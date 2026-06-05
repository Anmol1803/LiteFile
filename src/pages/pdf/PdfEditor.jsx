import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ResultsList from '@/components/shared/ResultsList';
import {
  FileEdit, ChevronLeft, ChevronRight, Download, X, Undo2, Redo2,
  Type, Square, Circle, Minus, Highlighter, Pen, Trash2, ZoomIn, ZoomOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { readFileAsArrayBuffer, applyPdfAnnotations } from '@/lib/pdfCore';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

const TOOLS = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'rect', label: 'Rectangle', icon: Square },
  { id: 'circle', label: 'Circle', icon: Circle },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'highlight', label: 'Highlight', icon: Highlighter },
  { id: 'pen', label: 'Freehand', icon: Pen },
];

const renderAnnotationToCanvas = (ctx, annotation, scale = 1) => {
  ctx.save();
  ctx.globalAlpha = annotation.opacity || 1;
  ctx.strokeStyle = annotation.color || '#000';
  ctx.fillStyle = annotation.color || '#000';
  ctx.lineWidth = annotation.strokeWidth || 2;

  if (annotation.type === 'text') {
    const fontStyle = annotation.isBold ? 'bold ' : '';
    ctx.font = `${fontStyle}${annotation.fontSize}px ${annotation.fontFamily || 'Arial'}`;
    ctx.fillText(annotation.text, annotation.x * scale, annotation.y * scale);
  } else if (annotation.type === 'rect') {
    if (annotation.filled) {
      ctx.fillRect(annotation.x * scale, annotation.y * scale, annotation.width * scale, annotation.height * scale);
    } else {
      ctx.strokeRect(annotation.x * scale, annotation.y * scale, annotation.width * scale, annotation.height * scale);
    }
  } else if (annotation.type === 'circle') {
    ctx.beginPath();
    ctx.ellipse(
      (annotation.x + annotation.width / 2) * scale,
      (annotation.y + annotation.height / 2) * scale,
      Math.abs(annotation.width / 2) * scale,
      Math.abs(annotation.height / 2) * scale,
      0,
      0,
      Math.PI * 2
    );
    if (annotation.filled) ctx.fill();
    else ctx.stroke();
  } else if (annotation.type === 'line') {
    ctx.beginPath();
    ctx.moveTo(annotation.x * scale, annotation.y * scale);
    ctx.lineTo((annotation.x + annotation.width) * scale, (annotation.y + annotation.height) * scale);
    ctx.stroke();
  } else if (annotation.type === 'highlight') {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(annotation.x * scale, annotation.y * scale, annotation.width * scale, annotation.height * scale);
  } else if (annotation.type === 'pen' && annotation.points) {
    if (annotation.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(annotation.points[0].x * scale, annotation.points[0].y * scale);
      for (let i = 1; i < annotation.points.length; i++) {
        ctx.lineTo(annotation.points[i].x * scale, annotation.points[i].y * scale);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
};

const validatePdf = async (file) => {
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const view = new Uint8Array(buffer);
    if (view.length < 8) return false;
    const header = String.fromCharCode(...view.slice(0, 4));
    return header === '%PDF';
  } catch {
    return false;
  }
};

export default function PdfEditorPro() {
  const [state, setState] = useState({
    file: null,
    pages: [],
    currentPage: 0,
    annotations: [],
    history: [[]],
    historyIndex: 0,
    isLoading: false,
    error: null,
    exportStatus: 'idle',
    exportProgress: 0,
    results: [],
  });

  const [tool, setTool] = useState('text');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [isBold, setIsBold] = useState(false);
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [textInput, setTextInput] = useState('');
  const [zoom, setZoom] = useState(1);
  const [filled, setFilled] = useState(false);

  const overlayRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);

  const handleFiles = async (files) => {
    const file = files[0];
    if (!file?.name.toLowerCase().endsWith('.pdf')) {
      setState(prev => ({ ...prev, error: 'Please upload a valid PDF file' }));
      return;
    }

    const isValid = await validatePdf(file);
    if (!isValid) {
      setState(prev => ({ ...prev, error: 'PDF file appears to be corrupted or invalid' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null, file }));

    try {
      const pdfjsLib = await import('pdfjs-dist');
      // ✅ Correct worker URL for pdfjs-dist@6.0.227
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/build/pdf.worker.min.mjs';

      const buffer = await readFileAsArrayBuffer(file);
      const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
      const pageList = [];

      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        }).promise;

        pageList.push({
          dataUrl: canvas.toDataURL('image/png'),
          width: viewport.width,
          height: viewport.height,
        });
      }

      setState(prev => ({
        ...prev,
        pages: pageList,
        currentPage: 0,
        annotations: [],
        history: [[]],
        historyIndex: 0,
        isLoading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: `Failed to load PDF: ${err.message || 'Unknown error'}`,
      }));
    }
  };

  const renderOverlay = useCallback(() => {
    if (!overlayRef.current || !state.pages[state.currentPage]) return;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageAnnotations = state.annotations.filter(a => a.pageIndex === state.currentPage);
    for (const ann of pageAnnotations) {
      renderAnnotationToCanvas(ctx, ann, zoom);
    }
  }, [state.annotations, state.currentPage, state.pages, zoom]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay]);

  const getCanvasPos = (e) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  const addAnnotation = (annotation) => {
    setState(prev => {
      const newAnnotations = [...prev.annotations, annotation];
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(newAnnotations);
      return {
        ...prev,
        annotations: newAnnotations,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e);
    setDrawing(true);
    setDrawStart(pos);

    if (tool === 'text') {
      if (!textInput.trim()) {
        setState(prev => ({ ...prev, error: 'Please enter text first' }));
        return;
      }
      addAnnotation({
        type: 'text',
        pageIndex: state.currentPage,
        x: pos.x,
        y: pos.y,
        text: textInput,
        fontSize,
        color,
        opacity,
        fontFamily,
        isBold,
      });
      setTextInput('');
    } else if (tool === 'pen') {
      setCurrentPath([pos]);
    }
  };

  const handleMouseMove = (e) => {
    if (!drawing || !drawStart || !overlayRef.current) return;
    const pos = getCanvasPos(e);
    const ctx = overlayRef.current.getContext('2d');

    if (tool === 'pen') {
      setCurrentPath(prev => [...prev, pos]);
      renderOverlay();

      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const points = [...currentPath, pos];
      if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x * zoom, points[0].y * zoom);
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x * zoom, points[i].y * zoom);
        }
        ctx.stroke();
      }
      ctx.restore();
    } else if (['rect', 'circle', 'line', 'highlight'].includes(tool)) {
      renderOverlay();

      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = tool === 'highlight' ? 0.35 : opacity;

      const w = (pos.x - drawStart.x) * zoom;
      const h = (pos.y - drawStart.y) * zoom;

      if (tool === 'rect') {
        if (filled) ctx.fillRect(drawStart.x * zoom, drawStart.y * zoom, w, h);
        else ctx.strokeRect(drawStart.x * zoom, drawStart.y * zoom, w, h);
      } else if (tool === 'highlight') {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(drawStart.x * zoom, drawStart.y * zoom, w, h);
      } else if (tool === 'circle') {
        ctx.beginPath();
        ctx.ellipse(
          (drawStart.x + (pos.x - drawStart.x) / 2) * zoom,
          (drawStart.y + (pos.y - drawStart.y) / 2) * zoom,
          Math.abs(w / 2),
          Math.abs(h / 2),
          0,
          0,
          Math.PI * 2
        );
        if (filled) ctx.fill();
        else ctx.stroke();
      } else if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(drawStart.x * zoom, drawStart.y * zoom);
        ctx.lineTo(pos.x * zoom, pos.y * zoom);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const handleMouseUp = (e) => {
    if (!drawing || !drawStart) return;
    const pos = getCanvasPos(e);
    setDrawing(false);

    if (tool === 'pen' && currentPath.length > 1) {
      addAnnotation({
        type: 'pen',
        pageIndex: state.currentPage,
        points: currentPath,
        color,
        strokeWidth,
        opacity,
      });
      setCurrentPath([]);
    } else if (['rect', 'circle', 'line', 'highlight'].includes(tool)) {
      const w = pos.x - drawStart.x;
      const h = pos.y - drawStart.y;
      if (Math.abs(w) > 2 || Math.abs(h) > 2) {
        addAnnotation({
          type: tool,
          pageIndex: state.currentPage,
          x: drawStart.x,
          y: drawStart.y,
          width: w,
          height: h,
          color,
          strokeWidth,
          opacity,
          filled: tool !== 'highlight' && filled,
        });
      }
    }
    setDrawStart(null);
  };

  const undo = () => {
    setState(prev => {
      if (prev.historyIndex > 0) {
        const newIndex = prev.historyIndex - 1;
        return { ...prev, historyIndex: newIndex, annotations: prev.history[newIndex] };
      }
      return prev;
    });
  };

  const redo = () => {
    setState(prev => {
      if (prev.historyIndex < prev.history.length - 1) {
        const newIndex = prev.historyIndex + 1;
        return { ...prev, historyIndex: newIndex, annotations: prev.history[newIndex] };
      }
      return prev;
    });
  };

  const deleteLastAnnotation = () => {
    setState(prev => {
      const pageAnnotations = prev.annotations.filter(a => a.pageIndex === prev.currentPage);
      if (pageAnnotations.length === 0) return prev;
      const lastIdx = prev.annotations.lastIndexOf(pageAnnotations[pageAnnotations.length - 1]);
      const newAnnotations = prev.annotations.filter((_, i) => i !== lastIdx);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(newAnnotations);
      return {
        ...prev,
        annotations: newAnnotations,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  };

  const clearPage = () => {
    setState(prev => {
      const newAnnotations = prev.annotations.filter(a => a.pageIndex !== prev.currentPage);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(newAnnotations);
      return {
        ...prev,
        annotations: newAnnotations,
        history: newHistory,
        historyIndex: newHistory.length - 1,
      };
    });
  };

  const exportPdf = async () => {
    if (!state.file) return;
    setState(prev => ({ ...prev, exportStatus: 'processing', exportProgress: 0 }));
    try {
      setState(prev => ({ ...prev, exportProgress: 50 }));
      const blob = await applyPdfAnnotations(state.file, state.annotations);
      setState(prev => ({
        ...prev,
        exportProgress: 100,
        exportStatus: 'done',
        results: [
          {
            blob,
            name: state.file.name.replace('.pdf', '_annotated.pdf'),
            size: blob.size,
          },
        ],
      }));
      setTimeout(() => {
        setState(prev => ({ ...prev, exportStatus: 'idle' }));
      }, 3000);
    } catch (err) {
      setState(prev => ({
        ...prev,
        exportStatus: 'error',
        error: `Export failed: ${err.message || 'Unknown error'}`,
      }));
    }
  };

  const page = state.pages[state.currentPage];
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  if (!state.file) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <ToolHeader
            title="Pro PDF Editor"
            description="Advanced annotation, markup, and editing with corruption-free export"
            icon={FileEdit}
          />
          <FileDropzone
            accept=".pdf"
            onFiles={handleFiles}
            label="Drop a PDF to edit"
            description="Supports PDF files up to 500MB"
          />
          {state.error && (
            <div className="mt-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{state.error}</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader
          title="Pro PDF Editor"
          description="Advanced annotation, markup, and editing with corruption-free export"
          icon={FileEdit}
        />

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="xl:col-span-1 order-2 xl:order-1">
            <div className="sticky top-8 space-y-4">
              {/* Tools */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Annotation Tools</h3>
                <div className="grid grid-cols-3 gap-2">
                  {TOOLS.map(t => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTool(t.id)}
                        title={t.label}
                        className={`p-2 rounded-lg transition-all flex flex-col items-center justify-center ${
                          tool === t.id
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-xs mt-1 font-medium">{t.label.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settings */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 max-h-96 overflow-y-auto">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Settings</h3>

                {tool === 'text' && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Text Input</Label>
                      <Input
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        placeholder="Enter text..."
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Font Size: {fontSize}px</Label>
                      <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={8} max={72} step={1} />
                    </div>
                    <div>
                      <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Font Family</Label>
                      <Select value={fontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arial">Arial</SelectItem>
                          <SelectItem value="Helvetica">Helvetica</SelectItem>
                          <SelectItem value="Georgia">Georgia</SelectItem>
                          <SelectItem value="Courier">Courier</SelectItem>
                          <SelectItem value="Times New Roman">Times</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={isBold} onCheckedChange={c => setIsBold(c)} />
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Bold</Label>
                    </div>
                  </>
                )}

                {['rect', 'circle', 'line'].includes(tool) && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Stroke Width: {strokeWidth}px</Label>
                      <Slider value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} min={1} max={20} step={1} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={filled} onCheckedChange={c => setFilled(c)} />
                      <Label className="text-xs text-slate-600 dark:text-slate-400">Filled</Label>
                    </div>
                  </>
                )}

                {['pen', 'rect', 'circle', 'line'].includes(tool) && (
                  <>
                    <div>
                      <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Stroke Width: {strokeWidth}px</Label>
                      <Slider value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} min={1} max={20} step={1} />
                    </div>
                  </>
                )}

                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Color</Label>
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-full h-8 rounded cursor-pointer border border-slate-200 dark:border-slate-600"
                  />
                </div>

                <div>
                  <Label className="text-xs text-slate-600 dark:text-slate-400 mb-1 block">Opacity: {Math.round(opacity * 100)}%</Label>
                  <Slider
                    value={[opacity * 100]}
                    onValueChange={([v]) => setOpacity(v / 100)}
                    min={10}
                    max={100}
                    step={5}
                  />
                </div>
              </div>

              {/* History */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">History</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undo}
                    disabled={!canUndo}
                    className="flex-1"
                  >
                    <Undo2 className="w-4 h-4 mr-1" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={redo}
                    disabled={!canRedo}
                    className="flex-1"
                  >
                    <Redo2 className="w-4 h-4 mr-1" />
                    Redo
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={deleteLastAnnotation}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Last
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearPage}
                  className="w-full text-red-600 dark:text-red-400"
                >
                  <X className="w-4 h-4 mr-1" />
                  Clear Page
                </Button>
              </div>

              {/* Export */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                <Button
                  onClick={exportPdf}
                  disabled={state.exportStatus === 'processing'}
                  className="w-full rounded-lg h-10"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                {state.exportStatus === 'done' && (
                  <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Export successful!
                  </div>
                )}
                {state.error && (
                  <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    {state.error}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="xl:col-span-3 order-1 xl:order-2 space-y-4">
            {/* Page Navigation */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setState(prev => ({ ...prev, currentPage: Math.max(0, prev.currentPage - 1) }))}
                disabled={state.currentPage === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Page {state.currentPage + 1} of {state.pages.length}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setState(prev => ({ ...prev, currentPage: Math.min(state.pages.length - 1, prev.currentPage + 1) }))}
                disabled={state.currentPage === state.pages.length - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                  disabled={zoom <= 0.5}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                  disabled={zoom >= 2}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Canvas Area */}
            {page && (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg" style={{ aspectRatio: `${page.width}/${page.height}` }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: page.width, height: page.height }}>
                  <img
                    src={page.dataUrl}
                    alt={`Page ${state.currentPage + 1}`}
                    className="block pointer-events-none w-full"
                  />
                  <canvas
                    ref={overlayRef}
                    width={page.width}
                    height={page.height}
                    className={`absolute inset-0 w-full h-full ${
                      tool === 'text'
                        ? 'cursor-text'
                        : tool === 'pen'
                        ? 'cursor-crosshair'
                        : 'cursor-crosshair'
                    }`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => setDrawing(false)}
                    style={{ touchAction: 'none' }}
                  />
                </div>
              </div>
            )}

            {/* Results */}
            {state.results.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Ready to Download</h3>
                <ResultsList results={state.results} title="" />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}