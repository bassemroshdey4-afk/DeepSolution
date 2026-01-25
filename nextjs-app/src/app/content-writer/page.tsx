'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { PenTool, Sparkles } from 'lucide-react';

export default function ContentWriterPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/content-writer');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <AppShell
        title="كاتب المحتوى"
        description="إنشاء محتوى تسويقي بالذكاء الاصطناعي"
        breadcrumbs={[{ label: 'كاتب المحتوى', href: '/content-writer' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="كاتب المحتوى"
      description="إنشاء محتوى تسويقي بالذكاء الاصطناعي"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'كاتب المحتوى' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      <EmptyState
        icon={PenTool}
        title="كاتب المحتوى الذكي"
        description="استخدم الذكاء الاصطناعي لكتابة محتوى تسويقي احترافي"
        action={
          <button 
            onClick={() => router.push('/ai-pipeline')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            ابدأ الكتابة بالذكاء الاصطناعي
          </button>
        }
      />
    </AppShell>
  );
}
