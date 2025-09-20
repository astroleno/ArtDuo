'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import ArtworkCard from '@/components/ArtworkCard';
import BreathingLightTrigger from '@/components/BreathingLightTrigger';
import DialogueOverlay from '@/components/DialogueOverlay';
import ClientOnly from '@/components/ClientOnly';

// 模拟艺术作品数据
const mockArtworks = [
  {
    id: '1',
    title: '星夜',
    artist: '文森特·梵高',
    year: '1889',
    medium: '布面油画',
    dimensions: '73.7 × 92.1 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '这幅画描绘了一个充满动感的夜空，展现了艺术家内心的情感波动。',
    museum: '纽约现代艺术博物馆',
    license: 'CC0',
  },
  {
    id: '2',
    title: '蒙娜丽莎',
    artist: '列奥纳多·达·芬奇',
    year: '1503-1519',
    medium: '木板油画',
    dimensions: '77 × 53 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '世界上最著名的肖像画之一，以其神秘的微笑而闻名。',
    museum: '卢浮宫',
    license: 'CC0',
  },
  {
    id: '3',
    title: '呐喊',
    artist: '爱德华·蒙克',
    year: '1893',
    medium: '纸板蛋彩画',
    dimensions: '91 × 73.5 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '表现主义代表作，表达了现代人的焦虑和孤独。',
    museum: '挪威国家美术馆',
    license: 'CC0',
  },
  {
    id: '4',
    title: '向日葵',
    artist: '文森特·梵高',
    year: '1888',
    medium: '布面油画',
    dimensions: '92 × 73 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '梵高最著名的静物画之一，展现了生命的活力和希望。',
    museum: '伦敦国家美术馆',
    license: 'CC0',
  },
  {
    id: '5',
    title: '格尔尼卡',
    artist: '巴勃罗·毕加索',
    year: '1937',
    medium: '布面油画',
    dimensions: '349.3 × 776.6 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '反战主题的杰作，表达了艺术家对战争的愤怒和悲痛。',
    museum: '索菲亚王后国家艺术中心',
    license: 'CC0',
  },
  {
    id: '6',
    title: '睡莲',
    artist: '克劳德·莫奈',
    year: '1919',
    medium: '布面油画',
    dimensions: '100 × 200 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '印象派大师的晚期作品，展现了光影变化的魅力。',
    museum: '橘园美术馆',
    license: 'CC0',
  },
  {
    id: '7',
    title: '最后的晚餐',
    artist: '列奥纳多·达·芬奇',
    year: '1495-1498',
    medium: '壁画',
    dimensions: '460 × 880 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '文艺复兴时期的杰作，描绘了耶稣与门徒的最后晚餐。',
    museum: '圣玛丽亚感恩教堂',
    license: 'CC0',
  },
  {
    id: '8',
    title: '创世纪',
    artist: '米开朗基罗',
    year: '1508-1512',
    medium: '壁画',
    dimensions: '14 × 40 m',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '西斯廷教堂的天顶画，展现了上帝创造亚当的经典场景。',
    museum: '梵蒂冈西斯廷教堂',
    license: 'CC0',
  },
  {
    id: '9',
    title: '夜巡',
    artist: '伦勃朗',
    year: '1642',
    medium: '布面油画',
    dimensions: '363 × 437 cm',
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&h=600&fit=crop',
    description: '荷兰黄金时代的杰作，展现了光影大师的精湛技艺。',
    museum: '阿姆斯特丹国家博物馆',
    license: 'CC0',
  },
];

export default function GalleryPage() {
  return (
    <ClientOnly fallback={
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-accent-secondary border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <p className="text-text-secondary text-lg">加载中...</p>
        </div>
      </div>
    }>
      <GalleryPageContent />
    </ClientOnly>
  );
}

function GalleryPageContent() {
  const router = useRouter();
  const { 
    emotionInput, 
    curationResult,
    artworks, 
    setArtworks, 
    isDialogueOpen, 
    setIsDialogueOpen,
    selectedArtwork,
    setSelectedArtwork 
  } = useAppStore();

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查是否有情绪输入
    if (!emotionInput.emotion) {
      router.push('/');
      return;
    }

    // 如果有策展结果，直接使用
    if (curationResult && curationResult.success) {
      console.log('📦 使用策展结果:', curationResult);
      setArtworks(curationResult.artworks);
      setIsLoading(false);
      return;
    }

    // 否则调用API（降级方案）
    const loadArtworks = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/curate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            emotion: emotionInput.emotion,
            userInput: emotionInput.userInput
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to load artworks');
        }

        const data = await response.json();
        if (data.success) {
          setArtworks(data.artworks);
        } else {
          throw new Error(data.error || 'Failed to load artworks');
        }
      } catch (error) {
        console.error('Failed to load artworks:', error);
        // 降级到模拟数据
        setArtworks(mockArtworks);
      } finally {
        setIsLoading(false);
      }
    };

    loadArtworks();
  }, [emotionInput.emotion, emotionInput.userInput, curationResult, router, setArtworks]);

  const handleArtworkClick = (artwork: any) => {
    setSelectedArtwork(artwork);
  };

  const handleDialogueToggle = () => {
    setIsDialogueOpen(!isDialogueOpen);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <motion.div
            className="w-16 h-16 border-4 border-accent-secondary border-t-transparent rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <p className="text-text-secondary text-lg">正在为你策展...</p>
          <p className="text-text-muted text-sm mt-2">基于「{emotionInput.emotion}」的情绪</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary">
      {/* 头部信息 */}
      <motion.div
        className="p-6 md:p-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.button
            onClick={() => router.push('/')}
            className="
              text-text-secondary hover:text-accent-secondary
              transition-colors duration-300
              mb-4
            "
            whileHover={{ x: -5 }}
            transition={{ duration: 0.2 }}
          >
            ← 返回
          </motion.button>
          
          <h1 className="text-display text-2xl md:text-3xl text-text-primary font-light mb-2">
            情绪展览：{emotionInput.emotion}
          </h1>
          <p className="text-text-secondary text-sm md:text-base">
            为你精心策展的 9 件艺术作品
          </p>
        </div>
      </motion.div>

      {/* 3×3 网格布局 */}
      <motion.div
        className="max-w-6xl mx-auto px-6 md:px-8 pb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {artworks.map((artwork, index) => (
            <motion.div
              key={artwork.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ 
                delay: index * 0.1, 
                duration: 0.6,
                ease: 'easeOut'
              }}
            >
              <ArtworkCard
                artwork={artwork}
                onClick={() => handleArtworkClick(artwork)}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 呼吸灯触发点 */}
      <motion.div
        className="fixed bottom-8 right-8 z-50"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
      >
        <BreathingLightTrigger
          onClick={handleDialogueToggle}
          size="lg"
        />
      </motion.div>

      {/* AI 对话弹层 */}
      <AnimatePresence>
        {isDialogueOpen && (
          <DialogueOverlay
            onClose={() => setIsDialogueOpen(false)}
            artwork={selectedArtwork}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
