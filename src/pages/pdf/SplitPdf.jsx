import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { Split } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatFileSize } from '@/lib/imageUtils';
import { splitPdfByRanges, parsePageRanges, getPdfPageCount } from '@/lib/pdfCore';

export default function SplitPdf() {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [method, setMethod] = useState('range');
  const [rangeInput, setRangeInput] = useState('');
  const [everyX, setEveryX] = useState('1');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);

  const handleFiles = async (files) => {
    const f = files[0];
    if (!f || !f.name.toLowerCase().endsWith('.pdf')) return;
    setFile(f);
    setResults([]);
    const count = await getPdfPageCount(f);
    setPageCount(count);
    setRangeInput(`1-${Math.ceil(count / 2)},${Math.ceil(count / 2) + 1}-${count}`);
  };

  const split = async () => {
    setStatus('processing');
    setProgress(10);
    setResults([]);

    let ranges = [];
    if (method === 'range') {
      ranges = parsePageRanges(rangeInput, pageCount);
    } else if (method === 'every') {
      const x = parseInt(everyX) || 1;
      for (let i = 1; i <= pageCount; i += x) {
        ranges.push([i, Math.min(i + x - 1, pageCount)]);
      }
    } else {
      // extract each page
      for (let i = 1; i <= pageCount; i++) ranges.push([i, i]);
    }

    setProgress(20);
    const splitResults = await splitPdfByRanges(file, ranges);
    const out = splitResults.map(r => ({ ...r, size: r.blob.size }));
    setResults(out);
    setProgress(100);
    setStatus('done');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Split PDF" description="Split by ranges, intervals, or individual pages" icon={Split} />

        {!file ? (
          <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF to split" />
        ) : (
          <div className="space-y-6">
            <div className="p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3">
              <Split className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} · {pageCount} pages</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setResults([]); }}>Change</Button>
            </div>

            <Tabs value={method} onValueChange={setMethod}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="range">Page Ranges</TabsTrigger>
                <TabsTrigger value="every">Every X Pages</TabsTrigger>
                <TabsTrigger value="single">All Pages</TabsTrigger>
              </TabsList>
              <TabsContent value="range" className="mt-4 space-y-2">
                <Label>Ranges (comma-separated, e.g. <code className="text-xs bg-muted px-1 rounded">1-5, 6-10, 15</code>)</Label>
                <Input value={rangeInput} onChange={e => setRangeInput(e.target.value)} placeholder="1-5, 6-10" />
                <p className="text-xs text-muted-foreground">PDF has {pageCount} pages</p>
              </TabsContent>
              <TabsContent value="every" className="mt-4 space-y-2">
                <Label>Split every X pages</Label>
                <Input type="number" value={everyX} onChange={e => setEveryX(e.target.value)} min="1" max={pageCount} className="w-32" />
                <p className="text-xs text-muted-foreground">Will create {Math.ceil(pageCount / (parseInt(everyX) || 1))} files</p>
              </TabsContent>
              <TabsContent value="single" className="mt-4">
                <p className="text-sm text-muted-foreground">Extract every page as a separate PDF ({pageCount} files)</p>
              </TabsContent>
            </Tabs>

            <ProgressBar progress={progress} status={status} />

            <Button onClick={split} disabled={status === 'processing'} className="w-full h-12 text-base rounded-xl">
              <Split className="w-5 h-5 mr-2" /> Split PDF
            </Button>

            <ResultsList results={results} title="Split Parts" />
          </div>
        )}
      </main>
    </div>
  );
}