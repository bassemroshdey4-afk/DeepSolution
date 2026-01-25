'use client';

// FORCE VERCEL REDEPLOY - Auth routing fix - 2026-01-25T12:50:00Z

// Force dynamic rendering to prevent prerendering errors with useContext
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  Package,
  ShoppingCart,
  Truck,
  BarChart3,
  Zap,
  Shield,
  Globe,
  ArrowLeft,
} from 'lucide-react';

const features = [
  {
    icon: Package,
    title: 'إدارة المنتجات',
    description: 'إدارة كاملة للمنتجات مع دعم AI لكتابة المحتوى والتسعير الذكي',
  },
  {
    icon: ShoppingCart,
    title: 'إدارة الطلبات',
    description: 'تتبع الطلبات من الإنشاء حتى التسليم مع حساب الربحية الفعلية',
  },
  {
    icon: Truck,
    title: 'ذكاء الشحن',
    description: 'اختيار ذكي للناقل بناءً على الأداء والتكلفة والموقع',
  },
  {
    icon: BarChart3,
    title: 'تحليلات الربحية',
    description: 'تتبع الربح الحقيقي مع فصل المقدر عن المؤكد',
  },
  {
    icon: Zap,
    title: 'إضافات AI',
    description: 'كاتب محتوى ذكي، تحسين الأسعار، وتوقع الطلب',
  },
  {
    icon: Shield,
    title: 'أمان متعدد المستأجرين',
    description: 'عزل كامل للبيانات مع Row Level Security',
  },
];

export default function HomePage() {
  const { user, isLoading, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">D</span>
            </div>
            <span className="font-semibold text-xl">DeepSolution</span>
          </div>
          
          <nav className="flex items-center gap-4">
            {isLoading ? (
              <div className="w-24 h-10 bg-muted animate-pulse rounded-lg" />
            ) : isAuthenticated ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <span>لوحة التحكم</span>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <span>تسجيل الدخول</span>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm mb-6">
          <Globe className="h-4 w-4" />
          <span>منظومة SaaS عالمية</span>
        </div>
        
        <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
          منصة إدارة التجارة الإلكترونية
          <br />
          <span className="text-primary">الأكثر ذكاءً</span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          إدارة شاملة للمنتجات والطلبات والشحن والمخزون مع تحليلات ربحية دقيقة
          وإضافات AI متقدمة
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-lg font-medium"
            >
              <span>الذهاب للوحة التحكم</span>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-lg font-medium"
            >
              <span>ابدأ مجاناً</span>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <Link
            href="#features"
            className="px-8 py-4 border border-border rounded-xl hover:bg-accent transition-colors text-lg"
          >
            اكتشف المزيد
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          كل ما تحتاجه لإدارة تجارتك
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 bg-card rounded-xl border border-border hover:border-primary/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">D</span>
              </div>
              <span className="font-medium">DeepSolution</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} DeepSolution. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
