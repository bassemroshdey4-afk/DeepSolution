import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(userId: number = 1, tenantId?: number): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `user${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
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
  it("should create a new tenant", async () => {
    const ctx = createTestContext(999);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.tenant.create({
      name: "Test Store",
      domain: `test-store-${Date.now()}`,
    });

    expect(result).toHaveProperty("tenantId");
    expect(result.tenantId).toBeGreaterThan(0);
  });

  it("should reject duplicate domain", async () => {
    const ctx = createTestContext(998);
    const caller = appRouter.createCaller(ctx);

    const domain = `duplicate-test-${Date.now()}`;

    // Create first tenant
    await caller.tenant.create({
      name: "First Store",
      domain,
    });

    // Try to create second tenant with same domain
    await expect(
      caller.tenant.create({
        name: "Second Store",
        domain,
      })
    ).rejects.toThrow("هذا النطاق مستخدم بالفعل");
  });

  // Note: Testing getCurrent would require reloading user context
  // after tenant creation, which is handled by the auth system in production
});

// Note: Additional tests for products, campaigns, and data isolation
// would require mocking the database or using a test database
// to properly test tenant isolation after user context refresh.
// For MVP, we verify the core tenant creation and domain uniqueness.
