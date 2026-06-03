import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { FileDown, X, AlertCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFileSize } from '@/lib/imageUtils';
import { compressPdf, compressPdfToTarget } from '@/lib/pdfCore';
import { motion, AnimatePresence } from 'framer-motion';

const QUALITY_PRESETS = [
  { label: 'Screen', sublabel: '~72 dpi', quality: 0.25 },
  { label: 'eBook', sublabel: '~150 dpi', quality: 0.45 },
  { label: 'Print', sublabel: '~300 dpi', quality: 0.72 },
  { label: 'Prepress', sublabel: 'Max', quality: 0.92 },
];

const SIZE_PRESETS = [
  { label: '50 KB', bytes: 50 * 1024 },
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '200 KB', bytes: 200 * 1024 },
  { label: '500 KB', bytes: 500 * 1024 },
  { label: '1 MB', bytes: 1024 * 1024 },
  { label: '2 MB', bytes: 2 * 1024 * 1024 },
];

export default function CompressPdf() {
  const [files, setFiles] = useState([]);
  const [mode, setMode] = useState('quality');
  const [quality, setQuality] = useState(0.45);
  const [targetPreset, setTargetPreset] = useState(null);
  const [customKb, setCustomKb] = useState('');
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [warnings, setWarnings] = useState([]);

  const handleFiles = (newFiles) => {
    const pdfs = newFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    setFiles(prev => [...prev, ...pdfs]);
    setResults([]); setWarnings([]);
  };

  const getTargetBytes = () => {
    if (targetPreset) return targetPreset;
    if (customKb) return parseFloat(customKb) * 1024;
    return null;
  };

  const compress = async () => {
    setStatus('processing');
    setProgress(0);
    setResults([]);
    setWarnings([]);
    const out = [];
    const warns = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      setCurrentFile(f.name);
      const fileProgress = (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100));

      if (mode === 'target') {
        const targetBytes = getTargetBytes();
        if (!targetBytes) continue;
        const result = await compressPdfToTarget(f, targetBytes, fileProgress);
        if (result.success) {
          out.push({ blob: result.blob, name: f.name.replace('.pdf', '_compressed.pdf'), originalSize: f.size, size: result.blob.size });
        } else {
          // Could not achieve target — inform user
          warns.push({
            filename: f.name,
            requestedSize: targetBytes,
            minSize: result.minSize,
            reason: result.reason,
          });
          // Still provide the best we could achieve
          out.push({ blob: result.minBlob, name: f.name.replace('.pdf', '_compressed.pdf'), originalSize: f.size, size: result.minSize, warning: true });
        }
      } else {
        const blob = await compressPdf(f, quality, fileProgress);
        out.push({ blob, name: f.name.replace('.pdf', '_compressed.pdf'), originalSize: f.size, size: blob.size });
      }
    }

    setResults(out);
    setWarnings(warns);
    setProgress(100);
    setStatus('done');
    setCurrentFile('');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Compress PDF" description="Reduce PDF size with quality presets or exact target size" icon={FileDown} />

        <FileDropzone accept=".pdf" multiple onFiles={handleFiles}
          label="Drop PDFs to compress" description="Drag & drop, browse, or paste • Batch supported" />

        {files.length > 0 && (
          <div className="space-y-6 mt-6">
            {/* File list */}
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                  <FileDown className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Settings */}
            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
              <Tabs value={mode} onValueChange={v => { setMode(v); setResults([]); setWarnings([]); }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="quality">Quality Mode</TabsTrigger>
                  <TabsTrigger value="target">Target Size</TabsTrigger>
                </TabsList>

                <TabsContent value="quality" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {QUALITY_PRESETS.map(p => (
                      <Button key={p.label}
                        variant={quality === p.quality ? 'default' : 'outline'}
                        size="sm" className="h-auto py-2.5 flex flex-col gap-0.5 text-xs"
                        onClick={() => setQuality(p.quality)}>
                        <span className="font-semibold">{p.label}</span>
                        <span className="opacity-70">{p.sublabel}</span>
                      </Button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-sm">Fine-tune quality</Label>
                      <span className="text-xs text-muted-foreground font-mono">{Math.round(quality * 100)}%</span>
                    </div>
                    <Slider value={[quality * 100]} onValueChange={([v]) => setQuality(v / 100)} min={10} max={95} />
                  </div>
                </TabsContent>

                <TabsContent value="target" className="mt-4 space-y-4">
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
                  <div className="flex items-center gap-3 pt-1">
                    <Label className="text-sm shrink-0">Custom:</Label>
                    <Input
                      type="number" placeholder="e.g. 250"
                      value={customKb}
                      onChange={e => { setCustomKb(e.target.value); setTargetPreset(null); }}
                      className="w-32 h-8 text-sm"
                    />
                    <span className="text-sm text-muted-foreground">KB</span>
                    {customKb && <span className="text-xs text-muted-foreground">= {formatFileSize(parseFloat(customKb) * 1024)}</span>}
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="text-xs">If the target size cannot be achieved without destroying the document, you'll be shown the minimum achievable size.</p>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <ProgressBar
              progress={progress} status={status}
              label={status === 'processing' ? `Compressing${currentFile ? ` "${currentFile}"` : ''}… (${files.length} file${files.length > 1 ? 's' : ''})` : undefined}
            />

            <Button onClick={compress} disabled={status === 'processing' || (mode === 'target' && !getTargetBytes())}
              className="w-full h-12 text-base rounded-xl">
              <FileDown className="w-5 h-5 mr-2" />
              Compress {files.length} PDF{files.length > 1 ? 's' : ''}
            </Button>

            {/* Warnings: unachievable targets */}
            <AnimatePresence>
              {warnings.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  {warnings.map((w, i) => (
                    <div key={i} className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
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
                      <p className="text-xs text-muted-foreground">
                        <strong>Reason:</strong> {w.reason || 'Further compression would result in unreadable content or invalid document structure.'}
                      </p>
                      <p className="text-xs text-muted-foreground">The best achievable version has been included in the results below.</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <ResultsList results={results} title="Compressed PDFs" />
          </div>
        )}
      </main>
    </div>
  );
}