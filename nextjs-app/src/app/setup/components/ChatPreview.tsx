'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, User, Send, Sparkles } from 'lucide-react';

interface Message {
  id: number;
  type: 'bot' | 'user';
  text: string;
  typing?: boolean;
}

interface Props {
  botType: 'whatsapp' | 'meta' | 'sales';
  scenario: 'order_confirmation' | 'sales' | 'support' | 'follow_up';
  isActive: boolean;
}

// Demo conversations for different scenarios
const DEMO_CONVERSATIONS: Record<string, Message[]> = {
  order_confirmation: [
    { id: 1, type: 'user', text: 'مرحباً، هل تم شحن طلبي؟' },
    { id: 2, type: 'bot', text: 'مرحباً! 👋 دعني أتحقق من طلبك...' },
    { id: 3, type: 'bot', text: '✅ نعم! طلبك رقم #12345 تم شحنه اليوم وسيصلك خلال 2-3 أيام عمل.' },
    { id: 4, type: 'bot', text: 'رقم التتبع: SA123456789\nهل تحتاج أي مساعدة أخرى؟' },
  ],
  sales: [
    { id: 1, type: 'user', text: 'أبحث عن هاتف جديد' },
    { id: 2, type: 'bot', text: 'أهلاً! 📱 سأساعدك في اختيار الهاتف المناسب.' },
    { id: 3, type: 'bot', text: 'ما هي ميزانيتك التقريبية؟\n1️⃣ أقل من 2000 ريال\n2️⃣ 2000-4000 ريال\n3️⃣ أكثر من 4000 ريال' },
    { id: 4, type: 'user', text: '2' },
    { id: 5, type: 'bot', text: '🌟 ممتاز! أنصحك بـ iPhone 14 أو Samsung S23\nكلاهما متوفر مع خصم 15% هذا الأسبوع!' },
  ],
  support: [
    { id: 1, type: 'user', text: 'المنتج وصل مكسور' },
    { id: 2, type: 'bot', text: 'نأسف جداً لهذا الإزعاج! 😔' },
    { id: 3, type: 'bot', text: 'سأساعدك في حل المشكلة فوراً. هل يمكنك إرسال صورة للمنتج؟' },
    { id: 4, type: 'user', text: '📷 [صورة]' },
    { id: 5, type: 'bot', text: '✅ تم استلام الصورة. سنرسل لك منتج بديل خلال 24 ساعة مجاناً.\nهل تريد استرداد المبلغ بدلاً من ذلك؟' },
  ],
  follow_up: [
    { id: 1, type: 'bot', text: 'مرحباً أحمد! 👋\nنتمنى أن يكون طلبك قد وصلك بسلام.' },
    { id: 2, type: 'bot', text: 'كيف كانت تجربتك مع المنتج؟\n⭐⭐⭐⭐⭐' },
    { id: 3, type: 'user', text: '⭐⭐⭐⭐⭐ ممتاز!' },
    { id: 4, type: 'bot', text: '🎉 سعداء بذلك!\nكهدية شكر، إليك كود خصم 10% على طلبك القادم: THANKS10' },
  ],
};

const BOT_COLORS: Record<string, { bg: string; accent: string }> = {
  whatsapp: { bg: 'bg-green-900/30', accent: 'bg-green-500' },
  meta: { bg: 'bg-blue-900/30', accent: 'bg-blue-500' },
  sales: { bg: 'bg-purple-900/30', accent: 'bg-purple-500' },
};

export default function ChatPreview({ botType, scenario, isActive }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const colors = BOT_COLORS[botType] || BOT_COLORS.whatsapp;
  const conversation = DEMO_CONVERSATIONS[scenario] || DEMO_CONVERSATIONS.order_confirmation;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Animate messages one by one
  useEffect(() => {
    if (!isActive) {
      setMessages([]);
      setCurrentIndex(0);
      return;
    }

    if (currentIndex >= conversation.length) return;

    const timer = setTimeout(() => {
      const nextMessage = conversation[currentIndex];
      
      // Add typing indicator for bot messages
      if (nextMessage.type === 'bot') {
        setMessages(prev => [...prev, { ...nextMessage, typing: true }]);
        
        // Replace with actual message after delay
        setTimeout(() => {
          setMessages(prev => 
            prev.map(m => m.id === nextMessage.id ? { ...m, typing: false } : m)
          );
          setCurrentIndex(prev => prev + 1);
        }, 800);
      } else {
        setMessages(prev => [...prev, nextMessage]);
        setCurrentIndex(prev => prev + 1);
      }
    }, currentIndex === 0 ? 500 : 1200);

    return () => clearTimeout(timer);
  }, [isActive, currentIndex, conversation]);

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`${colors.bg} border border-slate-600 rounded-xl overflow-hidden`}
    >
      {/* Chat Header */}
      <div className={`${colors.accent} px-4 py-3 flex items-center gap-3`}>
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-white font-medium text-sm">روبوت DeepSolution</p>
          <p className="text-white/70 text-xs flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            متصل الآن
          </p>
        </div>
        <div className="mr-auto">
          <Sparkles className="w-4 h-4 text-white/50" />
        </div>
      </div>

      {/* Chat Messages */}
      <div className="h-48 overflow-y-auto p-3 space-y-3">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`
                  max-w-[80%] px-3 py-2 rounded-xl text-sm
                  ${message.type === 'user' 
                    ? 'bg-slate-600 text-white rounded-tr-none' 
                    : `${colors.accent} text-white rounded-tl-none`}
                `}
              >
                {message.typing ? (
                  <div className="flex gap-1 py-1">
                    <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-white/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                ) : (
                  <p className="whitespace-pre-line">{message.text}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input (disabled, just for show) */}
      <div className="border-t border-slate-600 p-3">
        <div className="flex items-center gap-2 bg-slate-700/50 rounded-lg px-3 py-2">
          <input
            type="text"
            placeholder="اكتب رسالة..."
            disabled
            className="flex-1 bg-transparent text-slate-400 text-sm outline-none"
          />
          <Send className="w-4 h-4 text-slate-500" />
        </div>
      </div>
    </motion.div>
  );
}
