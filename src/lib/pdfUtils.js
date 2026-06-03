// PDF utility functions using jsPDF (installed) and browser APIs
// downloadBlob re-exported from pdfCore for backward compat
export { downloadBlob } from './pdfCore';
import jsPDF from 'jspdf';

export function imagesToPdf(images) {
  // images: array of { dataUrl, width, height }
  if (!images.length) return null;

  const pdf = new jsPDF({
    orientation: images[0].width > images[0].height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [images[0].width, images[0].height],
  });

  images.forEach((img, i) => {
    if (i > 0) {
      pdf.addPage([img.width, img.height], img.width > img.height ? 'landscape' : 'portrait');
    }
    pdf.addImage(img.dataUrl, 'JPEG', 0, 0, img.width, img.height);
  });

  return pdf;
}

export function downloadPdf(pdf, filename = 'output.pdf') {
  pdf.save(filename);
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}