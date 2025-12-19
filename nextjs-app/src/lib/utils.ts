import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getLoginUrl() {
  const appId = process.env.NEXT_PUBLIC_APP_ID || '';
  const portalUrl = process.env.NEXT_PUBLIC_OAUTH_PORTAL_URL || '';
  const redirectUri = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/oauth/callback`
    : '';
  
  return `${portalUrl}/authorize?app_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}
