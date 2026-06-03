import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, FileImage, FileText, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatFileSize } from '@/lib/imageUtils';

export default function FileDropzone({ accept, multiple = false, onFiles, maxFiles = 50, label, description }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) onFiles(multiple ? files.slice(0, maxFiles) : [files[0]]);
  }, [onFiles, multiple, maxFiles]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  }, []);

  const handleChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length) onFiles(multiple ? files.slice(0, maxFiles) : [files[0]]);
    e.target.value = '';
  };

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        files.push(items[i].getAsFile());
      }
    }
    if (files.length) onFiles(multiple ? files.slice(0, maxFiles) : [files[0]]);
  }, [onFiles, multiple, maxFiles]);

  React.useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const isImage = accept?.includes('image');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
        transition-all duration-300
        ${dragActive
          ? 'border-primary bg-primary/5 scale-[1.01]'
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }
      `}
      onDrop={handleDrop}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          {isImage ? (
            <FileImage className="w-8 h-8 text-primary" />
          ) : (
            <FileText className="w-8 h-8 text-primary" />
          )}
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {label || 'Drop files here or click to browse'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {description || `Drag & drop, browse, or paste from clipboard${multiple ? ' • Multiple files supported' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Upload className="w-3.5 h-3.5" />
          <span>{accept?.replace(/\./g, '').replace(/,/g, ', ').toUpperCase() || 'All file types'}</span>
        </div>
      </div>
    </motion.div>
  );
}