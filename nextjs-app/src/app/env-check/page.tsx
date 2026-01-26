'use client';

/**
 * Environment Check Page
 * 
 * Shows which environment variables are configured
 * Does NOT show actual values for security
 * 
 * Access: /env-check
 */

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import Link from 'next/link';

interface EnvStatus {
  configured: boolean;
  missing: string[];
  present: string[];
  dbConnected: boolean;
  authConfigured: boolean;
}

export default function EnvCheckPage() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkEnv = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super-admin/env-check');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check environment');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkEnv();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Environment Check
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                DeepSolution Configuration Status
              </p>
            </div>
            <button
              onClick={checkEnv}
              disabled={loading}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <XCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {loading && !status && (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-4 text-gray-500">Checking environment...</p>
            </div>
          )}

          {status && (
            <div className="space-y-6">
              {/* Overall Status */}
              <div className={`p-4 rounded-lg ${
                status.configured 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-center gap-3">
                  {status.configured ? (
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      status.configured 
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}>
                      {status.configured ? 'All Required Variables Configured' : 'Missing Required Variables'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {status.present.length} configured, {status.missing.length} missing
                    </p>
                  </div>
                </div>
              </div>

              {/* Missing Variables */}
              {status.missing.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Missing Variables
                  </h2>
                  <div className="space-y-2">
                    {status.missing.map((key) => (
                      <div key={key} className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <code className="text-sm text-red-700 dark:text-red-400">{key}</code>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    Add these in Vercel → Settings → Environment Variables
                  </p>
                </div>
              )}

              {/* Configured Variables */}
              {status.present.length > 0 && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Configured Variables
                  </h2>
                  <div className="space-y-2">
                    {status.present.map((key) => (
                      <div key={key} className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <code className="text-sm text-green-700 dark:text-green-400">{key}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connection Status */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Connection Status
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className={`p-4 rounded-lg ${
                    status.dbConnected 
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}>
                    <div className="flex items-center gap-2">
                      {status.dbConnected ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">Database</span>
                    </div>
                  </div>
                  <div className={`p-4 rounded-lg ${
                    status.authConfigured 
                      ? 'bg-green-50 dark:bg-green-900/20'
                      : 'bg-red-50 dark:bg-red-900/20'
                  }`}>
                    <div className="flex items-center gap-2">
                      {status.authConfigured ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">Auth</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Link 
              href="/login"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              ← Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
