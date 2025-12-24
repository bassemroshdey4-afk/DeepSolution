'use client';
export const dynamic = 'force-dynamic';
import { AppShell, SkeletonPage, EmptyState } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { PenTool, Sparkles } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function ContentWriterPage() {
  const { user, isLoading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => { const timer = setTimeout(() => setIsLoading(false), 800); return () => clearTimeout(timer); }, []);
  if (authLoading) return <AppShell breadcrumbs={[{ label: 'كاتب المحتوى' }]} title="كاتب المحتوى"><SkeletonPage /></AppShell>;
  return (
    <AppShell breadcrumbs={[{ label: 'كاتب المحتوى' }]} title="كاتب المحتوى" description="إنشاء محتوى تسويقي بالذكاء الاصطناعي" user={user ? { name: user.name || 'مستخدم', email: user.email } : null} onLogout={signOut}>
      <div className="flex justify-end mb-6">
        <button className="ds-btn-primary px-4 py-2 rounded-lg text-sm inline-flex items-center gap-2"><Sparkles className="h-4 w-4" />إنشاء محتوى</button>
      </div>
      <div className="ds-card"><EmptyState icon={PenTool} title="كاتب المحتوى الذكي" description="استخدم الذكاء الاصطناعي لإنشاء محتوى تسويقي احترافي" /></div>
    </AppShell>
  );
}
