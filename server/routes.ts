import type { Express } from "express";
import { createServer, type Server } from "http";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Note: This demo app runs simulation logic entirely on the frontend
  // No persistent backend storage is needed as the demo compresses
  // days of freight broker workflows into a minute-long demonstration

  return httpServer;
}
