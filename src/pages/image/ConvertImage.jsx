import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import FileList from '@/components/shared/FileList';
import { ArrowRightLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { loadImage, imageToCanvas, canvasToBlob, getMimeType, formatFileSize } from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfUtils';
import { motion } from 'framer-motion';

const FORMATS = ['jpg', 'png', 'webp', 'bmp'];

export default function ConvertImage() {
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('png');
  const [quality, setQuality] = useState(92);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState([]);

  const handleFiles = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles.filter(f => f.type.startsWith('image/'))]);
    setResults([]);
  };

  const convert = async () => {
    setProcessing(true);
    const newResults = [];
    const mime = getMimeType(targetFormat);

    for (const file of files) {
      const img = await loadImage(file);
      const canvas = imageToCanvas(img);
      const blob = await canvasToBlob(canvas, mime, quality / 100);
      const name = file.name.replace(/\.[^.]+$/, `.${targetFormat}`);
      newResults.push({ name, blob, size: blob.size, originalSize: file.size });
    }

    setResults(newResults);
    setProcessing(false);
  };

  const supportsQuality = targetFormat === 'jpg' || targetFormat === 'webp';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Convert Format" description="Convert images between JPG, PNG, WEBP, BMP" icon={ArrowRightLeft} />

        {!files.length ? (
          <FileDropzone accept="image/*" multiple onFiles={handleFiles} label="Drop images to convert" />
        ) : (
          <div className="space-y-6">
            <FileList files={files} onRemove={(i) => setFiles(f => f.filter((_, idx) => idx !== i))} onClear={() => { setFiles([]); setResults([]); }} />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Output Format</Label>
                <Select value={targetFormat} onValueChange={setTargetFormat}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORMATS.map(f => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {supportsQuality && (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Quality: {quality}%</Label>
                  </div>
                  <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={1} max={100} />
                </div>
              )}
            </div>

            <Button onClick={convert} disabled={processing} className="w-full h-12 text-base rounded-xl">
              {processing ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ArrowRightLeft className="w-5 h-5 mr-2" />}
              {processing ? 'Converting...' : `Convert ${files.length} image${files.length > 1 ? 's' : ''} to ${targetFormat.toUpperCase()}`}
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
                    <div>
                      <p className="font-medium text-sm">{r.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatFileSize(r.size)}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => downloadBlob(r.blob, r.name)}>
                      <Download className="w-4 h-4" />
                    </Button>
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