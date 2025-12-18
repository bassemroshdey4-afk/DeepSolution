import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { randomUUID } from "crypto";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(): TrpcContext {
  const userId = randomUUID();
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-open-id-${userId}`,
    email: `user-${userId.slice(0, 8)}@example.com`,
    name: `Test User`,
    avatarUrl: null,
    tenantId: null,
    role: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("Tenant Management", () => {
  it("should create a new tenant via onboarding", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.onboarding.createTenant({
      name: "Test Store",
      slug: `test-store-${Date.now()}`,
      country: "SA",
      currency: "SAR",
      language: "ar",
      timezone: "Asia/Riyadh",
    });

    expect(result).toHaveProperty("tenantId");
    expect(result).toHaveProperty("message");
    expect(result.message).toContain("تم إنشاء الحساب بنجاح");
  });

  it("should reject duplicate slug", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const slug = `duplicate-test-${Date.now()}`;

    // Create first tenant
    await caller.onboarding.createTenant({
      name: "First Store",
      slug,
      country: "SA",
      currency: "SAR",
      language: "ar",
      timezone: "Asia/Riyadh",
    });

    // Try to create second tenant with same slug (using same user context)
    // This should fail because slug is already taken
    await expect(
      caller.onboarding.createTenant({
        name: "Second Store",
        slug,
        country: "AE",
        currency: "AED",
        language: "ar",
        timezone: "Asia/Dubai",
      })
    ).rejects.toThrow("هذا النطاق مستخدم بالفعل");
  });

  it("should get onboarding status", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Before creating tenant
    const statusBefore = await caller.onboarding.getStatus();
    expect(statusBefore.hasCompletedOnboarding).toBe(false);
    expect(statusBefore.tenantsCount).toBe(0);

    // Create a tenant
    await caller.onboarding.createTenant({
      name: "Status Test Store",
      slug: `status-test-${Date.now()}`,
      country: "KW",
      currency: "KWD",
      language: "ar",
      timezone: "Asia/Kuwait",
    });

    // After creating tenant - check status again
    const statusAfter = await caller.onboarding.getStatus();
    expect(statusAfter.hasCompletedOnboarding).toBe(true);
    expect(statusAfter.tenantsCount).toBeGreaterThan(0);
  });
});

// Note: Additional tests for products, campaigns, and data isolation
// would require mocking the database or using a test database
// to properly test tenant isolation after user context refresh.
// For MVP, we verify the core tenant creation and domain uniqueness.
