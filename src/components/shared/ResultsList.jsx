import React from 'react';
import { motion } from 'framer-motion';
import { Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadBlob } from '@/lib/pdfCore';
import { formatFileSize } from '@/lib/imageUtils';
import JSZip from 'jszip';

export default function ResultsList({ results, title = 'Results' }) {
  if (!results?.length) return null;

  const downloadAll = async () => {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].name);
      return;
    }
    const zip = new JSZip();
    for (const r of results) {
      zip.file(r.name, r.blob);
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, 'toolkit_results.zip');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{title} ({results.length})</h3>
        <Button size="sm" variant="outline" onClick={downloadAll}>
          <Download className="w-3.5 h-3.5 mr-1" />
          {results.length > 1 ? 'Download ZIP' : 'Download'}
        </Button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {results.map((r, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
            <FileText className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.name}</p>
              {r.originalSize && r.size && (
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(r.originalSize)} → {formatFileSize(r.size)}
                  <span className="ml-1 text-green-500 font-medium">
                    ({Math.round((1 - r.size / r.originalSize) * 100)}% smaller)
                  </span>
                </p>
              )}
              {!r.originalSize && r.size && (
                <p className="text-xs text-muted-foreground">{formatFileSize(r.size)}</p>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => downloadBlob(r.blob, r.name)}>
              <Download className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}