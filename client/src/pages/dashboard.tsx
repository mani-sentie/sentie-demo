import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Truck, Bot, Mail, FileText, CheckCircle, AlertCircle, Clock, DollarSign, ExternalLink } from "lucide-react";
import { ActivityStream } from "@/components/activity-stream";
import { ShipmentTable } from "@/components/shipment-table";
import { StatusFilters } from "@/components/status-filters";
import type { Shipment, Activity, APStatus, ARStatus, SimulationState } from "@shared/schema";

const DEMO_SHIPMENTS: Shipment[] = [
  {
    id: "SHP-001",
    shipmentNumber: "FRT-2024-0847",
    origin: "Los Angeles, CA",
    destination: "Dallas, TX",
    carrier: "Swift Logistics",
    shipper: "TechCorp Industries",
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
    apStatus: "audit_pass",
    arStatus: "submitted",
    createdAt: new Date(Date.now() - 86400000)
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
    apStatus: "paid",
    arStatus: "collected",
    createdAt: new Date(Date.now() - 172800000)
  }
];

const AP_SIMULATION_STEPS = [
  { 
    delay: 0, 
    type: "email_received" as const, 
    title: "Delivery Confirmation Email Received", 
    description: "Email from Swift Logistics confirming delivery of shipment FRT-2024-0847 to Dallas, TX warehouse", 
    status: "received" as APStatus,
    document: { name: "Carrier Delivery Email", url: "/demo/emails/email_01_carrier_delivery_complete.pdf" }
  },
  { 
    delay: 2500, 
    type: "email_sent" as const, 
    title: "AI Acknowledges & Requests Documents", 
    description: "Sentie AI automatically sent acknowledgment to carrier and requested Proof of Delivery, Bill of Lading, and Invoice", 
    status: "received" as APStatus 
  },
  { 
    delay: 5000, 
    type: "email_received" as const, 
    title: "Invoice & Documents Received from Carrier", 
    description: "Carrier submitted invoice with attachments: POD, BOL, Rate Con, Invoice with $300 detention charge", 
    status: "in_review" as APStatus,
    document: { name: "Carrier Invoice Email", url: "/demo/emails/email_02_carrier_invoice_submission.pdf" }
  },
  { 
    delay: 7500, 
    type: "document_scanned" as const, 
    title: "AI Scanning Bill of Lading", 
    description: "Processing BOL document - verifying shipment details, origin/destination, weight, and commodity information", 
    status: "in_review" as APStatus,
    document: { name: "Bill of Lading", url: "/demo/documents/01_bill_of_lading.pdf" }
  },
  { 
    delay: 10000, 
    type: "document_scanned" as const, 
    title: "Proof of Delivery Verified", 
    description: "POD validated - receiver signature confirmed, delivery timestamp: 02/01/2024 14:32 CST, no exceptions noted", 
    status: "in_review" as APStatus,
    document: { name: "Proof of Delivery", url: "/demo/documents/02_proof_of_delivery.pdf" }
  },
  { 
    delay: 12500, 
    type: "document_scanned" as const, 
    title: "Rate Confirmation Verified", 
    description: "Rate Con validated - agreed rate $2,850 matches carrier agreement. Accessorials: lumper $0, detention TBD", 
    status: "in_review" as APStatus,
    document: { name: "Rate Confirmation", url: "/demo/documents/03_rate_confirmation.pdf" }
  },
  { 
    delay: 15000, 
    type: "document_scanned" as const, 
    title: "Carrier Invoice Analysis", 
    description: "Invoice #INV-78432 for $3,150 detected. Base rate $2,850 + $300 detention charge claimed", 
    status: "in_review" as APStatus,
    document: { name: "Carrier Invoice", url: "/demo/documents/04_carrier_invoice.pdf" }
  },
  { 
    delay: 17500, 
    type: "issue_found" as const, 
    title: "Detention Charge Issue Detected", 
    description: "AI flagged: Carrier claims $300 detention but no supporting documentation (gate log, ELD, timestamps) provided", 
    status: "in_dispute" as APStatus 
  },
  { 
    delay: 20000, 
    type: "email_sent" as const, 
    title: "AI Requests Detention Documentation", 
    description: "Automated email sent to carrier requesting proof of detention: gate logs, ELD report, and facility timestamps", 
    status: "in_dispute" as APStatus,
    document: { name: "Detention Request Email", url: "/demo/emails/email_03_sentie_detention_docs_request.pdf" }
  },
  { 
    delay: 24000, 
    type: "email_received" as const, 
    title: "Detention Documentation Received", 
    description: "Carrier provided detention proof: gate log shows 3.5 hour wait, ELD confirms driver on-site from 08:15 to 11:45", 
    status: "in_review" as APStatus 
  },
  { 
    delay: 26500, 
    type: "document_scanned" as const, 
    title: "Gate Log Verified", 
    description: "Gate log validated - driver check-in 08:15, dock assignment 11:42, confirms 3hr 27min wait exceeding 2hr free time", 
    status: "in_review" as APStatus,
    document: { name: "Gate Log", url: "/demo/documents/08_gate_log.pdf" }
  },
  { 
    delay: 29000, 
    type: "document_scanned" as const, 
    title: "ELD Report Verified", 
    description: "ELD data confirms: truck arrived 08:12, stationary at facility until 11:48, supports detention claim", 
    status: "in_review" as APStatus,
    document: { name: "ELD Report", url: "/demo/documents/09_eld_report.pdf" }
  },
  { 
    delay: 31500, 
    type: "document_scanned" as const, 
    title: "Detention Documentation Approved", 
    description: "Detention charge of $300 validated - 1.5 hours billable at $200/hr rate per rate confirmation terms", 
    status: "in_review" as APStatus,
    document: { name: "Detention Documentation", url: "/demo/documents/05_detention_documentation.pdf" }
  },
  { 
    delay: 34000, 
    type: "audit_complete" as const, 
    title: "AP Audit Complete", 
    description: "All documents verified. Invoice $3,150 approved for payment. Carrier rate $2,850 + $300 valid detention.", 
    status: "audit_pass" as APStatus 
  },
];

const AR_SIMULATION_STEPS = [
  { 
    delay: 0, 
    type: "email_received" as const, 
    title: "AR Job Opened", 
    description: "Initiating accounts receivable process for shipment FRT-2024-0847. Reviewing shipper communication history.", 
    status: "preparing" as ARStatus 
  },
  { 
    delay: 2500, 
    type: "document_scanned" as const, 
    title: "Reviewing Shipper-Broker Agreement", 
    description: "Found email thread confirming shipment booking. TechCorp Industries agreed to lane rate plus accessorials.", 
    status: "preparing" as ARStatus,
    document: { name: "Shipper Agreement Email", url: "/demo/emails/email_04_shipper_broker_arrangement.pdf" }
  },
  { 
    delay: 5000, 
    type: "document_scanned" as const, 
    title: "Lane Contract Verified", 
    description: "Lane contract confirms rate of $3,450 for LA to Dallas. Detention clause: shipper responsible for delays at destination.", 
    status: "preparing" as ARStatus,
    document: { name: "Lane Contract", url: "/demo/documents/06_lane_contract.pdf" }
  },
  { 
    delay: 7500, 
    type: "invoice_created" as const, 
    title: "Invoice Generated", 
    description: "Created invoice #BRK-2024-0847 for $3,750 - Lane rate $3,450 + $300 detention (shipper facility delay)", 
    status: "preparing" as ARStatus,
    document: { name: "Broker Invoice", url: "/demo/documents/07_broker_invoice.pdf" }
  },
  { 
    delay: 10000, 
    type: "document_scanned" as const, 
    title: "Evidence Packet Assembled", 
    description: "Compiled supporting documents: POD, gate log, ELD report proving shipper facility caused 3.5hr detention", 
    status: "for_review" as ARStatus 
  },
  { 
    delay: 12500, 
    type: "approval_requested" as const, 
    title: "Human Approval Requested", 
    description: "Invoice #BRK-2024-0847 and evidence packet ready for review. Awaiting approval to send to TechCorp Industries.", 
    status: "for_review" as ARStatus 
  },
  { 
    delay: 17000, 
    type: "email_sent" as const, 
    title: "Invoice Sent to Shipper", 
    description: "Invoice emailed to TechCorp Industries with attached POD, detention documentation, and payment terms (Net 30)", 
    status: "submitted" as ARStatus,
    document: { name: "Invoice Email", url: "/demo/emails/email_05_broker_invoice_to_shipper.pdf" }
  },
  { 
    delay: 19500, 
    type: "payment_received" as const, 
    title: "AR Complete", 
    description: "Invoice submitted successfully. Payment tracking initiated. Expected collection: Net 30 terms.", 
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
  const [shipments, setShipments] = useState<Shipment[]>(DEMO_SHIPMENTS);
  const [apFilter, setApFilter] = useState<APStatus | "all">("all");
  const [arFilter, setArFilter] = useState<ARStatus | "all">("all");
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const hasAutoStarted = useRef(false);

  const clearTimeouts = useCallback(() => {
    timeoutRefs.current.forEach(clearTimeout);
    timeoutRefs.current = [];
  }, []);

  const runAPSimulation = useCallback(() => {
    setSimulation(prev => ({ ...prev, currentPhase: "ap", currentStep: 0 }));
    setActiveTab("ap");
    
    AP_SIMULATION_STEPS.forEach((step, index) => {
      const timeout = setTimeout(() => {
        const newActivity: Activity = {
          id: `ap-${Date.now()}-${index}`,
          shipmentId: "SHP-001",
          type: step.type,
          category: "ap",
          title: step.title,
          description: step.description,
          timestamp: new Date(),
          metadata: step.document ? { document: step.document } : undefined
        };
        
        setActivities(prev => [newActivity, ...prev]);
        setSimulation(prev => ({ ...prev, currentStep: index + 1 }));
        
        setShipments(prev => prev.map(s => 
          s.id === "SHP-001" ? { ...s, apStatus: step.status } : s
        ));
        
        if (index === AP_SIMULATION_STEPS.length - 1) {
          setTimeout(() => {
            runARSimulation();
          }, 2000);
        }
      }, step.delay);
      
      timeoutRefs.current.push(timeout);
    });
  }, []);

  const runARSimulation = useCallback(() => {
    setSimulation(prev => ({ ...prev, currentPhase: "ar", currentStep: 0 }));
    setActiveTab("ar");
    
    AR_SIMULATION_STEPS.forEach((step, index) => {
      const timeout = setTimeout(() => {
        const newActivity: Activity = {
          id: `ar-${Date.now()}-${index}`,
          shipmentId: "SHP-001",
          type: step.type,
          category: "ar",
          title: step.title,
          description: step.description,
          timestamp: new Date(),
          metadata: step.document ? { document: step.document } : undefined
        };
        
        setActivities(prev => [newActivity, ...prev]);
        setSimulation(prev => ({ ...prev, currentStep: index + 1 }));
        
        setShipments(prev => prev.map(s => 
          s.id === "SHP-001" ? { ...s, arStatus: step.status } : s
        ));
        
        if (index === AR_SIMULATION_STEPS.length - 1) {
          setSimulation(prev => ({ ...prev, isRunning: false, currentPhase: "complete" }));
        }
      }, step.delay);
      
      timeoutRefs.current.push(timeout);
    });
  }, []);

  const startSimulation = useCallback(() => {
    clearTimeouts();
    setActivities([]);
    setShipments(DEMO_SHIPMENTS);
    setSimulation({ isRunning: true, currentPhase: "ap", currentStep: 0 });
    runAPSimulation();
  }, [clearTimeouts, runAPSimulation]);

  const pauseSimulation = useCallback(() => {
    clearTimeouts();
    setSimulation(prev => ({ ...prev, isRunning: false }));
  }, [clearTimeouts]);

  const resetSimulation = useCallback(() => {
    clearTimeouts();
    setActivities([]);
    setShipments(DEMO_SHIPMENTS);
    setSimulation({ isRunning: false, currentPhase: "idle", currentStep: 0 });
    setApFilter("all");
    setArFilter("all");
  }, [clearTimeouts]);

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
    total: shipments.length
  };

  const arCounts = {
    preparing: shipments.filter(s => s.arStatus === "preparing").length,
    for_review: shipments.filter(s => s.arStatus === "for_review").length,
    submitted: shipments.filter(s => s.arStatus === "submitted").length,
    in_dispute: shipments.filter(s => s.arStatus === "in_dispute").length,
    collected: shipments.filter(s => s.arStatus === "collected").length,
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
                <h1 className="text-xl font-semibold">Sentie AI</h1>
                <p className="text-sm text-muted-foreground">Intelligent Freight Broker Automation</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted">
                <div className={`w-2 h-2 rounded-full ${simulation.isRunning ? 'bg-chart-2 animate-pulse' : simulation.currentPhase === 'complete' ? 'bg-chart-2' : 'bg-muted-foreground'}`} />
                <span className="text-sm font-medium">
                  {simulation.currentPhase === "idle" ? "Ready" :
                   simulation.currentPhase === "complete" ? "Complete" :
                   simulation.isRunning ? `Running ${simulation.currentPhase.toUpperCase()}` : "Paused"}
                </span>
              </div>
              
              {!simulation.isRunning && simulation.currentPhase === "idle" && (
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
        <div className="mb-6">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  <span className="font-medium">Demo Flow:</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-background">SHIPPER</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="bg-primary/10 border-primary/30">FORWARDER/BROKER/3PL</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="bg-background">CARRIER</Badge>
                </div>
                <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>AI monitors all email communications</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActivityStream 
                      activities={apActivities} 
                      emptyMessage="Start the demo to see AP activities"
                    />
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">AP Process Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ProcessStep 
                      icon={<Mail className="w-4 h-4" />}
                      title="Receive Delivery Confirmation"
                      active={simulation.currentPhase === "ap" && simulation.currentStep >= 1 && simulation.currentStep <= 2}
                      complete={simulation.currentPhase === "ap" && simulation.currentStep > 2 || simulation.currentPhase === "ar" || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<FileText className="w-4 h-4" />}
                      title="Scan & Verify Documents"
                      active={simulation.currentPhase === "ap" && simulation.currentStep >= 3 && simulation.currentStep <= 7}
                      complete={simulation.currentPhase === "ap" && simulation.currentStep > 7 || simulation.currentPhase === "ar" || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<AlertCircle className="w-4 h-4" />}
                      title="Dispute & Request Proof"
                      active={simulation.currentPhase === "ap" && simulation.currentStep >= 8 && simulation.currentStep <= 10}
                      complete={simulation.currentPhase === "ap" && simulation.currentStep > 10 || simulation.currentPhase === "ar" || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<CheckCircle className="w-4 h-4" />}
                      title="Verify & Complete Audit"
                      active={simulation.currentPhase === "ap" && simulation.currentStep >= 11}
                      complete={simulation.currentPhase === "ar" || simulation.currentPhase === "complete"}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <DocumentLink name="Bill of Lading" url="/demo/documents/01_bill_of_lading.pdf" />
                    <DocumentLink name="Proof of Delivery" url="/demo/documents/02_proof_of_delivery.pdf" />
                    <DocumentLink name="Rate Confirmation" url="/demo/documents/03_rate_confirmation.pdf" />
                    <DocumentLink name="Carrier Invoice" url="/demo/documents/04_carrier_invoice.pdf" />
                    <DocumentLink name="Detention Docs" url="/demo/documents/05_detention_documentation.pdf" />
                    <DocumentLink name="Gate Log" url="/demo/documents/08_gate_log.pdf" />
                    <DocumentLink name="ELD Report" url="/demo/documents/09_eld_report.pdf" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ar" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Clock className="w-5 h-5 text-primary" />
                      AR Activity Stream
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ActivityStream 
                      activities={arActivities}
                      emptyMessage="AR process starts after AP audit is complete"
                    />
                  </CardContent>
                </Card>
              </div>
              
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">AR Process Overview</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <ProcessStep 
                      icon={<FileText className="w-4 h-4" />}
                      title="Review Shipper Agreement"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 1 && simulation.currentStep <= 3}
                      complete={simulation.currentPhase === "ar" && simulation.currentStep > 3 || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<DollarSign className="w-4 h-4" />}
                      title="Generate Invoice"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 4 && simulation.currentStep <= 5}
                      complete={simulation.currentPhase === "ar" && simulation.currentStep > 5 || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<CheckCircle className="w-4 h-4" />}
                      title="Request Human Approval"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 6 && simulation.currentStep <= 6}
                      complete={simulation.currentPhase === "ar" && simulation.currentStep > 6 || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<Mail className="w-4 h-4" />}
                      title="Send Invoice to Shipper"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 7}
                      complete={simulation.currentPhase === "complete"}
                    />
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <DocumentLink name="Lane Contract" url="/demo/documents/06_lane_contract.pdf" />
                    <DocumentLink name="Broker Invoice" url="/demo/documents/07_broker_invoice.pdf" />
                    <DocumentLink name="Shipper Agreement" url="/demo/emails/email_04_shipper_broker_arrangement.pdf" />
                    <DocumentLink name="Invoice Email" url="/demo/emails/email_05_broker_invoice_to_shipper.pdf" />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-primary" />
                  Shipments
                </CardTitle>
                <StatusFilters
                  activeTab={activeTab}
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
                activeTab={activeTab}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProcessStep({ icon, title, active, complete }: { icon: React.ReactNode; title: string; active: boolean; complete: boolean }) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
      active ? 'bg-primary/10 border border-primary/30' : 
      complete ? 'bg-chart-2/10' : 'bg-muted/50'
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
        active ? 'bg-primary text-primary-foreground' :
        complete ? 'bg-chart-2 text-white' : 'bg-muted text-muted-foreground'
      }`}>
        {complete ? <CheckCircle className="w-4 h-4" /> : icon}
      </div>
      <span className={`text-sm font-medium ${active ? 'text-primary' : complete ? 'text-chart-2' : 'text-muted-foreground'}`}>
        {title}
      </span>
    </div>
  );
}

function DocumentLink({ name, url }: { name: string; url: string }) {
  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover-elevate transition-colors group"
      data-testid={`doc-link-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm">{name}</span>
      </div>
      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  );
}
