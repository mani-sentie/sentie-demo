# Sentie AI Demo

## Overview
A web application demonstrating Sentie AI - an intelligent agent for freight brokers that automates accounts payable (AP) and accounts receivable (AR) processes. The demo auto-starts when you open the page. The demo simulates the complete workflow flow:

**SHIPPER → FORWARDER/BROKER/3PL → CARRIER**

The AI agent monitors email communications and processes documents automatically, compressing what would normally take days into a 1-minute demo.

## Features
- **Two-tab interface**: AP (Accounts Payable) and AR (Accounts Receivable)
- **Real-time activity stream**: Shows AI agent actions with timestamps
- **Status filtering**: Filter shipments by status (received, in review, audit pass, etc.)
- **Process overview**: Visual progress indicators for each workflow stage
- **Timed simulation**: Demo compresses days of work into seconds

## Demo Flow

### Accounts Payable (AP)
1. Delivery confirmation email received from carrier
2. AI acknowledges and requests proof of delivery
3. Documents received and scanned (POD, Rate Con, Invoice)
4. AI detects issues (e.g., detention charge without proof)
5. AI disputes invalid charges via email
6. Corrected invoice received
7. Audit completed

### Accounts Receivable (AR)
*Starts after AP audit is complete*
1. AR job opened
2. Shipment communication reviewed
3. Lane rates confirmed
4. Invoice generated with evidence packet
5. Human approval requested
6. Invoice sent to shipper

## Tech Stack
- **Frontend**: React + TypeScript + TailwindCSS + Shadcn UI
- **Backend**: Express.js
- **State Management**: React useState with simulation logic
- **Routing**: Wouter

## Project Structure
```
client/
  src/
    components/
      activity-stream.tsx    # Real-time activity feed
      shipment-table.tsx     # Shipment data table
      status-filters.tsx     # Status filter buttons
    pages/
      dashboard.tsx          # Main demo dashboard
shared/
  schema.ts                  # TypeScript types and schemas
server/
  routes.ts                  # API endpoints
  storage.ts                 # In-memory storage
```

## Running the App
The app runs on port 5000 with `npm run dev`. Click "Start Demo" to begin the simulation.
