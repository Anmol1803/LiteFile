import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

const POSITIONS = ['Top Left', 'Top Center', 'Top Right', 'Center Left', 'Center', 'Center Right', 'Bottom Left', 'Bottom Center', 'Bottom Right'];

export default function WatermarkPanel({ wm, onChange, onApply }) {
  const set = (key, val) => onChange({ ...wm, [key]: val });
  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Watermark</span>
      <div className="space-y-1.5">
        <Label className="text-xs">Watermark Text</Label>
        <Input value={wm.text} onChange={e => set('text', e.target.value)} className="h-8 text-xs" placeholder="e.g. © My Brand" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={wm.color} onChange={e => set('color', e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-border" />
          <Input value={wm.color} onChange={e => set('color', e.target.value)} className="h-8 text-xs flex-1 font-mono" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex justify-between"><Label className="text-xs">Opacity</Label><span className="text-xs font-mono">{Math.round(wm.opacity * 100)}%</span></div>
          <Slider value={[wm.opacity * 100]} onValueChange={([v]) => set('opacity', v / 100)} min={5} max={100} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between"><Label className="text-xs">Font Size</Label><span className="text-xs font-mono">{wm.fontSize}px</span></div>
          <Slider value={[wm.fontSize]} onValueChange={([v]) => set('fontSize', v)} min={8} max={200} />
        </div>
        <div className="space-y-1">
          <div className="flex justify-between"><Label className="text-xs">Rotation</Label><span className="text-xs font-mono">{wm.rotation}°</span></div>
          <Slider value={[wm.rotation]} onValueChange={([v]) => set('rotation', v)} min={-180} max={180} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Position</Label>
        <Select value={wm.position} onValueChange={v => set('position', v)}>
          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{POSITIONS.map(p => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Tile (repeat)</Label>
        <Switch checked={wm.tiled} onCheckedChange={v => set('tiled', v)} />
      </div>
      <Button size="sm" className="w-full text-xs h-8" onClick={onApply} disabled={!wm.text}>Apply Watermark</Button>
    </div>
  );
}