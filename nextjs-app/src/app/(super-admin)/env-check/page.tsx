'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, Lock } from 'lucide-react';

interface EnvStatus {
  key: string;
  category: string;
  exists: boolean;
  description: string;
}

interface HealthCheck {
  name: string;
  status: 'ok' | 'error' | 'warning';
  message: string;
}

export default function EnvCheckPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [envStatus, setEnvStatus] = useState<EnvStatus[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      checkSuperAdminAndLoadData();
    }
  }, [user, authLoading]);

  const checkSuperAdminAndLoadData = async () => {
    try {
      // Check super admin status via API
      const response = await fetch('/api/super-admin/check');
      const data = await response.json();
      
      if (!data.isSuperAdmin) {
        setIsSuperAdmin(false);
        setIsLoading(false);
        return;
      }
      
      setIsSuperAdmin(true);
      await loadEnvAndHealth();
    } catch (err) {
      setError('فشل في التحقق من صلاحيات المدير');
      setIsLoading(false);
    }
  };

  const loadEnvAndHealth = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/super-admin/env-check');
      const data = await response.json();
      
      setEnvStatus(data.envStatus || []);
      setHealthChecks(data.healthChecks || []);
    } catch (err) {
      setError('فشل في تحميل حالة البيئة');
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-ds-bg flex items-center justify-center">
        <div className="flex items-center gap-3 text-ds-text-secondary">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>جاري التحقق...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ds-bg flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-ds-text-secondary mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-ds-text mb-2">يجب تسجيل الدخول</h1>
          <p className="text-ds-text-secondary">هذه الصفحة تتطلب تسجيل الدخول</p>
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-ds-bg flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-ds-text mb-2">غير مصرح</h1>
          <p className="text-ds-text-secondary">هذه الصفحة متاحة للمدير الأعلى فقط</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ds-bg flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-ds-text mb-2">خطأ</h1>
          <p className="text-ds-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  const categories = Array.from(new Set(envStatus.map(e => e.category)));

  return (
    <div className="min-h-screen bg-ds-bg p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-ds-primary/10 rounded-lg">
            <Shield className="w-6 h-6 text-ds-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-ds-text">فحص البيئة</h1>
            <p className="text-ds-text-secondary text-sm">Super Admin Only</p>
          </div>
          <button
            onClick={loadEnvAndHealth}
            className="mr-auto p-2 hover:bg-ds-surface rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-ds-text-secondary" />
          </button>
        </div>

        {/* Health Checks */}
        <div className="ds-card p-6 mb-6">
          <h2 className="text-lg font-semibold text-ds-text mb-4">فحص الصحة</h2>
          <div className="grid gap-3">
            {healthChecks.map((check, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-ds-bg rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {check.status === 'ok' && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                  {check.status === 'error' && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {check.status === 'warning' && (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                  <span className="font-medium text-ds-text">{check.name}</span>
                </div>
                <span className="text-sm text-ds-text-secondary">{check.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Environment Variables */}
        <div className="ds-card p-6">
          <h2 className="text-lg font-semibold text-ds-text mb-4">متغيرات البيئة</h2>
          <p className="text-sm text-ds-text-secondary mb-4">
            يتم عرض أسماء المتغيرات فقط، لا يتم عرض القيم لأسباب أمنية
          </p>
          
          {categories.map(category => (
            <div key={category} className="mb-6 last:mb-0">
              <h3 className="text-sm font-medium text-ds-text-secondary uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="grid gap-2">
                {envStatus
                  .filter(e => e.category === category)
                  .map((env, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-ds-bg rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {env.exists ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500" />
                        )}
                        <code className="text-sm font-mono text-ds-text">{env.key}</code>
                      </div>
                      <span className="text-xs text-ds-text-secondary">{env.description}</span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-600">تحذير أمني</p>
              <p className="text-sm text-ds-text-secondary mt-1">
                هذه الصفحة تعرض معلومات حساسة عن إعدادات النظام. لا تشارك لقطات الشاشة أو المعلومات مع أي شخص.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
