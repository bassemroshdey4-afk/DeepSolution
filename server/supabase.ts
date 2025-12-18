import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

// Service role client (bypasses RLS - for server-side operations)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Anon client (respects RLS - for client-side operations)
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create a client with user's auth context (for RLS)
export function createUserClient(accessToken?: string) {
  if (!accessToken) {
    return supabaseAnon;
  }
  
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["tenants"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          open_id: string;
          email: string | null;
          name: string | null;
          avatar_url: string | null;
          default_tenant_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      tenant_users: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tenant_users"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["tenant_users"]["Insert"]>;
      };
      subscriptions: {
        Row: {
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
        };
        Insert: Omit<Database["public"]["Tables"]["subscriptions"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          price: number;
          cost: number | null;
          sku: string | null;
          barcode: string | null;
          image_url: string | null;
          stock: number;
          status: "active" | "draft" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["products"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      orders: {
        Row: {
          id: string;
          tenant_id: string;
          order_number: string;
          customer_name: string;
          customer_phone: string;
          customer_email: string | null;
          customer_address: string | null;
          status: "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
          payment_status: "pending" | "paid" | "failed" | "refunded";
          call_center_status: "pending" | "contacted" | "confirmed" | "cancelled" | null;
          total_amount: number;
          shipping_cost: number;
          discount_amount: number;
          campaign_id: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["orders"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["orders"]["Insert"]>;
      };
      order_items: {
        Row: {
          id: string;
          tenant_id: string;
          order_id: string;
          product_id: string | null;
          product_name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["order_items"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["order_items"]["Insert"]>;
      };
      campaigns: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          platform: string;
          budget: number;
          spent: number;
          revenue: number;
          orders_count: number;
          status: "draft" | "active" | "paused" | "completed";
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["campaigns"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["campaigns"]["Insert"]>;
      };
      events: {
        Row: {
          id: string;
          tenant_id: string;
          event_name: string | null;
          store_id: string | null;
          session_id: string | null;
          user_id: string | null;
          product_id: string | null;
          order_id: string | null;
          source: string | null;
          utm_source: string | null;
          utm_campaign: string | null;
          utm_content: string | null;
          utm_term: string | null;
          ad_platform: string | null;
          ad_account_id: string | null;
          campaign_platform_id: string | null;
          ad_id: string | null;
          event_data: Record<string, unknown> | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["events"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
      };
      permissions: {
        Row: {
          id: string;
          key: string;
          description: string | null;
          module: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["permissions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["permissions"]["Insert"]>;
      };
      roles: {
        Row: {
          id: string;
          tenant_id: string | null;
          name: string;
          description: string | null;
          is_system: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["roles"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["roles"]["Insert"]>;
      };
      role_permissions: {
        Row: {
          id: string;
          role_id: string;
          permission_id: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["role_permissions"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["role_permissions"]["Insert"]>;
      };
      user_roles: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role_id: string;
          scope_store_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_roles"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Insert"]>;
      };
      user_store_access: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          store_id: string;
          access_level: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_store_access"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["user_store_access"]["Insert"]>;
      };
    };
    Functions: {
      start_tenant_trial: {
        Args: { p_tenant_id: string };
        Returns: string;
      };
      expire_trial_subscriptions: {
        Args: Record<string, never>;
        Returns: number;
      };
      is_tenant_in_trial: {
        Args: { check_tenant_id: string };
        Returns: boolean;
      };
      user_has_tenant_access: {
        Args: { check_tenant_id: string };
        Returns: boolean;
      };
    };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> = Partial<Database["public"]["Tables"][T]["Row"]> & { tenant_id: string };
export type UpdateTables<T extends keyof Database["public"]["Tables"]> = Partial<Database["public"]["Tables"][T]["Row"]>;
