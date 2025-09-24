'use client';

import { motion } from 'framer-motion';

interface DetailedAnalysisProps {
  artwork: {
    detailedAnalysis?: {
      emotionalJourney: string;
      artisticInsights: string;
      historicalStory: string;
      personalConnection: string;
      viewingExperience: string;
    };
  };
}

function Section({ title, icon, children, className = '' }: {
  title: string;
  icon?: string;
  children: string;
  className?: string;
}) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-center gap-2 text-text-primary mb-2">
        {icon && <span>{icon}</span>}
        <div className="font-medium">{title}</div>
      </div>
      <div className="text-text-secondary text-sm leading-relaxed pl-6">
        {children}
      </div>
    </div>
  );
}

export default function DetailedAnalysis({ artwork }: DetailedAnalysisProps) {
  return (
    <motion.div
      className="w-[800px] min-h-[400px] bg-background-secondary/10 backdrop-blur-gallery rounded-xl p-6 border border-background-secondary/20 text-left"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      id="detailed-analysis"
      role="region"
      aria-label="详细分析内容"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="情绪陪伴" icon="💙">
          {artwork.detailedAnalysis?.emotionalJourney}
        </Section>
        <Section title="艺术洞察" icon="🎨">
          {artwork.detailedAnalysis?.artisticInsights}
        </Section>
        <Section title="历史故事" icon="📖">
          {artwork.detailedAnalysis?.historicalStory}
        </Section>
        <Section title="个人启发" icon="✨">
          {artwork.detailedAnalysis?.personalConnection}
        </Section>
      </div>
      <Section title="观看建议" icon="👁️" className="mt-6">
        {artwork.detailedAnalysis?.viewingExperience}
      </Section>
    </motion.div>
  );
}