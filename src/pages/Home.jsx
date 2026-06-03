import React from 'react';
import { motion } from 'framer-motion';
import Navbar from '@/components/dashboard/Navbar';
import ToolCard from '@/components/dashboard/ToolCard';
import { imageTools, pdfTools } from '@/lib/toolsConfig';
import { FileImage, FileText, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <img src="/LiteFile.png" alt="LiteFile" className="w-40 h-40 mx-auto mb-6" />
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
            Universal PDF &<br />
            <span className="text-primary">Image Toolkit</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Powerful image and PDF tools that run entirely in your browser.
            No uploads to servers. Fast, private, and free.
          </p>
        </motion.div>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileImage className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Image Tools</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {imageTools.map((tool, i) => (
              <ToolCard key={tool.path} tool={tool} index={i} />
            ))}
          </div>
        </section>

        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">PDF Tools</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pdfTools.map((tool, i) => (
              <ToolCard key={tool.path} tool={tool} index={i + imageTools.length} />
            ))}
          </div>
        </section>

        <footer className="text-center py-8 border-t border-border/50 space-y-2">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <ShieldCheck className="w-4 h-4" />
            <p className="text-sm">All processing happens in your browser. Your files never leave your device.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}