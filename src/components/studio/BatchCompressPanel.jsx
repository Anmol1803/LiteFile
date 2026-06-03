import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProgressBar from '@/components/shared/ProgressBar';
import { Download } from 'lucide-react';
import { formatFileSize } from '@/lib/imageUtils';

const SIZE_PRESETS = [
  { label: '50 KB', bytes: 50 * 1024 },
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '200 KB', bytes: 200 * 1024 },
  { label: '500 KB', bytes: 500 * 1024 },
  { label: '1 MB', bytes: 1024 * 1024 },
];

export default function BatchCompressPanel({ fileCount, onCompress, status, progress, results, onDownloadZip }) {
  const [targetMode, setTargetMode] = useState(false); // false = quality mode, true = target size mode
  const [targetPreset, setTargetPreset] = useState(null);
  const [customKb, setCustomKb] = useState('');
  const [quality, setQuality] = useState(80);
  const [outputFormat, setOutputFormat] = useState('jpg');

  const getTargetBytes = () => {
    if (targetPreset) return targetPreset;
    if (customKb) return parseFloat(customKb) * 1024;
    return null;
  };

  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Batch Compress ({fileCount} files)</span>
      
      {/* Mode toggle: Quality vs Target Size */}
      <div className="flex gap-2">
        <Button
          variant={!targetMode ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setTargetMode(false)}
        >
          Quality Mode
        </Button>
        <Button
          variant={targetMode ? 'default' : 'outline'}
          size="sm"
          className="flex-1 text-xs"
          onClick={() => setTargetMode(true)}
        >
          Target Size
        </Button>
      </div>

      {!targetMode ? (
        // Quality mode UI
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-xs">Quality</span>
            <span className="text-xs font-mono">{quality}%</span>
          </div>
          <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={10} max={95} />
          <Select value={outputFormat} onValueChange={setOutputFormat}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="jpg">JPG</SelectItem>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="webp">WEBP</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        // Target size mode UI
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {SIZE_PRESETS.map(p => (
              <button
                key={p.label}
                className={`text-xs py-1.5 rounded-lg border transition-colors ${
                  targetPreset === p.bytes ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50 hover:border-primary/40'
                }`}
                onClick={() => {
                  setTargetPreset(p.bytes);
                  setCustomKb('');
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Custom KB"
              value={customKb}
              onChange={e => {
                setCustomKb(e.target.value);
                setTargetPreset(null);
              }}
              className="h-7 text-xs flex-1"
            />
            <span className="text-xs text-muted-foreground">KB</span>
          </div>
        </div>
      )}

      <ProgressBar progress={progress} status={status} />

      <Button
        size="sm"
        className="w-full text-xs h-8"
        disabled={status === 'processing'}
        onClick={() => onCompress(targetMode ? getTargetBytes() : null, quality, outputFormat)}
      >
        Compress All {fileCount} Files
      </Button>

      {results.length > 0 && (
        <div className="space-y-1.5">
          <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={onDownloadZip}>
            <Download className="w-3 h-3 mr-1" />Download ZIP ({results.length})
          </Button>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {results.map((r, i) => (
              <div key={i} className={`text-xs p-1.5 rounded-lg flex justify-between items-center gap-1 ${r.warning ? 'bg-amber-500/10' : 'bg-muted/40'}`}>
                <span className="truncate flex-1 text-muted-foreground">{r.name.replace(/_compressed|_best/, '')}</span>
                <span className={`shrink-0 font-mono font-medium ${r.warning ? 'text-amber-500' : 'text-green-500'}`}>{formatFileSize(r.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}