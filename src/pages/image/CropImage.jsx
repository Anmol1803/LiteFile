import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import { Crop, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { loadImage, imageToCanvas, canvasToBlob, cropCanvas, formatFileSize } from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfUtils';
import { motion } from 'framer-motion';

const RATIOS = [
  { label: 'Free', value: 'free' },
  { label: '1:1', value: '1' },
  { label: '4:3', value: '1.333' },
  { label: '16:9', value: '1.778' },
  { label: '9:16', value: '0.5625' },
  { label: '3:2', value: '1.5' },
  { label: '5:4', value: '1.25' },
  { label: '21:9', value: '2.333' },
];

const SOCIAL_PRESETS = [
  { label: 'Instagram Post', w: 1080, h: 1080 },
  { label: 'Instagram Story', w: 1080, h: 1920 },
  { label: 'Facebook Cover', w: 820, h: 312 },
  { label: 'Facebook Post', w: 1200, h: 630 },
  { label: 'LinkedIn Banner', w: 1584, h: 396 },
  { label: 'Twitter Header', w: 1500, h: 500 },
  { label: 'YouTube Thumbnail', w: 1280, h: 720 },
];

const PASSPORT_PRESETS = [
  { label: 'India (2×2 in)', w: 600, h: 600 },
  { label: 'USA (2×2 in)', w: 600, h: 600 },
  { label: 'Canada (50×70 mm)', w: 591, h: 827 },
  { label: 'UK (35×45 mm)', w: 413, h: 531 },
  { label: 'Australia (35×45 mm)', w: 413, h: 531 },
];

export default function CropImage() {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [ratio, setRatio] = useState('free');
  const [cropRect, setCropRect] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const [result, setResult] = useState(null);
  const [displayScale, setDisplayScale] = useState(1);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  const handleFiles = async (files) => {
    const f = files[0];
    setFile(f);
    const image = await loadImage(f);
    setImg(image);
    setResult(null);
  };

  useEffect(() => {
    if (!img || !canvasRef.current) return;
    const container = containerRef.current;
    const maxW = container?.clientWidth || 600;
    const maxH = 500;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    setDisplayScale(scale);
    const cw = Math.round(img.naturalWidth * scale);
    const ch = Math.round(img.naturalHeight * scale);
    const canvas = canvasRef.current;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    setCropRect({ x: 0, y: 0, w: cw, h: ch });
  }, [img]);

  const drawOverlay = useCallback(() => {
    if (!canvasRef.current || !img) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch);
    // Dim outside crop
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, cw, ch);
    // Clear crop area
    ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.drawImage(img, cropRect.x / displayScale, cropRect.y / displayScale, cropRect.w / displayScale, cropRect.h / displayScale, cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    // Border
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    ctx.setLineDash([]);
  }, [img, cropRect, displayScale]);

  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging(true);
    setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMove = (e) => {
    if (!dragging || !dragStart) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    let x = Math.min(dragStart.x, cx);
    let y = Math.min(dragStart.y, cy);
    let w = Math.abs(cx - dragStart.x);
    let h = Math.abs(cy - dragStart.y);
    if (ratio !== 'free') {
      const r = parseFloat(ratio);
      h = w / r;
    }
    x = Math.max(0, Math.min(x, canvasRef.current.width - w));
    y = Math.max(0, Math.min(y, canvasRef.current.height - h));
    setCropRect({ x, y, w, h });
  };

  const handleMouseUp = () => { setDragging(false); };

  const applyPreset = (w, h) => {
    if (!canvasRef.current) return;
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;
    const aspectRatio = w / h;
    let cropW = cw;
    let cropH = cw / aspectRatio;
    if (cropH > ch) { cropH = ch; cropW = ch * aspectRatio; }
    setCropRect({ x: (cw - cropW) / 2, y: (ch - cropH) / 2, w: cropW, h: cropH });
  };

  const doCrop = async () => {
    if (!img) return;
    const realX = Math.round(cropRect.x / displayScale);
    const realY = Math.round(cropRect.y / displayScale);
    const realW = Math.round(cropRect.w / displayScale);
    const realH = Math.round(cropRect.h / displayScale);
    const full = imageToCanvas(img);
    const cropped = cropCanvas(full, realX, realY, realW, realH);
    const blob = await canvasToBlob(cropped, 'image/png', 1);
    setResult({ blob, name: file.name.replace(/\.[^.]+$/, '_cropped.png'), w: realW, h: realH, size: blob.size });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Crop Image" description="Free crop, fixed ratios, and social media presets" icon={Crop} />

        {!file ? (
          <FileDropzone accept="image/*" onFiles={handleFiles} label="Drop an image to crop" />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Aspect Ratio</Label>
                  <Select value={ratio} onValueChange={(v) => { setRatio(v); if (v !== 'free' && canvasRef.current) { const cw = canvasRef.current.width; const r = parseFloat(v); const ch2 = cw / r; setCropRect({ x: 0, y: 0, w: cw, h: Math.min(ch2, canvasRef.current.height) }); } }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RATIOS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Social Media</Label>
                  <div className="space-y-1">{SOCIAL_PRESETS.map(p => (
                    <Button key={p.label} variant="ghost" size="sm" className="w-full justify-start text-xs h-8" onClick={() => applyPreset(p.w, p.h)}>{p.label}</Button>
                  ))}</div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Passport</Label>
                  <div className="space-y-1">{PASSPORT_PRESETS.map(p => (
                    <Button key={p.label} variant="ghost" size="sm" className="w-full justify-start text-xs h-8" onClick={() => applyPreset(p.w, p.h)}>{p.label}</Button>
                  ))}</div>
                </div>
              </div>

              <div className="md:col-span-3" ref={containerRef}>
                <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 flex items-center justify-center p-2">
                  <canvas
                    ref={canvasRef}
                    className="max-w-full cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Crop: {Math.round(cropRect.w / displayScale)}×{Math.round(cropRect.h / displayScale)}px
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setFile(null); setImg(null); setResult(null); }} className="rounded-xl">Change Image</Button>
              <Button onClick={doCrop} className="flex-1 h-12 text-base rounded-xl">
                <Crop className="w-5 h-5 mr-2" /> Crop Image
              </Button>
            </div>

            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{result.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{result.w}×{result.h}px • {formatFileSize(result.size)}</p>
                </div>
                <Button size="sm" onClick={() => downloadBlob(result.blob, result.name)}><Download className="w-4 h-4 mr-1" /> Download</Button>
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}