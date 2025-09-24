'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NavigationButtonsProps {
  onPrev: () => void;
  onNext: () => void;
}

export default function NavigationButtons({ onPrev, onNext }: NavigationButtonsProps) {
  return (
    <>
      <motion.button
        onClick={onPrev}
        className="fixed top-1/2 left-4 -translate-y-1/2 bg-background-secondary/40 text-text-secondary rounded-full w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-gallery z-30 hover:bg-background-secondary/80 hover:text-accent-primary"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Previous artwork"
      >
        <ChevronLeft className="w-5 h-5" />
      </motion.button>

      <motion.button
        onClick={onNext}
        className="fixed top-1/2 right-4 -translate-y-1/2 bg-background-secondary/40 text-text-secondary rounded-full w-12 h-12 flex items-center justify-center cursor-pointer transition-all duration-300 backdrop-blur-gallery z-30 hover:bg-background-secondary/80 hover:text-accent-primary"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        aria-label="Next artwork"
      >
        <ChevronRight className="w-5 h-5" />
      </motion.button>
    </>
  );
}