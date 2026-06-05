import React, { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RotateCw, FlipHorizontal, FlipVertical, Lock, Unlock } from 'lucide-react';
import { SIZE_PRESETS } from '@/lib/imageUtils';

export default function TransformPanel({ 
  img, rotation, onRotation, 
  flippedH, flippedV, onFlipH, onFlipV, 
  cropRect, onCropRect, 
  resizeW, resizeH, onResize, lockAspect, onLockAspect,
  cropMode, setCropMode 
}) {
  const [unit, setUnit] = useState('px');
  const [resizeMode, setResizeMode] = useState('pixels');
  const [dpi, setDpi] = useState(72);
  const [cropRatio, setCropRatio] = useState('free');

  const origW = img?.naturalWidth || resizeW;
  const origH = img?.naturalHeight || resizeH;
  const aspectRatio = origW && origH ? origW / origH : 1;

  const handleWidth = (v) => {
    const n = parseInt(v) || 1;
    onResize(n, lockAspect ? Math.round(n / aspectRatio) : resizeH);
  };
  const handleHeight = (v) => {
    const n = parseInt(v) || 1;
    onResize(lockAspect ? Math.round(n * aspectRatio) : resizeW, n);
  };
  const handlePercent = (pct) => {
    const p = parseFloat(pct) / 100;
    onResize(Math.round(origW * p), Math.round(origH * p));
  };

  const applyRatioPreset = (ratio) => {
    setCropRatio(ratio.label || 'free');
    if (!ratio.ratio || !img) return;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const r = ratio.ratio;
    let cw, ch;
    if (iw / ih > r) { ch = ih; cw = Math.round(ih * r); }
    else { cw = iw; ch = Math.round(iw / r); }
    const cx = Math.round((iw - cw) / 2), cy = Math.round((ih - ch) / 2);
    onCropRect({ x: cx, y: cy, w: cw, h: ch });
  };

  const applySizePreset = (preset) => {
    onResize(preset.w, preset.h);
  };

  return (
    <div className="space-y-3">
      <Tabs defaultValue="rotate">
        <TabsList className="grid w-full grid-cols-3 text-xs h-8">
          <TabsTrigger value="rotate" className="text-xs">Rotate</TabsTrigger>
          <TabsTrigger value="resize" className="text-xs">Resize</TabsTrigger>
          <TabsTrigger value="crop" className="text-xs">Crop</TabsTrigger>
        </TabsList>

        {/* ROTATE / FLIP */}
        <TabsContent value="rotate" className="space-y-3 mt-3">
          <div className="grid grid-cols-4 gap-1.5">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onRotation((rotation - 90 + 360) % 360)}>↺ 90°</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onRotation((rotation + 90) % 360)}>↻ 90°</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onRotation((rotation + 180) % 360)}>↻ 180°</Button>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => onRotation(0)}>Reset</Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between"><Label className="text-xs">Fine rotation</Label><span className="text-xs font-mono">{rotation}°</span></div>
            <Slider value={[rotation]} onValueChange={([v]) => onRotation(v)} min={0} max={359} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button variant={flippedH ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => onFlipH(!flippedH)}>
              <FlipHorizontal className="w-3.5 h-3.5 mr-1" />Flip H
            </Button>
            <Button variant={flippedV ? 'default' : 'outline'} size="sm" className="text-xs" onClick={() => onFlipV(!flippedV)}>
              <FlipVertical className="w-3.5 h-3.5 mr-1" />Flip V
            </Button>
          </div>
        </TabsContent>

        {/* RESIZE */}
        <TabsContent value="resize" className="space-y-3 mt-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs flex-1" onClick={() => onLockAspect(!lockAspect)}>
              {lockAspect ? <Lock className="w-3 h-3 mr-1" /> : <Unlock className="w-3 h-3 mr-1" />}
              {lockAspect ? 'Locked' : 'Unlocked'}
            </Button>
            <Select value={resizeMode} onValueChange={setResizeMode}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pixels">Pixels</SelectItem>
                <SelectItem value="percent">Percent</SelectItem>
                <SelectItem value="preset">Presets</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {resizeMode === 'pixels' && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Width (px)</Label>
                <Input type="number" value={resizeW} onChange={e => handleWidth(e.target.value)} className="h-8 text-xs" /></div>
              <div className="space-y-1"><Label className="text-xs">Height (px)</Label>
                <Input type="number" value={resizeH} onChange={e => handleHeight(e.target.value)} className="h-8 text-xs" /></div>
            </div>
          )}

          {resizeMode === 'percent' && (
            <div className="space-y-2">
              <Label className="text-xs">Scale (%)</Label>
              <Input type="number" placeholder="100" defaultValue="100"
                onChange={e => handlePercent(e.target.value)} className="h-8 text-xs w-24" />
              <p className="text-xs text-muted-foreground">→ {resizeW} × {resizeH} px</p>
            </div>
          )}

          {resizeMode === 'preset' && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground">Social Media</p>
              {SIZE_PRESETS.social.map(p => (
                <button key={p.label} onClick={() => applySizePreset(p)}
                  className="w-full flex justify-between items-center text-xs px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                  <span>{p.label}</span><span className="text-muted-foreground font-mono">{p.w}×{p.h}</span>
                </button>
              ))}
              <p className="text-xs font-semibold text-muted-foreground mt-2">Documents</p>
              {SIZE_PRESETS.document.map(p => (
                <button key={p.label} onClick={() => applySizePreset(p)}
                  className="w-full flex justify-between items-center text-xs px-2 py-1.5 rounded-lg hover:bg-muted/60 transition-colors">
                  <span>{p.label}</span><span className="text-muted-foreground font-mono">{p.w}×{p.h}</span>
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground">Current: {resizeW} × {resizeH} px (orig: {origW} × {origH})</p>
        </TabsContent>

        {/* CROP */}
        <TabsContent value="crop" className="space-y-3 mt-3">
          <div className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
            <Label className="text-xs font-semibold">✂ Crop Mode</Label>
            <Switch checked={cropMode} onCheckedChange={setCropMode} />
          </div>
          <p className="text-xs text-muted-foreground">
            {cropMode ? 'Drag on canvas to select crop area. Drawing tools are disabled.' : 'Turn on Crop Mode to crop, then turn off to draw.'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Ratio presets (apply after cropping)</p>
          <div className="grid grid-cols-3 gap-1.5">
            {SIZE_PRESETS.ratio.map(r => (
              <Button key={r.label} variant={cropRatio === r.label ? 'default' : 'outline'} size="sm" className="text-xs"
                onClick={() => applyRatioPreset(r)}>{r.label}</Button>
            ))}
          </div>
          {cropRect && (
            <div className="p-2 rounded-lg bg-muted/50 text-xs space-y-1">
              <p>x: {cropRect.x}, y: {cropRect.y}</p>
              <p>w: {cropRect.w}, h: {cropRect.h}</p>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2 mt-1" onClick={() => { onCropRect(null); setCropRatio('free'); }}>Clear crop</Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}