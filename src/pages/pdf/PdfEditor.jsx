import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { FileEdit, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFileSize } from '@/lib/imageUtils';
import { readFileAsArrayBuffer, applyPdfAnnotations, downloadBlob } from '@/lib/pdfCore';

const TOOLS = [
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'rect', label: 'Rect', icon: '▭' },
  { id: 'circle', label: 'Circle', icon: '○' },
  { id: 'line', label: 'Line', icon: '╱' },
  { id: 'highlight', label: 'Highlight', icon: '▌' },
  { id: 'pen', label: 'Pen', icon: '✏' },
];

export default function PdfEditor() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [tool, setTool] = useState('text');
  const [annotations, setAnnotations] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [fontSize, setFontSize] = useState(16);
  const [color, setColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const handleFiles = async (files) => {
    const f = files[0];
    if (!f?.name.toLowerCase().endsWith('.pdf')) return;
    setFile(f);
    setAnnotations([]);
    setResults([]);
    setLoading(true);

    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    const ab = await readFileAsArrayBuffer(f);
    const pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
    const pageList = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pageList.push({ dataUrl: canvas.toDataURL(), width: viewport.width, height: viewport.height });
    }

    setPages(pageList);
    setCurrentPage(0);
    setLoading(false);
  };

  const renderOverlay = useCallback(() => {
    if (!overlayRef.current || !pages[currentPage]) return;
    const canvas = overlayRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageAnns = annotations.filter(a => a.pageIndex === currentPage);
    for (const ann of pageAnns) {
      ctx.save();
      ctx.globalAlpha = ann.opacity || 1;
      ctx.strokeStyle = ann.color || '#000';
      ctx.fillStyle = ann.color || '#000';
      ctx.lineWidth = ann.strokeWidth || 2;

      if (ann.type === 'text') {
        ctx.font = `${ann.fontSize || 16}px Arial`;
        ctx.fillText(ann.text || '', ann.x, ann.y);
      } else if (ann.type === 'rect') {
        ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
      } else if (ann.type === 'circle') {
        ctx.beginPath();
        ctx.ellipse(ann.x + ann.width / 2, ann.y + ann.height / 2, ann.width / 2, ann.height / 2, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ann.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(ann.x, ann.y);
        ctx.lineTo(ann.x + ann.width, ann.y + ann.height);
        ctx.stroke();
      } else if (ann.type === 'highlight') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
      } else if (ann.type === 'pen' && ann.points) {
        ctx.beginPath();
        ann.points.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
      }
      ctx.restore();
    }
  }, [annotations, currentPage, pages]);

  useEffect(() => { renderOverlay(); }, [renderOverlay]);

  const getCanvasPos = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleMouseDown = (e) => {
    const pos = getCanvasPos(e);
    setDrawing(true);
    setDrawStart(pos);
    if (tool === 'text') {
      if (!textInput) return;
      setAnnotations(prev => [...prev, { type: 'text', pageIndex: currentPage, x: pos.x, y: pos.y, text: textInput, fontSize, color, opacity }]);
    } else if (tool === 'pen') {
      setCurrentPath([pos]);
    }
  };

  const handleMouseMove = (e) => {
    if (!drawing || !drawStart) return;
    const pos = getCanvasPos(e);
    if (tool === 'pen') {
      setCurrentPath(prev => [...prev, pos]);
      // Draw live pen stroke
      const ctx = overlayRef.current.getContext('2d');
      const pts = [...currentPath, pos];
      renderOverlay();
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = opacity;
      ctx.beginPath();
      pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
      ctx.stroke();
      ctx.restore();
    } else if (['rect', 'circle', 'line', 'highlight'].includes(tool)) {
      renderOverlay();
      const ctx = overlayRef.current.getContext('2d');
      ctx.save();
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = tool === 'highlight' ? 0.35 : opacity;
      const w = pos.x - drawStart.x;
      const h = pos.y - drawStart.y;
      if (tool === 'rect') ctx.strokeRect(drawStart.x, drawStart.y, w, h);
      else if (tool === 'highlight') { ctx.fillStyle = '#ffff00'; ctx.fillRect(drawStart.x, drawStart.y, w, h); }
      else if (tool === 'circle') { ctx.beginPath(); ctx.ellipse(drawStart.x + w / 2, drawStart.y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      else if (tool === 'line') { ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y); ctx.lineTo(pos.x, pos.y); ctx.stroke(); }
      ctx.restore();
    }
  };

  const handleMouseUp = (e) => {
    if (!drawing) return;
    const pos = getCanvasPos(e);
    setDrawing(false);
    if (tool === 'pen' && currentPath.length > 1) {
      setAnnotations(prev => [...prev, { type: 'pen', pageIndex: currentPage, points: currentPath, color, strokeWidth, opacity }]);
      setCurrentPath([]);
    } else if (['rect', 'circle', 'line', 'highlight'].includes(tool)) {
      const w = pos.x - drawStart.x;
      const h = pos.y - drawStart.y;
      if (Math.abs(w) > 3 || Math.abs(h) > 3) {
        setAnnotations(prev => [...prev, { type: tool, pageIndex: currentPage, x: drawStart.x, y: drawStart.y, width: w, height: h, color, strokeWidth, opacity }]);
      }
    }
    setDrawStart(null);
  };

  const undo = () => {
    const pageAnns = annotations.filter(a => a.pageIndex === currentPage);
    if (!pageAnns.length) return;
    const lastIdx = annotations.lastIndexOf(pageAnns[pageAnns.length - 1]);
    setAnnotations(prev => prev.filter((_, i) => i !== lastIdx));
  };

  const exportPdf = async () => {
    setStatus('processing');
    setProgress(30);
    const blob = await applyPdfAnnotations(file, annotations);
    setProgress(100);
    setResults([{ blob, name: file.name.replace('.pdf', '_edited.pdf'), size: blob.size }]);
    setStatus('done');
  };

  const page = pages[currentPage];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="PDF Editor" description="Add text, shapes, drawings, and annotations" icon={FileEdit} />

        {!file ? (
          <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF to edit" />
        ) : loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">Loading PDF pages...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
              <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
                <div className="grid grid-cols-3 gap-1.5">
                  {TOOLS.map(t => (
                    <Button key={t.id} variant={tool === t.id ? 'default' : 'outline'} size="sm"
                      className="text-xs flex flex-col h-auto py-2" onClick={() => setTool(t.id)}>
                      <span className="text-base">{t.icon}</span>
                      <span>{t.label}</span>
                    </Button>
                  ))}
                </div>

                {tool === 'text' && (
                  <div className="space-y-2">
                    <Label className="text-xs">Text to add</Label>
                    <Input value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Type text..." className="text-sm" />
                    <div className="space-y-1">
                      <Label className="text-xs">Font size: {fontSize}px</Label>
                      <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={8} max={72} />
                    </div>
                  </div>
                )}

                {['rect', 'circle', 'line', 'pen'].includes(tool) && (
                  <div className="space-y-2">
                    <Label className="text-xs">Stroke width: {strokeWidth}px</Label>
                    <Slider value={[strokeWidth]} onValueChange={([v]) => setStrokeWidth(v)} min={1} max={20} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs">Color</Label>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Opacity: {Math.round(opacity * 100)}%</Label>
                  <Slider value={[opacity * 100]} onValueChange={([v]) => setOpacity(v / 100)} min={10} max={100} />
                </div>

                <Button variant="outline" size="sm" className="w-full text-xs" onClick={undo}>↩ Undo Last</Button>
              </div>

              <div className="space-y-2">
                <ProgressBar progress={progress} status={status} />
                <Button onClick={exportPdf} disabled={status === 'processing'} className="w-full rounded-xl">
                  <Download className="w-4 h-4 mr-1" /> Export PDF
                </Button>
              </div>

              <ResultsList results={results} title="Edited PDF" />
            </div>

            {/* Canvas area */}
            <div className="lg:col-span-3 order-1 lg:order-2 space-y-3">
              {/* Page nav */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">Page {currentPage + 1} of {pages.length}</span>
                <Button variant="outline" size="sm" disabled={currentPage === pages.length - 1} onClick={() => setCurrentPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {page && (
                <div className="relative border border-border/50 rounded-xl overflow-hidden bg-white" style={{ width: '100%' }}>
                  <img src={page.dataUrl} alt={`Page ${currentPage + 1}`} className="w-full block pointer-events-none" />
                  <canvas ref={overlayRef} width={page.width} height={page.height}
                    className={`absolute inset-0 w-full h-full ${tool === 'text' ? 'cursor-text' : tool === 'pen' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => { if (drawing) handleMouseUp({ clientX: 0, clientY: 0 }); }}
                    style={{ touchAction: 'none' }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}