import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function applyPatch(filePath, replacements) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const { find, replace } of replacements) {
    if (content.match(find)) {
      content = content.replace(find, replace);
      changed = true;
      console.log(`  ✓ Patched: ${find}`);
    } else {
      console.warn(`  ⚠️ Not found: ${find}`);
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated ${filePath}\n`);
  } else {
    console.log(`ℹ️ No changes for ${filePath}\n`);
  }
}

// ========== 1. DrawPanel.jsx – Add Select tool + shape integration ==========
const drawPanelPatches = [
  // Add shapeTool props to component
  {
    find: /export default function DrawPanel\({ drawTool, onDrawTool, color, onColor, size, onSize, textVal, onTextVal, textSize, onTextSize, fontFamily, onFontFamily, onAddText }\)/,
    replace: `export default function DrawPanel({ drawTool, onDrawTool, color, onColor, size, onSize, textVal, onTextVal, textSize, onTextSize, fontFamily, onFontFamily, onAddText, shapeTool, onShapeTool })`
  },
  // Add Select button before other tools
  {
    find: /<div className="grid grid-cols-2 gap-1\.5">/,
    replace: `<div className="grid grid-cols-2 gap-1.5">\n        <Button variant={drawTool === 'select' ? 'default' : 'outline'} size="sm" className="text-xs justify-start h-7" onClick={() => onDrawTool('select')}>\n          🖱️ Select\n        </Button>`
  },
  // Modify shape buttons to set drawTool='select' and update shapeTool
  {
    find: /<Button key={t\.id} variant={drawTool === t\.id \? 'default' : 'outline'} size="sm"\s+className="text-xs justify-start h-7" onClick=\{\(\) => onDrawTool\(t\.id\)\}>\s+{t\.label}\s+<\/Button>/g,
    replace: (match, ...args) => {
      if (match.includes('line') || match.includes('rect') || match.includes('circle') || match.includes('arrow')) {
        return match.replace(/onClick=\{\(\) => onDrawTool\(t\.id\)\}/, `onClick={() => { onDrawTool('select'); onShapeTool(t.id); }}`);
      }
      return match;
    }
  }
];

// ========== 2. TransformPanel.jsx – Add interactive crop toggle ==========
const transformPanelPatches = [
  // Add isCropping and setIsCropping props
  {
    find: /export default function TransformPanel\({ img, rotation, onRotation, flippedH, flippedV, onFlipH, onFlipV, cropRect, onCropRect, resizeW, resizeH, onResize, lockAspect, onLockAspect }\)/,
    replace: `export default function TransformPanel({ img, rotation, onRotation, flippedH, flippedV, onFlipH, onFlipV, cropRect, onCropRect, resizeW, resizeH, onResize, lockAspect, onLockAspect, isCropping, setIsCropping })`
  },
  // Add Start Crop button in crop tab
  {
    find: /<TabsContent value="crop" className="space-y-3 mt-3">\s+<p className="text-xs text-muted-foreground">Ratio presets \(crop is applied on export\)<\/p>/,
    replace: `<TabsContent value="crop" className="space-y-3 mt-3">\n          <Button variant={isCropping ? 'destructive' : 'default'} size="sm" className="w-full text-xs" onClick={() => setIsCropping(!isCropping)}>\n            {isCropping ? '✖ Cancel Crop' : '✂ Start Crop'}\n          </Button>\n          <p className="text-xs text-muted-foreground">Ratio presets (crop is applied on export)</p>`
  }
];

// ========== 3. pdfCore.js – Mobile-friendly chunked compression ==========
const pdfCorePatches = [
  // Remove misplaced memory warning and add inside compressPdf
  {
    find: /if \(typeof navigator !== 'undefined' && navigator\.deviceMemory && navigator\.deviceMemory < 4\) {\s+console\.warn\('Low memory device – compression may be slow'\);\s+}/,
    replace: ``
  },
  // Replace compressPdf with chunked version (memory efficient)
  {
    find: /export async function compressPdf\(file, quality = 0\.6, onProgress\) {[\s\S]*?return new Blob\(\[bytes\], { type: 'application\/pdf' }\);\n}/,
    replace: `export async function compressPdf(file, quality = 0.6, onProgress) {\n  // Mobile memory warning\n  if (typeof navigator !== 'undefined' && navigator.deviceMemory && navigator.deviceMemory < 4) {\n    console.warn('Low memory device – compression may be slow');\n  }\n\n  const arrayBuffer = await readFileAsArrayBuffer(file);\n  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });\n  const totalPages = pdfDoc.getPageCount();\n  const newPdf = await PDFDocument.create();\n  const chunkSize = 5; // Process pages in batches to avoid memory spikes\n\n  // Load pdf.js document for rendering\n  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });\n  const pdfJsDoc = await loadingTask.promise;\n\n  for (let start = 0; start < totalPages; start += chunkSize) {\n    const end = Math.min(start + chunkSize, totalPages);\n    for (let i = start; i < end; i++) {\n      if (onProgress) onProgress(Math.round((i / totalPages) * 100));\n      const page = await pdfJsDoc.getPage(i + 1);\n      const viewport = page.getViewport({ scale: 1.5 });\n      const canvas = document.createElement('canvas');\n      canvas.width = viewport.width;\n      canvas.height = viewport.height;\n      const ctx = canvas.getContext('2d');\n      await page.render({ canvasContext: ctx, viewport }).promise;\n      const imgDataUrl = canvas.toDataURL('image/jpeg', quality);\n      const base64 = imgDataUrl.split(',')[1];\n      const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));\n      const jpgImage = await newPdf.embedJpg(imgBytes);\n      const newPage = newPdf.addPage([viewport.width, viewport.height]);\n      newPage.drawImage(jpgImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });\n    }\n    // Yield to event loop to allow garbage collection\n    await new Promise(resolve => setTimeout(resolve, 0));\n  }\n\n  if (onProgress) onProgress(100);\n  const bytes = await newPdf.save();\n  return new Blob([bytes], { type: 'application/pdf' });\n}`
  }
];

// ========== 4. ImageStudio.jsx – Add missing props & shapeTool ==========
// Note: ImageStudio.jsx was partially patched earlier. Now we add the missing integrations.
const imageStudioPatches = [
  // Add shapeTool state
  {
    find: /const \[drawTool, setDrawTool\] = useState\('select'\);/,
    replace: `const [drawTool, setDrawTool] = useState('select');\n  const [shapeTool, setShapeTool] = useState('rect');`
  },
  // Pass shapeTool and onShapeTool to DrawPanel
  {
    find: /<DrawPanel\n\s+drawTool=\{drawTool\}\n\s+onDrawTool=\{setDrawTool\}\n\s+color=\{drawColor\}\n\s+onColor=\{setDrawColor\}\n\s+size=\{drawSize\}\n\s+onSize=\{setDrawSize\}\n\s+textVal=\{textVal\}\n\s+onTextVal=\{setTextVal\}\n\s+textSize=\{textSize\}\n\s+onTextSize=\{setTextSize\}\n\s+fontFamily=\{fontFamily\}\n\s+onFontFamily=\{setFontFamily\}\n\s+onAddText=\{addText\}\n\s+\/>/,
    replace: `<DrawPanel\n          drawTool={drawTool}\n          onDrawTool={setDrawTool}\n          color={drawColor}\n          onColor={setDrawColor}\n          size={drawSize}\n          onSize={setDrawSize}\n          textVal={textVal}\n          onTextVal={setTextVal}\n          textSize={textSize}\n          onTextSize={setTextSize}\n          fontFamily={fontFamily}\n          onFontFamily={setFontFamily}\n          onAddText={addText}\n          shapeTool={shapeTool}\n          onShapeTool={setShapeTool}\n        />`
  },
  // Pass isCropping and setIsCropping to TransformPanel
  {
    find: /<TransformPanel\n\s+img=\{img\}\n\s+rotation=\{rotation\}\n\s+onRotation=\{setRotation\}\n\s+flippedH=\{flippedH\}\n\s+flippedV=\{flippedV\}\n\s+onFlipH=\{setFlippedH\}\n\s+onFlipV=\{setFlippedV\}\n\s+cropRect=\{cropRect\}\n\s+onCropRect=\{setCropRect\}\n\s+resizeW=\{resizeW\}\n\s+resizeH=\{resizeH\}\n\s+onResize=\{\(w, h\) => \{ setResizeW\(w\); setResizeH\(h\); \}\}\n\s+lockAspect=\{lockAspect\}\n\s+onLockAspect=\{setLockAspect\}\n\s+\/>/,
    replace: `<TransformPanel\n          img={img}\n          rotation={rotation}\n          onRotation={setRotation}\n          flippedH={flippedH}\n          flippedV={flippedV}\n          onFlipH={setFlippedH}\n          onFlipV={setFlippedV}\n          cropRect={cropRect}\n          onCropRect={setCropRect}\n          resizeW={resizeW}\n          resizeH={resizeH}\n          onResize={(w, h) => { setResizeW(w); setResizeH(h); }}\n          lockAspect={lockAspect}\n          onLockAspect={setLockAspect}\n          isCropping={isCropping}\n          setIsCropping={setIsCropping}\n        />`
  }
];

// Apply all patches
console.log('🔧 Applying patches...\n');

applyPatch(path.join(__dirname, 'src/components/studio/DrawPanel.jsx'), drawPanelPatches);
applyPatch(path.join(__dirname, 'src/components/studio/TransformPanel.jsx'), transformPanelPatches);
applyPatch(path.join(__dirname, 'src/lib/pdfCore.js'), pdfCorePatches);
applyPatch(path.join(__dirname, 'src/pages/image/ImageStudio.jsx'), imageStudioPatches);

console.log('✨ All patches applied!');
console.log('\n📱 Next steps:');
console.log('1. Run `npm run dev` and test on mobile.');
console.log('2. Ensure you have a local pdf.worker.min.js in public/ (or the existing worker path works).');
console.log('3. If any patch fails, manually check the file – the patterns are exact matches.');