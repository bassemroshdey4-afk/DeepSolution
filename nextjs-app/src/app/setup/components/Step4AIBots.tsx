'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  MessageCircle, 
  Facebook, 
  ShoppingCart,
  CheckCircle,
  Phone,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Eye
} from 'lucide-react';
import ChatPreview from './ChatPreview';

interface SetupData {
  support_mode: 'human' | 'bot' | 'hybrid';
  ai_bots_enabled: boolean;
  whatsapp_bot_enabled: boolean;
  meta_bot_enabled: boolean;
  sales_agent_enabled: boolean;
  [key: string]: any;
}

interface Props {
  data: SetupData;
  onUpdate: (data: Partial<SetupData>) => void;
  onNext: (data?: Partial<SetupData>) => void;
  onBack: () => void;
  saving: boolean;
}

const AI_SCENARIOS = [
  { 
    id: 'order_confirmation', 
    title: 'تأكيد الطلبات', 
    description: 'إرسال رسائل تأكيد تلقائية للعملاء',
    icon: CheckCircle,
    color: 'emerald'
  },
  { 
    id: 'sales', 
    title: 'مبيعات ذكية', 
    description: 'الرد على استفسارات وتقديم توصيات',
    icon: ShoppingCart,
    color: 'blue'
  },
  { 
    id: 'support', 
    title: 'دعم العملاء', 
    description: 'الرد على الأسئلة الشائعة',
    icon: MessageCircle,
    color: 'purple'
  },
  { 
    id: 'follow_up', 
    title: 'متابعة ما بعد البيع', 
    description: 'رسائل متابعة وطلب تقييم',
    icon: Phone,
    color: 'orange'
  },
];

const BOT_CHANNELS = [
  { 
    id: 'whatsapp', 
    title: 'واتساب', 
    description: 'روبوت واتساب للتواصل مع العملاء',
    icon: MessageCircle,
    color: 'green',
    field: 'whatsapp_bot_enabled' as const
  },
  { 
    id: 'meta', 
    title: 'ماسنجر وانستجرام', 
    description: 'روبوت للرد على رسائل فيسبوك وانستجرام',
    icon: Facebook,
    color: 'blue',
    field: 'meta_bot_enabled' as const
  },
  { 
    id: 'sales', 
    title: 'وكيل مبيعات ذكي', 
    description: 'AI يساعد في إتمام عمليات البيع',
    icon: ShoppingCart,
    color: 'purple',
    field: 'sales_agent_enabled' as const
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-400' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-400' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-400' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-400' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-400' },
};

export default function Step4AIBots({ data, onUpdate, onNext, onBack, saving }: Props) {
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>(['order_confirmation']);
  const [activePreview, setActivePreview] = useState<{
    botType: 'whatsapp' | 'meta' | 'sales';
    scenario: 'order_confirmation' | 'sales' | 'support' | 'follow_up';
  } | null>(null);

  // Check if AI is relevant based on support mode
  const showAIOptions = data.support_mode === 'bot' || data.support_mode === 'hybrid';

  // Get the first enabled bot type for preview
  const getActiveBotType = (): 'whatsapp' | 'meta' | 'sales' => {
    if (data.whatsapp_bot_enabled) return 'whatsapp';
    if (data.meta_bot_enabled) return 'meta';
    if (data.sales_agent_enabled) return 'sales';
    return 'whatsapp';
  };

  const toggleChannel = (field: 'whatsapp_bot_enabled' | 'meta_bot_enabled' | 'sales_agent_enabled') => {
    const newValue = !data[field];
    onUpdate({ 
      [field]: newValue,
      ai_bots_enabled: newValue || data.whatsapp_bot_enabled || data.meta_bot_enabled || data.sales_agent_enabled
    });
    
    // Show preview when enabling a channel
    if (newValue) {
      const botType = field === 'whatsapp_bot_enabled' ? 'whatsapp' : 
                      field === 'meta_bot_enabled' ? 'meta' : 'sales';
      setActivePreview({ 
        botType, 
        scenario: selectedScenarios[0] as any || 'order_confirmation' 
      });
    }
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => {
      const newScenarios = prev.includes(scenarioId) 
        ? prev.filter(s => s !== scenarioId)
        : [...prev, scenarioId];
      
      // Show preview when selecting a scenario
      if (!prev.includes(scenarioId) && (data.whatsapp_bot_enabled || data.meta_bot_enabled || data.sales_agent_enabled)) {
        setActivePreview({
          botType: getActiveBotType(),
          scenario: scenarioId as any
        });
      }
      
      return newScenarios;
    });
  };

  const handleNext = () => {
    const anyBotEnabled = data.whatsapp_bot_enabled || data.meta_bot_enabled || data.sales_agent_enabled;
    onNext({ 
      ai_bots_enabled: anyBotEnabled,
      whatsapp_bot_enabled: data.whatsapp_bot_enabled,
      meta_bot_enabled: data.meta_bot_enabled,
      sales_agent_enabled: data.sales_agent_enabled,
    });
  };

  // If human-only support, show skip message
  if (!showAIOptions) {
    return (
      <div>
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-600/50 flex items-center justify-center"
          >
            <Bot className="w-8 h-8 text-slate-400" />
          </motion.div>
          <h2 className="text-2xl font-bold text-white mb-2">روبوتات الذكاء الاصطناعي</h2>
          <p className="text-slate-400">اخترت الدعم البشري فقط</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 bg-slate-700/30 border border-slate-600 rounded-xl text-center mb-8"
        >
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-300 mb-2">
            بما أنك اخترت الدعم البشري فقط، يمكنك تخطي هذه الخطوة.
          </p>
          <p className="text-slate-500 text-sm">
            يمكنك تفعيل روبوتات الذكاء الاصطناعي لاحقاً من الإعدادات.
          </p>
        </motion.div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
            السابق
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNext}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                تخطي والمتابعة
                <ChevronLeft className="w-5 h-5" />
              </>
            )}
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center"
        >
          <Bot className="w-8 h-8 text-purple-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">روبوتات الذكاء الاصطناعي</h2>
        <p className="text-slate-400">اختر القنوات والسيناريوهات لتفعيل الروبوت</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Settings */}
        <div className="space-y-6">
          {/* Bot Channels */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              قنوات الروبوت
            </h3>
            <div className="space-y-3">
              {BOT_CHANNELS.map((channel, index) => {
                const isEnabled = data[channel.field];
                const colors = colorClasses[channel.color];
                
                return (
                  <motion.button
                    key={channel.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => toggleChannel(channel.field)}
                    className={`
                      w-full p-4 rounded-xl border-2 text-right transition-all duration-200
                      ${isEnabled 
                        ? `${colors.bg} ${colors.border}` 
                        : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg ${isEnabled ? colors.bg : 'bg-slate-600'} flex items-center justify-center`}>
                        <channel.icon 
                          className={`w-5 h-5 ${isEnabled ? colors.text : 'text-slate-400'}`} 
                        />
                      </div>
                      <div className="flex-1">
                        <p className={`font-medium ${isEnabled ? 'text-white' : 'text-slate-300'}`}>
                          {channel.title}
                        </p>
                        <p className="text-slate-500 text-xs">{channel.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        isEnabled ? `${colors.border} ${colors.bg}` : 'border-slate-500'
                      }`}>
                        {isEnabled && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={`w-2.5 h-2.5 rounded-full ${colors.text.replace('text-', 'bg-')}`}
                          />
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* AI Scenarios */}
          <div>
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <Bot className="w-4 h-4 text-purple-400" />
              سيناريوهات الذكاء الاصطناعي
              <span className="text-xs text-slate-500">(اضغط للمعاينة)</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {AI_SCENARIOS.map((scenario, index) => {
                const isSelected = selectedScenarios.includes(scenario.id);
                const colors = colorClasses[scenario.color];
                const anyBotEnabled = data.whatsapp_bot_enabled || data.meta_bot_enabled || data.sales_agent_enabled;
                
                return (
                  <motion.button
                    key={scenario.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleScenario(scenario.id)}
                    className={`
                      p-3 rounded-xl border transition-all duration-200 text-right relative
                      ${isSelected 
                        ? `${colors.bg} ${colors.border}` 
                        : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'}
                    `}
                  >
                    <div className="flex items-center gap-2">
                      <scenario.icon 
                        className={`w-4 h-4 ${isSelected ? colors.text : 'text-slate-400'}`} 
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                          {scenario.title}
                        </p>
                      </div>
                    </div>
                    {isSelected && anyBotEnabled && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute top-1 left-1"
                      >
                        <Eye className="w-3 h-3 text-slate-400" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column - Chat Preview */}
        <div>
          <h3 className="text-white font-medium mb-3 flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-400" />
            معاينة المحادثة
          </h3>
          <AnimatePresence mode="wait">
            {activePreview && (data.whatsapp_bot_enabled || data.meta_bot_enabled || data.sales_agent_enabled) ? (
              <ChatPreview
                key={`${activePreview.botType}-${activePreview.scenario}`}
                botType={activePreview.botType}
                scenario={activePreview.scenario}
                isActive={true}
              />
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-64 bg-slate-700/30 border border-slate-600 rounded-xl flex items-center justify-center"
              >
                <div className="text-center">
                  <Bot className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">فعّل قناة لمعاينة المحادثة</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
          السابق
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 text-white rounded-xl font-medium transition-colors"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            <>
              التالي
              <ChevronLeft className="w-5 h-5" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
