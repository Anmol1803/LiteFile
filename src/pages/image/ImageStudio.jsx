import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
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
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  loadImage, imageToCanvas, canvasToBlob, applyFilters, applyPresetFilter,
  rotateCanvas, flipCanvas, cropCanvas, addTextWatermark, heicToBlob,
  formatFileSize
} from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfCore';
import JSZip from 'jszip';

const DEFAULT_WM = { text: '', color: '#ffffff', opacity: 0.4, fontSize: 48, rotation: -30, position: 'Center', tiled: false };

export default function ImageStudio() {
  const [files, setFiles] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [img, setImg] = useState(null);
  const [originalImage, setOriginalImage] = useState(null);

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
  const [cropMode, setCropMode] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [wm, setWm] = useState(DEFAULT_WM);
  const [wmApplied, setWmApplied] = useState(false);

  // Draw state
  const [drawTool, setDrawTool] = useState('select');
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [drawSize, setDrawSize] = useState(4);
  const [textVal, setTextVal] = useState('');
  const [textSize, setTextSize] = useState(36);
  const [fontFamily, setFontFamily] = useState('Arial');

  // History (operation-based)
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // UI state
  const [zoom, setZoom] = useState(1);
  const [procStatus, setProcStatus] = useState(null);
  const [progress, setProgress] = useState(0);
  const [batchResults, setBatchResults] = useState([]);
  const [filterThumbs, setFilterThumbs] = useState({});
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const canvasRef = useRef(null);
  const drawLayerRef = useRef(null);
  const drawingRef = useRef(false);
  const shapeStartRef = useRef(null);
  const fullWidthRef = useRef(0);
  const fullHeightRef = useRef(0);

  // Load image with HEIC support
  const loadFile = useCallback(async (file) => {
    let imageFile = file;
    if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
      try {
        imageFile = await heicToBlob(file, 'image/jpeg');
      } catch (e) {
        console.error('HEIC conversion failed', e);
      }
    }
    const image = await loadImage(imageFile);
    setImg(image);
    setOriginalImage(image);
    setAdjustments(DEFAULT_ADJ);
    setFilter('none');
    setRotation(0); setFlippedH(false); setFlippedV(false);
    setResizeW(image.naturalWidth); setResizeH(image.naturalHeight);
    setCropRect(null); setCropMode(false); setCropStart(null);
    setWmApplied(false); setWm(DEFAULT_WM);
    drawLayerRef.current = null;
    setHistory([]);
    setHistoryIndex(-1);
    setZoom(1);
    generateFilterThumbs(image);
  }, []);

  useEffect(() => {
    if (files[activeIdx]) loadFile(files[activeIdx]);
  }, [activeIdx, files, loadFile]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      await new Promise(r => setTimeout(r, 0));
    }
    setFilterThumbs(thumbs);
  };

  const buildCanvas = useCallback(() => {
    if (!img) return null;
    let canvas = imageToCanvas(img);
    const hasAdj = Object.entries(adjustments).some(([k, v]) => k === 'gamma' ? v !== 1 : v !== 0);
    if (hasAdj) applyFilters(canvas, adjustments);
    if (filter !== 'none') applyPresetFilter(canvas, filter);
    if (rotation !== 0) canvas = rotateCanvas(canvas, rotation);
    if (flippedH) canvas = flipCanvas(canvas, true);
    if (flippedV) canvas = flipCanvas(canvas, false);
    if (resizeW && resizeH && (resizeW !== canvas.width || resizeH !== canvas.height)) {
      const rc = document.createElement('canvas'); rc.width = resizeW; rc.height = resizeH;
      rc.getContext('2d').drawImage(canvas, 0, 0, resizeW, resizeH);
      canvas = rc;
    }
    if (cropRect) {
      canvas = cropCanvas(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    }
    if (wmApplied && wm.text) {
      addTextWatermark(canvas, { text: wm.text, color: wm.color, opacity: wm.opacity, fontSize: wm.fontSize, rotation: wm.rotation, tiled: wm.tiled });
    }
    return canvas;
  }, [img, adjustments, filter, rotation, flippedH, flippedV, resizeW, resizeH, cropRect, wm, wmApplied]);

  const applyDrawLayer = useCallback((destCanvas) => {
    if (!drawLayerRef.current) return destCanvas;
    const drawLayer = drawLayerRef.current;
    const ctx = destCanvas.getContext('2d');
    ctx.drawImage(drawLayer, 0, 0);
    return destCanvas;
  }, []);

  const render = useCallback(() => {
    if (!canvasRef.current || !img) return;
    let srcCanvas = buildCanvas();
    if (!srcCanvas) return;
    srcCanvas = applyDrawLayer(srcCanvas);
    fullWidthRef.current = srcCanvas.width;
    fullHeightRef.current = srcCanvas.height;
    const maxW = Math.min(900, (window.innerWidth - (isMobile ? 40 : 340)) * 0.98);
    const maxH = window.innerHeight - 240;
    const scale = Math.min(maxW / srcCanvas.width, maxH / srcCanvas.height, 1) * zoom;
    const dw = Math.round(srcCanvas.width * scale), dh = Math.round(srcCanvas.height * scale);
    const dc = canvasRef.current;
    dc.width = dw; dc.height = dh;
    dc.getContext('2d').drawImage(srcCanvas, 0, 0, dw, dh);
    if (cropMode && cropStart && cropRect) {
      const ctx = dc.getContext('2d');
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, dw, dh);
      ctx.clearRect(cropRect.x * scale, cropRect.y * scale, cropRect.w * scale, cropRect.h * scale);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cropRect.x * scale, cropRect.y * scale, cropRect.w * scale, cropRect.h * scale);
      ctx.setLineDash([]);
    }
  }, [img, buildCanvas, applyDrawLayer, zoom, cropMode, cropStart, cropRect, isMobile]);

  useEffect(() => { render(); }, [render]);

  const pushHistory = useCallback(() => {
    const state = {
      adjustments, filter, rotation, flippedH, flippedV, resizeW, resizeH, cropRect, wmApplied, wm,
      drawLayer: drawLayerRef.current ? drawLayerRef.current.toDataURL() : null,
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), state]);
    setHistoryIndex(prev => prev + 1);
  }, [adjustments, filter, rotation, flippedH, flippedV, resizeW, resizeH, cropRect, wmApplied, wm, historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex < 0) return;
    const prevState = history[historyIndex];
    setAdjustments(prevState.adjustments);
    setFilter(prevState.filter);
    setRotation(prevState.rotation);
    setFlippedH(prevState.flippedH);
    setFlippedV(prevState.flippedV);
    setResizeW(prevState.resizeW);
    setResizeH(prevState.resizeH);
    setCropRect(prevState.cropRect);
    setWmApplied(prevState.wmApplied);
    setWm(prevState.wm);
    if (prevState.drawLayer) {
      const img2 = new Image();
      img2.onload = () => {
        if (!drawLayerRef.current) drawLayerRef.current = document.createElement('canvas');
        drawLayerRef.current.width = img2.width;
        drawLayerRef.current.height = img2.height;
        drawLayerRef.current.getContext('2d').drawImage(img2, 0, 0);
        render();
      };
      img2.src = prevState.drawLayer;
    } else {
      drawLayerRef.current = null;
      render();
    }
    setHistoryIndex(prev => prev - 1);
  }, [history, historyIndex, render]);

  const getCanvasPos = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const displayWidth = canvasRef.current.width;
    const displayHeight = canvasRef.current.height;
    const scaleX = displayWidth / rect.width;
    const scaleY = displayHeight / rect.height;
    const displayX = (clientX - rect.left) * scaleX;
    const displayY = (clientY - rect.top) * scaleY;
    const fullWidth = fullWidthRef.current;
    const fullHeight = fullHeightRef.current;
    if (fullWidth === 0 || fullHeight === 0) return { x: 0, y: 0 };
    const fullX = (displayX / displayWidth) * fullWidth;
    const fullY = (displayY / displayHeight) * fullHeight;
    return { x: fullX, y: fullY };
  };

  const ensureDrawLayer = useCallback(() => {
    const width = fullWidthRef.current;
    const height = fullHeightRef.current;
    if (width === 0 || height === 0) return;
    if (!drawLayerRef.current || drawLayerRef.current.width !== width || drawLayerRef.current.height !== height) {
      const newLayer = document.createElement('canvas');
      newLayer.width = width;
      newLayer.height = height;
      if (drawLayerRef.current) {
        const ctx = newLayer.getContext('2d');
        ctx.drawImage(drawLayerRef.current, 0, 0, drawLayerRef.current.width, drawLayerRef.current.height, 0, 0, width, height);
      }
      drawLayerRef.current = newLayer;
    }
  }, []);

  const onPointerDown = (e) => {
    e.preventDefault();
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const pos = getCanvasPos(clientX, clientY);
    if (cropMode) {
      setCropStart(pos);
      return;
    }
    if (drawTool === 'select') return;
    if (!['pen', 'brush', 'highlighter', 'line', 'rect', 'circle', 'arrow', 'eraser'].includes(drawTool)) return;
    pushHistory();
    drawingRef.current = true;
    ensureDrawLayer();
    shapeStartRef.current = pos;
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const pos = getCanvasPos(clientX, clientY);
    if (cropMode && cropStart) {
      const x = Math.min(cropStart.x, pos.x);
      const y = Math.min(cropStart.y, pos.y);
      const w = Math.abs(pos.x - cropStart.x);
      const h = Math.abs(pos.y - cropStart.y);
      setCropRect({ x, y, w, h });
      render();
      return;
    }
    if (!drawingRef.current) return;
    const ctx = drawLayerRef.current.getContext('2d');
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (drawTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = drawSize * 3;
      ctx.beginPath();
      ctx.moveTo(shapeStartRef.current.x, shapeStartRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      shapeStartRef.current = pos;
    } else if (drawTool === 'pen' || drawTool === 'brush' || drawTool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = drawTool === 'highlighter' ? drawColor + '80' : drawColor;
      ctx.lineWidth = drawTool === 'brush' ? drawSize * 2.5 : drawSize;
      ctx.globalAlpha = drawTool === 'highlighter' ? 0.5 : 1;
      ctx.beginPath();
      ctx.moveTo(shapeStartRef.current.x, shapeStartRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      shapeStartRef.current = pos;
    }
    render();
  };

  const onPointerUp = (e) => {
    e.preventDefault();
    if (cropMode && cropStart) {
      setCropStart(null);
      return;
    }
    if (!drawingRef.current) return;
    let clientX, clientY;
    if (e.changedTouches) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    const endPos = getCanvasPos(clientX, clientY);
    const startPos = shapeStartRef.current;
    drawingRef.current = false;
    const ctx = drawLayerRef.current.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.strokeStyle = drawColor;
    ctx.fillStyle = drawColor + '40';
    ctx.lineWidth = drawSize;
    if (startPos && (drawTool === 'rect' || drawTool === 'circle' || drawTool === 'line' || drawTool === 'arrow')) {
      if (drawTool === 'rect') {
        const w = endPos.x - startPos.x;
        const h = endPos.y - startPos.y;
        ctx.strokeRect(startPos.x, startPos.y, w, h);
        ctx.fillRect(startPos.x, startPos.y, w, h);
      } else if (drawTool === 'circle') {
        const rx = Math.abs(endPos.x - startPos.x) / 2;
        const ry = Math.abs(endPos.y - startPos.y) / 2;
        const cx = startPos.x + (endPos.x - startPos.x) / 2;
        const cy = startPos.y + (endPos.y - startPos.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      } else if (drawTool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();
      } else if (drawTool === 'arrow') {
        const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x);
        const arrowSize = 15;
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(endPos.x, endPos.y);
        ctx.lineTo(endPos.x - arrowSize * Math.cos(angle - Math.PI/6), endPos.y - arrowSize * Math.sin(angle - Math.PI/6));
        ctx.lineTo(endPos.x - arrowSize * Math.cos(angle + Math.PI/6), endPos.y - arrowSize * Math.sin(angle + Math.PI/6));
        ctx.fill();
      }
      render();
    }
    shapeStartRef.current = null;
  };

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

  const applyWatermark = () => setWmApplied(true);

  const handleExport = async ({ format, quality, targetBytes }) => {
    let srcCanvas = buildCanvas();
    if (!srcCanvas) return;
    srcCanvas = applyDrawLayer(srcCanvas);
    const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
    const mime = mimeMap[format] || 'image/jpeg';
    const baseName = files[activeIdx]?.name.replace(/\.[^.]+$/, '') || 'image';
    if (targetBytes) {
      const compressResult = await compressCanvasToTarget(srcCanvas, targetBytes, mime);
      if (compressResult.success) {
        downloadBlob(compressResult.blob, `${baseName}_compressed.${format}`);
        return { success: true };
      } else {
        downloadBlob(compressResult.minBlob, `${baseName}_best.${format}`);
        return { success: false, minSize: compressResult.minSize, requestedSize: targetBytes };
      }
    } else {
      const blob = await canvasToBlob(srcCanvas, mime, quality);
      downloadBlob(blob, `${baseName}_edited.${format}`);
      return { success: true };
    }
  };

  const batchCompress = async (targetBytes, quality, outputFormat) => {
    setProcStatus('processing'); setProgress(0); setBatchResults([]);
    const results = [];
    const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[outputFormat] || 'image/jpeg';
    for (let i = 0; i < files.length; i++) {
      setProgress(Math.round((i / files.length) * 100));
      const image = await loadImage(files[i]);
      let canvas = imageToCanvas(image);
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

  const resetAll = () => {
    if (originalImage) {
      setImg(originalImage);
      setAdjustments(DEFAULT_ADJ);
      setFilter('none');
      setRotation(0); setFlippedH(false); setFlippedV(false);
      setResizeW(originalImage.naturalWidth); setResizeH(originalImage.naturalHeight);
      setCropRect(null); setCropMode(false); setCropStart(null);
      setWmApplied(false); setWm(DEFAULT_WM);
      drawLayerRef.current = null;
      setHistory([]); setHistoryIndex(-1);
      setZoom(1);
      generateFilterThumbs(originalImage);
    }
    setResetDialogOpen(false);
  };

  const isDrawMode = !cropMode && ['pen', 'brush', 'highlighter', 'line', 'rect', 'circle', 'arrow', 'eraser'].includes(drawTool);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ToolHeader title="Image Studio" description="Professional image editor — adjust, filter, transform, draw, watermark, compress" icon={Layers} />

        {!files.length ? (
          <FileDropzone accept="image/*,image/heic" multiple maxFiles={50} onFiles={(f) => setFiles(prev => [...prev, ...f])}
            label="Drop images to start editing" description="JPG, PNG, WEBP, HEIC • Multiple files for batch processing • Drag, browse, or paste" />
        ) : (
          <div className="flex flex-col lg:flex-row gap-4">
            {isMobile ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="mb-2">Tools</Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 overflow-y-auto">
                  <div className="space-y-4 mt-6">
                    <div className="p-3 rounded-xl bg-card border border-border/50">
                      <Tabs defaultValue="adjust">
                        <TabsList className="grid w-full grid-cols-3 h-8 text-xs mb-3">
                          <TabsTrigger value="adjust">Adjust</TabsTrigger>
                          <TabsTrigger value="filter">Filter</TabsTrigger>
                          <TabsTrigger value="transform">Transform</TabsTrigger>
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
                            cropMode={cropMode} setCropMode={setCropMode}
                          />
                        </TabsContent>
                      </Tabs>
                    </div>
                    <div className="p-3 rounded-xl bg-card border border-border/50">
                      <Tabs defaultValue="draw">
                        <TabsList className="grid w-full grid-cols-2 h-8 mb-3">
                          <TabsTrigger value="draw">Draw</TabsTrigger>
                          <TabsTrigger value="watermark">Watermark</TabsTrigger>
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
                </SheetContent>
              </Sheet>
            ) : (
              <div className="w-72 shrink-0 space-y-3">
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <Tabs defaultValue="adjust">
                    <TabsList className="grid w-full grid-cols-3 h-8 text-xs mb-3">
                      <TabsTrigger value="adjust">Adjust</TabsTrigger>
                      <TabsTrigger value="filter">Filter</TabsTrigger>
                      <TabsTrigger value="transform">Transform</TabsTrigger>
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
                        cropMode={cropMode} setCropMode={setCropMode}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <Tabs defaultValue="draw">
                    <TabsList className="grid w-full grid-cols-2 h-8 mb-3">
                      <TabsTrigger value="draw">Draw</TabsTrigger>
                      <TabsTrigger value="watermark">Watermark</TabsTrigger>
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
            )}

            <div className="flex-1 min-w-0 space-y-3">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {files.map((f, i) => (
                  <div key={f.name + i} className={`relative shrink-0 rounded-lg border-2 px-3 py-1.5 text-xs text-center min-w-[70px] max-w-[90px] transition-colors cursor-pointer
                    ${activeIdx === i ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/40'}`}
                    onClick={() => setActiveIdx(i)}>
                    <p className="truncate font-medium">{f.name.split('.')[0]}</p>
                    <p className="text-muted-foreground">{formatFileSize(f.size)}</p>
                    <button
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
                      onClick={(e) => { e.stopPropagation(); const nf = files.filter((_, idx) => idx !== i); setFiles(nf); if (activeIdx >= nf.length) setActiveIdx(Math.max(0, nf.length - 1)); }}
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
                <button onClick={() => { const el = document.createElement('input'); el.type = 'file'; el.accept = 'image/*,image/heic'; el.multiple = true; el.onchange = e => setFiles(p => [...p, ...Array.from(e.target.files)]); el.click(); }}
                  className="shrink-0 rounded-lg border-2 border-dashed border-border/50 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-w-[50px]">
                  + Add
                </button>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2">
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
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={undo} disabled={historyIndex < 0}>
                    <Undo2 className="w-3.5 h-3.5 mr-1" />Undo
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setResetDialogOpen(true)}>
                    Reset All
                  </Button>
                </div>
                {img && <span className="text-xs text-muted-foreground">{img.naturalWidth}×{img.naturalHeight}px</span>}
              </div>

              <div className="rounded-xl border border-border/50 bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[length:20px_20px] overflow-auto flex items-center justify-center min-h-[400px] p-4">
                {img ? (
                  <canvas
                    ref={canvasRef}
                    className={`max-w-full shadow-xl ${isDrawMode ? 'cursor-crosshair' : cropMode ? 'crosshair' : 'cursor-default'}`}
                    onMouseDown={onPointerDown}
                    onMouseMove={onPointerMove}
                    onMouseUp={onPointerUp}
                    onMouseLeave={onPointerUp}
                    onTouchStart={onPointerDown}
                    onTouchMove={onPointerMove}
                    onTouchEnd={onPointerUp}
                    style={{ imageRendering: zoom > 2 ? 'pixelated' : 'auto', touchAction: 'none' }}
                  />
                ) : (
                  <div className="text-muted-foreground text-sm">Select a file to start editing</div>
                )}
              </div>
            </div>

            {isMobile ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="mt-2">Export</Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 overflow-y-auto">
                  <div className="space-y-3 mt-6">
                    <div className="p-3 rounded-xl bg-card border border-border/50">
                      <ExportPanel onExport={handleExport} processing={false} />
                    </div>
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
                </SheetContent>
              </Sheet>
            ) : (
              <div className="w-64 shrink-0 space-y-3">
                <div className="p-3 rounded-xl bg-card border border-border/50">
                  <ExportPanel onExport={handleExport} processing={false} />
                </div>
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
            )}
          </div>
        )}
      </main>
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset All Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will discard all adjustments, filters, drawings, crops, and watermarks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={resetAll}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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