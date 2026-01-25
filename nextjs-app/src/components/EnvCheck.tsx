'use client';

/**
 * Environment Check Component
 * 
 * Shows a visible error page if critical environment variables are missing.
 * This prevents silent blank screens and helps with debugging.
 */

import { AlertTriangle } from 'lucide-react';

interface EnvCheckProps {
  children: React.ReactNode;
}

// Check required environment variables
const requiredEnvVars = [
  { key: 'NEXT_PUBLIC_SUPABASE_URL', label: 'Supabase URL' },
  { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key' },
];

function getMissingEnvVars(): string[] {
  const missing: string[] = [];
  
  for (const env of requiredEnvVars) {
    // Check if env var exists and is not empty
    const value = typeof window !== 'undefined' 
      ? (window as any).__ENV__?.[env.key] 
      : process.env[env.key];
    
    // For client-side, check the actual process.env
    const clientValue = process.env[env.key];
    
    if (!clientValue || clientValue === 'undefined' || clientValue === '') {
      missing.push(env.label);
    }
  }
  
  return missing;
}

export function EnvCheck({ children }: EnvCheckProps) {
  // Only check on client side
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  const missingVars = getMissingEnvVars();

  if (missingVars.length > 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg">
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30">
            <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
          </div>
          
          <h1 className="text-xl font-bold text-center text-foreground mb-2">
            خطأ في الإعدادات
          </h1>
          
          <p className="text-center text-muted-foreground mb-6">
            بعض متغيرات البيئة المطلوبة غير موجودة. يرجى التواصل مع مدير النظام.
          </p>
          
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-foreground mb-2">المتغيرات المفقودة:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {missingVars.map((varName) => (
                <li key={varName} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {varName}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="text-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default EnvCheck;
