import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { Stamp, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatFileSize } from '@/lib/imageUtils';
import { addPdfTextWatermark } from '@/lib/pdfCore';

export default function PdfWatermark() {
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState(0.3);
  const [rotation, setRotation] = useState(-45);
  const [fontSize, setFontSize] = useState(60);
  const [color, setColor] = useState('#888888');
  const [pages, setPages] = useState('all');
  const [customRange, setCustomRange] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);

  const handleFiles = (newFiles) => {
    const pdfs = newFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    setFiles(prev => [...prev, ...pdfs]);
    setResults([]);
  };

  const apply = async () => {
    setStatus('processing');
    setProgress(0);
    setResults([]);
    const out = [];
    for (let i = 0; i < files.length; i++) {
      setProgress(Math.round((i / files.length) * 100));
      const blob = await addPdfTextWatermark(files[i], { text, opacity, rotation, fontSize, color, pages, customRange });
      out.push({ blob, name: files[i].name.replace('.pdf', '_watermarked.pdf'), size: blob.size });
    }
    setProgress(100);
    setResults(out);
    setStatus('done');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="PDF Watermark" description="Add text watermarks to PDFs — batch supported" icon={Stamp} />

        <FileDropzone accept=".pdf" multiple onFiles={handleFiles} label="Drop PDFs to watermark" description="Multiple files supported" />

        {files.length > 0 && (
          <div className="space-y-6 mt-6">
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
              <h3 className="font-semibold text-sm">Watermark Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Watermark Text</Label>
                  <Input value={text} onChange={e => setText(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex gap-2 items-center">
                    <input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-9 w-16 rounded cursor-pointer" />
                    <Input value={color} onChange={e => setColor(e.target.value)} className="flex-1" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><Label>Opacity</Label><span className="text-xs text-muted-foreground">{Math.round(opacity * 100)}%</span></div>
                  <Slider value={[opacity * 100]} onValueChange={([v]) => setOpacity(v / 100)} min={5} max={100} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><Label>Rotation</Label><span className="text-xs text-muted-foreground">{rotation}°</span></div>
                  <Slider value={[rotation]} onValueChange={([v]) => setRotation(v)} min={-180} max={180} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between"><Label>Font Size</Label><span className="text-xs text-muted-foreground">{fontSize}px</span></div>
                  <Slider value={[fontSize]} onValueChange={([v]) => setFontSize(v)} min={10} max={120} />
                </div>
                <div className="space-y-2">
                  <Label>Apply To</Label>
                  <Select value={pages} onValueChange={setPages}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Pages</SelectItem>
                      <SelectItem value="first">First Page Only</SelectItem>
                      <SelectItem value="last">Last Page Only</SelectItem>
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  {pages === 'custom' && (
                    <Input value={customRange} onChange={e => setCustomRange(e.target.value)} placeholder="e.g. 1-3, 5, 7" className="mt-2" />
                  )}
                </div>
              </div>
            </div>

            <ProgressBar progress={progress} status={status} label={status === 'processing' ? `Watermarking ${files.length} PDF(s)...` : undefined} />

            <Button onClick={apply} disabled={!text || status === 'processing'} className="w-full h-12 text-base rounded-xl">
              <Stamp className="w-5 h-5 mr-2" /> Add Watermark to {files.length} PDF{files.length > 1 ? 's' : ''}
            </Button>

            <ResultsList results={results} title="Watermarked PDFs" />
          </div>
        )}
      </main>
    </div>
  );
}