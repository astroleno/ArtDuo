'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { frontendAgent, AgentState } from '@/lib/frontend-agent';

interface EmotionInputProps {
  className?: string;
}

export default function EmotionInput({ className = '' }: EmotionInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>('idle');

  const { setEmotionInput, setIsLoading, setCurationResult } = useAppStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setIsLoading(true);

    try {
      // 设置用户输入
      setEmotionInput({
        emotion: inputValue.trim(),
        userInput: inputValue.trim(),
      });

      // 监听Agent状态变化
      const unsubscribe = frontendAgent.onStateChange((state, data) => {
        setAgentState(state);
        console.log('🤖 Agent状态更新:', state, data);
      });

      // 执行Agent
      const result = await frontendAgent.execute(inputValue.trim(), inputValue.trim());
      
      // 设置策展结果
      setCurationResult(result);
      
      // 取消监听
      unsubscribe();

      // 跳转到画廊页面
      router.push('/gallery');

    } catch (error) {
      console.error('❌ Agent执行失败:', error);
      // 即使失败也跳转到画廊页面，显示错误信息
      router.push('/gallery');
    } finally {
      // 确保状态正确重置
      setIsSubmitting(false);
      setIsLoading(false);
      setAgentState('idle');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={`${className}`}>
      <form onSubmit={handleSubmit}>
        {/* 输入区域 */}
        <div className="relative w-full">
          <div className="relative flex h-16 items-center rounded-2xl transition-all duration-300 w-full" style={{ width: '100%', maxWidth: '100%', minWidth: '100%' }}>
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="写下此刻心境…"
              className="flex-1 rounded-2xl bg-transparent px-6 pr-16 text-lg font-light text-white placeholder:text-white/50 focus:outline-none"
              style={{ fontFamily: 'Inter, sans-serif' }}
              disabled={isSubmitting}
            />

            <button
              type="submit"
              disabled={!inputValue.trim() || isSubmitting}
              style={{ 
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                color: 'white',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'none',
                boxShadow: 'none'
              }}
            >
              <AnimatePresence mode="wait">
                {isSubmitting ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                    transition={{ duration: 0.3 }}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: '2px solid #0f172a',
                      borderTop: '2px solid transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                ) : (
                  <motion.svg
                    key="arrow"
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 4 }}
                    transition={{ duration: 0.3 }}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </motion.svg>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}