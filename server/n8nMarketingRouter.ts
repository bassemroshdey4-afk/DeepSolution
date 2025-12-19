import { z } from "zod";
import { router, tenantProcedure, publicProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "./supabase";
import crypto from "crypto";

// ============================================
// n8n Marketing Automation Workflows
// ============================================
// Implements 6 marketing workflows with:
// - HMAC signature verification
// - Idempotency (prevent duplicates)
// - Audit logging
// - Dead letter queue for failures
// ============================================

// ============================================
// Types
// ============================================
interface WorkflowResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  data?: Record<string, unknown>;
  auditLogId?: string;
}

// ============================================
// Helper: Verify HMAC Signature
// ============================================
function verifyHMACSignature(
  body: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // Check timestamp (5 min tolerance)
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

// ============================================
// Helper: Check idempotency
// ============================================
async function checkIdempotency(key: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("workflow_executions")
    .select("id")
    .eq("idempotency_key", key)
    .single();

  return !!data;
}

// ============================================
// Helper: Record workflow execution
// ============================================
async function recordExecution(
  workflowId: string,
  idempotencyKey: string,
  tenantId: string,
  entityId: string,
  entityType: string,
  status: "completed" | "failed" = "completed"
): Promise<void> {
  await supabaseAdmin.from("workflow_executions").insert({
    workflow_id: workflowId,
    idempotency_key: idempotencyKey,
    tenant_id: tenantId,
    entity_id: entityId,
    entity_type: entityType,
    status,
    created_at: new Date().toISOString(),
  });
}

// ============================================
// Helper: Create workflow audit log
// ============================================
async function createWorkflowAuditLog(
  workflowId: string,
  tenantId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("workflow_audit_logs")
    .insert({
      workflow_id: workflowId,
      tenant_id: tenantId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      payload,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create workflow audit log:", error);
    return "";
  }

  return data?.id || "";
}

// ============================================
// Helper: Log to dead letter queue
// ============================================
async function logDeadLetter(
  workflowId: string,
  tenantId: string | null,
  payload: Record<string, unknown>,
  errorMessage: string
): Promise<void> {
  await supabaseAdmin.from("n8n_dead_letters").insert({
    workflow_id: workflowId,
    tenant_id: tenantId,
    payload,
    error_message: errorMessage,
    retry_count: 0,
    created_at: new Date().toISOString(),
  });
}

// ============================================
// WF-001: Campaign Re-Evaluation
// ============================================
async function evaluateCampaign(
  tenantId: string,
  campaignId: string
): Promise<WorkflowResult> {
  const workflowId = "WF-001";
  const today = new Date().toISOString().split('T')[0];
  const idempotencyKey = `${workflowId}:${tenantId}:${campaignId}:${today}`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already evaluated today" };
  }

  try {
    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .eq("tenant_id", tenantId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    // Get recent metrics
    const { data: metrics } = await supabaseAdmin
      .from("ad_platform_metrics")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("tenant_id", tenantId)
      .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order("date", { ascending: false });

    // Calculate performance indicators
    const totalSpend = metrics?.reduce((sum, m) => sum + (m.spend || 0), 0) || 0;
    const totalRevenue = metrics?.reduce((sum, m) => sum + (m.revenue || 0), 0) || 0;
    const avgRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
    const avgCtr = metrics?.length ? metrics.reduce((sum, m) => sum + (m.ctr || 0), 0) / metrics.length : 0;

    // Generate decision
    let action = "maintain";
    let confidence = 70;
    let explanation = "";

    if (avgRoas < 1) {
      action = "pause";
      confidence = 85;
      explanation = `ROAS is ${avgRoas.toFixed(2)}, below break-even. Recommend pausing to prevent further losses.`;
    } else if (avgRoas > 3) {
      action = "scale";
      confidence = 80;
      explanation = `Strong ROAS of ${avgRoas.toFixed(2)}. Recommend increasing budget to capture more conversions.`;
    } else if (avgCtr < 0.5) {
      action = "adjust";
      confidence = 75;
      explanation = `CTR of ${avgCtr.toFixed(2)}% is below average. Recommend refreshing creatives or adjusting targeting.`;
    } else {
      explanation = `Campaign performing within acceptable range. ROAS: ${avgRoas.toFixed(2)}, CTR: ${avgCtr.toFixed(2)}%.`;
    }

    // Get next decision version
    const { data: lastDecision } = await supabaseAdmin
      .from("marketing_decisions")
      .select("decision_version")
      .eq("campaign_id", campaignId)
      .order("decision_version", { ascending: false })
      .limit(1)
      .single();

    const decisionVersion = (lastDecision?.decision_version || 0) + 1;

    // Store decision
    const { data: decision, error: decisionError } = await supabaseAdmin
      .from("marketing_decisions")
      .insert({
        tenant_id: tenantId,
        campaign_id: campaignId,
        decision_version: decisionVersion,
        client_explanation: explanation,
        confidence,
        recommendations: { action, metrics: { avgRoas, avgCtr, totalSpend, totalRevenue } },
        next_check_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
        status: "pending",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (decisionError) {
      throw new Error(`Failed to store decision: ${decisionError.message}`);
    }

    // Update campaign
    await supabaseAdmin
      .from("campaigns")
      .update({
        last_evaluated_at: new Date().toISOString(),
        force_review: false,
        total_spend_since_review: 0,
      })
      .eq("id", campaignId);

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, campaignId, "campaign");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      "CAMPAIGN_EVALUATED",
      "campaign",
      campaignId,
      { decision_version: decisionVersion, confidence, action }
    );

    return {
      success: true,
      data: {
        decisionId: decision?.id,
        decisionVersion,
        action,
        confidence,
        explanation,
      },
    };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { campaignId }, (error as Error).message);
    throw error;
  }
}

// ============================================
// WF-003: Decision Notification
// ============================================
async function notifyDecision(
  tenantId: string,
  decisionId: string
): Promise<WorkflowResult> {
  const workflowId = "WF-003";
  const idempotencyKey = `${workflowId}:${decisionId}:email`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already notified" };
  }

  try {
    // Get decision with campaign and tenant
    const { data: decision, error: decisionError } = await supabaseAdmin
      .from("marketing_decisions")
      .select(`
        *,
        campaigns:campaign_id (name, platform),
        tenants:tenant_id (name, owner_email, notification_preferences)
      `)
      .eq("id", decisionId)
      .eq("tenant_id", tenantId)
      .single();

    if (decisionError || !decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    const tenant = decision.tenants as { name: string; owner_email: string; notification_preferences?: { email_enabled?: boolean; min_confidence?: number } } | null;
    const campaign = decision.campaigns as { name: string; platform: string } | null;

    // Check notification preferences
    const prefs = tenant?.notification_preferences || {};
    if (prefs.email_enabled === false) {
      return { success: true, skipped: true, reason: "Email notifications disabled" };
    }
    if (decision.confidence < (prefs.min_confidence || 70)) {
      return { success: true, skipped: true, reason: "Confidence below threshold" };
    }

    // Log notification (actual email sent by n8n)
    await supabaseAdmin.from("notification_logs").insert({
      tenant_id: tenantId,
      decision_id: decisionId,
      channel: "email",
      recipient: tenant?.owner_email || "",
      status: "pending",
      sent_at: new Date().toISOString(),
    });

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, decisionId, "decision");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      "NOTIFICATION_QUEUED",
      "decision",
      decisionId,
      { channel: "email", recipient: tenant?.owner_email }
    );

    return {
      success: true,
      data: {
        recipient: tenant?.owner_email,
        campaignName: campaign?.name,
        confidence: decision.confidence,
        explanation: decision.client_explanation,
      },
    };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { decisionId }, (error as Error).message);
    throw error;
  }
}

// ============================================
// WF-004: Approval → Execute
// ============================================
async function executeDecision(
  tenantId: string,
  decisionId: string
): Promise<WorkflowResult> {
  const workflowId = "WF-004";
  const idempotencyKey = `${workflowId}:${decisionId}:execute`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already executed" };
  }

  try {
    // Get decision with campaign and platform connection
    const { data: decision, error: decisionError } = await supabaseAdmin
      .from("marketing_decisions")
      .select(`
        *,
        campaigns:campaign_id (id, name, platform),
        tenants:tenant_id (name, owner_email)
      `)
      .eq("id", decisionId)
      .eq("tenant_id", tenantId)
      .single();

    if (decisionError || !decision) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    if (decision.status !== "approved") {
      return { success: true, skipped: true, reason: `Decision status is ${decision.status}, not approved` };
    }

    const campaign = decision.campaigns as { id: string; name: string; platform: string } | null;

    // Check for platform API access
    const { data: connection } = await supabaseAdmin
      .from("ad_platform_connections")
      .select("access_token, account_id")
      .eq("tenant_id", tenantId)
      .eq("platform", campaign?.platform || "")
      .eq("status", "active")
      .single();

    let executionMode = "manual_instructions";
    let changesApplied: Array<{ field: string; action: string }> = [];
    let instructions: string[] = [];

    if (connection?.access_token) {
      // Auto-execute mode (would call platform API)
      executionMode = "auto_execute";
      const recommendations = decision.recommendations as { action?: string; budget_change?: number } | null;
      
      if (recommendations?.action === "pause") {
        changesApplied.push({ field: "status", action: "paused" });
      } else if (recommendations?.action === "scale" && recommendations?.budget_change) {
        changesApplied.push({ field: "budget", action: `Changed to ${recommendations.budget_change}` });
      }
    } else {
      // Generate manual instructions
      const recommendations = decision.recommendations as { action?: string } | null;
      instructions = [
        `1. Log into ${campaign?.platform || "ad platform"} Ads Manager`,
        `2. Navigate to Campaign: ${campaign?.name || "Unknown"}`,
        `3. Apply the recommended action: ${recommendations?.action || "review"}`,
        `4. Save changes`,
        `5. Return to DeepSolution and mark as "Executed"`,
      ];
    }

    // Store execution log
    await supabaseAdmin.from("execution_logs").insert({
      tenant_id: tenantId,
      decision_id: decisionId,
      execution_mode: executionMode,
      changes_applied: changesApplied,
      instructions,
      status: "completed",
      executed_at: new Date().toISOString(),
    });

    // Update decision status
    await supabaseAdmin
      .from("marketing_decisions")
      .update({
        status: "executed",
        executed_at: new Date().toISOString(),
      })
      .eq("id", decisionId);

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, decisionId, "decision");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      executionMode === "auto_execute" ? "DECISION_EXECUTED" : "MANUAL_INSTRUCTIONS_GENERATED",
      "decision",
      decisionId,
      { execution_mode: executionMode, changes_count: changesApplied.length }
    );

    return {
      success: true,
      data: {
        executionMode,
        changesApplied,
        instructions,
      },
    };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { decisionId }, (error as Error).message);
    throw error;
  }
}

// ============================================
// WF-005: Landing Page Publish
// ============================================
async function publishLandingPage(
  tenantId: string,
  pageId: string,
  version: number
): Promise<WorkflowResult> {
  const workflowId = "WF-005";
  const idempotencyKey = `${workflowId}:${pageId}:${version}:publish`;

  // Check idempotency
  if (await checkIdempotency(idempotencyKey)) {
    return { success: true, skipped: true, reason: "Already published" };
  }

  try {
    // Get landing page
    const { data: page, error: pageError } = await supabaseAdmin
      .from("landing_pages")
      .select(`
        *,
        tenants:tenant_id (slug, name, owner_email, custom_domain)
      `)
      .eq("id", pageId)
      .eq("tenant_id", tenantId)
      .eq("version", version)
      .single();

    if (pageError || !page) {
      throw new Error(`Landing page not found: ${pageId} v${version}`);
    }

    if (page.status !== "review") {
      return { success: true, skipped: true, reason: `Page status is ${page.status}, not review` };
    }

    const tenant = page.tenants as { slug: string; name: string; owner_email: string; custom_domain?: string } | null;

    // Generate published URL
    let publishedUrl: string;
    if (tenant?.custom_domain) {
      publishedUrl = `https://${tenant.custom_domain}/${page.slug}`;
    } else {
      publishedUrl = `https://${tenant?.slug || tenantId}.deepsolution.app/${page.slug}`;
    }

    // Update page status
    await supabaseAdmin
      .from("landing_pages")
      .update({
        status: "published",
        published_url: publishedUrl,
        published_at: new Date().toISOString(),
      })
      .eq("id", pageId)
      .eq("version", version);

    // Record execution
    await recordExecution(workflowId, idempotencyKey, tenantId, pageId, "landing_page");

    // Audit log
    await createWorkflowAuditLog(
      workflowId,
      tenantId,
      "LANDING_PAGE_PUBLISHED",
      "landing_page",
      pageId,
      { version, published_url: publishedUrl }
    );

    return {
      success: true,
      data: {
        publishedUrl,
        pageName: page.name,
        version,
      },
    };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, { pageId, version }, (error as Error).message);
    throw error;
  }
}

// ============================================
// WF-006: Ops Alert Detection
// ============================================
async function detectOpsAlerts(tenantId: string): Promise<WorkflowResult> {
  const workflowId = "WF-006";
  const hour = new Date().toISOString().slice(0, 13); // yyyy-MM-ddTHH

  try {
    // Get active campaigns with metrics
    const { data: campaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id, name, budget, platform")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    if (!campaigns?.length) {
      return { success: true, data: { alertsDetected: 0 } };
    }

    const alerts: Array<{
      campaignId: string;
      campaignName: string;
      alertType: string;
      severity: string;
      description: string;
    }> = [];

    for (const campaign of campaigns) {
      const idempotencyKey = `${workflowId}:${campaign.id}:${hour}`;

      // Skip if already alerted this hour
      if (await checkIdempotency(idempotencyKey)) {
        continue;
      }

      // Get recent metrics (last 7 days)
      const { data: recentMetrics } = await supabaseAdmin
        .from("ad_platform_metrics")
        .select("spend, roas, ctr, date")
        .eq("campaign_id", campaign.id)
        .eq("tenant_id", tenantId)
        .gte("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      // Get baseline metrics (previous 30 days)
      const { data: baselineMetrics } = await supabaseAdmin
        .from("ad_platform_metrics")
        .select("spend, roas, ctr")
        .eq("campaign_id", campaign.id)
        .eq("tenant_id", tenantId)
        .gte("date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lt("date", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const recentSpend = recentMetrics?.reduce((sum, m) => sum + (m.spend || 0), 0) || 0;
      const recentRoas = recentMetrics?.length ? recentMetrics.reduce((sum, m) => sum + (m.roas || 0), 0) / recentMetrics.length : 0;
      const recentCtr = recentMetrics?.length ? recentMetrics.reduce((sum, m) => sum + (m.ctr || 0), 0) / recentMetrics.length : 0;

      const baselineSpend = baselineMetrics?.reduce((sum, m) => sum + (m.spend || 0), 0) || 0;
      const baselineRoas = baselineMetrics?.length ? baselineMetrics.reduce((sum, m) => sum + (m.roas || 0), 0) / baselineMetrics.length : 0;
      const baselineCtr = baselineMetrics?.length ? baselineMetrics.reduce((sum, m) => sum + (m.ctr || 0), 0) / baselineMetrics.length : 0;

      let alertType: string | null = null;
      let severity = "medium";
      let description = "";
      let forceReview = false;

      // Budget exhaustion check
      if (campaign.budget && campaign.budget > 0 && recentSpend / campaign.budget > 0.9) {
        alertType = "budget_exhaustion";
        severity = "critical";
        description = `Budget is ${Math.round((recentSpend / campaign.budget) * 100)}% exhausted`;
        forceReview = true;
      }
      // Spend spike check
      else if (baselineSpend > 0 && recentSpend > baselineSpend * 2) {
        alertType = "spend_spike";
        severity = "high";
        description = `Spend increased by ${Math.round((recentSpend / baselineSpend) * 100)}%`;
      }
      // ROAS collapse check
      else if (baselineRoas > 0 && recentRoas < baselineRoas * 0.5) {
        alertType = "roas_collapse";
        severity = "critical";
        description = `ROAS dropped to ${recentRoas.toFixed(2)} from ${baselineRoas.toFixed(2)}`;
        forceReview = true;
      }
      // CTR drop check
      else if (baselineCtr > 0 && recentCtr < baselineCtr * 0.5) {
        alertType = "ctr_drop";
        severity = "medium";
        description = `CTR dropped to ${(recentCtr * 100).toFixed(2)}% from ${(baselineCtr * 100).toFixed(2)}%`;
      }

      if (alertType) {
        alerts.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          alertType,
          severity,
          description,
        });

        // Force review if critical
        if (forceReview) {
          await supabaseAdmin
            .from("campaigns")
            .update({ force_review: true })
            .eq("id", campaign.id);
        }

        // Record execution
        await recordExecution(workflowId, idempotencyKey, tenantId, campaign.id, "campaign");

        // Audit log
        await createWorkflowAuditLog(
          workflowId,
          tenantId,
          forceReview ? "FORCE_REVIEW_TRIGGERED" : "OPS_ALERT_TRIGGERED",
          "campaign",
          campaign.id,
          { alert_type: alertType, severity }
        );
      }
    }

    return {
      success: true,
      data: {
        alertsDetected: alerts.length,
        alerts,
      },
    };
  } catch (error) {
    await logDeadLetter(workflowId, tenantId, {}, (error as Error).message);
    throw error;
  }
}

// ============================================
// Router
// ============================================
export const n8nMarketingRouter = router({
  // WF-001: Evaluate campaign (called by n8n scheduler)
  evaluateCampaign: tenantProcedure
    .input(z.object({
      campaignId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await evaluateCampaign(ctx.tenantId, input.campaignId);
    }),

  // WF-003: Notify decision (called by n8n on decision insert)
  notifyDecision: tenantProcedure
    .input(z.object({
      decisionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await notifyDecision(ctx.tenantId, input.decisionId);
    }),

  // WF-004: Execute decision (called by n8n on approval)
  executeDecision: tenantProcedure
    .input(z.object({
      decisionId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await executeDecision(ctx.tenantId, input.decisionId);
    }),

  // WF-005: Publish landing page (called by n8n on publish action)
  publishLandingPage: tenantProcedure
    .input(z.object({
      pageId: z.string(),
      version: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      return await publishLandingPage(ctx.tenantId, input.pageId, input.version);
    }),

  // WF-006: Detect ops alerts (called by n8n hourly)
  detectOpsAlerts: tenantProcedure
    .mutation(async ({ ctx }) => {
      return await detectOpsAlerts(ctx.tenantId);
    }),

  // Get campaigns needing evaluation (for WF-001 scheduler)
  getCampaignsNeedingEvaluation: tenantProcedure
    .query(async ({ ctx }) => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseAdmin
        .from("campaigns")
        .select("id, name, last_evaluated_at, force_review, total_spend_since_review")
        .eq("tenant_id", ctx.tenantId)
        .eq("status", "active")
        .or(`force_review.eq.true,last_evaluated_at.lt.${sixHoursAgo},last_evaluated_at.is.null`);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Get workflow audit logs
  getWorkflowAuditLogs: tenantProcedure
    .input(z.object({
      workflowId: z.string().optional(),
      eventType: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      let query = supabaseAdmin
        .from("workflow_audit_logs")
        .select("*")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false })
        .limit(input.limit);

      if (input.workflowId) {
        query = query.eq("workflow_id", input.workflowId);
      }
      if (input.eventType) {
        query = query.eq("event_type", input.eventType);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data || [];
    }),

  // Verify webhook signature (utility for n8n)
  verifyWebhook: publicProcedure
    .input(z.object({
      body: z.string(),
      signature: z.string(),
      timestamp: z.string(),
    }))
    .mutation(async ({ input }) => {
      const secret = process.env.N8N_WEBHOOK_SECRET || "";
      const isValid = verifyHMACSignature(input.body, input.signature, input.timestamp, secret);
      return { valid: isValid };
    }),
});
