// Pure client-side image processing utilities
import heic2any from 'heic2any';

export async function heicToBlob(file, targetFormat = 'image/jpeg') {
  const blob = await heic2any({
    blob: file,
    toType: targetFormat,
    quality: 0.9,
  });
  return blob;
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function imageToCanvas(img, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width || img.naturalWidth;
  canvas.height = height || img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function canvasToBlob(canvas, format = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), format, quality);
  });
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getMimeType(format) {
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp' };
  return map[format.toLowerCase()] || 'image/png';
}

export function getExtension(mimeType) {
  const map = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/bmp': 'bmp' };
  return map[mimeType] || 'png';
}

export async function compressToTargetSize(img, targetBytes, format = 'image/jpeg') {
  let lo = 0.01, hi = 1.0, bestBlob = null;
  const canvas = imageToCanvas(img);
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    const blob = await canvasToBlob(canvas, format, mid);
    if (blob.size <= targetBytes) { bestBlob = blob; lo = mid; }
    else hi = mid;
  }
  if (bestBlob) return { blob: bestBlob, achieved: bestBlob.size, success: true };
  for (let scale = 0.9; scale >= 0.05; scale -= 0.05) {
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const smallCanvas = imageToCanvas(img, w, h);
    for (let q = 0.7; q >= 0.05; q -= 0.1) {
      const blob = await canvasToBlob(smallCanvas, format, q);
      if (blob.size <= targetBytes) return { blob, achieved: blob.size, success: true };
    }
  }
  const minCanvas = imageToCanvas(img, Math.max(1, Math.round(img.naturalWidth * 0.1)), Math.max(1, Math.round(img.naturalHeight * 0.1)));
  const minBlob = await canvasToBlob(minCanvas, format, 0.01);
  return { blob: null, minBlob, minSize: minBlob.size, success: false };
}

export function applyFilters(canvas, adjustments) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const {
    brightness = 0, contrast = 0, saturation = 0, temperature = 0,
    tint = 0, gamma = 1, exposure = 0, highlights = 0, shadows = 0,
    vibrance = 0, clarity = 0, sharpness = 0,
  } = adjustments;
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const exposureFactor = Math.pow(2, exposure / 100);
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i+1], b = data[i+2];
    r *= exposureFactor; g *= exposureFactor; b *= exposureFactor;
    r += brightness * 2.55; g += brightness * 2.55; b += brightness * 2.55;
    r = contrastFactor * (r - 128) + 128;
    g = contrastFactor * (g - 128) + 128;
    b = contrastFactor * (b - 128) + 128;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (highlights !== 0 && lum > 128) {
      const f = highlights * 0.5 * ((lum - 128) / 127);
      r += f; g += f; b += f;
    }
    if (shadows !== 0 && lum < 128) {
      const f = shadows * 0.5 * ((128 - lum) / 128);
      r += f; g += f; b += f;
    }
    r += temperature * 1.5; b -= temperature * 1.5;
    g += tint * 1.5;
    const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
    const satFactor = 1 + saturation / 100;
    r = gray + satFactor * (r - gray);
    g = gray + satFactor * (g - gray);
    b = gray + satFactor * (b - gray);
    if (vibrance !== 0) {
      const maxC = Math.max(r,g,b), minC = Math.min(r,g,b);
      const sat = (maxC - minC) / (maxC + 0.0001);
      const vf = (1 - sat) * (vibrance / 100);
      const vGray = 0.2989 * r + 0.587 * g + 0.114 * b;
      r = vGray + (1 + vf) * (r - vGray);
      g = vGray + (1 + vf) * (g - vGray);
      b = vGray + (1 + vf) * (b - vGray);
    }
    if (gamma !== 1) {
      r = 255 * Math.pow(Math.max(0, r) / 255, 1 / gamma);
      g = 255 * Math.pow(Math.max(0, g) / 255, 1 / gamma);
      b = 255 * Math.pow(Math.max(0, b) / 255, 1 / gamma);
    }
    data[i] = Math.min(255, Math.max(0, r));
    data[i+1] = Math.min(255, Math.max(0, g));
    data[i+2] = Math.min(255, Math.max(0, b));
  }
  ctx.putImageData(imageData, 0, 0);
  if (sharpness > 0) applySharpness(canvas, sharpness / 100);
  return canvas;
}

function applySharpness(canvas, amount) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const src = ctx.getImageData(0, 0, w, h);
  const dst = ctx.createImageData(w, h);
  const s = src.data, d = dst.data;
  const kernel = [-1, -1, -1, -1, 9, -1, -1, -1, -1];
  for (let y = 1; y < h-1; y++) {
    for (let x = 1; x < w-1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let val = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ki = (ky+1)*3 + (kx+1);
            const si = ((y+ky)*w + (x+kx))*4 + c;
            val += s[si] * kernel[ki];
          }
        }
        d[idx+c] = Math.min(255, Math.max(0, s[idx+c] * (1 - amount) + val * amount));
      }
      d[idx+3] = s[idx+3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

export const FILTER_PRESETS = {
  none: {},
  grayscale: { saturation: -100 },
  bw: { saturation: -100, contrast: 20 },
  sepia: { saturation: -50, temperature: 30, brightness: 5 },
  vintage: { saturation: -30, contrast: -10, temperature: 15, brightness: -5 },
  warm: { temperature: 25, saturation: 10 },
  cool: { temperature: -25, saturation: 10 },
  hdr: { contrast: 30, saturation: 20, brightness: 5, clarity: 30 },
  film: { contrast: 15, saturation: -20, temperature: 10, highlights: -20, shadows: 20 },
  cinematic: { contrast: 25, saturation: -15, temperature: -10, highlights: -30, shadows: 10 },
  vivid: { saturation: 40, contrast: 20, vibrance: 30 },
  matte: { contrast: -20, brightness: 5, saturation: -10, highlights: -20 },
};

export function applyPresetFilter(canvas, filterName) {
  const preset = FILTER_PRESETS[filterName];
  if (!preset || Object.keys(preset).length === 0) return canvas;
  return applyFilters(canvas, preset);
}

export function rotateCanvas(canvas, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const newW = Math.round(canvas.width * cos + canvas.height * sin);
  const newH = Math.round(canvas.width * sin + canvas.height * cos);
  const rotated = document.createElement('canvas');
  rotated.width = newW; rotated.height = newH;
  const ctx = rotated.getContext('2d');
  ctx.translate(newW/2, newH/2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -canvas.width/2, -canvas.height/2);
  return rotated;
}

export function flipCanvas(canvas, horizontal) {
  const flipped = document.createElement('canvas');
  flipped.width = canvas.width; flipped.height = canvas.height;
  const ctx = flipped.getContext('2d');
  if (horizontal) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  else { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
  ctx.drawImage(canvas, 0, 0);
  return flipped;
}

export function cropCanvas(canvas, x, y, width, height) {
  const cropped = document.createElement('canvas');
  cropped.width = Math.max(1, width); cropped.height = Math.max(1, height);
  cropped.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
  return cropped;
}

export function resizeCanvas(canvas, newW, newH) {
  const resized = document.createElement('canvas');
  resized.width = newW; resized.height = newH;
  resized.getContext('2d').drawImage(canvas, 0, 0, newW, newH);
  return resized;
}

export function addTextWatermark(canvas, options) {
  const { text = 'Watermark', fontSize = 48, fontFamily = 'Arial', color = '#ffffff', opacity = 0.3, rotation = -30, tiled = false } = options;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (tiled) {
    const gap = fontSize * 4;
    for (let x = 0; x < canvas.width + gap; x += gap) {
      for (let y = 0; y < canvas.height + gap; y += gap) {
        ctx.save(); ctx.translate(x, y); ctx.rotate((rotation * Math.PI) / 180); ctx.fillText(text, 0, 0); ctx.restore();
      }
    }
  } else {
    ctx.translate(canvas.width/2, canvas.height/2); ctx.rotate((rotation * Math.PI) / 180); ctx.fillText(text, 0, 0);
  }
  ctx.restore();
  return canvas;
}

export const SIZE_PRESETS = {
  social: [
    { label: 'Instagram Post', w: 1080, h: 1080 },
    { label: 'Instagram Story', w: 1080, h: 1920 },
    { label: 'Instagram Reel', w: 1080, h: 1920 },
    { label: 'Facebook Post', w: 1200, h: 630 },
    { label: 'Facebook Cover', w: 851, h: 315 },
    { label: 'LinkedIn Banner', w: 1584, h: 396 },
    { label: 'LinkedIn Post', w: 1200, h: 627 },
    { label: 'YouTube Thumbnail', w: 1280, h: 720 },
    { label: 'YouTube Banner', w: 2560, h: 1440 },
    { label: 'Twitter Header', w: 1500, h: 500 },
    { label: 'TikTok Cover', w: 1080, h: 1920 },
    { label: 'Pinterest Pin', w: 1000, h: 1500 },
    { label: 'WhatsApp Status', w: 1080, h: 1920 },
  ],
  document: [
    { label: 'Passport Photo', w: 413, h: 531 },
    { label: 'Visa Photo', w: 600, h: 600 },
    { label: 'Resume Photo', w: 300, h: 400 },
    { label: 'ID Card Photo', w: 354, h: 472 },
    { label: 'Profile Picture', w: 400, h: 400 },
    { label: 'Thumbnail', w: 320, h: 180 },
    { label: 'Cover Image', w: 1600, h: 900 },
    { label: 'Poster (A3)', w: 2480, h: 3508 },
    { label: 'Flyer (A5)', w: 1748, h: 2480 },
    { label: 'A4', w: 2480, h: 3508 },
    { label: 'A3', w: 3508, h: 4961 },
    { label: 'Letter', w: 2550, h: 3300 },
    { label: 'Legal', w: 2550, h: 4200 },
  ],
  ratio: [
    { label: '1:1', ratio: 1/1 },
    { label: '4:3', ratio: 4/3 },
    { label: '3:4', ratio: 3/4 },
    { label: '16:9', ratio: 16/9 },
    { label: '9:16', ratio: 9/16 },
    { label: '5:4', ratio: 5/4 },
    { label: '2:3', ratio: 2/3 },
    { label: '3:2', ratio: 3/2 },
    { label: '21:9', ratio: 21/9 },
  ],
};