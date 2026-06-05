import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import FileList from '@/components/shared/FileList';
import { Minimize2, Download, Loader2, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { loadImage, imageToCanvas, canvasToBlob, compressToTargetSize, formatFileSize } from '@/lib/imageUtils';
import { downloadBlob } from '@/lib/pdfCore';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';

const SIZE_PRESETS = [
  { label: '10 KB', bytes: 10 * 1024 },
  { label: '20 KB', bytes: 20 * 1024 },
  { label: '50 KB', bytes: 50 * 1024 },
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '200 KB', bytes: 200 * 1024 },
  { label: '500 KB', bytes: 500 * 1024 },
];

export default function CompressImage() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('quality');
  const [quality, setQuality] = useState(80);
  const [outputFormat, setOutputFormat] = useState('jpg');
  const [preserveResolution, setPreserveResolution] = useState(true);
  const [targetPreset, setTargetPreset] = useState(null);
  const [customKb, setCustomKb] = useState('');
  const [processing, setProcessing] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);

  const handleFiles = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles.filter(f => f.type.startsWith('image/'))]);
    setResults([]); setWarnings([]);
  };

  const getTargetBytes = () => {
    if (targetPreset) return targetPreset;
    if (customKb) return parseFloat(customKb) * 1024;
    return null;
  };

  const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

  const compress = async () => {
    setProcessing(true);
    setResults([]); setWarnings([]);
    const newResults = [], warns = [];

    for (let idx = 0; idx < files.length; idx++) {
      setCurrentIdx(idx);
      const file = files[idx];
      const img = await loadImage(file);

      if (mode === 'target') {
        const target = getTargetBytes();
        if (!target) continue;
        const result = await compressToTargetSize(img, target, 'image/jpeg');
        if (result.success) {
          newResults.push({
            name: file.name.replace(/\.[^.]+$/, '_compressed.jpg'),
            originalSize: file.size,
            compressedSize: result.blob.size,
            blob: result.blob,
            width: img.naturalWidth,
            height: img.naturalHeight,
          });
        } else {
          warns.push({
            filename: file.name,
            requestedSize: target,
            minSize: result.minSize,
          });
          newResults.push({
            name: file.name.replace(/\.[^.]+$/, '_compressed.jpg'),
            originalSize: file.size,
            compressedSize: result.minBlob.size,
            blob: result.minBlob,
            width: img.naturalWidth,
            height: img.naturalHeight,
            warning: true,
          });
        }
      } else {
        let canvas = imageToCanvas(img);
        if (!preserveResolution && quality < 50) {
          const scale = 0.5 + (quality / 100) * 0.5;
          canvas = imageToCanvas(img, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale));
        }
        const blob = await canvasToBlob(canvas, mimeMap[outputFormat] || 'image/jpeg', quality / 100);
        newResults.push({
          name: file.name.replace(/\.[^.]+$/, `.${outputFormat}`),
          originalSize: file.size,
          compressedSize: blob.size,
          blob,
          width: canvas.width,
          height: canvas.height,
          originalWidth: img.naturalWidth,
          originalHeight: img.naturalHeight,
        });
      }
    }

    setResults(newResults);
    setWarnings(warns);
    setProcessing(false);
  };

  const downloadAll = async () => {
    if (results.length === 1) { downloadBlob(results[0].blob, results[0].name); return; }
    const zip = new JSZip();
    results.forEach(r => zip.file(r.name, r.blob));
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'compressed_images.zip');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Compress Image" description="Reduce file size with quality mode or exact target size" icon={Minimize2} />

        {!files.length ? (
          <FileDropzone accept="image/*" multiple onFiles={handleFiles} label="Drop images to compress" description="JPG, PNG, WEBP • Multiple files supported" />
        ) : (
          <div className="space-y-6">
            <FileList files={files} onRemove={(i) => { setFiles(f => f.filter((_, idx) => idx !== i)); setResults([]); }} onClear={() => { setFiles([]); setResults([]); }} />

            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
              <Tabs value={mode} onValueChange={v => { setMode(v); setResults([]); setWarnings([]); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="quality">Quality Mode</TabsTrigger>
                  <TabsTrigger value="target">Target Size</TabsTrigger>
                </TabsList>

                <TabsContent value="quality" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Quality: <span className="font-mono">{quality}%</span></Label>
                      <span className="text-sm text-muted-foreground">{quality < 30 ? 'Low' : quality < 60 ? 'Medium' : quality < 85 ? 'High' : 'Maximum'}</span>
                    </div>
                    <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={1} max={100} step={1} />
                    <div className="grid grid-cols-4 gap-1.5 mt-2">
                      {[{ l: 'Low', v: 20 }, { l: 'Medium', v: 50 }, { l: 'High', v: 80 }, { l: 'Max', v: 95 }].map(p => (
                        <Button key={p.l} variant={quality === p.v ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => setQuality(p.v)}>{p.l}</Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Output Format</Label>
                      <Select value={outputFormat} onValueChange={setOutputFormat}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="jpg">JPG (smallest)</SelectItem>
                          <SelectItem value="png">PNG (lossless)</SelectItem>
                          <SelectItem value="webp">WEBP (best ratio)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between pt-5">
                      <Label className="text-sm">Preserve resolution</Label>
                      <Switch checked={preserveResolution} onCheckedChange={setPreserveResolution} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="target" className="space-y-4 mt-4">
                  <Label className="text-sm font-medium block">Select target size</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {SIZE_PRESETS.map(p => (
                      <Button key={p.label}
                        variant={targetPreset === p.bytes ? 'default' : 'outline'}
                        size="sm" className="text-xs"
                        onClick={() => { setTargetPreset(p.bytes); setCustomKb(''); }}>
                        {p.label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm shrink-0">Custom:</Label>
                    <Input type="number" placeholder="e.g. 75" value={customKb}
                      onChange={e => { setCustomKb(e.target.value); setTargetPreset(null); }}
                      className="w-28 h-8 text-sm" />
                    <span className="text-sm text-muted-foreground">KB</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs">The engine iteratively reduces quality and resolution until your target is reached. If it cannot be achieved, you'll see the minimum achievable size.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <Button onClick={compress} disabled={processing || (mode === 'target' && !getTargetBytes())} className="w-full h-12 text-base rounded-xl">
              {processing ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Compressing {currentIdx + 1}/{files.length}…</> : <><Minimize2 className="w-5 h-5 mr-2" />Compress {files.length} image{files.length > 1 ? 's' : ''}</>}
            </Button>

            <AnimatePresence>
              {warnings.map((w, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-semibold">Target size not achievable — {w.filename}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-2 rounded-lg bg-background/60">
                      <p className="text-xs text-muted-foreground">Requested Size</p>
                      <p className="font-semibold text-destructive">{formatFileSize(w.requestedSize)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-background/60">
                      <p className="text-xs text-muted-foreground">Minimum Achievable</p>
                      <p className="font-semibold text-amber-600 dark:text-amber-400">{formatFileSize(w.minSize)}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {results.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Results ({results.length})</h3>
                    <Button variant="outline" size="sm" onClick={downloadAll}>
                      <Download className="w-4 h-4 mr-1" /> {results.length > 1 ? 'Download ZIP' : 'Download'}
                    </Button>
                  </div>
                  {results.map((r, i) => {
                    const reduction = ((1 - r.compressedSize / r.originalSize) * 100).toFixed(1);
                    return (
                      <div key={i} className={`p-4 rounded-xl bg-card border flex items-center justify-between gap-4 ${r.warning ? 'border-amber-500/40' : 'border-border/50'}`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm truncate">{r.name}</p>
                            {r.warning && <span className="text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded">Best achievable</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{formatFileSize(r.originalSize)} → {formatFileSize(r.compressedSize)}</span>
                            <span className={reduction > 0 ? 'text-green-500 font-medium' : 'text-muted-foreground'}>
                              {reduction > 0 ? `-${reduction}%` : `+${Math.abs(Number(reduction))}%`}
                            </span>
                            <span>{r.width}×{r.height}</span>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => downloadBlob(r.blob, r.name)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}