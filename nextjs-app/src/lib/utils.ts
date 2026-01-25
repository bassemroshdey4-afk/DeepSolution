import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Login URL is now simply the internal login page
// All OAuth is handled by Supabase on the login page
export function getLoginUrl(redirect?: string) {
  const base = '/login';
  if (redirect) {
    return `${base}?redirect=${encodeURIComponent(redirect)}`;
  }
  return base;
}
