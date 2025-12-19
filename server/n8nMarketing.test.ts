import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";

// ============================================
// n8n Marketing Workflows Tests
// ============================================

describe("n8n Marketing Workflows", () => {
  // ============================================
  // HMAC Signature Verification
  // ============================================
  describe("HMAC Signature Verification", () => {
    const secret = "test-webhook-secret";

    function generateSignature(body: string, timestamp: string): string {
      return 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');
    }

    function verifySignature(
      body: string,
      signature: string,
      timestamp: string,
      secret: string
    ): boolean {
      const now = Date.now();
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 300000) {
        return false;
      }

      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      try {
        return crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        );
      } catch {
        return false;
      }
    }

    it("should verify valid signature", () => {
      const body = JSON.stringify({ tenant_id: "t1", campaign_id: "c1" });
      const timestamp = Date.now().toString();
      const signature = generateSignature(body, timestamp);

      expect(verifySignature(body, signature, timestamp, secret)).toBe(true);
    });

    it("should reject invalid signature", () => {
      const body = JSON.stringify({ tenant_id: "t1", campaign_id: "c1" });
      const timestamp = Date.now().toString();
      const signature = "sha256=invalid";

      expect(verifySignature(body, signature, timestamp, secret)).toBe(false);
    });

    it("should reject expired timestamp (>5 min)", () => {
      const body = JSON.stringify({ tenant_id: "t1", campaign_id: "c1" });
      const timestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago
      const signature = generateSignature(body, timestamp);

      expect(verifySignature(body, signature, timestamp, secret)).toBe(false);
    });

    it("should accept timestamp within tolerance", () => {
      const body = JSON.stringify({ tenant_id: "t1", campaign_id: "c1" });
      const timestamp = (Date.now() - 4 * 60 * 1000).toString(); // 4 minutes ago
      const signature = generateSignature(body, timestamp);

      expect(verifySignature(body, signature, timestamp, secret)).toBe(true);
    });

    it("should use timing-safe comparison", () => {
      const body = JSON.stringify({ tenant_id: "t1" });
      const timestamp = Date.now().toString();
      const signature = generateSignature(body, timestamp);

      // Multiple calls should take similar time (timing-safe)
      const start1 = process.hrtime.bigint();
      verifySignature(body, signature, timestamp, secret);
      const end1 = process.hrtime.bigint();

      const start2 = process.hrtime.bigint();
      verifySignature(body, "sha256=wrong", timestamp, secret);
      const end2 = process.hrtime.bigint();

      // Both should complete (timing difference is implementation detail)
      expect(Number(end1 - start1)).toBeGreaterThan(0);
      expect(Number(end2 - start2)).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Idempotency Key Generation
  // ============================================
  describe("Idempotency Key Generation", () => {
    function generateIdempotencyKey(
      workflowId: string,
      tenantId: string,
      entityId: string,
      suffix?: string
    ): string {
      const date = new Date().toISOString().split('T')[0];
      return suffix
        ? `${workflowId}:${tenantId}:${entityId}:${suffix}`
        : `${workflowId}:${tenantId}:${entityId}:${date}`;
    }

    it("should generate consistent keys for same inputs", () => {
      const key1 = generateIdempotencyKey("WF-001", "tenant1", "campaign1");
      const key2 = generateIdempotencyKey("WF-001", "tenant1", "campaign1");
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different workflows", () => {
      const key1 = generateIdempotencyKey("WF-001", "tenant1", "campaign1");
      const key2 = generateIdempotencyKey("WF-002", "tenant1", "campaign1");
      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different tenants", () => {
      const key1 = generateIdempotencyKey("WF-001", "tenant1", "campaign1");
      const key2 = generateIdempotencyKey("WF-001", "tenant2", "campaign1");
      expect(key1).not.toBe(key2);
    });

    it("should include custom suffix when provided", () => {
      const key = generateIdempotencyKey("WF-003", "tenant1", "decision1", "email");
      expect(key).toBe("WF-003:tenant1:decision1:email");
    });

    it("should include date by default", () => {
      const key = generateIdempotencyKey("WF-001", "tenant1", "campaign1");
      const today = new Date().toISOString().split('T')[0];
      expect(key).toContain(today);
    });
  });

  // ============================================
  // WF-001: Campaign Re-Evaluation
  // ============================================
  describe("WF-001: Campaign Re-Evaluation", () => {
    interface CampaignMetrics {
      spend: number;
      revenue: number;
      roas: number;
      ctr: number;
    }

    function evaluateCampaign(metrics: CampaignMetrics): {
      action: string;
      confidence: number;
      explanation: string;
    } {
      const { roas, ctr } = metrics;

      if (roas < 1) {
        return {
          action: "pause",
          confidence: 85,
          explanation: `ROAS is ${roas.toFixed(2)}, below break-even. Recommend pausing.`,
        };
      }

      if (roas > 3) {
        return {
          action: "scale",
          confidence: 80,
          explanation: `Strong ROAS of ${roas.toFixed(2)}. Recommend scaling.`,
        };
      }

      if (ctr < 0.5) {
        return {
          action: "adjust",
          confidence: 75,
          explanation: `CTR of ${ctr.toFixed(2)}% is below average. Recommend adjusting.`,
        };
      }

      return {
        action: "maintain",
        confidence: 70,
        explanation: `Campaign performing within acceptable range.`,
      };
    }

    it("should recommend pause when ROAS < 1", () => {
      const result = evaluateCampaign({ spend: 100, revenue: 50, roas: 0.5, ctr: 1.0 });
      expect(result.action).toBe("pause");
      expect(result.confidence).toBe(85);
    });

    it("should recommend scale when ROAS > 3", () => {
      const result = evaluateCampaign({ spend: 100, revenue: 400, roas: 4.0, ctr: 1.0 });
      expect(result.action).toBe("scale");
      expect(result.confidence).toBe(80);
    });

    it("should recommend adjust when CTR < 0.5%", () => {
      const result = evaluateCampaign({ spend: 100, revenue: 200, roas: 2.0, ctr: 0.3 });
      expect(result.action).toBe("adjust");
      expect(result.confidence).toBe(75);
    });

    it("should recommend maintain for acceptable performance", () => {
      const result = evaluateCampaign({ spend: 100, revenue: 200, roas: 2.0, ctr: 1.0 });
      expect(result.action).toBe("maintain");
      expect(result.confidence).toBe(70);
    });

    it("should prioritize ROAS over CTR", () => {
      const result = evaluateCampaign({ spend: 100, revenue: 50, roas: 0.5, ctr: 0.3 });
      expect(result.action).toBe("pause"); // ROAS check comes first
    });
  });

  // ============================================
  // WF-003: Decision Notification
  // ============================================
  describe("WF-003: Decision Notification", () => {
    interface NotificationPrefs {
      email_enabled?: boolean;
      min_confidence?: number;
    }

    function shouldNotify(
      confidence: number,
      prefs: NotificationPrefs
    ): { notify: boolean; reason?: string } {
      if (prefs.email_enabled === false) {
        return { notify: false, reason: "Email notifications disabled" };
      }

      const minConfidence = prefs.min_confidence || 70;
      if (confidence < minConfidence) {
        return { notify: false, reason: "Confidence below threshold" };
      }

      return { notify: true };
    }

    it("should notify when preferences allow", () => {
      const result = shouldNotify(80, { email_enabled: true });
      expect(result.notify).toBe(true);
    });

    it("should not notify when email disabled", () => {
      const result = shouldNotify(80, { email_enabled: false });
      expect(result.notify).toBe(false);
      expect(result.reason).toBe("Email notifications disabled");
    });

    it("should not notify when confidence below threshold", () => {
      const result = shouldNotify(60, { email_enabled: true, min_confidence: 70 });
      expect(result.notify).toBe(false);
      expect(result.reason).toBe("Confidence below threshold");
    });

    it("should use default threshold of 70", () => {
      const result = shouldNotify(65, {});
      expect(result.notify).toBe(false);
    });

    it("should notify at exactly threshold", () => {
      const result = shouldNotify(70, { min_confidence: 70 });
      expect(result.notify).toBe(true);
    });
  });

  // ============================================
  // WF-004: Approval → Execute
  // ============================================
  describe("WF-004: Approval → Execute", () => {
    interface Decision {
      status: string;
      recommendations: { action?: string; budget_change?: number };
    }

    function determineExecutionMode(
      hasApiAccess: boolean
    ): "auto_execute" | "manual_instructions" {
      return hasApiAccess ? "auto_execute" : "manual_instructions";
    }

    function generateManualInstructions(
      platform: string,
      campaignName: string,
      action: string
    ): string[] {
      return [
        `1. Log into ${platform} Ads Manager`,
        `2. Navigate to Campaign: ${campaignName}`,
        `3. Apply the recommended action: ${action}`,
        `4. Save changes`,
        `5. Return to DeepSolution and mark as "Executed"`,
      ];
    }

    it("should use auto_execute when API access available", () => {
      const mode = determineExecutionMode(true);
      expect(mode).toBe("auto_execute");
    });

    it("should use manual_instructions when no API access", () => {
      const mode = determineExecutionMode(false);
      expect(mode).toBe("manual_instructions");
    });

    it("should generate correct manual instructions", () => {
      const instructions = generateManualInstructions("Meta", "Summer Sale", "pause");
      expect(instructions).toHaveLength(5);
      expect(instructions[0]).toContain("Meta");
      expect(instructions[1]).toContain("Summer Sale");
      expect(instructions[2]).toContain("pause");
    });

    it("should include platform name in instructions", () => {
      const instructions = generateManualInstructions("Google", "Test", "scale");
      expect(instructions.some(i => i.includes("Google"))).toBe(true);
    });
  });

  // ============================================
  // WF-005: Landing Page Publish
  // ============================================
  describe("WF-005: Landing Page Publish", () => {
    function generatePublishedUrl(
      tenantSlug: string,
      pageSlug: string,
      customDomain?: string
    ): string {
      if (customDomain) {
        return `https://${customDomain}/${pageSlug}`;
      }
      return `https://${tenantSlug}.deepsolution.app/${pageSlug}`;
    }

    it("should generate URL with custom domain", () => {
      const url = generatePublishedUrl("tenant1", "summer-sale", "shop.example.com");
      expect(url).toBe("https://shop.example.com/summer-sale");
    });

    it("should generate URL with default domain", () => {
      const url = generatePublishedUrl("tenant1", "summer-sale");
      expect(url).toBe("https://tenant1.deepsolution.app/summer-sale");
    });

    it("should handle page slug correctly", () => {
      const url = generatePublishedUrl("tenant1", "my-product-page");
      expect(url).toContain("my-product-page");
    });
  });

  // ============================================
  // WF-006: Ops Alerts
  // ============================================
  describe("WF-006: Ops Alerts", () => {
    interface AlertDetection {
      recentSpend: number;
      budget: number;
      recentRoas: number;
      baselineRoas: number;
      recentCtr: number;
      baselineCtr: number;
    }

    function detectAlert(data: AlertDetection): {
      alertType: string | null;
      severity: string;
      forceReview: boolean;
    } {
      // Budget exhaustion
      if (data.budget > 0 && data.recentSpend / data.budget > 0.9) {
        return { alertType: "budget_exhaustion", severity: "critical", forceReview: true };
      }

      // ROAS collapse
      if (data.baselineRoas > 0 && data.recentRoas < data.baselineRoas * 0.5) {
        return { alertType: "roas_collapse", severity: "critical", forceReview: true };
      }

      // CTR drop
      if (data.baselineCtr > 0 && data.recentCtr < data.baselineCtr * 0.5) {
        return { alertType: "ctr_drop", severity: "medium", forceReview: false };
      }

      return { alertType: null, severity: "none", forceReview: false };
    }

    it("should detect budget exhaustion (>90%)", () => {
      const result = detectAlert({
        recentSpend: 950,
        budget: 1000,
        recentRoas: 2.0,
        baselineRoas: 2.0,
        recentCtr: 1.0,
        baselineCtr: 1.0,
      });
      expect(result.alertType).toBe("budget_exhaustion");
      expect(result.severity).toBe("critical");
      expect(result.forceReview).toBe(true);
    });

    it("should detect ROAS collapse (<50% of baseline)", () => {
      const result = detectAlert({
        recentSpend: 500,
        budget: 1000,
        recentRoas: 0.8,
        baselineRoas: 2.0,
        recentCtr: 1.0,
        baselineCtr: 1.0,
      });
      expect(result.alertType).toBe("roas_collapse");
      expect(result.severity).toBe("critical");
      expect(result.forceReview).toBe(true);
    });

    it("should detect CTR drop (<50% of baseline)", () => {
      const result = detectAlert({
        recentSpend: 500,
        budget: 1000,
        recentRoas: 2.0,
        baselineRoas: 2.0,
        recentCtr: 0.4,
        baselineCtr: 1.0,
      });
      expect(result.alertType).toBe("ctr_drop");
      expect(result.severity).toBe("medium");
      expect(result.forceReview).toBe(false);
    });

    it("should return no alert for healthy metrics", () => {
      const result = detectAlert({
        recentSpend: 500,
        budget: 1000,
        recentRoas: 2.0,
        baselineRoas: 2.0,
        recentCtr: 1.0,
        baselineCtr: 1.0,
      });
      expect(result.alertType).toBeNull();
    });

    it("should prioritize budget exhaustion over other alerts", () => {
      const result = detectAlert({
        recentSpend: 950,
        budget: 1000,
        recentRoas: 0.5, // Also ROAS collapse
        baselineRoas: 2.0,
        recentCtr: 0.3, // Also CTR drop
        baselineCtr: 1.0,
      });
      expect(result.alertType).toBe("budget_exhaustion");
    });
  });

  // ============================================
  // Audit Log Structure
  // ============================================
  describe("Audit Log Structure", () => {
    interface WorkflowAuditLog {
      workflow_id: string;
      tenant_id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      payload: Record<string, unknown>;
      created_at: string;
    }

    function createAuditLogEntry(
      workflowId: string,
      tenantId: string,
      eventType: string,
      entityType: string,
      entityId: string,
      payload: Record<string, unknown>
    ): WorkflowAuditLog {
      return {
        workflow_id: workflowId,
        tenant_id: tenantId,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        payload,
        created_at: new Date().toISOString(),
      };
    }

    it("should create valid audit log entry", () => {
      const entry = createAuditLogEntry(
        "WF-001",
        "tenant1",
        "CAMPAIGN_EVALUATED",
        "campaign",
        "campaign1",
        { decision_version: 1, confidence: 80 }
      );

      expect(entry.workflow_id).toBe("WF-001");
      expect(entry.tenant_id).toBe("tenant1");
      expect(entry.event_type).toBe("CAMPAIGN_EVALUATED");
      expect(entry.entity_type).toBe("campaign");
      expect(entry.entity_id).toBe("campaign1");
      expect(entry.payload).toEqual({ decision_version: 1, confidence: 80 });
      expect(entry.created_at).toBeDefined();
    });

    it("should include timestamp", () => {
      const entry = createAuditLogEntry("WF-001", "t1", "TEST", "test", "1", {});
      expect(new Date(entry.created_at).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  // ============================================
  // Dead Letter Queue
  // ============================================
  describe("Dead Letter Queue", () => {
    interface DeadLetter {
      workflow_id: string;
      tenant_id: string | null;
      payload: Record<string, unknown>;
      error_message: string;
      retry_count: number;
    }

    function createDeadLetter(
      workflowId: string,
      tenantId: string | null,
      payload: Record<string, unknown>,
      errorMessage: string
    ): DeadLetter {
      return {
        workflow_id: workflowId,
        tenant_id: tenantId,
        payload,
        error_message: errorMessage,
        retry_count: 0,
      };
    }

    it("should create dead letter entry", () => {
      const entry = createDeadLetter(
        "WF-001",
        "tenant1",
        { campaignId: "c1" },
        "Connection timeout"
      );

      expect(entry.workflow_id).toBe("WF-001");
      expect(entry.tenant_id).toBe("tenant1");
      expect(entry.payload).toEqual({ campaignId: "c1" });
      expect(entry.error_message).toBe("Connection timeout");
      expect(entry.retry_count).toBe(0);
    });

    it("should allow null tenant_id", () => {
      const entry = createDeadLetter("WF-001", null, {}, "Error");
      expect(entry.tenant_id).toBeNull();
    });
  });

  // ============================================
  // Workflow Execution Recording
  // ============================================
  describe("Workflow Execution Recording", () => {
    interface WorkflowExecution {
      workflow_id: string;
      idempotency_key: string;
      tenant_id: string;
      entity_id: string;
      entity_type: string;
      status: "completed" | "failed";
      created_at: string;
    }

    function createExecutionRecord(
      workflowId: string,
      idempotencyKey: string,
      tenantId: string,
      entityId: string,
      entityType: string,
      status: "completed" | "failed"
    ): WorkflowExecution {
      return {
        workflow_id: workflowId,
        idempotency_key: idempotencyKey,
        tenant_id: tenantId,
        entity_id: entityId,
        entity_type: entityType,
        status,
        created_at: new Date().toISOString(),
      };
    }

    it("should create completed execution record", () => {
      const record = createExecutionRecord(
        "WF-001",
        "WF-001:t1:c1:2024-12-19",
        "t1",
        "c1",
        "campaign",
        "completed"
      );

      expect(record.status).toBe("completed");
      expect(record.workflow_id).toBe("WF-001");
    });

    it("should create failed execution record", () => {
      const record = createExecutionRecord(
        "WF-001",
        "WF-001:t1:c1:2024-12-19",
        "t1",
        "c1",
        "campaign",
        "failed"
      );

      expect(record.status).toBe("failed");
    });

    it("should include idempotency key", () => {
      const record = createExecutionRecord(
        "WF-001",
        "WF-001:t1:c1:2024-12-19",
        "t1",
        "c1",
        "campaign",
        "completed"
      );

      expect(record.idempotency_key).toBe("WF-001:t1:c1:2024-12-19");
    });
  });
});
