'use client';

import { motion } from 'framer-motion';

interface ProgressIndicatorProps {
  currentIndex: number;
  total: number;
}

export default function ProgressIndicator({ currentIndex, total }: ProgressIndicatorProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <motion.div
            key={index}
            className={`rounded-full transition-all duration-300 ${
              index === currentIndex
                ? 'w-6 h-1.5 bg-accent-primary'
                : index < currentIndex
                  ? 'w-1.5 h-1.5 bg-accent-primary/30'
                  : 'w-1.5 h-1.5 bg-background-secondary'
            }`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
      <div className="text-center text-text-muted text-sm mt-2">
        {currentIndex + 1} / {total}
      </div>
    </div>
  );
}