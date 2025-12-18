/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export * from "./_core/errors";

// User type for authentication
export interface User {
  id: string;
  openId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  tenantId: string | null;
  role: string | null;
  createdAt: string;
  updatedAt: string;
}

// Tenant type
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  country: string | null;
  currency: string | null;
  language: string | null;
  timezone: string | null;
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// Subscription type
export interface Subscription {
  id: string;
  tenant_id: string;
  plan: string;
  status: "trial" | "active" | "past_due" | "canceled" | "expired";
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  trial_campaigns_limit: number;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}
