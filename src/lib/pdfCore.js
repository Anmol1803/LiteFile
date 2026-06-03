// Core PDF processing using pdf-lib + pdfjs-dist
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mammoth from 'mammoth';

// ✅ Set worker to local file (no CDN dependency)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

// ─── HELPERS ───────────────────────────────────────────────────────────────

export async function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

// ─── PDF TO TEXT (returns string) ──────────────────────────────────────────
export async function pdfToText(file, onProgress) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdfDoc.numPages;
  let fullText = '';
  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress(Math.round((i / totalPages) * 100));
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }
  return fullText;
}

// ─── PDF TO DOCX (returns Blob) ────────────────────────────────────────────
export async function pdfToDocx(file, onProgress) {
  const text = await pdfToText(file, onProgress);
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const paragraphs = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`Converted from ${file.name}`)],
    }),
    new Paragraph({ text: '' }),
  ];
  for (const line of lines) {
    paragraphs.push(new Paragraph({
      children: [new TextRun(line)],
    }));
  }
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return blob;
}

// ─── PDF TO HTML (returns string) ──────────────────────────────────────────
export async function pdfToHtml(file, onProgress) {
  const images = await pdfToImages(file, 'image/jpeg', 1.5, onProgress);
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Converted PDF</title>
<style>body{margin:0;padding:20px;background:#333;display:flex;flex-direction:column;align-items:center;}
img{max-width:100%;margin:10px 0;box-shadow:0 4px 20px rgba(0,0,0,0.5);}</style></head><body>\n`;
  for (const img of images) {
    html += `<img src="${img.dataUrl}" alt="${img.name}" />\n`;
  }
  html += `</body></html>`;
  return html;
}

// ─── PDF TO MARKDOWN (returns string) ──────────────────────────────────────
export async function pdfToMarkdown(file, onProgress) {
  const text = await pdfToText(file, onProgress);
  return text; // plain text is valid markdown
}

// ─── PDF TO RTF (returns string) ───────────────────────────────────────────
export async function pdfToRtf(file, onProgress) {
  const text = await pdfToText(file, onProgress);
  const rtf = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 ${text.replace(/\n/g, '\\par ')} }`;
  return rtf;
}

// ─── PDF COMPRESSION ────────────────────────────────────────────────────────
export async function compressPdfToTarget(file, targetBytes, onProgress) {
  const QUALITY_STEPS = [0.7, 0.55, 0.4, 0.28, 0.18, 0.1, 0.05];
  let lastBlob = null;

  for (let qi = 0; qi < QUALITY_STEPS.length; qi++) {
    const q = QUALITY_STEPS[qi];
    if (onProgress) onProgress(Math.round((qi / QUALITY_STEPS.length) * 95));
    const blob = await compressPdf(file, q, null);
    if (!lastBlob || blob.size < lastBlob.size) lastBlob = blob;
    if (blob.size <= targetBytes) {
      if (onProgress) onProgress(100);
      return { success: true, blob };
    }
  }

  if (onProgress) onProgress(100);
  return {
    success: false,
    blob: null,
    minBlob: lastBlob,
    minSize: lastBlob?.size || 0,
    reason: 'Further compression would result in unreadable content or invalid document structure.',
  };
}

export async function compressPdf(file, quality = 0.6, onProgress) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
  const pdfJsDoc = await loadingTask.promise;
  const newPdf = await PDFDocument.create();

  for (let i = 0; i < totalPages; i++) {
    if (onProgress) onProgress(Math.round((i / totalPages) * 100));
    const page = await pdfJsDoc.getPage(i + 1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64 = imgDataUrl.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const jpgImage = await newPdf.embedJpg(imgBytes);
    const newPage = newPdf.addPage([viewport.width, viewport.height]);
    newPage.drawImage(jpgImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  }

  if (onProgress) onProgress(100);
  const bytes = await newPdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF MERGE ──────────────────────────────────────────────────────────────
export async function mergePdfs(files, onProgress) {
  const merged = await PDFDocument.create();
  for (let fi = 0; fi < files.length; fi++) {
    if (onProgress) onProgress(Math.round((fi / files.length) * 80));
    const ab = await readFileAsArrayBuffer(files[fi]);
    const doc = await PDFDocument.load(ab, { ignoreEncryption: true });
    const copiedPages = await merged.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach(p => merged.addPage(p));
  }
  if (onProgress) onProgress(95);
  const bytes = await merged.save();
  if (onProgress) onProgress(100);
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF SPLIT ──────────────────────────────────────────────────────────────
export async function splitPdfByRanges(file, ranges) {
  const ab = await readFileAsArrayBuffer(file);
  const srcDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
  const results = [];
  for (const [start, end] of ranges) {
    const newDoc = await PDFDocument.create();
    const indices = [];
    for (let i = start - 1; i <= end - 1 && i < srcDoc.getPageCount(); i++) indices.push(i);
    const pages = await newDoc.copyPages(srcDoc, indices);
    pages.forEach(p => newDoc.addPage(p));
    const bytes = await newDoc.save();
    results.push({ blob: new Blob([bytes], { type: 'application/pdf' }), name: `split_${start}-${end}.pdf` });
  }
  return results;
}

export function parsePageRanges(rangeStr, totalPages) {
  const ranges = [];
  const parts = rangeStr.split(',').map(s => s.trim());
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (!isNaN(a) && !isNaN(b)) ranges.push([a, Math.min(b, totalPages)]);
    } else {
      const n = Number(part);
      if (!isNaN(n) && n >= 1 && n <= totalPages) ranges.push([n, n]);
    }
  }
  return ranges;
}

export async function getPdfPageCount(file) {
  const ab = await readFileAsArrayBuffer(file);
  const doc = await PDFDocument.load(ab, { ignoreEncryption: true });
  return doc.getPageCount();
}

// ─── PDF TO IMAGES ──────────────────────────────────────────────────────────
export async function pdfToImages(file, format = 'image/jpeg', scale = 2, onProgress) {
  const ab = await readFileAsArrayBuffer(file);
  const pdfDoc = await pdfjsLib.getDocument({ data: ab }).promise;
  const totalPages = pdfDoc.numPages;
  const images = [];
  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress(Math.round((i / totalPages) * 100));
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const quality = format === 'image/jpeg' ? 0.92 : undefined;
    const dataUrl = canvas.toDataURL(format, quality);
    const ext = format === 'image/jpeg' ? 'jpg' : format.split('/')[1];
    images.push({ dataUrl, name: `page_${i}.${ext}` });
  }
  return images;
}

// ─── IMAGES TO PDF ───────────────────────────────────────────────────────────
export async function imagesToPdfLib(imageFiles, onProgress) {
  const pdfDoc = await PDFDocument.create();
  for (let i = 0; i < imageFiles.length; i++) {
    if (onProgress) onProgress(Math.round((i / imageFiles.length) * 100));
    const ab = await readFileAsArrayBuffer(imageFiles[i]);
    const bytes = new Uint8Array(ab);
    const type = imageFiles[i].type;
    let img;
    if (type === 'image/png') {
      img = await pdfDoc.embedPng(bytes);
    } else {
      // Convert to JPEG via canvas
      const file = imageFiles[i];
      const dataUrl = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = e => res(e.target.result);
        reader.readAsDataURL(file);
      });
      const htmlImg = await new Promise(res => {
        const img = new Image();
        img.onload = () => res(img);
        img.src = dataUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = htmlImg.naturalWidth;
      canvas.height = htmlImg.naturalHeight;
      canvas.getContext('2d').drawImage(htmlImg, 0, 0);
      const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = jpegDataUrl.split(',')[1];
      const jpegBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
      img = await pdfDoc.embedJpg(jpegBytes);
    }
    const page = pdfDoc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  if (onProgress) onProgress(100);
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── OTHER CONVERSIONS (to PDF) ─────────────────────────────────────────────
export async function docxToPdf(file) {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage();
  const lines = text.split('\n');
  let y = page.getHeight() - 50;
  for (const line of lines) {
    if (y < 50) break;
    page.drawText(line.slice(0, 80), { x: 50, y, size: 12, font });
    y -= 20;
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function txtToPdf(file) {
  const text = await file.text();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage();
  const lines = text.split('\n');
  let y = page.getHeight() - 50;
  for (const line of lines) {
    if (y < 50) break;
    page.drawText(line.slice(0, 80), { x: 50, y, size: 12, font });
    y -= 20;
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function htmlToPdf(file) {
  const html = await file.text();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage();
  const lines = html.replace(/<[^>]*>/g, '').split('\n');
  let y = page.getHeight() - 50;
  for (const line of lines) {
    if (y < 50) break;
    page.drawText(line.slice(0, 80), { x: 50, y, size: 10, font });
    y -= 15;
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

export async function markdownToPdf(file) {
  const text = await file.text();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage();
  const lines = text.split('\n');
  let y = page.getHeight() - 50;
  for (const line of lines) {
    if (y < 50) break;
    page.drawText(line.slice(0, 80), { x: 50, y, size: 12, font });
    y -= 20;
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── ORGANIZE PDF ────────────────────────────────────────────────────────────
export async function organizePdf(file, operations) {
  const ab = await readFileAsArrayBuffer(file);
  const srcDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
  const newDoc = await PDFDocument.create();
  const { pageOrder, rotations = {}, deletedPages = new Set() } = operations;
  for (const origIdx of pageOrder) {
    if (deletedPages.has(origIdx)) continue;
    const [copiedPage] = await newDoc.copyPages(srcDoc, [origIdx]);
    if (rotations[origIdx]) {
      copiedPage.setRotation(degrees(rotations[origIdx]));
    }
    newDoc.addPage(copiedPage);
  }
  const bytes = await newDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF SECURITY ────────────────────────────────────────────────────────────
export async function encryptPdf(file, userPassword, ownerPassword, permissions = {}) {
  const ab = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
  const bytes = await pdfDoc.save({
    userPassword,
    ownerPassword: ownerPassword || userPassword,
    permissions: {
      printing: permissions.allowPrinting ? 'highResolution' : 'none',
      modifying: !permissions.disableEditing,
      copying: !permissions.disableCopying,
      annotating: !permissions.disableAnnotating,
      fillingForms: !permissions.disableEditing,
      contentAccessibility: true,
      documentAssembly: !permissions.disableEditing,
    },
  });
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF WATERMARK ────────────────────────────────────────────────────────────
export async function addPdfTextWatermark(file, options) {
  const { text, opacity = 0.3, rotation = -45, fontSize = 60, color = '#888888', pages = 'all', customRange = '' } = options;
  const ab = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const allPages = pdfDoc.getPages();
  let pageIndices = allPages.map((_, i) => i);
  if (pages === 'first') pageIndices = [0];
  else if (pages === 'last') pageIndices = [allPages.length - 1];
  else if (pages === 'custom') {
    const ranges = parsePageRanges(customRange, allPages.length);
    pageIndices = [];
    for (const [s, e] of ranges) {
      for (let i = s - 1; i < e; i++) pageIndices.push(i);
    }
  }
  const rgbColor = hexToRgb(color);
  for (const idx of pageIndices) {
    const page = allPages[idx];
    const { width, height } = page.getSize();
    page.drawText(text, {
      x: width / 2 - (text.length * fontSize * 0.3),
      y: height / 2,
      size: fontSize,
      font,
      color: rgbColor,
      opacity,
      rotate: degrees(rotation),
    });
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

// ─── PDF ANNOTATIONS (Editor) ────────────────────────────────────────────────
export async function applyPdfAnnotations(file, annotations) {
  const ab = await readFileAsArrayBuffer(file);
  const pdfDoc = await PDFDocument.load(ab, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();
  for (const ann of annotations) {
    const page = pages[ann.pageIndex];
    if (!page) continue;
    const { height } = page.getSize();
    const pdfY = height - ann.y - (ann.height || 0);
    const color = ann.color ? hexToRgb(ann.color) : rgb(0, 0, 0);
    switch (ann.type) {
      case 'text':
        page.drawText(ann.text || '', {
          x: ann.x, y: pdfY + (ann.height || 0),
          size: ann.fontSize || 14,
          font: ann.bold ? boldFont : font,
          color,
          opacity: ann.opacity || 1,
        });
        break;
      case 'rect':
        page.drawRectangle({
          x: ann.x, y: pdfY,
          width: ann.width || 100, height: ann.height || 50,
          borderColor: color, borderWidth: ann.strokeWidth || 2,
          color: ann.fill ? color : undefined,
          opacity: ann.opacity || 0.5,
        });
        break;
      case 'circle':
        page.drawEllipse({
          x: ann.x + (ann.width || 60) / 2, y: pdfY + (ann.height || 60) / 2,
          xScale: (ann.width || 60) / 2, yScale: (ann.height || 60) / 2,
          borderColor: color, borderWidth: ann.strokeWidth || 2,
          opacity: ann.opacity || 0.5,
        });
        break;
      case 'line':
        page.drawLine({
          start: { x: ann.x, y: pdfY + (ann.height || 0) },
          end: { x: ann.x + (ann.width || 100), y: pdfY },
          color, thickness: ann.strokeWidth || 2,
          opacity: ann.opacity || 1,
        });
        break;
      case 'highlight':
        page.drawRectangle({
          x: ann.x, y: pdfY,
          width: ann.width || 100, height: ann.height || 20,
          color: rgb(1, 1, 0), opacity: 0.3,
        });
        break;
    }
  }
  const bytes = await pdfDoc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}