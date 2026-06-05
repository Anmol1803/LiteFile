import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DRAW_TOOLS = [
  { id: 'select', label: '🖱️ Select' },
  { id: 'pen', label: '✏ Pen' },
  { id: 'brush', label: '🖌 Brush' },
  { id: 'highlighter', label: '🟡 Highlight' },
  { id: 'line', label: '╱ Line' },
  { id: 'rect', label: '▭ Rect' },
  { id: 'circle', label: '○ Circle' },
  { id: 'arrow', label: '→ Arrow' },
  { id: 'eraser', label: '⬜ Eraser' },
];

const FONT_FAMILIES = ['Arial', 'Georgia', 'Courier New', 'Impact', 'Verdana', 'Times New Roman'];

export default function DrawPanel({ drawTool, onDrawTool, color, onColor, size, onSize, textVal, onTextVal, textSize, onTextSize, fontFamily, onFontFamily, onAddText }) {
  return (
    <div className="space-y-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Drawing Tools</span>
      <div className="grid grid-cols-2 gap-1.5">
        {DRAW_TOOLS.map(t => (
          <Button key={t.id} variant={drawTool === t.id ? 'default' : 'outline'} size="sm"
            className="text-xs justify-start h-7" onClick={() => onDrawTool(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Color</Label>
        <div className="flex items-center gap-2">
          <input type="color" value={color} onChange={e => onColor(e.target.value)} className="w-10 h-8 rounded cursor-pointer border border-border" />
          <Input value={color} onChange={e => onColor(e.target.value)} className="h-8 text-xs flex-1 font-mono" />
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between"><Label className="text-xs">Size</Label><span className="text-xs font-mono">{size}px</span></div>
        <Slider value={[size]} onValueChange={([v]) => onSize(v)} min={1} max={60} />
      </div>
      {/* Text tool */}
      <div className="border-t border-border pt-3 space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text Tool</span>
        <Input value={textVal} onChange={e => onTextVal(e.target.value)} placeholder="Enter text to stamp…" className="text-xs h-8" />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1"><Label className="text-xs">Font size</Label>
            <Input type="number" value={textSize} onChange={e => onTextSize(Number(e.target.value))} className="h-8 text-xs" /></div>
          <div className="space-y-1"><Label className="text-xs">Font</Label>
            <Select value={fontFamily} onValueChange={onFontFamily}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{FONT_FAMILIES.map(f => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" className="w-full text-xs h-8" onClick={onAddText} disabled={!textVal}>
          Stamp Text at Center
        </Button>
      </div>
    </div>
  );
}