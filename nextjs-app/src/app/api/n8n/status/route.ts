/**
 * n8n Status API Route
 * 
 * Returns the connection status of n8n
 */

import { NextResponse } from 'next/server';
import { getN8nStatus, isN8nConfigured, listWorkflows } from '@/lib/n8n';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Check if n8n is configured
  if (!isN8nConfigured()) {
    return NextResponse.json({
      configured: false,
      connected: false,
      message: 'n8n not configured. Add N8N_INSTANCE_URL and N8N_API_KEY to environment variables.',
    });
  }
  
  // Get n8n status
  const status = await getN8nStatus();
  
  if (!status.connected) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: status.error,
      message: 'n8n is configured but connection failed.',
    });
  }
  
  // Get workflows list
  const workflowsResult = await listWorkflows();
  
  return NextResponse.json({
    configured: true,
    connected: true,
    workflowCount: status.workflowCount,
    workflows: workflowsResult.success ? workflowsResult.workflows : [],
    message: `Connected to n8n. Found ${status.workflowCount} workflows.`,
  });
}
