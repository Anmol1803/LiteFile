import React, { useState, useRef, useEffect, useCallback } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import { Palette, Download, RotateCw, FlipHorizontal, FlipVertical, Undo2, Type, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadImage, imageToCanvas, canvasToBlob, applyFilters, applyPresetFilter, rotateCanvas, flipCanvas, formatFileSize } from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfUtils';

const FILTERS = [
  { label: 'None', value: 'none' },
  { label: 'B&W', value: 'bw' },
  { label: 'Sepia', value: 'sepia' },
  { label: 'Vintage', value: 'vintage' },
  { label: 'Warm', value: 'warm' },
  { label: 'Cool', value: 'cool' },
  { label: 'HDR', value: 'hdr' },
  { label: 'Grayscale', value: 'grayscale' },
];

export default function ImageEditor() {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [adjustments, setAdjustments] = useState({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, gamma: 1 });
  const [filter, setFilter] = useState('none');
  const [rotation, setRotation] = useState(0);
  const [flippedH, setFlippedH] = useState(false);
  const [flippedV, setFlippedV] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#ff0000');
  const [drawSize, setDrawSize] = useState(3);
  const [textOverlay, setTextOverlay] = useState('');
  const [textSize, setTextSize] = useState(32);
  const [textColor, setTextColor] = useState('#ffffff');
  const [outputFormat, setOutputFormat] = useState('png');
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef(null);
  const drawLayerRef = useRef(null);

  const handleFiles = async (files) => {
    const f = files[0];
    setFile(f);
    const image = await loadImage(f);
    setImg(image);
    setAdjustments({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, gamma: 1 });
    setFilter('none');
    setRotation(0);
    setFlippedH(false);
    setFlippedV(false);
  };

  const render = useCallback(() => {
    if (!img || !canvasRef.current) return;
    let canvas = imageToCanvas(img);

    // Apply adjustments
    if (Object.values(adjustments).some((v, i) => i < 5 ? v !== 0 : v !== 1)) {
      applyFilters(canvas, adjustments);
    }

    // Apply preset filter
    if (filter !== 'none') {
      applyPresetFilter(canvas, filter);
    }

    // Apply rotation
    if (rotation !== 0) {
      canvas = rotateCanvas(canvas, rotation);
    }

    // Apply flips
    if (flippedH) canvas = flipCanvas(canvas, true);
    if (flippedV) canvas = flipCanvas(canvas, false);

    // Scale for display
    const maxW = Math.min(800, window.innerWidth - 100);
    const maxH = 500;
    const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
    const dw = Math.round(canvas.width * scale);
    const dh = Math.round(canvas.height * scale);

    const displayCanvas = canvasRef.current;
    displayCanvas.width = dw;
    displayCanvas.height = dh;
    const ctx = displayCanvas.getContext('2d');
    ctx.drawImage(canvas, 0, 0, dw, dh);

    // Draw layer overlay
    if (drawLayerRef.current) {
      ctx.drawImage(drawLayerRef.current, 0, 0, dw, dh);
    }
  }, [img, adjustments, filter, rotation, flippedH, flippedV]);

  useEffect(() => { render(); }, [render]);

  const handleCanvasMouseDown = (e) => {
    if (!drawing) return;
    drawingRef.current = true;
    const rect = canvasRef.current.getBoundingClientRect();
    lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (!drawLayerRef.current) {
      drawLayerRef.current = document.createElement('canvas');
      drawLayerRef.current.width = canvasRef.current.width;
      drawLayerRef.current.height = canvasRef.current.height;
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (!drawingRef.current || !drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = drawLayerRef.current.getContext('2d');
    ctx.strokeStyle = drawColor;
    ctx.lineWidth = drawSize;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPosRef.current = { x, y };
    render();
  };

  const handleCanvasMouseUp = () => { drawingRef.current = false; };

  const addText = () => {
    if (!textOverlay || !canvasRef.current) return;
    if (!drawLayerRef.current) {
      drawLayerRef.current = document.createElement('canvas');
      drawLayerRef.current.width = canvasRef.current.width;
      drawLayerRef.current.height = canvasRef.current.height;
    }
    const ctx = drawLayerRef.current.getContext('2d');
    ctx.fillStyle = textColor;
    ctx.font = `${textSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(textOverlay, drawLayerRef.current.width / 2, drawLayerRef.current.height / 2);
    render();
    setTextOverlay('');
  };

  const resetAll = () => {
    setAdjustments({ brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, gamma: 1 });
    setFilter('none');
    setRotation(0);
    setFlippedH(false);
    setFlippedV(false);
    drawLayerRef.current = null;
    render();
  };

  const exportImage = async () => {
    if (!img) return;
    let canvas = imageToCanvas(img);
    if (Object.values(adjustments).some((v, i) => i < 5 ? v !== 0 : v !== 1)) applyFilters(canvas, adjustments);
    if (filter !== 'none') applyPresetFilter(canvas, filter);
    if (rotation !== 0) canvas = rotateCanvas(canvas, rotation);
    if (flippedH) canvas = flipCanvas(canvas, true);
    if (flippedV) canvas = flipCanvas(canvas, false);

    if (drawLayerRef.current) {
      const ctx = canvas.getContext('2d');
      const scale = canvas.width / canvasRef.current.width;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tCtx = tempCanvas.getContext('2d');
      tCtx.drawImage(drawLayerRef.current, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
    }

    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
    const blob = await canvasToBlob(canvas, mimeMap[outputFormat] || 'image/png', 0.92);
    downloadBlob(blob, file.name.replace(/\.[^.]+$/, `_edited.${outputFormat}`));
  };

  const updateAdj = (key, value) => setAdjustments(prev => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Image Editor" description="All-in-one editor with filters, adjustments, and drawing" icon={Palette} />

        {!file ? (
          <FileDropzone accept="image/*" onFiles={handleFiles} label="Drop an image to edit" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 space-y-4 order-2 lg:order-1">
              <Tabs defaultValue="adjust" className="w-full">
                <TabsList className="grid w-full grid-cols-4 text-xs">
                  <TabsTrigger value="adjust">Adjust</TabsTrigger>
                  <TabsTrigger value="filter">Filters</TabsTrigger>
                  <TabsTrigger value="transform">Transform</TabsTrigger>
                  <TabsTrigger value="draw">Draw</TabsTrigger>
                </TabsList>

                <TabsContent value="adjust" className="space-y-4 mt-4">
                  {[
                    { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
                    { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
                    { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
                    { key: 'temperature', label: 'Temperature', min: -50, max: 50 },
                    { key: 'tint', label: 'Tint', min: -50, max: 50 },
                  ].map(({ key, label, min, max }) => (
                    <div key={key} className="space-y-1.5">
                      <div className="flex justify-between">
                        <Label className="text-xs">{label}</Label>
                        <span className="text-xs text-muted-foreground">{adjustments[key]}</span>
                      </div>
                      <Slider value={[adjustments[key]]} onValueChange={([v]) => updateAdj(key, v)} min={min} max={max} />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label className="text-xs">Gamma</Label>
                      <span className="text-xs text-muted-foreground">{adjustments.gamma.toFixed(1)}</span>
                    </div>
                    <Slider value={[adjustments.gamma * 50]} onValueChange={([v]) => updateAdj('gamma', v / 50)} min={10} max={150} />
                  </div>
                </TabsContent>

                <TabsContent value="filter" className="mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    {FILTERS.map(f => (
                      <Button key={f.value} variant={filter === f.value ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setFilter(f.value)}>
                        {f.label}
                      </Button>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="transform" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRotation(r => r - 90)}>
                      <RotateCw className="w-3.5 h-3.5 mr-1 scale-x-[-1]" /> Left
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setRotation(r => r + 90)}>
                      <RotateCw className="w-3.5 h-3.5 mr-1" /> Right
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setFlippedH(!flippedH)}>
                      <FlipHorizontal className="w-3.5 h-3.5 mr-1" /> Flip H
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setFlippedV(!flippedV)}>
                      <FlipVertical className="w-3.5 h-3.5 mr-1" /> Flip V
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custom Angle: {rotation}°</Label>
                    <Slider value={[rotation]} onValueChange={([v]) => setRotation(v)} min={-180} max={180} />
                  </div>
                </TabsContent>

                <TabsContent value="draw" className="space-y-4 mt-4">
                  <Button variant={drawing ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setDrawing(!drawing)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> {drawing ? 'Drawing ON' : 'Drawing OFF'}
                  </Button>
                  <div className="space-y-2">
                    <Label className="text-xs">Brush Color</Label>
                    <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Brush Size: {drawSize}px</Label>
                    <Slider value={[drawSize]} onValueChange={([v]) => setDrawSize(v)} min={1} max={30} />
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <Label className="text-xs">Add Text</Label>
                    <Input value={textOverlay} onChange={(e) => setTextOverlay(e.target.value)} placeholder="Enter text..." className="text-xs" />
                    <div className="flex gap-2">
                      <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                      <Input type="number" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-20 text-xs" />
                      <Button size="sm" onClick={addText} className="text-xs"><Type className="w-3 h-3 mr-1" /> Add</Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="space-y-2 pt-2 border-t border-border">
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetAll}>
                  <Undo2 className="w-3.5 h-3.5 mr-1" /> Reset All
                </Button>
                <div className="flex gap-2">
                  <Select value={outputFormat} onValueChange={setOutputFormat}>
                    <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="jpg">JPG</SelectItem>
                      <SelectItem value="webp">WEBP</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={exportImage} className="flex-1">
                    <Download className="w-3.5 h-3.5 mr-1" /> Export
                  </Button>
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 flex items-center justify-center min-h-[400px] p-4">
                <canvas
                  ref={canvasRef}
                  className={`max-w-full ${drawing ? 'cursor-crosshair' : 'cursor-default'}`}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseUp}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}