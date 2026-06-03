import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ToolCard({ tool, index }) {
  const { title, description, icon: Icon, path, color } = tool;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.4 }}
    >
      <Link to={path} className="block group">
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 h-full transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold text-base mb-1.5">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          <div className="absolute bottom-6 right-6 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-4 h-4 text-primary" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}