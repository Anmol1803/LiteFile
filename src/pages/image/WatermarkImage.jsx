import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import FileList from '@/components/shared/FileList';
import { Droplets, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { loadImage, imageToCanvas, canvasToBlob, addTextWatermark, formatFileSize } from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfUtils';
import { motion } from 'framer-motion';

export default function WatermarkImage() {
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('Watermark');
  const [fontSize, setFontSize] = useState(48);
  const [color, setColor] = useState('#ffffff');
  const [opacity, setOpacity] = useState(30);
  const [rotation, setRotation] = useState(-30);
  const [tiled, setTiled] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const handleFiles = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles.filter(f => f.type.startsWith('image/'))]);
    setResults([]);
  };

  const applyWatermark = async () => {
    setProcessing(true);
    const newResults = [];

    for (const file of files) {
      const img = await loadImage(file);
      const canvas = imageToCanvas(img);
      addTextWatermark(canvas, { text, fontSize, color, opacity: opacity / 100, rotation, tiled });
      const blob = await canvasToBlob(canvas, 'image/png', 1);
      newResults.push({ name: file.name.replace(/\.[^.]+$/, '_watermarked.png'), blob, size: blob.size });
    }

    setResults(newResults);
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Watermark" description="Add text watermarks to images with batch support" icon={Droplets} />

        {!files.length ? (
          <FileDropzone accept="image/*" multiple onFiles={handleFiles} label="Drop images to watermark" />
        ) : (
          <div className="space-y-6">
            <FileList files={files} onRemove={(i) => setFiles(f => f.filter((_, idx) => idx !== i))} onClear={() => { setFiles([]); setResults([]); }} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Watermark Text</Label>
                <Input value={text} onChange={(e) => setText(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Font Size: {fontSize}px</Label>
                <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={12} max={200} />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Opacity: {opacity}%</Label>
                <Slider value={[opacity]} onValueChange={([v]) => setOpacity(v)} min={1} max={100} />
              </div>
              <div className="space-y-2">
                <Label>Rotation: {rotation}°</Label>
                <Slider value={[rotation]} onValueChange={([v]) => setRotation(v)} min={-180} max={180} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Tiled Pattern</Label>
                <Switch checked={tiled} onCheckedChange={setTiled} />
              </div>
            </div>

            <Button onClick={applyWatermark} disabled={processing} className="w-full h-12 text-base rounded-xl">
              {processing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Droplets className="w-5 h-5 mr-2" />}
              {processing ? 'Applying...' : `Apply Watermark to ${files.length} image${files.length > 1 ? 's' : ''}`}
            </Button>

            {results.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Results</h3>
                  {results.length > 1 && (
                    <Button variant="outline" size="sm" onClick={() => results.forEach(r => downloadBlob(r.blob, r.name))}>
                      <Download className="w-4 h-4 mr-1" /> Download All
                    </Button>
                  )}
                </div>
                {results.map((r, i) => (
                  <div key={i} className="p-4 rounded-xl bg-card border border-border/50 flex items-center justify-between">
                    <div><p className="font-medium text-sm">{r.name}</p><p className="text-xs text-muted-foreground">{formatFileSize(r.size)}</p></div>
                    <Button size="sm" variant="outline" onClick={() => downloadBlob(r.blob, r.name)}><Download className="w-4 h-4" /></Button>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}