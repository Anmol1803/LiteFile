import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

export default function ProgressBar({ progress, status, label }) {
  // status: 'processing' | 'done' | 'error'
  return (
    <AnimatePresence>
      {status && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="p-4 rounded-xl bg-card border border-border/50 space-y-2"
        >
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              {status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              {status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
              <span className={status === 'error' ? 'text-destructive' : 'text-foreground'}>
                {label || (status === 'done' ? 'Complete!' : status === 'error' ? 'Error' : 'Processing...')}
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-xs">{progress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <motion.div
              className={`h-2 rounded-full ${status === 'error' ? 'bg-destructive' : status === 'done' ? 'bg-green-500' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}