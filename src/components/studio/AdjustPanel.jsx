import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

const ADJUSTMENTS = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100, def: 0 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, def: 0 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, def: 0 },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100, def: 0 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, def: 0 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, def: 0 },
  { key: 'temperature', label: 'Temperature', min: -50, max: 50, def: 0 },
  { key: 'tint', label: 'Tint', min: -50, max: 50, def: 0 },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, def: 0 },
  { key: 'clarity', label: 'Clarity', min: 0, max: 100, def: 0 },
  { key: 'sharpness', label: 'Sharpness', min: 0, max: 100, def: 0 },
  { key: 'gamma', label: 'Gamma', min: 0.1, max: 3, def: 1, step: 0.05, format: v => v.toFixed(2) },
];

const DEFAULT_ADJ = { brightness: 0, contrast: 0, saturation: 0, exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, vibrance: 0, clarity: 0, sharpness: 0, gamma: 1 };

export { DEFAULT_ADJ };

export default function AdjustPanel({ adjustments, onChange }) {
  const reset = () => onChange(DEFAULT_ADJ);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Adjustments</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={reset}>
          <RotateCcw className="w-3 h-3 mr-1" />Reset
        </Button>
      </div>
      {ADJUSTMENTS.map(({ key, label, min, max, def, step = 1, format }) => (
        <div key={key} className="space-y-1">
          <div className="flex justify-between items-center">
            <Label className="text-xs">{label}</Label>
            <span className="text-xs font-mono text-muted-foreground w-10 text-right">
              {format ? format(adjustments[key] ?? def) : adjustments[key] ?? def}
            </span>
          </div>
          <Slider
            value={[adjustments[key] ?? def]}
            onValueChange={([v]) => onChange({ ...adjustments, [key]: v })}
            min={min} max={max} step={step}
          />
        </div>
      ))}
    </div>
  );
}