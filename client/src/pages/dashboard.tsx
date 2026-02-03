import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Truck, Bot, Mail, FileText, CheckCircle, AlertCircle, Clock, DollarSign } from "lucide-react";
import { ActivityStream } from "@/components/activity-stream";
import { ShipmentTable } from "@/components/shipment-table";
import { StatusFilters } from "@/components/status-filters";
import { ChatInterface } from "@/components/chat-interface";
import { ShipmentDetailsDialog } from "@/components/shipment-details-dialog";
import { EmailApprovalDialog } from "@/components/email-approval-dialog";
import { DocumentVerificationDialog } from "@/components/document-verification-dialog";
import type { Shipment, Activity, APStatus, ARStatus, SimulationState } from "@shared/schema";

const INITIAL_SHIPMENTS: Shipment[] = [
  {
    id: "SHP-001",
    shipmentNumber: "WFL-2026-0847",
    origin: "Los Angeles",
    destination: "Phoenix",
    carrier: "DESERT HAULERS TRUCKING INC",
    shipper: "PACIFIC RIM IMPORTS INC",
    laneRate: 2850,
    invoiceAmount: 3150,
    detentionCharge: 300,
    apStatus: "received",
    arStatus: "preparing",
    createdAt: new Date()
  },
  {
    id: "SHP-002",
    shipmentNumber: "FRT-2024-0848",
    origin: "Chicago, IL",
    destination: "Atlanta, GA",
    carrier: "Prime Freight",
    shipper: "GlobalMart Inc",
    laneRate: 1950,
    invoiceAmount: 1950,
    apStatus: "received",
    arStatus: "preparing",
    createdAt: new Date(Date.now() - 1000)
  },
  {
    id: "SHP-003",
    shipmentNumber: "FRT-2024-0849",
    origin: "Seattle, WA",
    destination: "Phoenix, AZ",
    carrier: "Northwest Haulers",
    shipper: "EcoProducts Ltd",
    laneRate: 2200,
    invoiceAmount: 2200,
    apStatus: "received",
    arStatus: "preparing",
    createdAt: new Date(Date.now() - 2000)
  }
];



interface SimStep {
  delay: number;
  type: "email_received" | "email_sent" | "email_draft" | "document_scanned" | "issue_found" | "approval_requested" | "invoice_created" | "audit_complete" | "payment_sent" | "payment_received";
  title: string;
  description: string;
  status: APStatus | ARStatus;
  document?: { name: string; url: string };
  requiresApproval?: boolean;
  pendingActionType?: 'approve_email' | 'verify_docs';
  draftContent?: {
    to: string;
    subject: string;
    body: string;
    attachments?: string[];
  };
}

const createAPSteps = (shipment: Shipment, currentActivities: Activity[] = []): SimStep[] => {
  const hasBOL = currentActivities.some(a => a.metadata?.document?.name === "Bill of Lading");
  const hasPOD = currentActivities.some(a => a.metadata?.document?.name === "Proof of Delivery");
  const hasInvoice = currentActivities.some(a => a.metadata?.document?.name === "Carrier Invoice");
  const hasDocRequest = currentActivities.some(a => a.title.includes("Drafting Document Request"));

  // Keep request steps in the array if they were already generated/executed (hasDocRequest)
  // regardless of whether we now have the docs. This preserves array indices.
  const needsDocRequest = (!hasBOL || !hasPOD || !hasInvoice) || hasDocRequest;

  return [
    {
      delay: 1000,
      type: "email_received",
      title: `Delivery Confirmation - ${shipment.shipmentNumber}`,
      description: `Email from ${shipment.carrier} confirming delivery to ${shipment.destination}`,
      status: "received" as APStatus,
      document: { name: "Delivery Email", url: "/demo/emails/email_01_carrier_delivery_complete.pdf" }
    },
    ...(needsDocRequest ? [
      {
        delay: 2000,
        type: "email_draft" as const,
        title: `Drafting Document Request - ${shipment.shipmentNumber}`,
        description: `Drafted email to ${shipment.carrier} asking for missing documents`,
        status: "received" as APStatus,
        requiresApproval: true,
        draftContent: {
          to: "dtorres@deserthaulers.com",
          subject: `Document Request - ${shipment.shipmentNumber}`,
          body: `Hello,\n\nPlease provide the ${[!hasPOD && 'Proof of Delivery', !hasBOL && 'Bill of Lading', !hasInvoice && 'Invoice'].filter(Boolean).join(', ')} for shipment ${shipment.shipmentNumber} delivered to ${shipment.destination}.\n\nThank you,\nSentie`
        }
      },
      {
        delay: 1000,
        type: "email_sent",
        title: `AI Requests Documents - ${shipment.shipmentNumber}`,
        description: `Sentie sent request to ${shipment.carrier} for missing documents`,
        status: "received" as APStatus
      },
      {
        delay: 5000, // Carrier reply delay
        type: "email_received",
        title: `Documents Received - ${shipment.shipmentNumber}`,
        description: `${shipment.carrier} submitted missing document(s)`,
        status: "in_review" as APStatus,
        document: { name: "Missing Documents Email", url: "/demo/emails/email_02_carrier_invoice_submission.pdf" }
      }
    ] : []),
    {
      delay: 2000,
      type: "document_scanned",
      title: `Scanning BOL - ${shipment.shipmentNumber}`,
      description: `Processing Bill of Lading for ${shipment.origin} to ${shipment.destination}`,
      status: "in_review" as APStatus,
      document: { name: "Bill of Lading", url: "/demo/documents/01_bill_of_lading.pdf" }
    },
    {
      delay: 2000,
      type: "document_scanned",
      title: `POD Verified - ${shipment.shipmentNumber}`,
      description: `Proof of Delivery validated - signature confirmed at ${shipment.destination}`,
      status: "in_review" as APStatus,
      document: { name: "Proof of Delivery", url: "/demo/documents/02_proof_of_delivery.pdf" }
    },
    {
      delay: 2000,
      type: "document_scanned",
      title: `Rate Con Verified - ${shipment.shipmentNumber}`,
      description: `Rate confirmation validated - agreed rate $${shipment.laneRate.toLocaleString()}`,
      status: "in_review" as APStatus,
      document: { name: "Rate Confirmation", url: "/demo/documents/03_rate_confirmation.pdf" }
    },
    {
      delay: 2000,
      type: "document_scanned",
      title: `Invoice Analysis - ${shipment.shipmentNumber}`,
      description: `Invoice for $${shipment.invoiceAmount.toLocaleString()} detected${shipment.detentionCharge ? ` (includes $${shipment.detentionCharge} detention)` : ''}`,
      status: "in_review" as APStatus,
      document: { name: "Carrier Invoice", url: "/demo/documents/04_carrier_invoice.pdf" }
    },
    ...(shipment.detentionCharge ? [
      {
        delay: 2000,
        type: "issue_found" as const,
        title: `Detention Issue - ${shipment.shipmentNumber}`,
        description: `Carrier claims $${shipment.detentionCharge} detention but no supporting documentation provided`,
        status: "in_dispute" as APStatus
      },
      {
        delay: 2000,
        type: "email_draft" as const,
        title: `Drafting Detention Request - ${shipment.shipmentNumber}`,
        description: `Drafted email to ${shipment.carrier} requesting gate logs and ELD report`,
        status: "in_dispute" as APStatus,
        requiresApproval: true,
        draftContent: {
          to: "dtorres@deserthaulers.com",
          subject: `Detention Documentation Request - ${shipment.shipmentNumber}`,
          body: `Hello,\n\n regarding shipment ${shipment.shipmentNumber}, we have received a detention charge of $${shipment.detentionCharge}. \n\nPlease provide the following documentation to substantiate this claim:\n${hasBOL ? '' : '1. Signed Bill of Lading with in/out times\n'}2. GPS/ELD report showing arrival and departure times\n\nThank you,\nSentie`
        }
      },
      {
        delay: 1000,
        type: "email_sent" as const,
        title: `Requesting Detention Proof - ${shipment.shipmentNumber}`,
        description: `Sentie emailed ${shipment.carrier} requesting gate logs and ELD report`,
        status: "in_dispute" as APStatus,
        document: { name: "Detention Request Email", url: "/demo/emails/email_03_sentie_detention_docs_request.pdf" }
      },
      {
        delay: 8000, // Carrier reply delay
        type: "email_received" as const,
        title: `Detention Docs Received - ${shipment.shipmentNumber}`,
        description: `${shipment.carrier} provided gate log and ELD report for detention claim`,
        status: "in_review" as APStatus
      },
      {
        delay: 500,
        type: "document_scanned" as const,
        title: "Gate Log Received",
        description: "Gate Log showing check-in/out times",
        status: "in_review" as APStatus,
        document: { name: "Gate Log.pdf", url: "/demo/documents/gate_log.pdf" }
      },
      {
        delay: 500,
        type: "document_scanned" as const,
        title: "ELD Report Received",
        description: "Driver ELD logs verifying wait time",
        status: "in_review" as APStatus,
        document: { name: "ELD Report.pdf", url: "/demo/documents/eld_report.pdf" }
      },

      {
        delay: 500,
        type: "issue_resolved" as const, // Or keep generic if type not supported, but title is key
        title: "Detention Verified - Valid Gate Log & ELD",
        description: "Detention charges verified against carrier documentation",
        status: "audit_pass" as APStatus
      },
      {
        delay: 2000,
        type: "document_scanned" as const,
        title: `Gate Log Verified - ${shipment.shipmentNumber}`,
        description: `Gate log confirms wait time exceeding free time allowance`,
        status: "in_review" as APStatus,
        document: { name: "Gate Log", url: "/demo/documents/08_gate_log.pdf" }
      },
      {
        delay: 2000,
        type: "document_scanned" as const,
        title: `ELD Report Verified - ${shipment.shipmentNumber}`,
        description: `ELD data confirms truck stationary at facility, supports detention claim`,
        status: "in_review" as APStatus,
        document: { name: "ELD Report", url: "/demo/documents/09_eld_report.pdf" }
      },
      {
        delay: 2000,
        type: "audit_complete" as const,
        title: `AP Audit Complete - ${shipment.shipmentNumber}`,
        description: `All documents verified. Invoice $${shipment.invoiceAmount.toLocaleString()} approved for payment.`,
        status: "audit_pass" as APStatus
      },
    ] : [
      {
        delay: 2000,
        type: "audit_complete" as const,
        title: `AP Audit Complete - ${shipment.shipmentNumber}`,
        description: `All documents verified. Invoice $${shipment.invoiceAmount.toLocaleString()} approved for payment.`,
        status: "audit_pass" as APStatus
      },
    ])
  ] as SimStep[];
};

const createARSteps = (shipment: Shipment, currentActivities: Activity[] = []): SimStep[] => [
  {
    delay: 1000,
    type: "email_received" as const,
    title: `AR Job Opened - ${shipment.shipmentNumber}`,
    description: `Initiating accounts receivable process for shipment to ${shipment.shipper}`,
    status: "preparing" as ARStatus
  },
  {
    delay: 2000,
    type: "document_scanned" as const,
    title: `Reviewing Agreement - ${shipment.shipmentNumber}`,
    description: `Scanning shipper agreement with ${shipment.shipper}`,
    status: "preparing" as ARStatus,
    document: { name: "Shipper Agreement", url: "/demo/emails/email_04_shipper_broker_arrangement.pdf" }
  },
  {
    delay: 2000,
    type: "document_scanned" as const,
    title: `Lane Contract Verified - ${shipment.shipmentNumber}`,
    description: `Lane contract confirms rate for ${shipment.origin} to ${shipment.destination}`,
    status: "preparing" as ARStatus,
    document: { name: "Lane Contract", url: "/demo/documents/06_lane_contract.pdf" }
  },
  {
    delay: 2000,
    type: "invoice_created" as const,
    title: `Invoice Generated - ${shipment.shipmentNumber}`,
    description: `Created broker invoice for ${shipment.shipper}${shipment.detentionCharge ? ` including $${shipment.detentionCharge} detention` : ''}`,
    status: "preparing" as ARStatus,
    document: { name: "Broker Invoice", url: "/demo/documents/07_broker_invoice.pdf" }
  },
  {
    delay: 2000,
    type: "document_scanned" as const,
    title: `Evidence Packet Ready - ${shipment.shipmentNumber}`,
    description: `Compiled POD, delivery confirmation, and supporting documentation`,
    status: "for_review" as ARStatus
  },
  {
    delay: 2000,
    type: "email_draft" as const,
    title: `Drafting Shipper Invoice - ${shipment.shipmentNumber}`,
    description: `Drafted invoice email to ${shipment.shipper} for review`,
    status: "for_review" as ARStatus,
    requiresApproval: true,
    draftContent: {
      to: "jwu@pacificrimports.com",
      subject: `Invoice for Shipment ${shipment.shipmentNumber}`,
      body: `Attached is the invoice for shipment ${shipment.shipmentNumber} from ${shipment.origin} to ${shipment.destination}.\n\nLine Items:\n- Base Freight: $${shipment.laneRate.toLocaleString()}\n${shipment.detentionCharge ? `- Detention: $${shipment.detentionCharge.toLocaleString()}\n` : ''}- Total Amount: $${shipment.invoiceAmount.toLocaleString()}\n\nPlease find the following documents attached:\n- Broker Invoice\n- Proof of Delivery\n- Bill of Lading\n\nKind regards,\nSentie`
    }
  },
  {
    delay: 1000,
    type: "email_sent" as const,
    title: `Invoice Sent - ${shipment.shipmentNumber}`,
    description: `Invoice emailed to ${shipment.shipper} with attached documentation`,
    status: "submitted" as ARStatus,
    document: { name: "Invoice Email", url: "/demo/emails/email_05_broker_invoice_to_shipper.pdf" }
  },
  {
    delay: 5000,
    type: "payment_received" as const,
    title: `AR Complete - ${shipment.shipmentNumber}`,
    description: `Invoice submitted to ${shipment.shipper}. Payment tracking initiated.`,
    status: "submitted" as ARStatus
  },
];


export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"ap" | "ar">("ap");
  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    currentPhase: "idle",
    currentStep: 0
  });
  const [activities, setActivities] = useState<Activity[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);

  const activitiesRef = useRef<Activity[]>(activities);
  const shipmentsRef = useRef<Shipment[]>(shipments);

  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);

  useEffect(() => {
    shipmentsRef.current = shipments;
  }, [shipments]);
  const [apFilter, setApFilter] = useState<APStatus | "all">("all");
  const [arFilter, setArFilter] = useState<ARStatus | "all">("all");
  const [completedAPShipments, setCompletedAPShipments] = useState<Set<string>>(new Set());
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [draftToApprove, setDraftToApprove] = useState<string | null>(null); // shipmentId
  const [docsToVerify, setDocsToVerify] = useState<string | null>(null); // shipmentId
  const [activeShipmentSteps, setActiveShipmentSteps] = useState<Record<string, number>>({});
  const [pendingDrafts, setPendingDrafts] = useState<Record<string, SimStep['draftContent']>>({});
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const hasAutoStarted = useRef(false);

  const clearTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  }, []);

  const runARForShipment = useCallback((shipment: Shipment, stepIndex: number = 0) => {
    // Use ref to avoid stale closure issues
    const arSteps = createARSteps(shipment, activitiesRef.current);
    if (stepIndex >= arSteps.length) return;

    // Update active step for resumption
    setActiveShipmentSteps(prev => ({ ...prev, [shipment.id]: stepIndex }));

    const step = arSteps[stepIndex];

    const timeout = setTimeout(() => {
      // If this step requires approval, pause here
      if (step.requiresApproval && step.draftContent) {
        setPendingDrafts(prev => ({ ...prev, [shipment.id]: step.draftContent }));

        // Add the "Draft created" activity
        const draftActivity: Activity = {
          id: `ar-${shipment.id}-${Date.now()}-${stepIndex}`,
          shipmentId: shipment.id,
          type: "email_draft",
          category: "ar",
          title: step.title,
          description: step.description,
          timestamp: new Date(),
          metadata: { pendingAction: true }
        };
        setActivities(prev => [draftActivity, ...prev]);

        setShipments(prev => prev.map(s =>
          s.id === shipment.id ? { ...s, arStatus: "input_required", pendingAction: "approve_email" } : s
        ));

        // Do NOT process next step automatically - PAUSE
        return;
      }

      const newActivity: Activity = {
        id: `ar-${shipment.id}-${Date.now()}-${stepIndex}`,
        shipmentId: shipment.id,
        type: step.type,
        category: "ar",
        title: step.title,
        description: step.description,
        timestamp: new Date(),
        metadata: step.document ? { document: step.document } : undefined
      };

      setActivities(prev => [newActivity, ...prev]);

      setShipments(prev => prev.map(s =>
        s.id === shipment.id ? { ...s, arStatus: step.status as ARStatus } : s
      ));

      // Continue to next step
      runARForShipment(shipment, stepIndex + 1);

    }, step.delay);

    timeoutRefs.current.push(timeout);
  }, []);

  const runAPForShipment = useCallback((shipment: Shipment, stepIndex: number = 0) => {
    // Use the ref to get the absolute latest activities and avoid stale closures
    const apSteps = createAPSteps(shipment, activitiesRef.current);
    if (stepIndex >= apSteps.length) return;

    // Update active step for resumption
    setActiveShipmentSteps(prev => ({ ...prev, [shipment.id]: stepIndex }));

    const step = apSteps[stepIndex];

    const timeout = setTimeout(() => {
      // If this step requires approval, pause here
      if (step.requiresApproval) {
        if (step.draftContent) {
          setPendingDrafts(prev => ({ ...prev, [shipment.id]: step.draftContent! }));
        }

        // Add the pending activity
        const pendingActivity: Activity = {
          id: `ap-${shipment.id}-${Date.now()}-${stepIndex}`,
          shipmentId: shipment.id,
          type: step.type,
          category: "ap",
          title: step.title,
          description: step.description,
          timestamp: new Date(),
          metadata: { pendingAction: true }
        };
        setActivities(prev => [pendingActivity, ...prev]);

        setShipments(prev => prev.map(s =>
          s.id === shipment.id ? {
            ...s,
            apStatus: "input_required",
            pendingAction: step.pendingActionType || "approve_email"
          } : s
        ));

        // Do NOT process next step automatically - PAUSE
        return;
      }

      const newActivity: Activity = {
        id: `ap-${shipment.id}-${Date.now()}-${stepIndex}`,
        shipmentId: shipment.id,
        type: step.type,
        category: "ap",
        title: step.title,
        description: step.description,
        timestamp: new Date(),
        metadata: step.document ? { document: step.document } : undefined
      };

      setActivities(prev => [newActivity, ...prev]);

      setShipments(prev => prev.map(s =>
        s.id === shipment.id ? { ...s, apStatus: step.status as APStatus } : s
      ));

      // When AP audit is complete for this shipment, start AR
      if (step.type === "audit_complete") {
        setCompletedAPShipments(prev => new Set(Array.from(prev).concat(shipment.id)));
        // Start AR for this shipment after a brief pause
        setTimeout(() => {
          runARForShipment(shipment, 0);
        }, 2000);
      } else {
        // Continue to next step
        runAPForShipment(shipment, stepIndex + 1);
      }
    }, step.delay);

    timeoutRefs.current.push(timeout);
  }, [runARForShipment]);

  const handleApproveAction = (shipmentId: string) => {
    const shipment = shipments.find(s => s.id === shipmentId);
    if (!shipment) return;

    // Clear pending state
    setPendingDrafts(prev => {
      const copy = { ...prev };
      delete copy[shipmentId];
      return copy;
    });

    setShipments(prev => prev.map(s =>
      s.id === shipmentId ? { ...s, pendingAction: undefined } : s
    ));

    // Update activities to remove the "Review Draft" button
    setActivities(prev => prev.map(a =>
      (a.shipmentId === shipmentId && a.type === 'email_draft' && a.metadata?.pendingAction)
        ? { ...a, metadata: { ...a.metadata, pendingAction: false } }
        : a
    ));

    // Resume execution
    // The activeShipmentSteps points to the step index that was *just executed* (the paused draft step)
    // So we need to resume from activeShipmentSteps + 1
    const currentIndex = activeShipmentSteps[shipmentId];

    const isAPComplete = completedAPShipments.has(shipmentId);

    if (isAPComplete) {
      // Resume AR
      runARForShipment(shipment, currentIndex + 1);
    } else {
      // Resume AP
      runAPForShipment(shipment, currentIndex + 1);
    }
  };

  const startSimulation = useCallback(() => {
    clearTimeouts();
    setActivities([]);
    setShipments(INITIAL_SHIPMENTS);
    setCompletedAPShipments(new Set());
    setSimulation({ isRunning: true, currentPhase: "ap", currentStep: 0 });

    // Run all shipments in parallel with staggered starts
    INITIAL_SHIPMENTS.forEach((shipment, index) => {
      // Stagger each shipment by 8 seconds
      const timeout = setTimeout(() => {
        runAPForShipment(shipment, 0);
      }, index * 8000);
      timeoutRefs.current.push(timeout);
    });

    // Update phase to show AR when first shipment starts AR
    const checkARTimeout = setTimeout(() => {
      setSimulation(prev => ({ ...prev, currentPhase: "ar" }));
    }, 45000 + (INITIAL_SHIPMENTS.length * 8000)); // Adjust based on total stagger

    timeoutRefs.current.push(checkARTimeout);

    // Mark simulation complete after all shipments finish
    const completeTimeout = setTimeout(() => {
      setSimulation(prev => ({ ...prev, isRunning: false, currentPhase: "complete" }));
    }, 120000);

    timeoutRefs.current.push(completeTimeout);
  }, [clearTimeouts, runAPForShipment]);

  const pauseSimulation = useCallback(() => {
    clearTimeouts();
    setSimulation(prev => ({ ...prev, isRunning: false }));
  }, [clearTimeouts]);

  const resetSimulation = useCallback(() => {
    clearTimeouts();
    setActivities([]);
    setShipments(INITIAL_SHIPMENTS);
    setCompletedAPShipments(new Set());
    setActiveShipmentSteps({});
    setPendingDrafts({});
    setSimulation({ isRunning: false, currentPhase: "idle", currentStep: 0 });
    setApFilter("all");
    setArFilter("all");
  }, [clearTimeouts]);

  const resumeSimulation = useCallback(() => {
    setSimulation(prev => ({ ...prev, isRunning: true }));

    shipments.forEach(shipment => {
      // Don't resume shipments that are stuck on approval
      if (shipment.pendingAction === 'approve_email') return;

      const currentIndex = activeShipmentSteps[shipment.id];
      const isAPComplete = completedAPShipments.has(shipment.id);

      // If it has a current index, resume from there
      if (currentIndex !== undefined) {
        if (isAPComplete) {
          runARForShipment(shipment, currentIndex);
        } else {
          runAPForShipment(shipment, currentIndex);
        }
      } else if (simulation.currentPhase !== 'complete') {
        // If it hasn't started yet, start from beginning
        runAPForShipment(shipment, 0);
      }
    });
  }, [shipments, activeShipmentSteps, completedAPShipments, runAPForShipment, runARForShipment, simulation.currentPhase]);

  const toggleSimulation = useCallback(() => {
    if (simulation.isRunning) {
      pauseSimulation();
    } else if (simulation.currentPhase === 'idle' || simulation.currentPhase === 'complete') {
      startSimulation();
    } else {
      resumeSimulation();
    }
  }, [simulation.isRunning, simulation.currentPhase, pauseSimulation, startSimulation, resumeSimulation]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        toggleSimulation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSimulation]);

  useEffect(() => {
    if (!hasAutoStarted.current) {
      hasAutoStarted.current = true;
      const autoStartTimer = setTimeout(() => {
        startSimulation();
      }, 800);

      return () => {
        clearTimeout(autoStartTimer);
        clearTimeouts();
      };
    }
    return () => clearTimeouts();
  }, []);

  const apCounts = {
    received: shipments.filter(s => s.apStatus === "received").length,
    in_review: shipments.filter(s => s.apStatus === "in_review").length,
    audit_pass: shipments.filter(s => s.apStatus === "audit_pass").length,
    in_dispute: shipments.filter(s => s.apStatus === "in_dispute").length,
    paid: shipments.filter(s => s.apStatus === "paid").length,
    input_required: shipments.filter(s => s.apStatus === "input_required").length,
    total: shipments.length
  };

  const arCounts = {
    preparing: shipments.filter(s => s.arStatus === "preparing").length,
    for_review: shipments.filter(s => s.arStatus === "for_review").length,
    submitted: shipments.filter(s => s.arStatus === "submitted").length,
    in_dispute: shipments.filter(s => s.arStatus === "in_dispute").length,
    collected: shipments.filter(s => s.arStatus === "collected").length,
    input_required: shipments.filter(s => s.arStatus === "input_required").length,
    total: shipments.length
  };

  const filteredShipments = shipments.filter(s => {
    if (activeTab === "ap") {
      return apFilter === "all" || s.apStatus === apFilter;
    }
    return arFilter === "all" || s.arStatus === arFilter;
  });

  const apActivities = activities.filter(a => a.category === "ap");
  const arActivities = activities.filter(a => a.category === "ar");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Sentie</h1>
                <p className="text-sm text-muted-foreground">AP AR on autopilot</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                <div className={`w-2 h-2 rounded-full ${simulation.isRunning ? 'bg-chart-2 animate-pulse' : simulation.currentPhase === 'complete' ? 'bg-chart-2' : 'bg-muted-foreground'}`} />
                <span className="text-sm font-medium">
                  {simulation.currentPhase === "idle" ? "Ready" :
                    simulation.currentPhase === "complete" ? "Complete" :
                      simulation.isRunning ? `Processing ${shipments.length} Shipments` : "Paused"}
                </span>
              </div>

              {!simulation.isRunning && (simulation.currentPhase === "idle" || simulation.currentPhase === "complete") && (
                <Button onClick={startSimulation} data-testid="button-start-demo">
                  <Play className="w-4 h-4 mr-2" />
                  Start Demo
                </Button>
              )}

              {simulation.isRunning && (
                <Button variant="secondary" onClick={pauseSimulation} data-testid="button-pause-demo">
                  <Pause className="w-4 h-4 mr-2" />
                  Pause
                </Button>
              )}

              {!simulation.isRunning && simulation.currentPhase !== "idle" && simulation.currentPhase !== "complete" && (
                <Button onClick={resumeSimulation} data-testid="button-resume-demo">
                  <Play className="w-4 h-4 mr-2" />
                  Resume
                </Button>
              )}

              {(simulation.currentPhase !== "idle" || activities.length > 0) && (
                <Button variant="outline" onClick={resetSimulation} data-testid="button-reset-demo">
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "ap" | "ar")} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="ap" className="gap-2" data-testid="tab-ap">
              <FileText className="w-4 h-4" />
              Accounts Payable
              {apActivities.length > 0 && (
                <Badge variant="secondary" className="ml-1 min-w-[20px] h-5 text-xs">
                  {apActivities.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ar" className="gap-2" data-testid="tab-ar">
              <DollarSign className="w-4 h-4" />
              Accounts Receivable
              {arActivities.length > 0 && (
                <Badge variant="secondary" className="ml-1 min-w-[20px] h-5 text-xs">
                  {arActivities.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ap" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-primary" />
                      AP Activity Stream
                      <Badge variant="outline" className="ml-2">Live</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActivityStream
                      activities={apActivities}
                      emptyMessage="Start the demo to see AP activities"
                      onAction={(activity) => {
                        // Open the draft directly from the activity stream.
                        setDraftToApprove(activity.shipmentId);
                      }}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <ChatInterface />
              </div>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    AP Shipments
                    <Badge variant="outline" className="ml-2">
                      {completedAPShipments.size}/{shipments.length} Complete
                    </Badge>
                  </CardTitle>
                  <StatusFilters
                    activeTab="ap"
                    apFilter={apFilter}
                    arFilter={arFilter}
                    onApFilterChange={setApFilter}
                    onArFilterChange={setArFilter}
                    apCounts={apCounts}
                    arCounts={arCounts}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ShipmentTable
                  shipments={filteredShipments}
                  activeTab="ap"
                  onShipmentClick={setSelectedShipment}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-primary" />
                      AR Activity Stream
                      <Badge variant="outline" className="ml-2">Live</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActivityStream
                      activities={arActivities}
                      emptyMessage="AR process starts after each shipment's AP audit is complete"
                      onAction={(activity) => {
                        // Just open the shipment details. User can click "Review Draft" from there.
                        setSelectedShipment(shipments.find(s => s.id === activity.shipmentId) || null);
                      }}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <ChatInterface />
              </div>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    AR Shipments
                  </CardTitle>
                  <StatusFilters
                    activeTab="ar"
                    apFilter={apFilter}
                    arFilter={arFilter}
                    onApFilterChange={setApFilter}
                    onArFilterChange={setArFilter}
                    apCounts={apCounts}
                    arCounts={arCounts}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <ShipmentTable
                  shipments={filteredShipments}
                  activeTab="ar"
                  onShipmentClick={setSelectedShipment}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ShipmentDetailsDialog
        shipment={selectedShipment ? (shipments.find(s => s.id === selectedShipment.id) || selectedShipment) : null}
        activities={activities}
        open={!!selectedShipment}
        onOpenChange={(open: boolean) => !open && setSelectedShipment(null)}
        onAction={(shipmentId: string) => {
          const shipment = shipments.find(s => s.id === shipmentId);
          if (shipment?.pendingAction === 'verify_docs') {
            setDocsToVerify(shipmentId);
          } else {
            setDraftToApprove(shipmentId);
          }
        }}
        context={activeTab}
      />

      <DocumentVerificationDialog
        open={!!docsToVerify}
        onOpenChange={(open: boolean) => !open && setDocsToVerify(null)}
        documents={docsToVerify ? activities
          .filter(a => a.shipmentId === docsToVerify && a.metadata?.document)
          .filter(a => {
            const name = a.metadata!.document!.name.toLowerCase();
            return name.includes('gate') || name.includes('eld') || name.includes('log') || name.includes('detention');
          })
          .map(a => ({ name: a.metadata!.document!.name, url: a.metadata!.document!.url }))
          : []
        }
        onApprove={() => {
          if (docsToVerify) {
            handleApproveAction(docsToVerify);
            setDocsToVerify(null);
          }
        }}
      />

      <EmailApprovalDialog
        open={!!draftToApprove}
        onOpenChange={(open: boolean) => !open && setDraftToApprove(null)}
        draft={draftToApprove ? (pendingDrafts[draftToApprove] || null) : null}
        onApprove={() => {
          if (draftToApprove) {
            handleApproveAction(draftToApprove);
            setDraftToApprove(null);
          }
        }}
        onCancel={() => setDraftToApprove(null)}
      />
    </div>
  );
}


