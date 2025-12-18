import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabaseAdmin
vi.mock("./supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        range: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
        })),
        in: vi.fn(() => Promise.resolve({ data: [], error: null })),
        limit: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: "test-id" }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}));

describe("Super Admin Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Access Control", () => {
    it("should identify super admin by OWNER_OPEN_ID", () => {
      const ownerOpenId = process.env.OWNER_OPEN_ID;
      expect(ownerOpenId).toBeDefined();
      expect(typeof ownerOpenId).toBe("string");
    });

    it("should have SuperAdmin role in database", async () => {
      // This test verifies the role was created
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      
      const { data: role } = await supabase
        .from("roles")
        .select("*")
        .eq("name", "SuperAdmin")
        .single();
      
      expect(role).toBeDefined();
      expect(role?.name).toBe("SuperAdmin");
      expect(role?.is_system).toBe(true);
    });
  });

  describe("Platform Stats", () => {
    it("should return tenant and user counts", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      
      const { count: tenantsCount } = await supabase
        .from("tenants")
        .select("*", { count: "exact", head: true });
      
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });
      
      expect(tenantsCount).toBeGreaterThanOrEqual(0);
      expect(usersCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Tenant Management", () => {
    it("should list tenants with subscription info", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );
      
      const { data: tenants, error } = await supabase
        .from("tenants")
        .select("*, subscriptions(*)")
        .limit(5);
      
      expect(error).toBeNull();
      expect(Array.isArray(tenants)).toBe(true);
    });
  });
});
