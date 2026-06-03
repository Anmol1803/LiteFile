import React from 'react';
import { FILTER_PRESETS } from '@/lib/imageUtils';
import { cn } from '@/lib/utils';

const FILTER_LIST = [
  { id: 'none', label: 'Original' },
  { id: 'vivid', label: 'Vivid' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'hdr', label: 'HDR' },
  { id: 'cinematic', label: 'Cinema' },
  { id: 'film', label: 'Film' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'matte', label: 'Matte' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'bw', label: 'B&W+' },
  { id: 'grayscale', label: 'Gray' },
];

export default function FilterPanel({ filter, onChange, thumbnails = {} }) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filters</span>
      <div className="grid grid-cols-3 gap-2">
        {FILTER_LIST.map(f => (
          <button key={f.id} onClick={() => onChange(f.id)}
            className={cn(
              'rounded-xl border-2 overflow-hidden text-center transition-all',
              filter === f.id ? 'border-primary ring-1 ring-primary/30' : 'border-border/50 hover:border-primary/40'
            )}>
            {thumbnails[f.id] ? (
              <img src={thumbnails[f.id]} alt={f.label} className="w-full aspect-square object-cover" />
            ) : (
              <div className="w-full aspect-square bg-muted/50 flex items-center justify-center">
                <span className="text-xs text-muted-foreground">img</span>
              </div>
            )}
            <div className={cn('text-xs py-1 font-medium', filter === f.id ? 'text-primary' : 'text-muted-foreground')}>
              {f.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}