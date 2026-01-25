/**
 * n8n Health Check Router
 * 
 * Provides endpoints to:
 * 1. Check n8n connection status
 * 2. Verify environment variables
 * 3. Test workflow creation
 */

import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";

// ============================================
// Types
// ============================================
interface N8nTestResult {
  url: string;
  status: number;
  ok: boolean;
  error?: string;
  message: string;
  workflowCount?: number;
  workflows?: Array<{ id: string; name: string; active: boolean }>;
}

interface EnvCheckResult {
  n8n_instance_url: { exists: boolean; value?: string };
  n8n_api_key: { exists: boolean; preview?: string };
  n8n_webhook_base_url: { exists: boolean; value?: string };
}

// ============================================
// Helper: Get n8n base URL
// ============================================
function getN8nBaseUrl(): string | null {
  const url = process.env.N8N_INSTANCE_URL;
  if (!url) return null;
  
  // Remove /mcp-server/http if present
  let baseUrl = url.replace(/\/mcp-server\/http\/?$/, '');
  // Remove trailing slash
  baseUrl = baseUrl.replace(/\/$/, '');
  
  return baseUrl;
}

// ============================================
// Helper: Test n8n connection
// ============================================
async function testN8nConnection(): Promise<N8nTestResult> {
  const baseUrl = getN8nBaseUrl();
  const apiKey = process.env.N8N_API_KEY;

  if (!baseUrl) {
    return {
      url: '',
      status: 0,
      ok: false,
      message: 'N8N_INSTANCE_URL not configured',
    };
  }

  if (!apiKey) {
    return {
      url: baseUrl,
      status: 0,
      ok: false,
      message: 'N8N_API_KEY not configured',
    };
  }

  try {
    const testUrl = `${baseUrl}/api/v1/workflows`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json',
      },
    });

    const responseText = await response.text();
    
    if (response.status === 200) {
      try {
        const data = JSON.parse(responseText);
        const workflows = (data.data || []).map((w: { id: string; name: string; active: boolean }) => ({
          id: w.id,
          name: w.name,
          active: w.active,
        }));
        
        return {
          url: testUrl,
          status: 200,
          ok: true,
          message: `Connected! Found ${workflows.length} workflows.`,
          workflowCount: workflows.length,
          workflows,
        };
      } catch {
        return {
          url: testUrl,
          status: 200,
          ok: false,
          message: 'Response received but not valid JSON',
        };
      }
    } else if (response.status === 401 || response.status === 403) {
      return {
        url: testUrl,
        status: response.status,
        ok: false,
        message: 'API Key is invalid or expired',
      };
    } else if (response.status === 404) {
      if (responseText.includes('No workspace here')) {
        return {
          url: testUrl,
          status: 404,
          ok: false,
          message: 'URL is WRONG - workspace does not exist',
        };
      }
      return {
        url: testUrl,
        status: 404,
        ok: false,
        message: 'API endpoint not found',
      };
    }

    return {
      url: testUrl,
      status: response.status,
      ok: false,
      message: `Unexpected status: ${response.status}`,
    };
  } catch (error) {
    return {
      url: baseUrl,
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to connect - network error',
    };
  }
}

// ============================================
// Helper: Create workflow via n8n API
// ============================================
async function createN8nWorkflow(workflowData: {
  name: string;
  nodes: unknown[];
  connections: unknown;
  settings?: unknown;
  tags?: string[];
}): Promise<{ success: boolean; workflowId?: string; error?: string }> {
  const baseUrl = getN8nBaseUrl();
  const apiKey = process.env.N8N_API_KEY;

  if (!baseUrl || !apiKey) {
    return { success: false, error: 'n8n not configured' };
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to create workflow: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    return { success: true, workflowId: data.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// Helper: Activate workflow
// ============================================
async function activateN8nWorkflow(workflowId: string): Promise<{ success: boolean; error?: string }> {
  const baseUrl = getN8nBaseUrl();
  const apiKey = process.env.N8N_API_KEY;

  if (!baseUrl || !apiKey) {
    return { success: false, error: 'n8n not configured' };
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Failed to activate: ${response.status} - ${errorText}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// ============================================
// Router
// ============================================
export const n8nHealthRouter = router({
  // Check environment variables
  checkEnv: publicProcedure.query((): EnvCheckResult => {
    return {
      n8n_instance_url: {
        exists: !!process.env.N8N_INSTANCE_URL,
        value: process.env.N8N_INSTANCE_URL || undefined,
      },
      n8n_api_key: {
        exists: !!process.env.N8N_API_KEY,
        preview: process.env.N8N_API_KEY 
          ? `${process.env.N8N_API_KEY.substring(0, 15)}...` 
          : undefined,
      },
      n8n_webhook_base_url: {
        exists: !!process.env.N8N_WEBHOOK_BASE_URL,
        value: process.env.N8N_WEBHOOK_BASE_URL || undefined,
      },
    };
  }),

  // Smoke test n8n connection
  smokeTest: publicProcedure.query(async () => {
    const result = await testN8nConnection();
    
    return {
      timestamp: new Date().toISOString(),
      result,
      instructions: !result.ok ? {
        title: 'How to get the correct n8n URL',
        steps: [
          '1. Go to https://app.n8n.cloud and log in',
          '2. Open your workspace',
          '3. Copy the URL from browser (e.g., https://YOUR-WORKSPACE.app.n8n.cloud)',
          '4. Go to Settings > API > Create API Key',
          '5. Set environment variables:',
          '   N8N_INSTANCE_URL=https://YOUR-WORKSPACE.app.n8n.cloud',
          '   N8N_API_KEY=your-api-key',
        ],
      } : null,
    };
  }),

  // List all workflows
  listWorkflows: publicProcedure.query(async () => {
    const result = await testN8nConnection();
    
    if (!result.ok) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: result.message,
      });
    }

    return {
      count: result.workflowCount || 0,
      workflows: result.workflows || [],
    };
  }),

  // Create a test workflow
  createTestWorkflow: protectedProcedure.mutation(async () => {
    const testWorkflow = {
      name: '[Test] DeepSolution Connection Test',
      nodes: [
        {
          parameters: {},
          id: 'start',
          name: 'Start',
          type: 'n8n-nodes-base.start',
          typeVersion: 1,
          position: [250, 300],
        },
        {
          parameters: {
            values: {
              string: [
                {
                  name: 'message',
                  value: 'DeepSolution n8n connection test successful!',
                },
                {
                  name: 'timestamp',
                  value: '={{$now.toISO()}}',
                },
              ],
            },
          },
          id: 'set',
          name: 'Set Test Data',
          type: 'n8n-nodes-base.set',
          typeVersion: 1,
          position: [450, 300],
        },
      ],
      connections: {
        Start: {
          main: [[{ node: 'Set Test Data', type: 'main', index: 0 }]],
        },
      },
      settings: {
        saveManualExecutions: true,
      },
    };

    const createResult = await createN8nWorkflow(testWorkflow);
    
    if (!createResult.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: createResult.error || 'Failed to create workflow',
      });
    }

    return {
      success: true,
      workflowId: createResult.workflowId,
      message: 'Test workflow created successfully',
    };
  }),

  // Full connection report
  fullReport: publicProcedure.query(async () => {
    const envCheck: EnvCheckResult = {
      n8n_instance_url: {
        exists: !!process.env.N8N_INSTANCE_URL,
        value: process.env.N8N_INSTANCE_URL || undefined,
      },
      n8n_api_key: {
        exists: !!process.env.N8N_API_KEY,
        preview: process.env.N8N_API_KEY 
          ? `${process.env.N8N_API_KEY.substring(0, 15)}...` 
          : undefined,
      },
      n8n_webhook_base_url: {
        exists: !!process.env.N8N_WEBHOOK_BASE_URL,
        value: process.env.N8N_WEBHOOK_BASE_URL || undefined,
      },
    };

    const connectionTest = await testN8nConnection();

    return {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      summary: {
        env_configured: envCheck.n8n_instance_url.exists && envCheck.n8n_api_key.exists,
        connection_ok: connectionTest.ok,
        workflow_count: connectionTest.workflowCount || 0,
      },
      env_check: envCheck,
      connection_test: connectionTest,
      instructions: !connectionTest.ok ? {
        title: '🔧 How to fix n8n connection',
        problem: connectionTest.message,
        steps: [
          '1. Go to https://app.n8n.cloud',
          '2. Log in and select your workspace',
          '3. Copy the URL from browser address bar',
          '   Example: https://bassem-workspace.app.n8n.cloud',
          '4. Go to Settings (⚙️) > API',
          '5. Create an API Key if needed',
          '6. Update environment variables in Vercel:',
          '   N8N_INSTANCE_URL = your workspace URL',
          '   N8N_API_KEY = your API key',
        ],
      } : null,
    };
  }),
});
