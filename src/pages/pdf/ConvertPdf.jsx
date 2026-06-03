import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { FileOutput, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatFileSize } from '@/lib/imageUtils';
import {
  pdfToImages, imagesToPdfLib, pdfToText, pdfToHtml, pdfToDocx,
  pdfToMarkdown, pdfToRtf, docxToPdf, txtToPdf, htmlToPdf, markdownToPdf,
  readFileAsArrayBuffer
} from '@/lib/pdfCore';
import { loadImage, imageToCanvas, canvasToBlob, heicToBlob } from '@/lib/imageUtils';
import JSZip from 'jszip';

const IMAGE_FORMATS = [
  { value: 'image/jpeg', label: 'JPG', ext: 'jpg' },
  { value: 'image/png', label: 'PNG', ext: 'png' },
  { value: 'image/webp', label: 'WEBP', ext: 'webp' },
  { value: 'image/bmp', label: 'BMP', ext: 'bmp' },
  { value: 'image/tiff', label: 'TIFF', ext: 'tiff' },
];

export default function ConvertPdf() {
  const [activeTab, setActiveTab] = useState('pdf-conversions');
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('image/jpeg');
  const [imageScale, setImageScale] = useState(2);
  const [pageRange, setPageRange] = useState('all');
  const [customPages, setCustomPages] = useState('');
  const [singleImagePerPage, setSingleImagePerPage] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);

  const handleFiles = (newFiles) => {
    setFiles(prev => [...prev, ...newFiles]);
    setResults([]);
    setStatus(null);
  };

  const getPageIndices = (totalPages) => {
    if (pageRange === 'all') return Array.from({ length: totalPages }, (_, i) => i);
    if (pageRange === 'custom') {
      const parts = customPages.split(',');
      const indices = [];
      for (const p of parts) {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map(Number);
          for (let i = start; i <= end && i <= totalPages; i++) indices.push(i - 1);
        } else {
          const num = Number(p);
          if (!isNaN(num) && num >= 1 && num <= totalPages) indices.push(num - 1);
        }
      }
      return indices;
    }
    return [];
  };

  const convertPdfToImages = async (file, format, scale, pageIndices, singleImagePerPageFlag) => {
    const allImages = await pdfToImages(file, format, scale, (p) => {});
    const selected = pageIndices.map(idx => allImages[idx]);
    if (singleImagePerPageFlag && selected.length === 1) {
      const res = await fetch(selected[0].dataUrl);
      const blob = await res.blob();
      return [{ blob, name: file.name.replace('.pdf', `_page_1.${format.split('/')[1]}`), size: blob.size }];
    } else {
      const zip = new JSZip();
      const folder = zip.folder(file.name.replace('.pdf', ''));
      for (let i = 0; i < selected.length; i++) {
        const img = selected[i];
        const res = await fetch(img.dataUrl);
        const blob = await res.blob();
        const ext = format === 'image/jpeg' ? 'jpg' : format.split('/')[1];
        folder.file(`page_${pageIndices[i] + 1}.${ext}`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      return [{ blob: zipBlob, name: file.name.replace('.pdf', `_images.zip`), size: zipBlob.size }];
    }
  };

  // Safe wrapper for any conversion function
const safeConvert = async (fn, file, ...args) => {
  try {
    const result = await fn(file, ...args);
    if (result instanceof Blob) {
      return { blob: result, success: true };
    } else if (typeof result === 'string') {
      // Convert string to blob with appropriate MIME type
      let mime = 'text/plain';
      if (fn.name === 'pdfToHtml') mime = 'text/html';
      if (fn.name === 'pdfToMarkdown') mime = 'text/markdown';
      if (fn.name === 'pdfToRtf') mime = 'application/rtf';
      const blob = new Blob([result], { type: mime });
      return { blob, success: true };
    } else if (result && result.blob) {
      return result;
    } else {
      throw new Error('Conversion did not return a Blob or string');
    }
  } catch (err) {
    console.error(`Conversion error for ${file.name}:`, err);
    const errorBlob = new Blob([`Conversion failed: ${err.message}\n\nStack: ${err.stack}`], { type: 'text/plain' });
    return { blob: errorBlob, success: false, error: err.message };
  }
};

  const convert = async () => {
    setStatus('processing');
    setProgress(0);
    setResults([]);
    const out = [];

    try {
      if (activeTab === 'pdf-conversions') {
        for (let idx = 0; idx < files.length; idx++) {
          const file = files[idx];
          if (!file.name.endsWith('.pdf')) continue;

          setProgress(Math.round((idx / files.length) * 100));
          let result;

          if (targetFormat === 'docx') {
            result = await safeConvert(pdfToDocx, file, (p) => setProgress(p));
            out.push({ blob: result.blob, name: file.name.replace('.pdf', '.docx'), size: result.blob.size, error: !result.success });
          } 
          else if (targetFormat === 'txt') {
            result = await safeConvert(pdfToText, file);
            const blob = new Blob([result.blob], { type: 'text/plain' });
            out.push({ blob, name: file.name.replace('.pdf', '.txt'), size: blob.size, error: !result.success });
          }
          else if (targetFormat === 'html') {
            result = await safeConvert(pdfToHtml, file);
            const blob = new Blob([result.blob], { type: 'text/html' });
            out.push({ blob, name: file.name.replace('.pdf', '.html'), size: blob.size, error: !result.success });
          }
          else if (targetFormat === 'md') {
            result = await safeConvert(pdfToMarkdown, file);
            const blob = new Blob([result.blob], { type: 'text/markdown' });
            out.push({ blob, name: file.name.replace('.pdf', '.md'), size: blob.size, error: !result.success });
          }
          else if (targetFormat === 'rtf') {
            result = await safeConvert(pdfToRtf, file);
            const blob = new Blob([result.blob], { type: 'application/rtf' });
            out.push({ blob, name: file.name.replace('.pdf', '.rtf'), size: blob.size, error: !result.success });
          }
          else if (targetFormat === 'epub') {
            const blob = new Blob(['EPUB conversion requires server-side processing. Please use Calibre or similar.'], { type: 'text/plain' });
            out.push({ blob, name: 'note.txt', size: blob.size });
          }
          else if (targetFormat === 'xlsx' || targetFormat === 'pptx') {
            const blob = new Blob([`${targetFormat.toUpperCase()} conversion is not available in browser. Use Microsoft Office or LibreOffice.`], { type: 'text/plain' });
            out.push({ blob, name: 'note.txt', size: blob.size });
          }
          else if (IMAGE_FORMATS.some(f => f.value === targetFormat)) {
            const arrayBuffer = await readFileAsArrayBuffer(file);
            const pdfjsLib = await import('pdfjs-dist');
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.0.227/pdf.worker.min.js`;
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const totalPages = pdfDoc.numPages;
            const pageIndices = getPageIndices(totalPages);
            const imageResults = await convertPdfToImages(file, targetFormat, imageScale, pageIndices, singleImagePerPage);
            out.push(...imageResults);
          } else {
            const blob = new Blob([`Conversion to ${targetFormat} is not supported.`], { type: 'text/plain' });
            out.push({ blob, name: 'error.txt', size: blob.size });
          }
        }
      }
      else if (activeTab === 'to-pdf') {
        for (let idx = 0; idx < files.length; idx++) {
          const file = files[idx];
          setProgress(Math.round((idx / files.length) * 100));
          let blob;
          try {
            if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
              const result = await safeConvert(docxToPdf, file);
              blob = result.blob;
            } else if (file.type === 'text/plain') {
              const result = await safeConvert(txtToPdf, file);
              blob = result.blob;
            } else if (file.type === 'text/html') {
              const result = await safeConvert(htmlToPdf, file);
              blob = result.blob;
            } else if (file.type === 'text/markdown') {
              const result = await safeConvert(markdownToPdf, file);
              blob = result.blob;
            } else if (file.type.startsWith('image/')) {
              let imgFile = file;
              if (file.type === 'image/heic') {
                imgFile = await heicToBlob(file, 'image/jpeg');
              }
              const img = await loadImage(imgFile);
              const canvas = imageToCanvas(img);
              const pdfLib = await import('pdf-lib');
              const pdfDoc = await pdfLib.PDFDocument.create();
              const page = pdfDoc.addPage([canvas.width, canvas.height]);
              const pngImage = await pdfDoc.embedPng(canvas.toDataURL('image/png'));
              page.drawImage(pngImage, { x: 0, y: 0, width: canvas.width, height: canvas.height });
              const bytes = await pdfDoc.save();
              blob = new Blob([bytes], { type: 'application/pdf' });
            } else {
              blob = new Blob([`Conversion from ${file.type} to PDF is not supported.`], { type: 'text/plain' });
            }
          } catch (err) {
            console.error(err);
            blob = new Blob([`Conversion error: ${err.message}`], { type: 'text/plain' });
          }
          out.push({ blob, name: file.name.replace(/\.[^.]+$/, '.pdf'), size: blob.size });
        }
      }
      else if (activeTab === 'image-converter') {
        for (let idx = 0; idx < files.length; idx++) {
          const file = files[idx];
          setProgress(Math.round((idx / files.length) * 100));
          if (!file.type.startsWith('image/')) continue;
          let imgFile = file;
          if (file.type === 'image/heic') {
            imgFile = await heicToBlob(file, targetFormat);
          }
          const img = await loadImage(imgFile);
          const canvas = imageToCanvas(img);
          const blob = await canvasToBlob(canvas, targetFormat, 0.92);
          const ext = targetFormat.split('/')[1] === 'jpeg' ? 'jpg' : targetFormat.split('/')[1];
          out.push({ blob, name: file.name.replace(/\.[^.]+$/, `.${ext}`), size: blob.size });
        }
      }
      else if (activeTab === 'universal') {
        for (const file of files) {
          const ext = file.name.split('.').pop().toLowerCase();
          const target = targetFormat;
          const blob = new Blob([`Universal converter coming soon – from ${ext} to ${target}.`], { type: 'text/plain' });
          out.push({ blob, name: 'note.txt', size: blob.size });
        }
      }
    } catch (err) {
      console.error('Global conversion error:', err);
      setStatus('error');
    }

    console.log('Final results array:', out.map(r => ({ name: r.name, size: r.size, blobType: r.blob?.type })));
    setResults(out);
    setProgress(100);
    setStatus('done');
  };

  const isImageConversion = IMAGE_FORMATS.some(f => f.value === targetFormat);
  const showScale = activeTab === 'pdf-conversions' && isImageConversion;
  const showPageOptions = activeTab === 'pdf-conversions' && isImageConversion;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Converter" description="Convert between PDF, Word, images, text, HTML, Markdown – all in your browser" icon={FileOutput} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pdf-conversions">PDF → Other</TabsTrigger>
            <TabsTrigger value="to-pdf">→ PDF</TabsTrigger>
            <TabsTrigger value="image-converter">Image ↔ Image</TabsTrigger>
            <TabsTrigger value="universal">Universal</TabsTrigger>
          </TabsList>

          <TabsContent value="pdf-conversions" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Convert PDF to</Label>
              <Select value={targetFormat} onValueChange={setTargetFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="docx">Microsoft Word (.docx)</SelectItem>
                  <SelectItem value="txt">Plain Text (.txt)</SelectItem>
                  <SelectItem value="html">HTML (.html)</SelectItem>
                  <SelectItem value="md">Markdown (.md)</SelectItem>
                  <SelectItem value="rtf">Rich Text Format (.rtf)</SelectItem>
                  <SelectItem value="epub">EPUB (experimental)</SelectItem>
                  <SelectItem value="xlsx">Excel (.xlsx) – server only</SelectItem>
                  <SelectItem value="pptx">PowerPoint (.pptx) – server only</SelectItem>
                  {IMAGE_FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showPageOptions && (
              <div className="space-y-2 border p-3 rounded-lg">
                <Label>Pages</Label>
                <div className="flex gap-2">
                  <button onClick={() => setPageRange('all')} className={`px-3 py-1 text-xs rounded ${pageRange === 'all' ? 'bg-primary text-white' : 'bg-muted'}`}>All pages</button>
                  <button onClick={() => setPageRange('custom')} className={`px-3 py-1 text-xs rounded ${pageRange === 'custom' ? 'bg-primary text-white' : 'bg-muted'}`}>Custom range</button>
                </div>
                {pageRange === 'custom' && (
                  <Input placeholder="e.g. 1-3,5,7-9" value={customPages} onChange={e => setCustomPages(e.target.value)} className="text-sm" />
                )}
                <div className="flex items-center gap-2">
                  <Checkbox checked={singleImagePerPage} onCheckedChange={setSingleImagePerPage} />
                  <Label className="text-sm">Single image per page (otherwise one ZIP per PDF)</Label>
                </div>
              </div>
            )}
            {showScale && (
              <div className="space-y-2">
                <Label>Image Scale: {imageScale}x ({Math.round(imageScale * 72)} DPI)</Label>
                <Slider value={[imageScale]} onValueChange={([v]) => setImageScale(v)} min={1} max={3} step={0.5} />
              </div>
            )}
          </TabsContent>

          <TabsContent value="to-pdf" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Convert to PDF from</Label>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>✅ Word (.docx)</div>
                <div>✅ Text (.txt)</div>
                <div>✅ HTML (.html)</div>
                <div>✅ Markdown (.md)</div>
                <div>✅ Images (JPG, PNG, WEBP, BMP, TIFF, HEIC)</div>
                <div>❌ Excel (.xlsx) – needs server</div>
                <div>❌ PowerPoint (.pptx) – needs server</div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Images are embedded as full pages. For Excel/PPT, please use desktop software or convert to PDF first.</p>
            </div>
          </TabsContent>

          <TabsContent value="image-converter" className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Output image format</Label>
              <Select value={targetFormat} onValueChange={setTargetFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_FORMATS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Supports batch conversion of all common image formats (including HEIC → JPG/PNG).</p>
            </div>
          </TabsContent>

          <TabsContent value="universal" className="mt-6 space-y-4">
            <div className="p-4 rounded-lg bg-muted/30 text-center">
              <p className="text-sm font-medium">Universal converter – coming soon</p>
              <p className="text-xs text-muted-foreground mt-1">Upload any file (PDF, DOCX, JPG, PNG, TXT, HTML, MD) and convert to your desired format.</p>
              <p className="text-xs text-muted-foreground">Currently under development. For now, use the dedicated tabs above.</p>
            </div>
          </TabsContent>
        </Tabs>

        <FileDropzone
          accept={activeTab === 'pdf-conversions' ? '.pdf' : 
                  activeTab === 'to-pdf' ? '.docx,.txt,.html,.md,image/*' : 
                  'image/*'}
          multiple
          onFiles={handleFiles}
          label={activeTab === 'pdf-conversions' ? 'Drop PDFs to convert' : 
                  activeTab === 'to-pdf' ? 'Drop files to convert to PDF' : 
                  'Drop images to convert'}
          description="Multiple files supported"
        />

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

            <ProgressBar progress={progress} status={status} label={status === 'processing' ? `Converting...` : undefined} />

            <Button onClick={convert} disabled={status === 'processing'} className="w-full h-12 text-base rounded-xl">
              <FileOutput className="w-5 h-5 mr-2" />
              Convert {files.length} file{files.length > 1 ? 's' : ''}
            </Button>

            {/* ResultsList will show automatically when results have length */}
            <ResultsList results={results} title="Converted Files" />
          </div>
        )}
      </main>
    </div>
  );
}