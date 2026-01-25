'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, EmptyState, SkeletonPage } from '@/components/layout';
import { useAuth } from '@/contexts/AuthContext';
import { Check, ExternalLink } from 'lucide-react';

const integrations = [
  { id: 'n8n', name: 'n8n', description: 'أتمتة سير العمل', status: 'connected', icon: '🔄' },
  { id: 'supabase', name: 'Supabase', description: 'قاعدة البيانات والمصادقة', status: 'connected', icon: '⚡' },
  { id: 'aramex', name: 'أرامكس', description: 'شركة الشحن', status: 'available', icon: '📦' },
  { id: 'smsa', name: 'SMSA', description: 'شركة الشحن', status: 'available', icon: '🚚' },
  { id: 'meta', name: 'Meta Ads', description: 'إعلانات فيسبوك وإنستغرام', status: 'available', icon: '📱' },
  { id: 'google', name: 'Google Ads', description: 'إعلانات جوجل', status: 'available', icon: '🔍' },
];

export default function IntegrationsPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/integrations');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <AppShell
        title="التكاملات"
        description="ربط متجرك بالمنصات الخارجية"
        breadcrumbs={[{ label: 'التكاملات', href: '/integrations' }]}
      >
        <SkeletonPage />
      </AppShell>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppShell
      title="التكاملات"
      description="ربط الخدمات الخارجية"
      breadcrumbs={[
        { label: 'لوحة التحكم', href: '/dashboard' },
        { label: 'التكاملات' },
      ]}
      user={user ? { name: user.name, email: user.email } : null}
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <div key={integration.id} className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{integration.icon}</span>
                <div>
                  <h3 className="font-semibold">{integration.name}</h3>
                  <p className="text-sm text-muted-foreground">{integration.description}</p>
                </div>
              </div>
              {integration.status === 'connected' && (
                <span className="flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  <Check className="h-3 w-3" />
                  متصل
                </span>
              )}
            </div>
            <button 
              onClick={() => { if (integration.status !== 'connected') setShowToast(true); }}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                integration.status === 'connected' 
                  ? 'bg-muted text-muted-foreground cursor-default'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              }`}
            >
              {integration.status === 'connected' ? 'متصل' : (<><ExternalLink className="h-4 w-4" />ربط</>)}
            </button>
          </div>
        ))}
      </div>

      {showToast && (
        <div className="fixed bottom-4 right-4 bg-foreground text-background px-4 py-3 rounded-lg shadow-lg z-50">
          <p className="text-sm">هذا التكامل قيد التطوير - سيتوفر قريباً</p>
          <button onClick={() => setShowToast(false)} className="absolute top-1 right-2 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
    </AppShell>
  );
}
