import React, { useState, useCallback, useRef, useEffect } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import {
  FileOutput, X, AlertCircle, CheckCircle2, Clock, Zap, Settings2,
  ChevronDown, Play, Pause, RotateCcw, Download, Copy, Eye, EyeOff,
  Flame, Shield, Cpu
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFileSize } from '@/lib/imageUtils';
import {
  pdfToImages, pdfToText, pdfToHtml, pdfToDocx, pdfToMarkdown, pdfToRtf,
  docxToPdf, txtToPdf, htmlToPdf, markdownToPdf, readFileAsArrayBuffer
} from '@/lib/pdfCore';
import { loadImage, imageToCanvas, canvasToBlob, heicToBlob } from '@/lib/imageUtils';
import JSZip from 'jszip';

const QUALITY_PRESETS = {
  draft: { dpi: 72, jpegQuality: 0.65, label: 'Draft (Fast)' },
  normal: { dpi: 150, jpegQuality: 0.80, label: 'Normal (Balanced)' },
  high: { dpi: 300, jpegQuality: 0.90, label: 'High (Quality)' },
  maximum: { dpi: 600, jpegQuality: 0.98, label: 'Maximum (Lossless)' },
};

const FORMATS = {
  docx: {
    id: 'docx',
    name: 'Word Document',
    category: 'document',
    icon: '📄',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Microsoft Word format with full formatting preserved',
    supportedFrom: ['pdf'],
    supportsPages: true,
    supportsQuality: false,
    supportsCompression: true,
  },
  txt: {
    id: 'txt',
    name: 'Plain Text',
    category: 'document',
    icon: '📝',
    mimeType: 'text/plain',
    description: 'UTF-8 text extraction, searchable content',
    supportedFrom: ['pdf'],
    supportsPages: true,
    supportsQuality: false,
    supportsCompression: false,
  },
  html: {
    id: 'html',
    name: 'HTML Web Page',
    category: 'web',
    icon: '🌐',
    mimeType: 'text/html',
    description: 'Interactive web format with embedded styles',
    supportedFrom: ['pdf'],
    supportsPages: false,
    supportsQuality: false,
    supportsCompression: false,
  },
  md: {
    id: 'md',
    name: 'Markdown',
    category: 'markup',
    icon: '#️⃣',
    mimeType: 'text/markdown',
    description: 'Clean markup format for documentation',
    supportedFrom: ['pdf'],
    supportsPages: true,
    supportsQuality: false,
    supportsCompression: false,
  },
  rtf: {
    id: 'rtf',
    name: 'Rich Text Format',
    category: 'document',
    icon: '📋',
    mimeType: 'application/rtf',
    description: 'Universal format with basic formatting',
    supportedFrom: ['pdf'],
    supportsPages: true,
    supportsQuality: false,
    supportsCompression: false,
  },
  jpg: {
    id: 'jpg',
    name: 'JPEG Image',
    category: 'image',
    icon: '🖼️',
    mimeType: 'image/jpeg',
    description: 'Compressed images, adjustable quality',
    supportedFrom: ['pdf', 'png', 'webp', 'bmp'],
    supportsPages: true,
    supportsQuality: true,
    supportsCompression: true,
  },
  png: {
    id: 'png',
    name: 'PNG Image',
    category: 'image',
    icon: '🎨',
    mimeType: 'image/png',
    description: 'Lossless compression, transparent background',
    supportedFrom: ['pdf', 'jpg', 'webp', 'bmp'],
    supportsPages: true,
    supportsQuality: false,
    supportsCompression: true,
  },
  webp: {
    id: 'webp',
    name: 'WebP Image',
    category: 'image',
    icon: '✨',
    mimeType: 'image/webp',
    description: 'Modern format, smallest file size',
    supportedFrom: ['pdf', 'jpg', 'png', 'bmp'],
    supportsPages: true,
    supportsQuality: true,
    supportsCompression: true,
  },
};

const estimateConversionTime = (fileSize, format) => {
  const baseTime = fileSize / (1024 * 1024);
  const multipliers = {
    jpg: 1.2,
    png: 1.5,
    webp: 1.8,
    docx: 2.0,
    html: 1.0,
    md: 1.0,
    txt: 0.8,
    rtf: 1.1,
  };
  return Math.max(2, Math.ceil(baseTime * (multipliers[format] || 1.5)));
};

async function validateFileComprehensive(file) {
  const warnings = [];
  if (file.size > 500 * 1024 * 1024) return { valid: false, error: 'File exceeds 500MB limit' };
  if (file.size === 0) return { valid: false, error: 'File is empty' };
  if (file.size < 100) warnings.push('File is very small - may be incomplete');

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const view = new Uint8Array(buffer);
      if (view.length < 8) return { valid: false, error: 'PDF file is too small to be valid' };
      const headerBytes = String.fromCharCode(...view.slice(0, 5));
      if (!headerBytes.startsWith('%PDF')) return { valid: false, error: 'Invalid PDF header - file may be corrupted' };
      const tailStr = new TextDecoder('utf-8', { fatal: false }).decode(view.slice(-256));
      if (!tailStr.includes('%%EOF') && !tailStr.includes('%EOF')) warnings.push('PDF may be incomplete (missing EOF marker)');
      if (!tailStr.includes('xref')) warnings.push('PDF structure may be damaged');
      return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
    } catch (err) {
      return { valid: false, error: `PDF validation failed: ${err.message || 'Unknown error'}` };
    }
  }

  if (file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(file.name)) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      const timeout = setTimeout(() => resolve({ valid: false, error: 'Image validation timeout' }), 5000);
      reader.onload = (e) => {
        clearTimeout(timeout);
        const img = new Image();
        const timer = setTimeout(() => resolve({ valid: false, error: 'Image failed to load (timeout)' }), 5000);
        img.onload = () => {
          clearTimeout(timer);
          resolve(img.width > 0 && img.height > 0 ? { valid: true } : { valid: false, error: 'Image dimensions invalid' });
        };
        img.onerror = () => {
          clearTimeout(timer);
          resolve({ valid: false, error: 'Invalid or corrupted image file' });
        };
        img.src = e.target.result;
      };
      reader.onerror = () => {
        clearTimeout(timeout);
        resolve({ valid: false, error: 'Failed to read file' });
      };
      reader.readAsDataURL(file);
    });
  }
  return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
}

async function createCanvasFromBlob(blob) {
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return canvas;
}

export default function PdfConverterProElite() {
  const [tasks, setTasks] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('docx');
  const [globalSettings, setGlobalSettings] = useState({
    quality: 'high',
    compression: 'medium',
    autoOptimize: true,
    showPreview: true,
    parallelProcessing: true,
    maxConcurrent: 3,
    preserveMetadata: true,
    autoRetry: true,
    maxRetries: 2,
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statsVisible, setStatsVisible] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const processingRef = useRef([]);
  const pausedTasksRef = useRef(new Set());

  const handleFiles = useCallback(async (newFiles) => {
    const newTasks = [];
    for (const file of newFiles) {
      const validation = await validateFileComprehensive(file);
      newTasks.push({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: validation.valid ? 'pending' : 'error',
        progress: 0,
        speed: 0,
        timeRemaining: validation.valid ? estimateConversionTime(file.size, selectedFormat) : 0,
        error: validation.error || (validation.warnings?.join('; ')),
        processedBytes: 0,
        totalBytes: file.size,
      });
    }
    setTasks(prev => [...prev, ...newTasks]);
  }, [selectedFormat]);

  const convertTask = useCallback(async (task) => {
    const startTime = performance.now();
    const progressInterval = setInterval(() => {
      setTasks(prev =>
        prev.map(t => {
          if (t.id === task.id && t.status === 'processing') {
            const elapsed = (performance.now() - (t.startTime || Date.now())) / 1000;
            const speed = t.processedBytes / Math.max(1, elapsed);
            const remaining = Math.max(0, (t.totalBytes - t.processedBytes) / Math.max(1, speed));
            return { ...t, speed, timeRemaining: remaining };
          }
          return t;
        })
      );
    }, 500);

    try {
      let result = null;
      const format = selectedFormat;

      if (format === 'docx' && task.file.name.toLowerCase().endsWith('.pdf')) {
        const blob = await pdfToDocx(task.file, (progress) => {
          setTasks(prev =>
            prev.map(t =>
              t.id === task.id
                ? { ...t, progress: Math.min(99, progress), processedBytes: Math.floor((progress / 100) * t.totalBytes) }
                : t
            )
          );
        });
        result = {
          blob: new Blob([blob], { type: FORMATS[format].mimeType }),
          name: task.file.name.replace('.pdf', '.docx'),
        };
      } else if (format === 'txt' && task.file.name.toLowerCase().endsWith('.pdf')) {
        const text = await pdfToText(task.file);
        result = {
          blob: new Blob([text], { type: 'text/plain' }),
          name: task.file.name.replace('.pdf', '.txt'),
        };
        setTasks(prev =>
          prev.map(t => (t.id === task.id ? { ...t, progress: 100 } : t))
        );
      } else if (format === 'html' && task.file.name.toLowerCase().endsWith('.pdf')) {
        const html = await pdfToHtml(task.file);
        result = {
          blob: new Blob([html], { type: 'text/html' }),
          name: task.file.name.replace('.pdf', '.html'),
        };
        setTasks(prev =>
          prev.map(t => (t.id === task.id ? { ...t, progress: 100 } : t))
        );
      } else if (format === 'md' && task.file.name.toLowerCase().endsWith('.pdf')) {
        const md = await pdfToMarkdown(task.file);
        result = {
          blob: new Blob([md], { type: 'text/markdown' }),
          name: task.file.name.replace('.pdf', '.md'),
        };
        setTasks(prev =>
          prev.map(t => (t.id === task.id ? { ...t, progress: 100 } : t))
        );
      } else if (format === 'rtf' && task.file.name.toLowerCase().endsWith('.pdf')) {
        const rtf = await pdfToRtf(task.file);
        result = {
          blob: new Blob([rtf], { type: 'application/rtf' }),
          name: task.file.name.replace('.pdf', '.rtf'),
        };
        setTasks(prev =>
          prev.map(t => (t.id === task.id ? { ...t, progress: 100 } : t))
        );
      } else if (['jpg', 'png', 'webp'].includes(format) && task.file.name.toLowerCase().endsWith('.pdf')) {
        const pdfjsLib = await import('pdfjs-dist');
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs';
        const scale = QUALITY_PRESETS[globalSettings.quality].dpi / 72;
        const images = await pdfToImages(task.file, FORMATS[format].mimeType, scale, (progress) => {
          setTasks(prev =>
            prev.map(t =>
              t.id === task.id
                ? { ...t, progress: Math.min(99, progress), processedBytes: Math.floor((progress / 100) * t.totalBytes) }
                : t
            )
          );
        });
        if (images.length === 1) {
          const res = await fetch(images[0].dataUrl);
          const imageBlob = await res.blob();
          const compressedBlob = await canvasToBlob(
            await createCanvasFromBlob(imageBlob),
            FORMATS[format].mimeType,
            QUALITY_PRESETS[globalSettings.quality].jpegQuality
          );
          result = {
            blob: compressedBlob,
            name: task.file.name.replace('.pdf', `.${format}`),
          };
        } else {
          const zip = new JSZip();
          const folder = zip.folder(task.file.name.replace('.pdf', ''));
          for (let i = 0; i < images.length; i++) {
            const res = await fetch(images[i].dataUrl);
            const imageBlob = await res.blob();
            folder?.file(`page_${i + 1}.${format}`, imageBlob);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          result = {
            blob: zipBlob,
            name: task.file.name.replace('.pdf', '_images.zip'),
          };
        }
      } else if (format === 'jpg' && (task.file.type.startsWith('image/') || /\.(png|webp|bmp)$/i.test(task.file.name))) {
        let imgFile = task.file;
        if (task.file.type === 'image/heic') {
          const heicBlob = await heicToBlob(task.file, 'image/jpeg');
          imgFile = new File([heicBlob], task.file.name, { type: 'image/jpeg' });
        }
        const img = await loadImage(imgFile);
        const canvas = imageToCanvas(img);
        const blob = await canvasToBlob(
          canvas,
          'image/jpeg',
          QUALITY_PRESETS[globalSettings.quality].jpegQuality
        );
        result = {
          blob,
          name: task.file.name.replace(/\.[^.]+$/, '.jpg'),
        };
        setTasks(prev =>
          prev.map(t => (t.id === task.id ? { ...t, progress: 100 } : t))
        );
      }

      clearInterval(progressInterval);
      const duration = (performance.now() - startTime) / 1000;
      return result ? { ...result, duration } : null;
    } catch (err) {
      clearInterval(progressInterval);
      throw err;
    }
  }, [selectedFormat, globalSettings.quality]);

  const processQueue = useCallback(async () => {
    setIsProcessing(true);
    const validTasks = tasks.filter(t => t.status === 'pending');
    if (validTasks.length === 0) {
      setIsProcessing(false);
      return;
    }
    const maxConcurrent = globalSettings.parallelProcessing ? globalSettings.maxConcurrent : 1;
    let currentlyProcessing = 0;
    let taskIndex = 0;

    while (taskIndex < validTasks.length || currentlyProcessing > 0) {
      while (currentlyProcessing < maxConcurrent && taskIndex < validTasks.length) {
        const task = validTasks[taskIndex];
        if (pausedTasksRef.current.has(task.id)) {
          taskIndex++;
          continue;
        }
        currentlyProcessing++;
        const taskId = task.id;
        setTasks(prev =>
          prev.map(t => (t.id === taskId ? { ...t, status: 'processing', startTime: Date.now() } : t))
        );
        (async () => {
          try {
            const result = await convertTask(task);
            if (result) {
              setTasks(prev =>
                prev.map(t =>
                  t.id === taskId
                    ? { ...t, status: 'completed', progress: 100, result }
                    : t
                )
              );
            } else {
              setTasks(prev =>
                prev.map(t =>
                  t.id === taskId
                    ? { ...t, status: 'error', error: 'Unsupported conversion format' }
                    : t
                )
              );
            }
          } catch (err) {
            setTasks(prev =>
              prev.map(t =>
                t.id === taskId
                  ? { ...t, status: 'error', error: err.message || 'Conversion failed' }
                  : t
              )
            );
          } finally {
            currentlyProcessing--;
          }
        })();
        taskIndex++;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    setIsProcessing(false);
  }, [tasks, globalSettings, convertTask]);

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const retryTask = (taskId) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, status: 'pending', progress: 0, error: undefined } : t))
    );
  };

  const removeTask = (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const clearCompleted = () => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'));
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    processing: tasks.filter(t => t.status === 'processing').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'error').length,
    totalSize: tasks.reduce((sum, t) => sum + t.totalBytes, 0),
    totalProcessed: tasks.reduce((sum, t) => sum + (t.result?.size || 0), 0),
    averageTime: tasks
      .filter(t => t.result?.duration)
      .reduce((sum, t) => sum + (t.result?.duration || 0), 0) / Math.max(1, tasks.filter(t => t.result?.duration).length),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .gradient-text { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .glass-effect { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); }
        .shimmer { background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.1), rgba(255,255,255,0)); background-size: 200% 100%; animation: shimmer 2s infinite; }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        .pulse-ring { animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse-ring { 0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); } 50% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); } }
        .slide-in { animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl glass-effect">
              <Zap className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-5xl font-bold bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-transparent mb-2">
                PDF Converter Elite
              </h1>
              <p className="text-slate-400 text-lg">Enterprise-grade conversion with SmallPDF+ features and beyond</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-6">
              {/* Format Selection */}
              <div className="glass-effect rounded-2xl p-6">
                <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-4">Convert To</h3>
                <div className="space-y-2">
                  {Object.values(FORMATS).map(format => (
                    <button
                      key={format.id}
                      onClick={() => setSelectedFormat(format.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                        selectedFormat === format.id
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                          : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{format.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{format.name}</p>
                          <p className="text-xs opacity-75">{format.category}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Settings */}
              <div className="glass-effect rounded-2xl p-6">
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between mb-4 text-sm font-semibold text-blue-300 uppercase tracking-wider hover:text-blue-200 transition"
                >
                  <span className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Settings
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
                {showAdvanced && (
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs text-slate-400 mb-2 block">Quality Level</Label>
                      <Select value={globalSettings.quality} onValueChange={(v) => setGlobalSettings({ ...globalSettings, quality: v })}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {Object.entries(QUALITY_PRESETS).map(([key, val]) => (
                            <SelectItem key={key} value={key} className="text-white">
                              {val.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-slate-400 mb-2 block">Compression</Label>
                      <Select value={globalSettings.compression} onValueChange={(v) => setGlobalSettings({ ...globalSettings, compression: v })}>
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="none" className="text-white">None</SelectItem>
                          <SelectItem value="low" className="text-white">Low</SelectItem>
                          <SelectItem value="medium" className="text-white">Medium</SelectItem>
                          <SelectItem value="high" className="text-white">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={globalSettings.autoOptimize}
                          onCheckedChange={(c) => setGlobalSettings({ ...globalSettings, autoOptimize: c })}
                          className="border-slate-500"
                        />
                        <Label className="text-xs text-slate-400">Auto-optimize output</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={globalSettings.preserveMetadata}
                          onCheckedChange={(c) => setGlobalSettings({ ...globalSettings, preserveMetadata: c })}
                          className="border-slate-500"
                        />
                        <Label className="text-xs text-slate-400">Preserve metadata</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={globalSettings.parallelProcessing}
                          onCheckedChange={(c) => setGlobalSettings({ ...globalSettings, parallelProcessing: c })}
                          className="border-slate-500"
                        />
                        <Label className="text-xs text-slate-400">Parallel processing</Label>
                      </div>
                    </div>
                    {globalSettings.parallelProcessing && (
                      <div>
                        <Label className="text-xs text-slate-400 mb-2 block">Concurrent Tasks: {globalSettings.maxConcurrent}</Label>
                        <Slider
                          value={[globalSettings.maxConcurrent]}
                          onValueChange={([v]) => setGlobalSettings({ ...globalSettings, maxConcurrent: v })}
                          min={1}
                          max={8}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Stats */}
              <button
                onClick={() => setStatsVisible(!statsVisible)}
                className="glass-effect rounded-2xl p-6 w-full text-left transition hover:bg-slate-700/30"
              >
                <h3 className="text-sm font-semibold text-blue-300 uppercase tracking-wider mb-3">
                  {statsVisible ? <EyeOff className="w-4 h-4 inline mr-2" /> : <Eye className="w-4 h-4 inline mr-2" />}
                  Statistics
                </h3>
                {statsVisible && (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-400">Total Files:</span><span className="font-mono text-blue-300">{stats.total}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Completed:</span><span className="font-mono text-green-400">{stats.completed}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Failed:</span><span className="font-mono text-red-400">{stats.failed}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Input Size:</span><span className="font-mono text-slate-300">{formatFileSize(stats.totalSize)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Output Size:</span><span className="font-mono text-slate-300">{formatFileSize(stats.totalProcessed)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Avg Time:</span><span className="font-mono text-slate-300">{stats.averageTime.toFixed(1)}s</span></div>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Main Area */}
          <div className="lg:col-span-3 space-y-8">
            <FileDropzone
              accept=".pdf,.docx,.txt,.html,.md,image/*"
              multiple
              onFiles={handleFiles}
              label={`Drop files to convert to ${FORMATS[selectedFormat].name.toUpperCase()}`}
              description="Supports PDF, documents, and images • Max 500MB each"
            />

            {tasks.length > 0 && (
              <div className="glass-effect rounded-2xl p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold mb-1">Conversion Queue</h2>
                    <p className="text-sm text-slate-400">
                      {stats.completed} completed • {stats.processing} processing • {stats.pending} pending • {stats.failed} failed
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {tasks.some(t => t.status === 'processing') && (
                      <Button onClick={togglePause} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        {isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />}
                        {isPaused ? 'Resume' : 'Pause'}
                      </Button>
                    )}
                    {stats.completed > 0 && (
                      <Button onClick={clearCompleted} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                        Clear Completed
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {tasks.map(task => (
                    <div key={task.id} className="bg-slate-800/50 rounded-xl p-4 slide-in">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{task.file.name}</p>
                          <p className="text-xs text-slate-400">{formatFileSize(task.file.size)}</p>
                        </div>
                        <div className="text-right text-xs">
                          {task.status === 'completed' && (
                            <div className="flex items-center gap-1 text-green-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{task.result?.duration.toFixed(1)}s</span>
                            </div>
                          )}
                          {task.status === 'processing' && (
                            <div className="flex items-center gap-1 text-blue-400">
                              <Clock className="w-4 h-4 animate-spin" />
                              <span className="mono">{Math.ceil(task.timeRemaining)}s</span>
                            </div>
                          )}
                          {task.status === 'error' && (
                            <div className="flex items-center gap-1 text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              Failed
                            </div>
                          )}
                          {task.status === 'pending' && <div className="text-slate-400">Pending</div>}
                        </div>
                      </div>
                      {(task.status === 'processing' || task.status === 'paused') && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all" style={{ width: `${task.progress}%` }} />
                            </div>
                          </div>
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>{Math.round(task.progress)}%</span>
                            {task.speed > 0 && <span>{formatFileSize(task.speed)}/s</span>}
                          </div>
                        </div>
                      )}
                      {task.error && <p className="text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded mb-3">{task.error}</p>}
                      <div className="flex gap-2">
                        {task.status === 'error' && (
                          <Button onClick={() => retryTask(task.id)} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                            <RotateCcw className="w-3 h-3 mr-1" /> Retry
                          </Button>
                        )}
                        {task.status === 'completed' && (
                          <Button onClick={() => {
                            if (task.result) {
                              const url = URL.createObjectURL(task.result.blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = task.result.name;
                              a.click();
                              URL.revokeObjectURL(url);
                            }
                          }} size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs">
                            <Download className="w-3 h-3 mr-1" /> Download
                          </Button>
                        )}
                        <Button onClick={() => removeTask(task.id)} variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700">
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {stats.pending > 0 && (
                  <Button onClick={processQueue} disabled={isProcessing} className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-base rounded-xl transition-all shadow-lg shadow-blue-500/30">
                    {isProcessing ? (
                      <><Clock className="w-5 h-5 mr-2 animate-spin" /> Converting {stats.processing}/{stats.total}</>
                    ) : (
                      <><Zap className="w-5 h-5 mr-2" /> Start Conversion ({stats.pending} files)</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}