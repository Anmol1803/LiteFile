import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import { Maximize2, Download, Loader2, Lock, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { loadImage, imageToCanvas, canvasToBlob, formatFileSize } from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfUtils';
import { motion } from 'framer-motion';

export default function ResizeImage() {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lockAspect, setLockAspect] = useState(true);
  const [mode, setMode] = useState('exact');
  const [percentage, setPercentage] = useState('50');
  const [dpi, setDpi] = useState('72');
  const [unit, setUnit] = useState('px');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const handleFiles = async (files) => {
    const f = files[0];
    setFile(f);
    const image = await loadImage(f);
    setImg(image);
    setWidth(String(image.naturalWidth));
    setHeight(String(image.naturalHeight));
    setResult(null);
  };

  const handleWidthChange = (v) => {
    setWidth(v);
    if (lockAspect && img) {
      const ratio = img.naturalHeight / img.naturalWidth;
      setHeight(String(Math.round(Number(v) * ratio)));
    }
  };

  const handleHeightChange = (v) => {
    setHeight(v);
    if (lockAspect && img) {
      const ratio = img.naturalWidth / img.naturalHeight;
      setWidth(String(Math.round(Number(v) * ratio)));
    }
  };

  const toPx = (val) => {
    const d = Number(dpi);
    if (unit === 'in') return Math.round(val * d);
    if (unit === 'cm') return Math.round((val / 2.54) * d);
    if (unit === 'mm') return Math.round((val / 25.4) * d);
    return Math.round(val);
  };

  const resize = async () => {
    if (!img) return;
    setProcessing(true);

    let w, h;
    if (mode === 'percentage') {
      const s = Number(percentage) / 100;
      w = Math.round(img.naturalWidth * s);
      h = Math.round(img.naturalHeight * s);
    } else if (mode === 'fit') {
      const maxW = toPx(Number(width));
      const maxH = toPx(Number(height));
      const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      w = Math.round(img.naturalWidth * ratio);
      h = Math.round(img.naturalHeight * ratio);
    } else if (mode === 'fill') {
      const maxW = toPx(Number(width));
      const maxH = toPx(Number(height));
      const ratio = Math.max(maxW / img.naturalWidth, maxH / img.naturalHeight);
      w = Math.round(img.naturalWidth * ratio);
      h = Math.round(img.naturalHeight * ratio);
    } else {
      w = toPx(Number(width));
      h = toPx(Number(height));
    }

    const canvas = imageToCanvas(img, w, h);
    const blob = await canvasToBlob(canvas, 'image/png', 1);
    setResult({
      blob,
      name: file.name.replace(/\.[^.]+$/, '_resized.png'),
      width: w,
      height: h,
      originalSize: file.size,
      newSize: blob.size,
    });
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Resize Image" description="Change dimensions, resolution, and scale" icon={Maximize2} />

        {!file ? (
          <FileDropzone accept="image/*" onFiles={handleFiles} label="Drop an image to resize" />
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-card border border-border/50">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {img?.naturalWidth}×{img?.naturalHeight}px • {formatFileSize(file.size)}
              </p>
            </div>

            <Tabs value={mode} onValueChange={setMode}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="exact">Exact</TabsTrigger>
                <TabsTrigger value="percentage">Percentage</TabsTrigger>
                <TabsTrigger value="fit">Fit</TabsTrigger>
                <TabsTrigger value="fill">Fill</TabsTrigger>
              </TabsList>

              <TabsContent value="exact" className="mt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Select value={unit} onValueChange={setUnit}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="px">Pixels</SelectItem>
                      <SelectItem value="in">Inches</SelectItem>
                      <SelectItem value="cm">Centimeters</SelectItem>
                      <SelectItem value="mm">Millimeters</SelectItem>
                    </SelectContent>
                  </Select>
                  {unit !== 'px' && (
                    <Select value={dpi} onValueChange={setDpi}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['72', '96', '150', '300', '600'].map(d => (
                          <SelectItem key={d} value={d}>{d} DPI</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <Label>Width</Label>
                    <Input type="number" value={width} onChange={(e) => handleWidthChange(e.target.value)} />
                  </div>
                  <Button variant="ghost" size="icon" className="mt-6" onClick={() => setLockAspect(!lockAspect)}>
                    {lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </Button>
                  <div className="flex-1 space-y-1">
                    <Label>Height</Label>
                    <Input type="number" value={height} onChange={(e) => handleHeightChange(e.target.value)} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="percentage" className="mt-6 space-y-4">
                <Label>Scale percentage</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" value={percentage} onChange={(e) => setPercentage(e.target.value)} className="w-32" />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                {img && (
                  <p className="text-xs text-muted-foreground">
                    Output: {Math.round(img.naturalWidth * Number(percentage) / 100)}×{Math.round(img.naturalHeight * Number(percentage) / 100)}px
                  </p>
                )}
              </TabsContent>

              <TabsContent value="fit" className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">Image will fit within these bounds while maintaining aspect ratio.</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1"><Label>Max Width</Label><Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} /></div>
                  <div className="flex-1 space-y-1"><Label>Max Height</Label><Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
                </div>
              </TabsContent>

              <TabsContent value="fill" className="mt-6 space-y-4">
                <p className="text-sm text-muted-foreground">Image will fill these dimensions (may crop edges).</p>
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1"><Label>Width</Label><Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} /></div>
                  <div className="flex-1 space-y-1"><Label>Height</Label><Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} /></div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-3">
              <Button onClick={() => { setFile(null); setImg(null); setResult(null); }} variant="outline" className="rounded-xl">Change Image</Button>
              <Button onClick={resize} disabled={processing} className="flex-1 h-12 text-base rounded-xl">
                {processing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Maximize2 className="w-5 h-5 mr-2" />}
                {processing ? 'Resizing...' : 'Resize Image'}
              </Button>
            </div>

            {result && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{result.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {result.width}×{result.height}px • {formatFileSize(result.newSize)}
                  </p>
                </div>
                <Button size="sm" onClick={() => downloadBlob(result.blob, result.name)}>
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}