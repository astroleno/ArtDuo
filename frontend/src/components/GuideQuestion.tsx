'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface GuideQuestionProps {
  className?: string;
}

const questions = [
  "此刻，世界于你是什么颜色？",
  "让艺术为你写诗",
  "感受内心的声音",
  "某个瞬间，你感受到什么？",
  "探索情感的世界",
];

export default function GuideQuestion({ className = '' }: GuideQuestionProps) {
  const [currentQuestion, setCurrentQuestion] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuestion((prev) => (prev + 1) % questions.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, ease: 'easeOut' }}
    >
      <AnimatePresence mode="wait">
        <motion.h1
          key={questions[currentQuestion]}
          className="text-5xl md:text-6xl text-white font-light leading-tight"
          style={{ fontFamily: 'Inter, sans-serif' }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {questions[currentQuestion]}
        </motion.h1>
      </AnimatePresence>
      
      <motion.div
        className="w-32 h-px bg-gradient-to-r from-transparent via-amber-400 to-transparent mx-auto"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
      />
    </motion.div>
  );
}