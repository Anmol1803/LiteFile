import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Download, AlertCircle } from 'lucide-react';
import { formatFileSize } from '@/lib/imageUtils';

const SIZE_PRESETS = [
  { label: '10 KB', bytes: 10 * 1024 },
  { label: '50 KB', bytes: 50 * 1024 },
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '200 KB', bytes: 200 * 1024 },
  { label: '500 KB', bytes: 500 * 1024 },
  { label: '1 MB', bytes: 1024 * 1024 },
];

export default function ExportPanel({ onExport, processing }) {
  const [format, setFormat] = useState('jpg');
  const [quality, setQuality] = useState(88);
  const [useTarget, setUseTarget] = useState(false);
  const [targetPreset, setTargetPreset] = useState(null);
  const [customKb, setCustomKb] = useState('');
  const [warning, setWarning] = useState(null);

  const getTargetBytes = () => {
    if (targetPreset) return targetPreset;
    if (customKb) return parseFloat(customKb) * 1024;
    return null;
  };

  const handleExport = async () => {
    setWarning(null);
    const targetBytes = useTarget ? getTargetBytes() : null;
    const result = await onExport({ format, quality: quality / 100, targetBytes });
    if (result && !result.success && result.minSize) {
      setWarning(result);
    }
  };

  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Export Settings</span>
      <div className="space-y-1.5">
        <Label className="text-xs">Format</Label>
        <Select value={format} onValueChange={setFormat}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="jpg">JPG — smallest size</SelectItem>
            <SelectItem value="png">PNG — lossless</SelectItem>
            <SelectItem value="webp">WEBP — best ratio</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-xs">Use Target Size</Label>
        <Switch checked={useTarget} onCheckedChange={setUseTarget} />
      </div>

      {useTarget ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1.5">
            {SIZE_PRESETS.map(p => (
              <Button
                key={p.label}
                variant={targetPreset === p.bytes ? 'default' : 'outline'}
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  setTargetPreset(p.bytes);
                  setCustomKb('');
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">Custom:</Label>
            <Input
              type="number"
              placeholder="e.g. 250"
              value={customKb}
              onChange={e => {
                setCustomKb(e.target.value);
                setTargetPreset(null);
              }}
              className="h-7 text-xs w-24"
            />
            <span className="text-xs text-muted-foreground">KB</span>
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          <div className="flex justify-between">
            <Label className="text-xs">Quality</Label>
            <span className="text-xs font-mono">{quality}%</span>
          </div>
          <Slider value={[quality]} onValueChange={([v]) => setQuality(v)} min={10} max={100} />
        </div>
      )}

      {warning && (
        <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 space-y-1">
          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-semibold">
            <AlertCircle className="w-3.5 h-3.5" />Target not achievable
          </div>
          <p className="text-xs text-muted-foreground">
            Requested: {formatFileSize(warning.requestedSize)} · Min achievable: <span className="font-semibold">{formatFileSize(warning.minSize)}</span>
          </p>
          <p className="text-xs text-muted-foreground">Reason: Further compression would cause unacceptable degradation.</p>
        </div>
      )}

      <Button
        onClick={handleExport}
        disabled={processing || (useTarget && !getTargetBytes())}
        className="w-full h-9 text-sm rounded-xl"
      >
        <Download className="w-4 h-4 mr-1.5" />{processing ? 'Exporting…' : 'Export Image'}
      </Button>
    </div>
  );
}