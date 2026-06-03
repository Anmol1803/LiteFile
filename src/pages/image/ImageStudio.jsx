import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import AdjustPanel, { DEFAULT_ADJ } from '@/components/studio/AdjustPanel';
import FilterPanel from '@/components/studio/FilterPanel';
import TransformPanel from '@/components/studio/TransformPanel';
import DrawPanel from '@/components/studio/DrawPanel';
import WatermarkPanel from '@/components/studio/WatermarkPanel';
import ExportPanel from '@/components/studio/ExportPanel';
import BatchCompressPanel from '@/components/studio/BatchCompressPanel';
import { Layers, X, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  loadImage, imageToCanvas, canvasToBlob, applyFilters, applyPresetFilter,
  rotateCanvas, flipCanvas, cropCanvas, addTextWatermark,
  formatFileSize
} from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfCore';
import JSZip from 'jszip';

const DEFAULT_WM = { text: '', color: '#ffffff', opacity: 0.4, fontSize: 48, rotation: -30, position: 'Center', tiled: false };

export default function ImageStudio() {
  const [files, setFiles] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [img, setImg] = useState(null);

  // Edit state
  const [adjustments, setAdjustments] = useState(DEFAULT_ADJ);
  const [filter, setFilter] = useState('none');
  const [rotation, setRotation] = useState(0);
  const [flippedH, setFlippedH] = useState(false);
  const [flippedV, setFlippedV] = useState(false);
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [lockAspect, setLockAspect] = useState(true);
  const [cropRect, setCropRect] = useState(null);
  const [wm, setWm] = useState(DEFAULT_WM);
  const [wmApplied, setWmApplied] = useState(false);

  // Draw state
  const [drawTool, setDrawTool] = useState('pen');
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [drawSize, setDrawSize] = useState(4);
  const [textVal, setTextVal] = useState('');
  const [textSize, setTextSize] = useState(36);
  const [fontFamily, setFontFamily] = useState('Arial');

  // History
  const [history, setHistory] = useState([]);

  // UI state
  const [zoom, setZoom] = useState(1);
  const [procStatus, setProcStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [batchResults, setBatchResults] = useState([]);
  const [filterThumbs, setFilterThumbs] = useState({});

  const canvasRef = useRef(null);
  const drawLayerRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef(null);

  // Load image when file changes
  const loadFile = useCallback(async (file) => {
    const image = await loadImage(file);
    setImg(image);
    setAdjustments(DEFAULT_ADJ);
    setFilter('none');
    setRotation(0); setFlippedH(false); setFlippedV(false);
    setResizeW(image.naturalWidth); setResizeH(image.naturalHeight);
    setCropRect(null); setWmApplied(false); setWm(DEFAULT_WM);
    drawLayerRef.current = null;
    setHistory([]);
    setZoom(1);
    generateFilterThumbs(image);
  }, []);

  useEffect(() => {
    if (files[activeIdx]) loadFile(files[activeIdx]);
  }, [activeIdx, files, loadFile]);

  // Generate small filter thumbnails
  const generateFilterThumbs = async (image) => {
    const FILTER_IDS = ['none', 'vivid', 'warm', 'cool', 'hdr', 'cinematic', 'film', 'vintage', 'matte', 'sepia', 'bw', 'grayscale'];
    const thumbs = {};
    const smallCanvas = imageToCanvas(image, 80, Math.round(80 * image.naturalHeight / image.naturalWidth));
    for (const fid of FILTER_IDS) {
      const c = imageToCanvas(image, 80, Math.round(80 * image.naturalHeight / image.naturalWidth));
      const ctx = c.getContext('2d');
      ctx.drawImage(smallCanvas, 0, 0);
      if (fid !== 'none') applyPresetFilter(c, fid);
      thumbs[fid] = c.toDataURL('image/jpeg', 0.6);
    }
    setFilterThumbs(thumbs);
  };

  // Main render pipeline
  const buildCanvas = useCallback(() => {
    if (!img) return null;
    let canvas = imageToCanvas(img);
    // Apply adjustments
    const hasAdj = Object.entries(adjustments).some(([k, v]) => k === 'gamma' ? v !== 1 : v !== 0);
    if (hasAdj) applyFilters(canvas, adjustments);
    if (filter !== 'none') applyPresetFilter(canvas, filter);
    if (rotation !== 0) canvas = rotateCanvas(canvas, rotation);
    if (flippedH) canvas = flipCanvas(canvas, true);
    if (flippedV) canvas = flipCanvas(canvas, false);
    // Resize
    if (resizeW && resizeH && (resizeW !== canvas.width || resizeH !== canvas.height)) {
      const rc = document.createElement('canvas'); rc.width = resizeW; rc.height = resizeH;
      rc.getContext('2d').drawImage(canvas, 0, 0, resizeW, resizeH);
      canvas = rc;
    }
    // Crop
    if (cropRect) {
      canvas = cropCanvas(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    }
    // Watermark
    if (wmApplied && wm.text) {
      addTextWatermark(canvas, { text: wm.text, color: wm.color, opacity: wm.opacity, fontSize: wm.fontSize, rotation: wm.rotation, tiled: wm.tiled });
    }
    return canvas;
  }, [img, adjustments, filter, rotation, flippedH, flippedV, resizeW, resizeH, cropRect, wm, wmApplied]);

  const render = useCallback(() => {
    if (!canvasRef.current || !img) return;
    const srcCanvas = buildCanvas();
    if (!srcCanvas) return;
    const maxW = Math.min(900, (window.innerWidth - 340) * 0.98);
    const maxH = window.innerHeight - 240;
    const scale = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height, 1) * zoom;
    const dw = Math.round(srcCanvas.width * scale), dh = Math.round(srcCanvas.height * scale);
    const dc = canvasRef.current;
    dc.width = dw; dc.height = dh;
    dc.getContext('2d').drawImage(srcCanvas, 0, 0, dw, dh);
    if (drawLayerRef.current) {
      if (drawLayerRef.current.width !== dw || drawLayerRef.current.height !== dh) {
        const newLayer = document.createElement('canvas');
        newLayer.width = dw; newLayer.height = dh;
        newLayer.getContext('2d').drawImage(drawLayerRef.current, 0, 0, dw, dh);
        drawLayerRef.current = newLayer;
      }
      dc.getContext('2d').drawImage(drawLayerRef.current, 0, 0);
    }
  }, [img, buildCanvas, zoom]);

  useEffect(() => { render(); }, [render]);

  const pushHistory = () => {
    if (!canvasRef.current) return;
    const snapshot = canvasRef.current.toDataURL();
    setHistory(h => [...h.slice(-19), snapshot]);
  };

  const undo = () => {
    if (!history.length || !canvasRef.current) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    const img2 = new Image();
    img2.onload = () => { const ctx = canvasRef.current?.getContext('2d'); if (ctx) { ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height); ctx.drawImage(img2, 0, 0); } };
    img2.src = prev;
  };

  // Drawing
  const ensureDrawLayer = () => {
    if (!drawLayerRef.current && canvasRef.current) {
      drawLayerRef.current = document.createElement('canvas');
      drawLayerRef.current.width = canvasRef.current.width;
      drawLayerRef.current.height = canvasRef.current.height;
    }
  };

  const getCanvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const onMouseDown = (e) => {
    if (!['pen', 'brush', 'highlighter', 'eraser'].includes(drawTool)) return;
    pushHistory();
    drawingRef.current = true;
    ensureDrawLayer();
    lastPosRef.current = getCanvasPos(e);
  };

  const onMouseMove = (e) => {
    if (!drawingRef.current) return;
    const pos = getCanvasPos(e);
    const ctx = drawLayerRef.current.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = drawSize * 3;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawTool === 'highlighter' ? drawColor + '80' : drawColor;
      ctx.lineWidth = drawTool === 'brush' ? drawSize * 2.5 : drawSize;
      ctx.globalAlpha = drawTool === 'highlighter' ? 0.5 : 1;
    }
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    lastPosRef.current = pos;
    render();
  };

  const onMouseUp = () => { drawingRef.current = false; };

  const addText = () => {
    if (!textVal || !canvasRef.current) return;
    pushHistory();
    ensureDrawLayer();
    const ctx = drawLayerRef.current.getContext('2d');
    ctx.fillStyle = drawColor;
    ctx.font = `${textSize}px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(textVal, drawLayerRef.current.width / 2, drawLayerRef.current.height / 2);
    render();
    setTextVal('');
  };

  const applyWatermark = () => {
    setWmApplied(true);
  };

  // Export
  const handleExport = async ({ format, quality, targetBytes }) => {
    let srcCanvas = buildCanvas();
    if (!srcCanvas) return;
    // Merge draw layer
    if (drawLayerRef.current) {
      const merged = document.createElement('canvas');
      merged.width = srcCanvas.width; merged.height = srcCanvas.height;
      const mctx = merged.getContext('2d');
      mctx.drawImage(srcCanvas, 0, 0);
      const scaleX = srcCanvas.width / canvasRef.current.width;
      const scaleY = srcCanvas.height / canvasRef.current.height;
      const slW = Math.round(drawLayerRef.current.width * scaleX), slH = Math.round(drawLayerRef.current.height * scaleY);
      const scaledLayer = document.createElement('canvas'); scaledLayer.width = slW; scaledLayer.height = slH;
      scaledLayer.getContext('2d').drawImage(drawLayerRef.current, 0, 0, slW, slH);
      mctx.drawImage(scaledLayer, 0, 0);
      srcCanvas = merged;
    }

    const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const mime = mimeMap[format] || 'image/jpeg';
    const baseName = files[activeIdx]?.name.replace(/\.[^.]+$/, '') || 'image';

    if (targetBytes) {
      const r2 = await compressCanvasToTarget(srcCanvas, targetBytes, mime);
      if (r2.success) {
        downloadBlob(r2.blob, `${baseName}_compressed.${format}`);
        return { success: true };
      } else {
        downloadBlob(r2.minBlob, `${baseName}_best.${format}`);
        return { success: false, minSize: r2.minSize, requestedSize: targetBytes };
      }
    } else {
      const blob = await canvasToBlob(srcCanvas, mime, quality);
      downloadBlob(blob, `${baseName}_edited.${format}`);
      return { success: true };
    }
  };

  // Batch compress
  const batchCompress = async (targetBytes, quality, outputFormat) => {
    setProcStatus('processing'); setProgress(0); setBatchResults([]);
    const results = [];
    const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[outputFormat] || 'image/jpeg';
    for (let i = 0; i < files.length; i++) {
      setProgress(Math.round((i / files.length) * 100));
      const image = await loadImage(files[i]);
      const canvas = imageToCanvas(image);
      if (targetBytes) {
        const r = await compressCanvasToTarget(canvas, targetBytes, mime);
        const blob = r.success ? r.blob : r.minBlob;
        results.push({ blob, name: files[i].name.replace(/\.[^.]+$/, r.success ? `_compressed.${outputFormat}` : `_best.${outputFormat}`), originalSize: files[i].size, size: blob.size, warning: !r.success });
      } else {
        const blob = await canvasToBlob(canvas, mime, quality / 100);
        results.push({ blob, name: files[i].name.replace(/\.[^.]+$/, `_compressed.${outputFormat}`), originalSize: files[i].size, size: blob.size });
      }
    }
    setBatchResults(results);
    setProgress(100);
    setProcStatus('done');
  };

  const downloadBatchZip = async () => {
    if (batchResults.length === 1) { downloadBlob(batchResults[0].blob, batchResults[0].name); return; }
    const zip = new JSZip();
    batchResults.forEach(r => zip.file(r.name, r.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'compressed_images.zip');
  };

  const isDrawMode = ['pen', 'brush', 'highlighter', 'eraser'].includes(drawTool);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ToolHeader title="Image Studio" description="Professional image editor — adjust, filter, transform, draw, watermark, compress" icon={Layers} />

        {!files.length ? (
          <FileDropzone accept="image/*" multiple maxFiles={50} onFiles={(f) => setFiles(prev => [...prev, ...f])}
            label="Drop images to start editing" description="JPG, PNG, WEBP • Multiple files for batch processing • Drag, browse, or paste" />
        ) : (
          <div className="flex gap-4">
            {/* ── Left sidebar: tools ── */}
            <div className="w-72 shrink-0 space-y-3">
              <div className="p-3 rounded-xl bg-card border border-border/50">
                <Tabs defaultValue="adjust">
                  <TabsList className="grid w-full grid-cols-3 h-8 text-xs mb-3">
                    <TabsTrigger value="adjust" className="text-xs">Adjust</TabsTrigger>
                    <TabsTrigger value="filter" className="text-xs">Filter</TabsTrigger>
                    <TabsTrigger value="transform" className="text-xs">Transform</TabsTrigger>
                  </TabsList>
                  <TabsContent value="adjust">
                    <AdjustPanel adjustments={adjustments} onChange={setAdjustments} />
                  </TabsContent>
                  <TabsContent value="filter">
                    <FilterPanel filter={filter} onChange={setFilter} thumbnails={filterThumbs} />
                  </TabsContent>
                  <TabsContent value="transform">
                    <TransformPanel
                      img={img}
                      rotation={rotation} onRotation={setRotation}
                      flippedH={flippedH} flippedV={flippedV}
                      onFlipH={setFlippedH} onFlipV={setFlippedV}
                      cropRect={cropRect} onCropRect={setCropRect}
                      resizeW={resizeW} resizeH={resizeH}
                      onResize={(w, h) => { setResizeW(w); setResizeH(h); }}
                      lockAspect={lockAspect} onLockAspect={setLockAspect}
                    />
                  </TabsContent>
                </Tabs>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border/50">
                <Tabs defaultValue="draw">
                  <TabsList className="grid w-full grid-cols-2 h-8 mb-3">
                    <TabsTrigger value="draw" className="text-xs">Draw</TabsTrigger>
                    <TabsTrigger value="watermark" className="text-xs">Watermark</TabsTrigger>
                  </TabsList>
                  <TabsContent value="draw">
                    <DrawPanel drawTool={drawTool} onDrawTool={setDrawTool} color={drawColor} onColor={setDrawColor}
                      size={drawSize} onSize={setDrawSize} textVal={textVal} onTextVal={setTextVal}
                      textSize={textSize} onTextSize={setTextSize} fontFamily={fontFamily} onFontFamily={setFontFamily}
                      onAddText={addText} />
                  </TabsContent>
                  <TabsContent value="watermark">
                    <WatermarkPanel wm={wm} onChange={setWm} onApply={applyWatermark} />
                  </TabsContent>
                </Tabs>
              </div>
            </div>

            {/* ── Center: canvas ── */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* File strip - FIXED: no nested buttons */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {files.map((f, i) => (
                  <div key={i} className={`relative shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs text-center min-w-[70px] max-w-[90px] transition-colors cursor-pointer
                    ${activeIdx === i ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40'}`}
                    onClick={() => setActiveIdx(i)}>
                    <p className="truncate font-medium">{f.name.split('.')[0]}</p>
                    <p className="text-muted-foreground">{formatFileSize(f.size)}</p>
                    <div
                      role="button"
                      tabIndex={0}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); const nf = files.filter((_, idx) => idx !== i); setFiles(nf); if (activeIdx >= nf.length) setActiveIdx(Math.max(0, nf.length - 1)); }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </div>
                  </div>
                ))}
                <button onClick={() => { const el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*'; el.multiple = true; el.onchange = e => setFiles(p => [...p, ...Array.from(e.target.files)]); el.click(); }}
                  className="shrink-0 rounded-lg border-2 border-dashed border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-w-[50px]">
                  + Add
                </button>
              </div>

              {/* Canvas toolbar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setZoom(z => Math.max(0.25, z - 0.25))}>
                    <ZoomOut className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setZoom(z => Math.min(4, z + 0.25))}>
                    <ZoomIn className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setZoom(1)}>Fit</Button>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={undo} disabled={!history.length}>
                    <Undo2 className="w-3.5 h-3.5 mr-1" />Undo
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground"
                    onClick={() => { setAdjustments(DEFAULT_ADJ); setFilter('none'); setRotation(0); setFlippedH(false); setFlippedV(false); setCropRect(null); setWmApplied(false); drawLayerRef.current = null; setHistory([]); }}>
                    Reset All
                  </Button>
                </div>
                {img && <span className="text-xs text-muted-foreground">{img.naturalWidth}×{img.naturalHeight}px</span>}
              </div>

              {/* Canvas */}
              <div className="rounded-xl border border-border/50 bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] overflow-auto flex items-center justify-center min-h-[400px] p-4">
                {img ? (
                  <canvas ref={canvasRef}
                    className={`max-w-full shadow-xl ${isDrawMode ? 'cursor-crosshair' : 'cursor-default'}`}
                    onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
                    style={{ imageRendering: zoom > 2 ? 'pixelated' : 'auto' }}
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">Select a file to start editing</div>
                )}
              </div>
            </div>

            {/* ── Right sidebar: export ── */}
            <div className="w-64 shrink-0 space-y-3">
              <div className="p-3 rounded-xl bg-card border border-border/50">
                <ExportPanel onExport={handleExport} processing={false} />
              </div>

              {/* Batch compress */}
              <div className="p-3 rounded-xl bg-card border border-border/50">
                <BatchCompressPanel
                  fileCount={files.length}
                  onCompress={batchCompress}
                  status={procStatus}
                  progress={progress}
                  results={batchResults}
                  onDownloadZip={downloadBatchZip}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Internal helper: compress canvas to target ──────────────────────────────
async function compressCanvasToTarget(canvas, targetBytes, format = 'image/jpeg') {
  let lo = 0.01, hi = 1.0, bestBlob = null;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const blob = await new Promise(res => canvas.toBlob(res, format, mid));
    if (blob.size <= targetBytes) { bestBlob = blob; lo = mid; }
    else hi = mid;
  }
  if (bestBlob) return { success: true, blob: bestBlob };

  for (let scale = 0.85; scale >= 0.05; scale -= 0.05) {
    const sw = Math.max(1, Math.round(canvas.width * scale)), sh = Math.max(1, Math.round(canvas.height * scale));
    const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
    sc.getContext('2d').drawImage(canvas, 0, 0, sw, sh);
    for (let q = 0.65; q >= 0.05; q -= 0.1) {
      const blob = await new Promise(res => sc.toBlob(res, format, q));
      if (blob.size <= targetBytes) return { success: true, blob };
    }
  }

  const minC = document.createElement('canvas');
  minC.width = Math.max(1, Math.round(canvas.width * 0.1));
  minC.height = Math.max(1, Math.round(canvas.height * 0.1));
  minC.getContext('2d').drawImage(canvas, 0, 0, minC.width, minC.height);
  const minBlob = await new Promise(res => minC.toBlob(res, format, 0.01));
  return { success: false, minBlob, minSize: minBlob.size };
}