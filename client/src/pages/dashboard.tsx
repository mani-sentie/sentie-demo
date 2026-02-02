import { useState, useEffect, useCallback, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, RotateCcw, Truck, Bot, Mail, FileText, CheckCircle, AlertCircle, Clock, DollarSign } from "lucide-react";
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
  { delay: 0, type: "email_received" as const, title: "Delivery Confirmation Received", description: "Email from Swift Logistics confirming delivery of shipment FRT-2024-0847 to Dallas, TX", status: "received" as APStatus },
  { delay: 2000, type: "email_sent" as const, title: "AI Requests Proof of Delivery", description: "Automated email sent to carrier requesting POD, BOL, and invoice documents", status: "received" as APStatus },
  { delay: 4000, type: "email_received" as const, title: "Documents Received from Carrier", description: "Received attachment package: POD, Rate Con, Invoice, Detention Charge claim", status: "in_review" as APStatus },
  { delay: 6000, type: "document_scanned" as const, title: "AI Scanning Documents", description: "Processing POD, Rate Confirmation, and Invoice...", status: "in_review" as APStatus },
  { delay: 8000, type: "document_scanned" as const, title: "POD Verified", description: "Proof of Delivery document validated - signature and timestamp confirmed", status: "in_review" as APStatus },
  { delay: 10000, type: "issue_found" as const, title: "Detention Charge Issue Detected", description: "Carrier claims $300 detention charge but no supporting documentation provided", status: "in_dispute" as APStatus },
  { delay: 12000, type: "document_scanned" as const, title: "Rate Con Verified", description: "Rate confirmation matches agreed lane rate of $2,850", status: "in_dispute" as APStatus },
  { delay: 14000, type: "email_sent" as const, title: "AI Disputes Detention Charge", description: "Email sent to carrier requesting proof of detention with timestamps and driver logs", status: "in_dispute" as APStatus },
  { delay: 18000, type: "email_received" as const, title: "Corrected Invoice Received", description: "Carrier submitted revised invoice for $2,850 without detention charge", status: "in_review" as APStatus },
  { delay: 20000, type: "document_scanned" as const, title: "Revised Invoice Verified", description: "Invoice amount $2,850 matches rate confirmation - all documents validated", status: "audit_pass" as APStatus },
  { delay: 22000, type: "audit_complete" as const, title: "AP Audit Complete", description: "All documents verified. Ready for payment processing.", status: "audit_pass" as APStatus },
];

const AR_SIMULATION_STEPS = [
  { delay: 0, type: "email_received" as const, title: "AR Job Opened", description: "Initiating accounts receivable process for shipment FRT-2024-0847", status: "preparing" as ARStatus },
  { delay: 2000, type: "document_scanned" as const, title: "Reviewing Shipment Communication", description: "Scanning email thread between TechCorp Industries and broker", status: "preparing" as ARStatus },
  { delay: 4000, type: "document_scanned" as const, title: "Lane Rate Confirmed", description: "Found agreed rate of $3,450 in shipper communication dated Jan 15", status: "preparing" as ARStatus },
  { delay: 6000, type: "invoice_created" as const, title: "Invoice Generated", description: "Created invoice #INV-2024-0847 for $3,450 including $300 detention at shipper facility", status: "preparing" as ARStatus },
  { delay: 8000, type: "document_scanned" as const, title: "Evidence Packet Assembled", description: "Compiled email proof showing shipper delay caused detention charges", status: "for_review" as ARStatus },
  { delay: 10000, type: "approval_requested" as const, title: "Human Approval Requested", description: "Invoice and evidence packet ready for review. Awaiting approval to send.", status: "for_review" as ARStatus },
  { delay: 14000, type: "email_sent" as const, title: "Invoice Sent to Shipper", description: "Invoice #INV-2024-0847 emailed to TechCorp Industries with supporting documentation", status: "submitted" as ARStatus },
  { delay: 16000, type: "payment_received" as const, title: "AR Complete", description: "Invoice submitted and tracking payment collection.", status: "submitted" as ARStatus },
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
          timestamp: new Date()
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
          timestamp: new Date()
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
    // Auto-start demo after a short delay when page loads
    const autoStartTimer = setTimeout(() => {
      startSimulation();
    }, 1000);
    
    return () => {
      clearTimeout(autoStartTimer);
      clearTimeouts();
    };
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
                      title="Dispute Invalid Charges"
                      active={simulation.currentPhase === "ap" && simulation.currentStep >= 8 && simulation.currentStep <= 9}
                      complete={simulation.currentPhase === "ap" && simulation.currentStep > 9 || simulation.currentPhase === "ar" || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<CheckCircle className="w-4 h-4" />}
                      title="Complete Audit"
                      active={simulation.currentPhase === "ap" && simulation.currentStep >= 10}
                      complete={simulation.currentPhase === "ar" || simulation.currentPhase === "complete"}
                    />
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
                      title="Open AR Job"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 1 && simulation.currentStep <= 2}
                      complete={simulation.currentPhase === "ar" && simulation.currentStep > 2 || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<DollarSign className="w-4 h-4" />}
                      title="Generate Invoice"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 3 && simulation.currentStep <= 4}
                      complete={simulation.currentPhase === "ar" && simulation.currentStep > 4 || simulation.currentPhase === "complete"}
                    />
                    <ProcessStep 
                      icon={<CheckCircle className="w-4 h-4" />}
                      title="Request Human Approval"
                      active={simulation.currentPhase === "ar" && simulation.currentStep >= 5 && simulation.currentStep <= 6}
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
