import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { ThemeProvider } from '@/lib/ThemeContext';

// Page imports
import Home from '@/pages/Home';
import CompressImage from '@/pages/image/CompressImage';
import ResizeImage from '@/pages/image/ResizeImage';
import CropImage from '@/pages/image/CropImage';
import ImageEditor from '@/pages/image/ImageEditor';
import ImageStudio from '@/pages/image/ImageStudio';
import ConvertImage from '@/pages/image/ConvertImage';
import WatermarkImage from '@/pages/image/WatermarkImage';
import CompressPdf from '@/pages/pdf/CompressPdf';
import MergePdf from '@/pages/pdf/MergePdf';
import SplitPdf from '@/pages/pdf/SplitPdf';
import ConvertPdf from '@/pages/pdf/ConvertPdf';
import PdfEditor from '@/pages/pdf/PdfEditor';
import OrganizePdf from '@/pages/pdf/OrganizePdf';
import PdfSecurity from '@/pages/pdf/PdfSecurity';
import PdfWatermark from '@/pages/pdf/PdfWatermark';
// OCR route removed

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Home />} />
            {/* Image Tools */}
            <Route path="/image/studio" element={<ImageStudio />} />
            <Route path="/image/compress" element={<CompressImage />} />
            <Route path="/image/resize" element={<ResizeImage />} />
            <Route path="/image/crop" element={<CropImage />} />
            <Route path="/image/editor" element={<ImageEditor />} />
            <Route path="/image/convert" element={<ConvertImage />} />
            <Route path="/image/watermark" element={<WatermarkImage />} />
            {/* PDF Tools */}
            <Route path="/pdf/compress" element={<CompressPdf />} />
            <Route path="/pdf/merge" element={<MergePdf />} />
            <Route path="/pdf/split" element={<SplitPdf />} />
            <Route path="/pdf/convert" element={<ConvertPdf />} />
            <Route path="/pdf/editor" element={<PdfEditor />} />
            <Route path="/pdf/organize" element={<OrganizePdf />} />
            <Route path="/pdf/security" element={<PdfSecurity />} />
            <Route path="/pdf/watermark" element={<PdfWatermark />} />
            {/* OCR route removed */}
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App