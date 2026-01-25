/**
 * Basic Auth Security Test
 * 
 * Validates that Basic Auth is properly configured and working
 */

import { describe, it, expect } from 'vitest';

describe('Basic Auth Configuration', () => {
  it('should have ENABLE_BASIC_AUTH set to true', () => {
    const enableBasicAuth = process.env.ENABLE_BASIC_AUTH;
    expect(enableBasicAuth).toBe('true');
  });

  it('should have BASIC_AUTH_USER configured', () => {
    const basicAuthUser = process.env.BASIC_AUTH_USER;
    expect(basicAuthUser).toBeDefined();
    expect(basicAuthUser).not.toBe('');
    expect(basicAuthUser!.length).toBeGreaterThan(0);
  });

  it('should have BASIC_AUTH_PASS configured', () => {
    const basicAuthPass = process.env.BASIC_AUTH_PASS;
    expect(basicAuthPass).toBeDefined();
    expect(basicAuthPass).not.toBe('');
    expect(basicAuthPass!.length).toBeGreaterThan(0);
  });

  it('should generate valid Basic Auth header', () => {
    const user = process.env.BASIC_AUTH_USER;
    const pass = process.env.BASIC_AUTH_PASS;
    
    if (user && pass) {
      const credentials = Buffer.from(`${user}:${pass}`).toString('base64');
      const authHeader = `Basic ${credentials}`;
      
      // Verify the header can be decoded back
      const decoded = Buffer.from(credentials, 'base64').toString('utf-8');
      expect(decoded).toBe(`${user}:${pass}`);
      expect(authHeader).toMatch(/^Basic [A-Za-z0-9+/]+=*$/);
    }
  });
});
