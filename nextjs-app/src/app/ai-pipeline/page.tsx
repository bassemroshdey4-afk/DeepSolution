'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Deep Intelligence™ Page
 * 
 * AI-powered product analysis and marketing recommendations.
 * Features the premium "Thinking Experience" loading states.
 */

import { useState } from 'react';
import { AppShell, PageHeader } from '@/components/layout';
import { 
  DeepIntelligenceThinking, 
  DeepIntelligenceSkeleton,
  PRODUCT_ANALYSIS_STAGES,
} from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  Upload,
  Image as ImageIcon,
  FileText,
  ArrowLeft,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  CheckCircle2,
  AlertCircle,
  Zap,
  MessageSquare,
} from 'lucide-react';

type PipelineStep = 'input' | 'analyzing' | 'results';

interface AnalysisResult {
  targetAudience: string[];
  uniqueSellingPoints: string[];
  pricingStrategy: {
    suggestedPriceRange: string;
    profitMargin: string;
    priceSensitivity: string;
  };
  marketingChannels: Array<{
    channel: string;
    priority: string;
  }>;
  competitiveAdvantages: string[];
  marketingMessages: string[];
  summary: string;
  isFallback?: boolean;
}

export default function DeepIntelligencePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [step, setStep] = useState<PipelineStep>('input');
  const [currentStage, setCurrentStage] = useState(0);
  const [productDescription, setProductDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Real AI analysis
  const handleAnalyze = async () => {
    if (!productDescription.trim()) return;
    
    setStep('analyzing');
    setCurrentStage(0);
    setError(null);

    // Simulate stage progression while waiting for API
    const stageInterval = setInterval(() => {
      setCurrentStage(prev => {
        if (prev < PRODUCT_ANALYSIS_STAGES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1500);

    try {
      const response = await fetch('/api/ai/analyze-product', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: productDescription,
          imageUrl: selectedImage ? URL.createObjectURL(selectedImage) : null,
        }),
      });

      const data = await response.json();

      clearInterval(stageInterval);
      setCurrentStage(PRODUCT_ANALYSIS_STAGES.length);

      if (data.success && data.analysis) {
        setAnalysisResult(data.analysis);
        await new Promise(resolve => setTimeout(resolve, 500));
        setStep('results');
      } else {
        throw new Error(data.error || 'فشل التحليل');
      }
    } catch (err) {
      clearInterval(stageInterval);
      console.error('Analysis error:', err);
      setError('حدث خطأ أثناء التحليل. يرجى المحاولة مرة أخرى.');
      setStep('input');
    }
  };

  const handleReset = () => {
    setStep('input');
    setCurrentStage(0);
    setProductDescription('');
    setSelectedImage(null);
    setAnalysisResult(null);
    setError(null);
  };

  if (authLoading) {
    return (
      <AppShell>
        <div className="p-6">
          <DeepIntelligenceSkeleton lines={5} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <PageHeader
          title="Deep Intelligence™"
          description="تحليل ذكي لمنتجاتك وتوصيات استراتيجية مبنية على البيانات"
        />

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Input Step */}
        {step === 'input' && (
          <div className="mt-8 space-y-6">
            {/* Product Image Upload */}
            <div className="ds-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                صورة المنتج
              </h3>
              <div 
                className={cn(
                  'border-2 border-dashed rounded-xl p-8 text-center',
                  'transition-colors duration-200',
                  selectedImage 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                )}
              >
                {selectedImage ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                    <p className="text-sm text-foreground">{selectedImage.name}</p>
                    <button 
                      onClick={() => setSelectedImage(null)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      إزالة
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      اسحب الصورة هنا أو انقر للاختيار
                    </p>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden"
                      onChange={(e) => setSelectedImage(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Product Description */}
            <div className="ds-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                وصف المنتج
              </h3>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="اكتب وصفاً تفصيلياً للمنتج... ما هو؟ ما مميزاته؟ من الجمهور المستهدف؟"
                className={cn(
                  'w-full h-32 p-4 rounded-lg border border-border',
                  'bg-background text-foreground placeholder:text-muted-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'resize-none transition-colors'
                )}
              />
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              disabled={!productDescription.trim()}
              className={cn(
                'w-full py-4 rounded-xl font-semibold text-lg',
                'flex items-center justify-center gap-3',
                'transition-all duration-200',
                productDescription.trim()
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
            >
              <Sparkles className="h-5 w-5" />
              بدء التحليل الذكي
            </button>
          </div>
        )}

        {/* Analyzing Step */}
        {step === 'analyzing' && (
          <div className="mt-8">
            <DeepIntelligenceThinking
              stages={PRODUCT_ANALYSIS_STAGES}
              currentStage={currentStage}
              title="Deep Intelligence™"
              showDescriptions={true}
              className="min-h-[400px]"
            />
          </div>
        )}

        {/* Results Step */}
        {step === 'results' && analysisResult && (
          <div className="mt-8 space-y-6">
            {/* Success Header */}
            <div className="ds-card p-6 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    اكتمل التحليل الذكي
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {analysisResult.isFallback 
                      ? 'تم استخدام التحليل الافتراضي (يرجى التحقق من إعدادات API)'
                      : 'تم تحليل منتجك وإعداد التوصيات الاستراتيجية'}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary */}
            {analysisResult.summary && (
              <div className="ds-card p-6 bg-gradient-to-r from-primary/5 to-transparent">
                <p className="text-foreground leading-relaxed">{analysisResult.summary}</p>
              </div>
            )}

            {/* Results Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Target Audience */}
              <div className="ds-card p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  الجمهور المستهدف
                </h4>
                <div className="space-y-2">
                  {analysisResult.targetAudience.map((audience, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{audience}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* USPs */}
              <div className="ds-card p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  نقاط البيع الفريدة
                </h4>
                <div className="space-y-2">
                  {analysisResult.uniqueSellingPoints.map((usp, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <p className="text-sm">{usp}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Strategy */}
              <div className="ds-card p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  استراتيجية التسعير
                </h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">السعر المقترح</span>
                    <span className="font-semibold">{analysisResult.pricingStrategy.suggestedPriceRange}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">هامش الربح المتوقع</span>
                    <span className="font-semibold text-green-600">{analysisResult.pricingStrategy.profitMargin}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">حساسية السعر</span>
                    <span className="font-semibold text-yellow-600">{analysisResult.pricingStrategy.priceSensitivity}</span>
                  </div>
                </div>
              </div>

              {/* Marketing Channels */}
              <div className="ds-card p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  القنوات التسويقية المقترحة
                </h4>
                <div className="space-y-2">
                  {analysisResult.marketingChannels.map((channel, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <span className="text-sm">{channel.channel}</span>
                      <span className={cn(
                        'text-xs px-2 py-1 rounded',
                        channel.priority === 'عالية' 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted-foreground/20 text-muted-foreground'
                      )}>
                        أولوية {channel.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Competitive Advantages */}
              {analysisResult.competitiveAdvantages && analysisResult.competitiveAdvantages.length > 0 && (
                <div className="ds-card p-6">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    المزايا التنافسية
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.competitiveAdvantages.map((advantage, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg">
                        <p className="text-sm">{advantage}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Marketing Messages */}
              {analysisResult.marketingMessages && analysisResult.marketingMessages.length > 0 && (
                <div className="ds-card p-6">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    رسائل تسويقية مقترحة
                  </h4>
                  <div className="space-y-2">
                    {analysisResult.marketingMessages.map((message, index) => (
                      <div key={index} className="p-3 bg-muted rounded-lg border-r-2 border-primary">
                        <p className="text-sm italic">"{message}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleReset}
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium',
                  'border border-border',
                  'flex items-center justify-center gap-2',
                  'transition-colors hover:bg-muted'
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                تحليل منتج جديد
              </button>
              <button
                className={cn(
                  'flex-1 py-3 rounded-xl font-medium',
                  'bg-primary text-primary-foreground',
                  'flex items-center justify-center gap-2',
                  'transition-colors hover:bg-primary/90'
                )}
              >
                <Sparkles className="h-4 w-4" />
                توليد الحملة التسويقية
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
