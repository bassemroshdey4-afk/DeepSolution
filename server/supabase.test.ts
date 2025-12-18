import { describe, it, expect } from "vitest";
import { supabaseAdmin } from "./supabase";

describe("Supabase Connection", () => {
  it("should connect to Supabase and list tables", async () => {
    // Test connection by querying information_schema
    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .limit(1);

    // Should not have connection error
    expect(error).toBeNull();
    
    // Data should be an array (even if empty)
    expect(Array.isArray(data)).toBe(true);
  });

  it("should have SUPABASE_URL configured", () => {
    expect(process.env.SUPABASE_URL).toBeDefined();
    expect(process.env.SUPABASE_URL).not.toBe("");
  });

  it("should have SUPABASE_SERVICE_KEY configured", () => {
    expect(process.env.SUPABASE_SERVICE_KEY).toBeDefined();
    expect(process.env.SUPABASE_SERVICE_KEY).not.toBe("");
  });
});
