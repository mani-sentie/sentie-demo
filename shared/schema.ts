import { z } from "zod";

// Shipment status for AP (Accounts Payable)
export const apStatusSchema = z.enum([
  "received",
  "in_review",
  "audit_pass",
  "in_dispute",
  "paid",
  "input_required"
]);

// Shipment status for AR (Accounts Receivable)
export const arStatusSchema = z.enum([
  "preparing",
  "for_review",
  "submitted",
  "in_dispute",
  "collected",
  "input_required"
]);

export type APStatus = z.infer<typeof apStatusSchema>;
export type ARStatus = z.infer<typeof arStatusSchema>;

// Activity types for the stream
export const activityTypeSchema = z.enum([
  "email_received",
  "email_sent",
  "email_draft",
  "document_scanned",
  "issue_found",
  "approval_requested",
  "invoice_created",
  "audit_complete",
  "payment_sent",
  "payment_received"
]);

export type ActivityType = z.infer<typeof activityTypeSchema>;

// Shipment data
export const shipmentSchema = z.object({
  id: z.string(),
  shipmentNumber: z.string(),
  origin: z.string(),
  destination: z.string(),
  carrier: z.string(),
  shipper: z.string(),
  laneRate: z.number(),
  invoiceAmount: z.number(),
  detentionCharge: z.number().optional(),
  apStatus: apStatusSchema,
  arStatus: arStatusSchema,
  createdAt: z.date(),
  pendingAction: z.enum(["approve_email"]).optional()
});

export type Shipment = z.infer<typeof shipmentSchema>;

// Activity log entry
export const activitySchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  type: activityTypeSchema,
  category: z.enum(["ap", "ar"]),
  title: z.string(),
  description: z.string(),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

export type Activity = z.infer<typeof activitySchema>;

// Document types
export const documentTypeSchema = z.enum([
  "rate_con",
  "bol",
  "pod",
  "detention",
  "detention_proof",
  "carrier_invoice",
  "broker_invoice"
]);

export type DocumentType = z.infer<typeof documentTypeSchema>;

export const documentSchema = z.object({
  id: z.string(),
  shipmentId: z.string(),
  type: documentTypeSchema,
  name: z.string(),
  status: z.enum(["pending", "verified", "issue", "corrected"]),
  uploadedAt: z.date()
});

export type Document = z.infer<typeof documentSchema>;

// Simulation state
export const simulationStateSchema = z.object({
  isRunning: z.boolean(),
  currentPhase: z.enum(["idle", "ap", "ar", "complete"]),
  currentStep: z.number(),
  shipmentId: z.string().optional()
});

export type SimulationState = z.infer<typeof simulationStateSchema>;

// Users table (keeping from original)
import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
