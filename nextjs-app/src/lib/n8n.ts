/**
 * n8n Integration Helper
 * 
 * Provides functions to interact with n8n API
 * 
 * Required ENV:
 * - N8N_INSTANCE_URL: Base URL of n8n instance (e.g., https://your-workspace.app.n8n.cloud)
 * - N8N_API_KEY: API key from n8n Settings > API
 */

// Get n8n configuration
function getN8nConfig(): { url: string; apiKey: string } | null {
  const url = process.env.N8N_INSTANCE_URL;
  const apiKey = process.env.N8N_API_KEY;
  
  if (!url || !apiKey) {
    return null;
  }
  
  // Clean up URL (remove trailing slash and /mcp-server/http if present)
  const cleanUrl = url
    .replace(/\/mcp-server\/http\/?$/, '')
    .replace(/\/$/, '');
  
  return { url: cleanUrl, apiKey };
}

// Check if n8n is configured
export function isN8nConfigured(): boolean {
  return getN8nConfig() !== null;
}

// Get n8n status
export async function getN8nStatus(): Promise<{
  connected: boolean;
  workflowCount?: number;
  error?: string;
}> {
  const config = getN8nConfig();
  
  if (!config) {
    return { connected: false, error: 'n8n not configured' };
  }
  
  try {
    const response = await fetch(`${config.url}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { connected: false, error: 'Invalid API key' };
      }
      return { connected: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return {
      connected: true,
      workflowCount: data.data?.length || 0,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// List all workflows
export async function listWorkflows(): Promise<{
  success: boolean;
  workflows?: Array<{
    id: string;
    name: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  error?: string;
}> {
  const config = getN8nConfig();
  
  if (!config) {
    return { success: false, error: 'n8n not configured' };
  }
  
  try {
    const response = await fetch(`${config.url}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    return {
      success: true,
      workflows: data.data?.map((w: Record<string, unknown>) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      })) || [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list workflows',
    };
  }
}

// Trigger a webhook
export async function triggerWebhook(
  webhookPath: string,
  data: Record<string, unknown>
): Promise<{
  success: boolean;
  response?: unknown;
  error?: string;
}> {
  const config = getN8nConfig();
  
  if (!config) {
    return { success: false, error: 'n8n not configured' };
  }
  
  try {
    const webhookUrl = `${config.url}/webhook/${webhookPath}`;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const responseData = await response.json().catch(() => ({}));
    return {
      success: true,
      response: responseData,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook trigger failed',
    };
  }
}

// Execute a workflow by ID
export async function executeWorkflow(
  workflowId: string,
  data?: Record<string, unknown>
): Promise<{
  success: boolean;
  executionId?: string;
  error?: string;
}> {
  const config = getN8nConfig();
  
  if (!config) {
    return { success: false, error: 'n8n not configured' };
  }
  
  try {
    const response = await fetch(`${config.url}/api/v1/workflows/${workflowId}/execute`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data || {}),
    });
    
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    const responseData = await response.json();
    return {
      success: true,
      executionId: responseData.data?.executionId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
}
