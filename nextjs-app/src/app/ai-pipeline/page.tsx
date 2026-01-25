'use client';

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

/**
 * Deep Intelligence™ Page
 * 
 * AI-powered product analysis and marketing recommendations.
 * Features the premium "Thinking Experience" loading states.
 */

import { useState, useEffect } from 'react';
import { AppShell, PageHeader } from '@/components/layout';
import { 
  DeepIntelligenceThinking, 
  DeepIntelligenceSkeleton,
  PRODUCT_ANALYSIS_STAGES,
  MARKETING_PIPELINE_STAGES,
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
} from 'lucide-react';

type PipelineStep = 'input' | 'analyzing' | 'results';

export default function DeepIntelligencePage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const [step, setStep] = useState<PipelineStep>('input');
  const [currentStage, setCurrentStage] = useState(0);
  const [productDescription, setProductDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);

  // SECURITY: Redirect unauthenticated users to login
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      window.location.href = '/login?redirect=/ai-pipeline';
    }
  }, [authLoading, isAuthenticated]);

  // Simulate analysis process
  const handleAnalyze = async () => {
    if (!productDescription.trim()) return;
    
    setStep('analyzing');
    setCurrentStage(0);

    // Simulate stage progression
    for (let i = 0; i < PRODUCT_ANALYSIS_STAGES.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCurrentStage(i + 1);
    }

    // Move to results
    await new Promise(resolve => setTimeout(resolve, 500));
    setStep('results');
  };

  const handleReset = () => {
    setStep('input');
    setCurrentStage(0);
    setProductDescription('');
    setSelectedImage(null);
  };

  // SECURITY: Show loading while checking auth, or if not authenticated
  if (authLoading || !isAuthenticated) {
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
        {step === 'results' && (
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
                    تم تحليل منتجك وإعداد التوصيات الاستراتيجية
                  </p>
                </div>
              </div>
            </div>

            {/* Results Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Target Audience */}
              <div className="ds-card p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  الجمهور المستهدف
                </h4>
                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">رجال الأعمال الشباب (25-40 سنة)</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">المهتمون بالتقنية والابتكار</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">أصحاب الدخل المتوسط-العالي</p>
                  </div>
                </div>
              </div>

              {/* USPs */}
              <div className="ds-card p-6">
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  نقاط البيع الفريدة
                </h4>
                <div className="space-y-2">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">جودة عالية بسعر تنافسي</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">تصميم عصري وأنيق</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm">ضمان شامل لمدة سنة</p>
                  </div>
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
                    <span className="font-semibold">299 - 399 ر.س</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">هامش الربح المتوقع</span>
                    <span className="font-semibold text-green-600">35-45%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">حساسية السعر</span>
                    <span className="font-semibold text-yellow-600">متوسطة</span>
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
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">Instagram</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">أولوية عالية</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">TikTok</span>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">أولوية عالية</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span className="text-sm">Snapchat</span>
                    <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-1 rounded">أولوية متوسطة</span>
                  </div>
                </div>
              </div>
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
