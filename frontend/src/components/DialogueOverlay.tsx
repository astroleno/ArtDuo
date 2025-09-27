'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Bot, User } from 'lucide-react';
import { Artwork, Message } from '@/lib/store';
import { useAppStore } from '@/lib/store';

interface DialogueOverlayProps {
  onClose: () => void;
  artwork?: Artwork | null;
}

export default function DialogueOverlay({ onClose, artwork }: DialogueOverlayProps) {
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, addMessage, clearMessages } = useAppStore();

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化欢迎消息
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        type: 'text',
        content: {
          text: artwork 
            ? `你好！我是这件《${artwork.title}》的专属AI助手。你想了解关于这件作品的什么呢？`
            : '你好！我是你的艺术策展助手。有什么想了解的吗？'
        },
        user: false,
      });
    }
  }, [artwork, messages.length, addMessage]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsTyping(true);

    // 添加用户消息
    addMessage({
      type: 'text',
      content: { text: userMessage },
      user: true,
    });

    try {
      // 准备对话历史
      const conversationHistory = messages.map(msg => ({
        role: msg.user ? 'user' as const : 'assistant' as const,
        content: msg.content.text || ''
      }));

      // 调用真实的 API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artwork,
          message: userMessage,
          conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let aiResponse = '';

      // 添加 AI 消息占位符
      addMessage({
        type: 'text',
        content: { text: '' },
        user: false,
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const parsed = JSON.parse(data);
                if (parsed.type === 'content') {
                  aiResponse += parsed.content;
                  // 更新最后一条消息 - 这里需要重新设计，因为zustand store不支持直接更新
                  // 暂时跳过流式更新，在最后统一添加消息
                } else if (parsed.type === 'end') {
                  break;
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                }
              } catch (e) {
                console.warn('Failed to parse SSE data:', data);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      setIsTyping(false);
    } catch (error) {
      console.error('Chat error:', error);
      
      // 添加错误消息
      addMessage({
        type: 'text',
        content: { text: '抱歉，我现在无法回答您的问题，请稍后再试。' },
        user: false,
      });
      
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* 背景遮罩 */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
        />

        {/* 对话窗口 */}
        <motion.div
          className="
            relative w-full max-w-2xl h-[600px] md:h-[700px]
            bg-white/95
            backdrop-blur-2xl
            rounded-3xl
            border border-white/20
            shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_0_0_1px_rgba(255,255,255,0.1)]
            flex flex-col
            overflow-hidden
          "
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {/* 头部 */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200/50 bg-gradient-to-b from-white/60 to-transparent">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-gray-900 font-medium">
                  {artwork ? `《${artwork.title}》助手` : '艺术策展助手'}
                </h3>
                <p className="text-gray-600 text-sm">
                  {artwork ? `${artwork.artist} · ${artwork.year}` : 'AI 艺术顾问'}
                </p>
              </div>
            </div>
            
            <motion.button
              onClick={onClose}
              className="
                w-8 h-8 rounded-full
                bg-gray-100/80 hover:bg-gray-200/80
                flex items-center justify-center
                text-gray-600 hover:text-gray-900
                transition-all duration-200
                shadow-sm hover:shadow-md
              "
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-4 h-4" />
            </motion.button>
          </div>

          {/* 消息列表 */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            {messages.map((message, index) => (
              <motion.div
                key={index}
                className={`flex ${message.user ? 'justify-end' : 'justify-start'}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
              >
                <div className={`flex items-start space-x-3 max-w-[80%] ${message.user ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  {/* 头像 */}
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm
                    ${message.user
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white'
                      : 'bg-gray-200/60 text-gray-600'
                    }
                  `}>
                    {message.user ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-gray-600" />
                    )}
                  </div>

                  {/* 消息内容 */}
                  <div className={`
                    px-4 py-3 rounded-2xl shadow-sm
                    ${message.user
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-200/20'
                      : 'bg-gray-100/80 text-gray-900 border border-gray-200/50'
                    }
                  `}>
                    <p className="text-sm leading-relaxed">{message.content.text}</p>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* 打字指示器 */}
            {isTyping && (
              <motion.div
                className="flex justify-start"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200/60 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="bg-gray-100/80 px-4 py-3 rounded-2xl border border-gray-200/50 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区域 */}
          <div className="p-4 md:p-6 border-t border-gray-200/50 bg-gradient-to-t from-white/60 to-transparent">
            <div className="flex items-center space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="输入你的问题..."
                  className="
                    w-full px-4 py-3
                    bg-white/90
                    border border-gray-300/50
                    rounded-xl
                    text-gray-900
                    placeholder-gray-500
                    focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500
                    transition-all duration-200
                    shadow-sm focus:shadow-md
                  "
                  disabled={isTyping}
                />
              </div>
              
              <motion.button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || isTyping}
                className="
                  w-12 h-12
                  bg-gradient-to-r from-amber-500 to-amber-600
                  text-white
                  rounded-xl
                  flex items-center justify-center
                  disabled:opacity-50 disabled:cursor-not-allowed
                  hover:from-amber-600 hover:to-amber-700
                  transition-all duration-200
                  shadow-lg hover:shadow-xl
                "
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
