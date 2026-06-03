import {
  Minimize2, Maximize2, Crop, Palette, ArrowRightLeft, Droplets,
  FileDown, Merge, Split, FileOutput, FileEdit, LayoutGrid, Lock, Stamp,
  Layers
} from 'lucide-react';

export const imageTools = [
  {
    title: 'Image Studio',
    description: 'Edit, transform, compress & batch-process images — all in one',
    icon: Layers,
    path: '/image/studio',
    color: 'bg-violet-500/10 text-violet-500',
  },
  {
    title: 'Compress Image',
    description: 'Reduce file size with target size or quality control',
    icon: Minimize2,
    path: '/image/compress',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    title: 'Resize Image',
    description: 'Change dimensions, resolution, and scale',
    icon: Maximize2,
    path: '/image/resize',
    color: 'bg-green-500/10 text-green-500',
  },
  {
    title: 'Crop Image',
    description: 'Free crop, fixed ratios, and social media presets',
    icon: Crop,
    path: '/image/crop',
    color: 'bg-amber-500/10 text-amber-500',
  },
  {
    title: 'Image Editor',
    description: 'Full editor with filters, adjustments, and drawing tools',
    icon: Palette,
    path: '/image/editor',
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    title: 'Convert Format',
    description: 'Convert between JPG, PNG, WEBP, BMP, and more',
    icon: ArrowRightLeft,
    path: '/image/convert',
    color: 'bg-teal-500/10 text-teal-500',
  },
  {
    title: 'Watermark',
    description: 'Add text or logo watermarks with batch support',
    icon: Droplets,
    path: '/image/watermark',
    color: 'bg-rose-500/10 text-rose-500',
  },
];

export const pdfTools = [
  {
    title: 'Compress PDF',
    description: 'Reduce PDF file size with image optimization',
    icon: FileDown,
    path: '/pdf/compress',
    color: 'bg-red-500/10 text-red-500',
  },
  {
    title: 'Merge PDFs',
    description: 'Combine multiple PDFs with drag-and-drop ordering',
    icon: Merge,
    path: '/pdf/merge',
    color: 'bg-orange-500/10 text-orange-500',
  },
  {
    title: 'Split PDF',
    description: 'Split by pages, ranges, or file size',
    icon: Split,
    path: '/pdf/split',
    color: 'bg-cyan-500/10 text-cyan-500',
  },
  {
    title: 'Convert PDF',
    description: 'Convert PDFs to images, or images to PDF',
    icon: FileOutput,
    path: '/pdf/convert',
    color: 'bg-indigo-500/10 text-indigo-500',
  },
  {
    title: 'PDF Editor',
    description: 'Add text, shapes, annotations, and signatures',
    icon: FileEdit,
    path: '/pdf/editor',
    color: 'bg-violet-500/10 text-violet-500',
  },
  {
    title: 'Organize Pages',
    description: 'Rotate, reorder, delete, and insert pages',
    icon: LayoutGrid,
    path: '/pdf/organize',
    color: 'bg-emerald-500/10 text-emerald-500',
  },
  {
    title: 'PDF Security',
    description: 'Add or remove password protection',
    icon: Lock,
    path: '/pdf/security',
    color: 'bg-yellow-500/10 text-yellow-500',
  },
  {
    title: 'PDF Watermark',
    description: 'Add text or image watermarks to pages',
    icon: Stamp,
    path: '/pdf/watermark',
    color: 'bg-pink-500/10 text-pink-500',
  },
  // OCR entry removed
];