import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import path from "path";
import { createProxyMiddleware } from "http-proxy-middleware";

// Next.js dev server URL
const NEXTJS_DEV_URL = "http://localhost:3001";

export async function setupVite(app: Express, server: Server) {
  // Proxy all non-API requests to Next.js dev server
  const nextProxy = createProxyMiddleware({
    target: NEXTJS_DEV_URL,
    changeOrigin: true,
    ws: true, // WebSocket support for HMR
  });

  // Proxy everything except /api to Next.js
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
    } else {
      nextProxy(req, res, next);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, serve Next.js build output
  const publicPath = path.resolve(import.meta.dirname, "../..", "nextjs-app", "public");

  // Serve Next.js public files
  if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
  }

  // For production, proxy to Next.js server
  const nextProxy = createProxyMiddleware({
    target: NEXTJS_DEV_URL,
    changeOrigin: true,
  });

  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
    } else {
      nextProxy(req, res, next);
    }
  });
}
