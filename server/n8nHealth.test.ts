import { describe, it, expect } from 'vitest';

describe('n8n API Connection', () => {
  const N8N_INSTANCE_URL = process.env.N8N_INSTANCE_URL || 'https://deepsolution.app.n8n.cloud';
  const N8N_API_KEY = process.env.N8N_API_KEY;

  it('should have N8N_INSTANCE_URL configured', () => {
    expect(N8N_INSTANCE_URL).toBeDefined();
    expect(N8N_INSTANCE_URL).toContain('n8n.cloud');
  });

  it('should have N8N_API_KEY configured', () => {
    expect(N8N_API_KEY).toBeDefined();
    expect(N8N_API_KEY!.length).toBeGreaterThan(50);
  });

  it('should successfully connect to n8n API and list workflows', async () => {
    if (!N8N_API_KEY) {
      console.log('Skipping API test - N8N_API_KEY not set');
      return;
    }

    const response = await fetch(`${N8N_INSTANCE_URL}/api/v1/workflows`, {
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
      },
    });

    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
    
    console.log(`✅ n8n API connected successfully. Found ${data.data.length} workflow(s)`);
  });
});
