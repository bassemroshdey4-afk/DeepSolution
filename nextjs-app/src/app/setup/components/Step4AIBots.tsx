'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  AlertCircle
} from 'lucide-react';

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
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);

  // Check if AI is relevant based on support mode
  const showAIOptions = data.support_mode === 'bot' || data.support_mode === 'hybrid';

  const toggleChannel = (field: 'whatsapp_bot_enabled' | 'meta_bot_enabled' | 'sales_agent_enabled') => {
    const newValue = !data[field];
    onUpdate({ 
      [field]: newValue,
      ai_bots_enabled: newValue || data.whatsapp_bot_enabled || data.meta_bot_enabled || data.sales_agent_enabled
    });
  };

  const toggleScenario = (scenarioId: string) => {
    setSelectedScenarios(prev => 
      prev.includes(scenarioId) 
        ? prev.filter(s => s !== scenarioId)
        : [...prev, scenarioId]
    );
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-600/50 flex items-center justify-center">
            <Bot className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">روبوتات الذكاء الاصطناعي</h2>
          <p className="text-slate-400">اخترت الدعم البشري فقط</p>
        </div>

        <div className="p-6 bg-slate-700/30 border border-slate-600 rounded-xl text-center mb-8">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-300 mb-2">
            بما أنك اخترت الدعم البشري فقط، يمكنك تخطي هذه الخطوة.
          </p>
          <p className="text-slate-500 text-sm">
            يمكنك تفعيل روبوتات الذكاء الاصطناعي لاحقاً من الإعدادات.
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
            السابق
          </button>
          <button
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
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
          <Bot className="w-8 h-8 text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">روبوتات الذكاء الاصطناعي</h2>
        <p className="text-slate-400">اختر القنوات التي تريد تفعيل الروبوت عليها</p>
      </div>

      {/* Bot Channels */}
      <div className="mb-8">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          قنوات الروبوت
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {BOT_CHANNELS.map((channel, index) => {
            const isEnabled = data[channel.field];
            const colors = colorClasses[channel.color];
            
            return (
              <motion.button
                key={channel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => toggleChannel(channel.field)}
                className={`
                  p-4 rounded-xl border-2 text-center transition-all duration-200
                  ${isEnabled 
                    ? `${colors.bg} ${colors.border}` 
                    : 'bg-slate-700/50 border-slate-600 hover:border-slate-500'}
                `}
              >
                <channel.icon 
                  className={`w-8 h-8 mx-auto mb-2 ${isEnabled ? colors.text : 'text-slate-400'}`} 
                />
                <p className={`font-medium ${isEnabled ? 'text-white' : 'text-slate-300'}`}>
                  {channel.title}
                </p>
                <p className="text-slate-400 text-xs mt-1">{channel.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* AI Scenarios */}
      <div className="mb-8">
        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          سيناريوهات الذكاء الاصطناعي
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {AI_SCENARIOS.map((scenario, index) => {
            const isSelected = selectedScenarios.includes(scenario.id);
            const colors = colorClasses[scenario.color];
            
            return (
              <motion.button
                key={scenario.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => toggleScenario(scenario.id)}
                className={`
                  p-3 rounded-xl border transition-all duration-200 text-right
                  ${isSelected 
                    ? `${colors.bg} ${colors.border}` 
                    : 'bg-slate-700/30 border-slate-600 hover:border-slate-500'}
                `}
              >
                <div className="flex items-center gap-3">
                  <scenario.icon 
                    className={`w-5 h-5 ${isSelected ? colors.text : 'text-slate-400'}`} 
                  />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {scenario.title}
                    </p>
                    <p className="text-slate-500 text-xs">{scenario.description}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
          السابق
        </button>
        <button
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
        </button>
      </div>
    </div>
  );
}
