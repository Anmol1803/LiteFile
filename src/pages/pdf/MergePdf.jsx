import React, { useState } from 'react';
import Navbar from '@/components/dashboard/Navbar';
import ToolHeader from '@/components/shared/ToolHeader';
import FileDropzone from '@/components/shared/FileDropzone';
import ProgressBar from '@/components/shared/ProgressBar';
import ResultsList from '@/components/shared/ResultsList';
import { Merge, GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/imageUtils';
import { mergePdfs } from '@/lib/pdfCore';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function MergePdf() {
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState([]);

  const handleFiles = (newFiles) => {
    const pdfs = newFiles.filter(f => f.name.toLowerCase().endsWith('.pdf'));
    setFiles(prev => [...prev, ...pdfs]);
    setResults([]);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const items = Array.from(files);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setFiles(items);
  };

  const merge = async () => {
    setStatus('processing');
    setProgress(0);
    setResults([]);
    const blob = await mergePdfs(files, setProgress);
    setResults([{ blob, name: 'merged.pdf', size: blob.size }]);
    setProgress(100);
    setStatus('done');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ToolHeader title="Merge PDFs" description="Combine multiple PDFs — drag to reorder" icon={Merge} />

        <FileDropzone accept=".pdf" multiple onFiles={handleFiles} label="Drop PDFs to merge" description="Add multiple PDFs, then drag to reorder pages" />

        {files.length > 0 && (
          <div className="space-y-6 mt-6">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="merge-list">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {files.map((file, i) => (
                      <Draggable key={file.name + i} draggableId={file.name + i} index={i}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps}
                            className={`flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 ${snapshot.isDragging ? 'shadow-xl ring-2 ring-primary/30' : ''}`}>
                            <div {...provided.dragHandleProps} className="cursor-grab">
                              <GripVertical className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFiles(files.filter((_, idx) => idx !== i))}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            <ProgressBar progress={progress} status={status} label={status === 'processing' ? `Merging ${files.length} PDFs...` : undefined} />

            <Button onClick={merge} disabled={files.length < 2 || status === 'processing'} className="w-full h-12 text-base rounded-xl">
              <Merge className="w-5 h-5 mr-2" />
              Merge {files.length} PDFs
            </Button>

            <ResultsList results={results} title="Merged PDF" />
          </div>
        )}
      </main>
    </div>
  );
}