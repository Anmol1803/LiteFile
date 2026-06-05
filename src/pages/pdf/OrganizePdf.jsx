import React, { useState, useEffect, useRef } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { LayoutGrid, RotateCw, Trash2, Copy, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/imageUtils';
import { readFileAsArrayBuffer, organizePdf, downloadBlob } from '@/lib/pdfCore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument } from 'pdf-lib';

export default function OrganizePdf() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // [{ origIdx, rotation, thumbnail }]
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (files) => {
    const f = files[0];
    if (!f?.name.toLowerCase().endsWith('.pdf')) return;
    setFile(f);
    setResults([]);
    setLoading(true);

    // Generate thumbnails via pdfjs
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    const ab = await readFileAsArrayBuffer(f);
    const pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
    const totalPages = pdfDoc.numPages;
    const pageList = [];

    for (let i = 1; i <= totalPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 0.4 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageList.push({ origIdx: i - 1, rotation: 0, thumbnail: canvas.toDataURL('image/jpeg', 0.7) });
    }

    setPages(pageList);
    setLoading(false);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(pages);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setPages(items);
  };

  const rotatePage = (idx, deg) => {
    setPages(prev => prev.map((p, i) => i === idx ? { ...p, rotation: ((p.rotation + deg) % 360 + 360) % 360 } : p));
  };

  const deletePage = (idx) => setPages(prev => prev.filter((_, i) => i !== idx));

  const duplicatePage = (idx) => {
    const items = Array.from(pages);
    items.splice(idx + 1, 0, { ...pages[idx] });
    setPages(items);
  };

  const movePage = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= pages.length) return;
    const items = Array.from(pages);
    const [moved] = items.splice(idx, 1);
    items.splice(newIdx, 0, moved);
    setPages(items);
  };

  const save = async () => {
    setStatus('processing');
    setProgress(20);
    const pageOrder = pages.map(p => p.origIdx);
    const rotations = {};
    pages.forEach((p, i) => { if (p.rotation !== 0) rotations[p.origIdx] = p.rotation; });
    setProgress(50);
    const blob = await organizePdf(file, { pageOrder, rotations, deletedPages: new Set() });
    setProgress(100);
    setResults([{ blob, name: file.name.replace('.pdf', '_organized.pdf'), size: blob.size }]);
    setStatus('done');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Organize Pages" description="Drag to reorder, rotate, duplicate, or delete pages" icon={LayoutGrid} />

        {!file ? (
          <FileDropzone accept=".pdf" onFiles={handleFiles} label="Drop a PDF to organize" />
        ) : (
          <div className="space-y-6">
            <div className="p-3 rounded-xl bg-card border border-border/50 flex items-center gap-3">
              <LayoutGrid className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} · {pages.length} pages</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setFile(null); setPages([]); setResults([]); }}>Change</Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground">Loading page thumbnails...</div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="pages" direction="horizontal">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef}
                      className="flex flex-wrap gap-3 p-4 rounded-xl bg-muted/30 border border-border/50 min-h-[200px]">
                      {pages.map((page, idx) => (
                        <Draggable key={`page-${idx}-${page.origIdx}`} draggableId={`page-${idx}-${page.origIdx}`} index={idx}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}
                              className={`relative group bg-card border border-border/50 rounded-xl overflow-hidden cursor-grab w-28
                                ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-primary' : 'hover:ring-2 hover:ring-primary/40'}`}>
                              <div className="relative overflow-hidden" style={{ transform: `rotate(${page.rotation}deg)`, transition: 'transform 0.2s' }}>
                                <img src={page.thumbnail} alt={`Page ${idx + 1}`} className="w-full object-contain" />
                              </div>
                              <div className="p-1 text-center text-xs text-muted-foreground">{idx + 1}</div>
                              {/* Controls */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                <div className="flex gap-1">
                                  <button onClick={() => rotatePage(idx, -90)} className="bg-white/90 rounded p-1 hover:bg-white">
                                    <RotateCw className="w-3 h-3 scale-x-[-1]" />
                                  </button>
                                  <button onClick={() => rotatePage(idx, 90)} className="bg-white/90 rounded p-1 hover:bg-white">
                                    <RotateCw className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => movePage(idx, -1)} className="bg-white/90 rounded p-1 hover:bg-white">
                                    <ChevronLeft className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => movePage(idx, 1)} className="bg-white/90 rounded p-1 hover:bg-white">
                                    <ChevronRight className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="flex gap-1">
                                  <button onClick={() => duplicatePage(idx)} className="bg-white/90 rounded p-1 hover:bg-white">
                                    <Copy className="w-3 h-3" />
                                  </button>
                                  <button onClick={() => deletePage(idx)} className="bg-red-500/90 rounded p-1 hover:bg-red-500 text-white">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}

            <ProgressBar progress={progress} status={status} />

            <Button onClick={save} disabled={status === 'processing' || loading} className="w-full h-12 text-base rounded-xl">
              <LayoutGrid className="w-5 h-5 mr-2" /> Save Organized PDF
            </Button>

            <ResultsList results={results} title="Organized PDF" />
          </div>
        )}
      </main>
    </div>
  );
}