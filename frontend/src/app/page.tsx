'use client';

import { motion } from 'framer-motion';
import DynamicBackground from '@/components/DynamicBackground';
import GuideQuestion from '@/components/GuideQuestion';
import EmotionInput from '@/components/EmotionInput';
import ClientOnly from '@/components/ClientOnly';

export default function HomePage() {
  return (
    <ClientOnly
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full mx-auto mb-6 animate-spin" />
            <p className="text-slate-300 text-lg font-light">加载中...</p>
          </div>
        </div>
      }
    >
      <HomePageContent />
    </ClientOnly>
  );
}

function HomePageContent() {
  return (
    <DynamicBackground>
      <div className="min-h-screen flex flex-col">
        {/* 顶部Logo */}
        <motion.header
          className="pt-12 pb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="header-container">
            <div className="header-content">
              <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'Inter, sans-serif' }}>ArtDuo</h1>
              <p className="text-xs text-slate-400 tracking-widest" style={{ fontFamily: 'Inter, sans-serif' }}>CURATE</p>
            </div>
          </div>
        </motion.header>

        {/* 主内容区域 */}
        <main className="flex-1 flex items-center justify-center px-8">
          <div className="max-w-2xl mx-auto text-center">
            {/* 轮播标题 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 1 }}
              style={{ marginBottom: '20px' }}
            >
              <GuideQuestion />
            </motion.div>

            {/* 输入区域 */}
            <div className="input-container" style={{ marginBottom: '80px' }}>
              <EmotionInput />
              {/* 副文案 - 空间叙事感 */}
              <p className="text-sm text-slate-400 font-light" style={{ fontFamily: 'Inter, sans-serif', marginTop: '20px' }}>
                让艺术回应你的情绪
              </p>
            </div>
          </div>
        </main>

      </div>
    </DynamicBackground>
  );
}