import React from 'react';
import { X, FileImage, FileText } from 'lucide-react';
import { formatFileSize } from '@/lib/imageUtils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export default function FileList({ files, onRemove, onClear }) {
  if (!files.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          {files.length} file{files.length > 1 ? 's' : ''} selected
        </p>
        {files.length > 1 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-xs">
            Clear all
          </Button>
        )}
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        <AnimatePresence>
          {files.map((file, i) => (
            <motion.div
              key={file.name + i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 group"
            >
              {file.type?.startsWith('image') ? (
                <FileImage className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-primary shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(i)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}