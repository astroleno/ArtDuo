import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Artwork } from '@/lib/curation/types';

// 重新导出类型以保持兼容性
export type { Artwork };

export interface EmotionInput {
  emotion: string;
  userInput?: string;
  emotionCurve?: EmotionCurve;
}

export interface CurationResult {
  success: boolean;
  artworks: Artwork[];
  curation: {
    theme: string;
    description: string;
    emotionCurve: number[];
    totalWorks: number;
  };
  analysis: {
    emotion_analysis: string;
    art_styles: string[];
    search_keywords: string[];
    recommended_artists: string[];
    curation_strategy: string;
  };
  source: 'mcp' | 'api' | 'fallback';
  executionTime: number;
}

export interface EmotionCurve {
  id: string;
  name: string;
  description: string;
  points: number[];
}

export interface Message {
  id: string;
  type: 'text' | 'image' | 'card';
  content: {
    text?: string;
    imageUrl?: string;
    artwork?: Artwork;
  };
  user: boolean;
  timestamp: Date;
}

export interface ChatContext {
  currentArtwork: Artwork | null;
  exhibition: Artwork[];
  emotionInput: EmotionInput;
}

// 状态接口
interface AppState {
  // 用户输入状态
  emotionInput: EmotionInput;
  setEmotionInput: (input: EmotionInput) => void;
  
  // 策展结果状态
  curationResult: CurationResult | null;
  setCurationResult: (result: CurationResult | null) => void;
  
  // 展览状态
  artworks: Artwork[];
  selectedArtwork: Artwork | null;
  currentArtworkIndex: number;
  setArtworks: (artworks: Artwork[]) => void;
  setSelectedArtwork: (artwork: Artwork | null) => void;
  setCurrentArtworkIndex: (index: number) => void;
  
  // UI 状态
  isDetailModalOpen: boolean;
  isDialogueOpen: boolean;
  isLoading: boolean;
  error: string | null;
  setIsDetailModalOpen: (open: boolean) => void;
  setIsDialogueOpen: (open: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 对话状态
  messages: Message[];
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  
  // 主题状态
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  
  // 缓存状态
  visitedArtworks: string[];
  addVisitedArtwork: (artworkId: string) => void;
}

// 创建 store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 用户输入状态
      emotionInput: {
        emotion: '',
        userInput: '',
      },
      setEmotionInput: (input) => set({ emotionInput: input }),
      
      // 策展结果状态
      curationResult: null,
      setCurationResult: (result) => set({ curationResult: result }),
      
      // 展览状态
      artworks: [],
      selectedArtwork: null,
      currentArtworkIndex: 0,
      setArtworks: (artworks) => set({ artworks }),
      setSelectedArtwork: (artwork) => set({ selectedArtwork: artwork }),
      setCurrentArtworkIndex: (index) => set({ currentArtworkIndex: index }),
      
      // UI 状态
      isDetailModalOpen: false,
      isDialogueOpen: false,
      isLoading: false,
      error: null,
      setIsDetailModalOpen: (open) => set({ isDetailModalOpen: open }),
      setIsDialogueOpen: (open) => set({ isDialogueOpen: open }),
      setIsLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      
      // 对话状态
      messages: [],
      addMessage: (message) => {
        const newMessage: Message = {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date(),
        };
        set((state) => ({
          messages: [...state.messages, newMessage],
        }));
      },
      clearMessages: () => set({ messages: [] }),
      
      // 主题状态
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      
      // 缓存状态
      visitedArtworks: [],
      addVisitedArtwork: (artworkId) => {
        set((state) => ({
          visitedArtworks: [...state.visitedArtworks.filter(id => id !== artworkId), artworkId],
        }));
      },
    }),
    {
      name: 'artduo-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        theme: state.theme,
        visitedArtworks: state.visitedArtworks,
      }),
    }
  )
);

// 预设情绪曲线
export const emotionCurves: EmotionCurve[] = [
  {
    id: 'melancholy',
    name: '忧郁',
    description: '从深沉到宁静的情绪旅程',
    points: [0.2, 0.1, 0.3, 0.4, 0.2, 0.1, 0.3, 0.5, 0.4],
  },
  {
    id: 'joy',
    name: '喜悦',
    description: '充满活力的快乐体验',
    points: [0.8, 0.9, 0.7, 0.8, 0.9, 0.8, 0.7, 0.8, 0.9],
  },
  {
    id: 'serenity',
    name: '宁静',
    description: '平和安详的心灵之旅',
    points: [0.5, 0.6, 0.5, 0.4, 0.5, 0.6, 0.5, 0.4, 0.5],
  },
  {
    id: 'passion',
    name: '激情',
    description: '强烈而炽热的情感波动',
    points: [0.9, 0.7, 0.8, 0.9, 0.6, 0.8, 0.9, 0.7, 0.8],
  },
  {
    id: 'contemplation',
    name: '沉思',
    description: '深度思考的智慧之旅',
    points: [0.3, 0.4, 0.2, 0.3, 0.5, 0.4, 0.3, 0.2, 0.4],
  },
];

// 工具函数
export const getCurrentEmotionCurve = (emotion: string): EmotionCurve => {
  const curve = emotionCurves.find(c => c.id === emotion);
  return curve || emotionCurves[0];
};

export const generateArtworkId = (): string => {
  return `artwork_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
