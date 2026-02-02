import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Truck, MapPin, DollarSign, Clock, CheckCircle, AlertCircle, Mail, ExternalLink, Circle, Loader2, ChevronDown, ChevronRight, Check } from "lucide-react";
import type { Shipment, Activity, Document } from "@shared/schema";
import { format } from "date-fns";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface ShipmentDetailsDialogProps {
    shipment: Shipment | null;
    activities: Activity[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAction?: (shipmentId: string) => void;
    context?: 'ap' | 'ar';
}

type ChecklistItemStatus = 'pending' | 'in-progress' | 'completed';

interface ChecklistItem {
    id: string;
    label: string;
    status: ChecklistItemStatus;
}

interface GroupedActivity {
    id: string;
    title: string;
    status: 'completed' | 'in-progress' | 'pending' | 'error';
    timestamp: Date;
    traces: Activity[];
    description?: string;
}

export function ShipmentDetailsDialog({ shipment, activities, open, onOpenChange, onAction, context = 'ap' }: ShipmentDetailsDialogProps) {
    if (!shipment) return null;

    const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});

    const toggleActivity = (id: string) => {
        setExpandedActivities(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- Checklist Logic ---
    const getChecklistItems = (): ChecklistItem[] => {
        const items: ChecklistItem[] = [];

        if (context === 'ap') {
            // AP Logic
            const hasLoadData = true; // Shipment exists, so load data is effectively valid
            const ratesValidated = activities.some(a => a.title.includes('Rate Con Verified') || shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid');
            const accessorialsChecked = activities.some(a => a.title.includes('Accessorial') || shipment.detentionCharge !== null);
            const evidencesChecked = activities.some(a => a.metadata?.document); // Simplified check
            const isDone = shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid';

            items.push({ id: 'ap-1', label: 'Validating load data', status: hasLoadData ? 'completed' : 'in-progress' }); // Assuming always started if viewing
            items.push({ id: 'ap-2', label: 'Validating rates', status: ratesValidated ? 'completed' : (hasLoadData ? 'in-progress' : 'pending') });
            items.push({ id: 'ap-3', label: 'Checking accessorials', status: accessorialsChecked ? 'completed' : (ratesValidated ? 'in-progress' : 'pending') });
            items.push({ id: 'ap-4', label: 'Checking evidences', status: evidencesChecked ? 'completed' : (accessorialsChecked ? 'in-progress' : 'pending') });
            items.push({ id: 'ap-5', label: 'Done', status: isDone ? 'completed' : (evidencesChecked ? 'in-progress' : 'pending') });

        } else {
            // AR Logic
            const sent = shipment.arStatus === 'submitted' || shipment.arStatus === 'collected';

            // Tie logic strictly to activities or final status
            const hasLoadData = sent || activities.some(a => a.category === 'ar' && a.title.includes('AR Job Opened'));
            const loadedRateContract = sent || activities.some(a => a.category === 'ar' && (a.title.includes('Agreement') || a.title.includes('Contract')));
            const calculatedCharge = sent || activities.some(a => a.category === 'ar' && a.type === 'invoice_created');
            const foundAccessorials = sent || activities.some(a => a.category === 'ar' && a.title.includes('Evidence')); // "Evidence Packet Ready" implies accessorials checked
            const builtPacket = sent || activities.some(a => a.category === 'ar' && (a.title.includes('Packet') || a.title.includes('Drafting')));

            items.push({ id: 'ar-1', label: 'Collecting load data', status: hasLoadData ? 'completed' : 'in-progress' });
            items.push({ id: 'ar-2', label: 'Loading rate contract', status: loadedRateContract ? 'completed' : (hasLoadData ? 'in-progress' : 'pending') });
            items.push({ id: 'ar-3', label: 'Calculating rate charge', status: calculatedCharge ? 'completed' : (loadedRateContract ? 'in-progress' : 'pending') });
            items.push({ id: 'ar-4', label: 'Finding accessorials', status: foundAccessorials ? 'completed' : (calculatedCharge ? 'in-progress' : 'pending') });
            items.push({ id: 'ar-5', label: 'Building evidence packet', status: builtPacket ? 'completed' : (foundAccessorials ? 'in-progress' : 'pending') });
            items.push({ id: 'ar-6', label: 'Send', status: sent ? 'completed' : (builtPacket ? 'in-progress' : 'pending') });
        }
        return items;
    };

    const checklistItems = getChecklistItems();

    // --- Activity Grouping Logic ---
    const groupActivities = (rawActivities: Activity[]): GroupedActivity[] => {
        const sorted = [...rawActivities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const groups: GroupedActivity[] = [];

        // Helper to find or create group
        // This is a simplified heuristic grouping. In a real app, we might want consistent IDs linking these.
        // Here we'll group by time proximity or fuzzy text matching if no explicit linking exists.
        // For this task, strict mapping based on the plan instructions:

        const mainCategories = [
            { id: 'docs', keywords: ['Scanning', 'Verifying', 'OCR'], title: 'Processing Documents' },
            { id: 'rates', keywords: ['Rate', 'Calculat', 'Stop-off'], title: 'Rate Validation' },
            { id: 'evidence', keywords: ['Evidence', 'Packet', 'Generating'], title: 'Evidence Building' },
            { id: 'other', keywords: [], title: 'Other Activity' }
        ];

        // We will do a single pass to bucketize. 
        // Since the requirement is "ephemeral reasoning traces", we want to show the Main Status as the primary item.

        // Let's create buckets.
        const bucketMap: Record<string, GroupedActivity> = {};

        sorted.forEach(act => {
            let matchedCat = mainCategories.find(cat => cat.keywords.some(k => act.title.includes(k) || act.description?.includes(k)));
            if (!matchedCat) matchedCat = mainCategories.find(c => c.id === 'other'); // Fallback

            if (matchedCat && matchedCat.id !== 'other') {
                if (!bucketMap[matchedCat.id]) {
                    bucketMap[matchedCat.id] = {
                        id: matchedCat.id,
                        title: matchedCat.title,
                        status: 'completed', // simplified default
                        timestamp: new Date(act.timestamp),
                        traces: [],
                        description: act.description
                    };
                }
                // Keep latest timestamp for the group
                if (new Date(act.timestamp) > bucketMap[matchedCat.id].timestamp) {
                    bucketMap[matchedCat.id].timestamp = new Date(act.timestamp);
                }
                bucketMap[matchedCat.id].traces.push(act);
            } else {
                groups.push({
                    id: act.id,
                    title: act.title,
                    status: act.type === 'issue_found' ? 'error' : 'completed',
                    timestamp: new Date(act.timestamp),
                    traces: [act], // It is its own trace
                    description: act.description
                });
            }
        });

        // Add grouped buckets to the list
        Object.values(bucketMap).forEach(g => {
            // Sort traces: Oldest first for sequential reasoning traces
            g.traces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            groups.push(g);
        });

        // Re-sort everything by timestamp
        return groups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    };

    const groupedActivities = groupActivities(activities.filter(a => a.shipmentId === shipment.id && (!context || a.category === context)));

    // Determine current processing state for UI
    const isShipmentComplete = context === 'ap'
        ? (shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid')
        : (shipment.arStatus === 'submitted' || shipment.arStatus === 'collected');

    // If shipment is not complete, the very first group (latest in time) is likely the "Active" one.
    if (!isShipmentComplete && groupedActivities.length > 0) {
        groupedActivities[0].status = 'in-progress';
    }

    // Extract documents (same as before logic, just helper now)
    const documents = activities
        .filter(a => a.shipmentId === shipment.id && a.metadata?.document)
        .map(a => ({
            name: a.metadata!.document!.name,
            url: a.metadata!.document!.url,
            type: a.type,
            timestamp: new Date(a.timestamp)
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Financial discovery logic (preserved)
    const isAPComplete = shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid';
    const isARComplete = shipment.arStatus === 'submitted' || shipment.arStatus === 'collected';
    const showLaneRate = isAPComplete || activities.some(a => a.shipmentId === shipment.id && a.title.includes("Rate Con Verified"));
    const showInvoiceAmount = isAPComplete || activities.some(a => a.shipmentId === shipment.id && a.title.includes("Invoice Analysis"));
    const showDetention = isAPComplete || activities.some(a => a.shipmentId === shipment.id && a.title.includes("ELD Report Verified"));
    const showARAmount = isARComplete || activities.some(a => a.shipmentId === shipment.id && (a.type === "invoice_created" || a.title.includes("Invoice Generated")));

    const currentApStatus = shipment.apStatus as string;
    const currentArStatus = shipment.arStatus as string;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <div className="flex items-center justify-between mr-8">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                <Truck className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Shipment {shipment.shipmentNumber}</DialogTitle>
                                <DialogDescription className="flex items-center gap-2 mt-1">
                                    <span className="font-medium text-foreground">{shipment.carrier}</span>
                                    <span>•</span>
                                    <span>{shipment.shipper}</span>
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">{context === 'ap' ? 'Accounts Payable' : 'Accounts Receivable'}</span>
                                <Badge variant={shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid' ? 'default' : shipment.apStatus === 'input_required' ? 'destructive' : 'secondary'}>
                                    {currentApStatus.replace('_', ' ').toUpperCase()}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {shipment.pendingAction && (
                    <div className="px-6 pb-2">
                        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-orange-800">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">
                                    {(() => {
                                        // Find the activity that triggered this action
                                        const pendingActivity = activities.find(a => a.type === 'email_draft' && a.metadata?.pendingAction);
                                        if (!pendingActivity) return "Action Required: Email Draft Pending Review";

                                        if (pendingActivity.title.includes("Detention")) return "Action Required: Review Detention Request Draft";
                                        if (pendingActivity.title.includes("Document")) return "Action Required: Review Document Request Draft";
                                        if (pendingActivity.title.includes("Shipper Invoice")) return "Action Required: Review Shipper Invoice Draft";

                                        return `Action Required: Review ${pendingActivity.title.replace('Drafting ', '')}`;
                                    })()}
                                </span>
                            </div>
                            <button
                                onClick={() => onAction?.(shipment.id)}
                                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                            >
                                Review Draft
                            </button>
                        </div>
                    </div>
                )}

                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-4 h-full">
                    {/* Column 1: Checklist */}
                    <div className="md:col-span-1 border-r bg-muted/10 flex flex-col overflow-hidden">
                        <div className="p-4 border-b bg-muted/20">
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                <CheckCircle className="h-4 w-4" />
                                Process Checklist
                            </h3>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4">
                                {checklistItems.map((item, idx) => (
                                    <div key={item.id} className="relative pl-6 pb-4 last:pb-0">
                                        {/* Connector Line */}
                                        {idx !== checklistItems.length - 1 && (
                                            <div className={cn(
                                                "absolute left-[11px] top-6 bottom-[-10px] w-px",
                                                item.status === 'completed' ? "bg-primary" : "bg-muted"
                                            )} />
                                        )}

                                        <div className="absolute left-0 top-1">
                                            {item.status === 'completed' ? (
                                                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                                                    <CheckCircle className="h-4 w-4" />
                                                </div>
                                            ) : item.status === 'in-progress' ? (
                                                <div className="h-6 w-6 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                                                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="h-6 w-6 rounded-full border-2 border-muted bg-muted/50" />
                                            )}
                                        </div>
                                        <div>
                                            <p className={cn(
                                                "text-sm font-medium leading-none mb-1 pt-1.5",
                                                item.status === 'pending' ? "text-muted-foreground" : "text-foreground"
                                            )}>
                                                {item.label}
                                            </p>
                                            {item.status === 'in-progress' && (
                                                <p className="text-xs text-muted-foreground">Currently processing...</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Column 2: Details & Documents */}
                    <div className="md:col-span-1 border-r bg-muted/5 flex flex-col overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-4 space-y-4">
                                {/* Route Details */}
                                <Card>
                                    <CardHeader className="py-2 px-4 bg-muted/50">
                                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <MapPin className="h-3 w-3" />
                                            Route
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-2">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] text-muted-foreground uppercase">Origin</p>
                                            <p className="font-medium text-sm leading-tight">{shipment.origin}</p>
                                        </div>
                                        <Separator />
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] text-muted-foreground uppercase">Destination</p>
                                            <p className="font-medium text-sm leading-tight">{shipment.destination}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Financials */}
                                <Card>
                                    <CardHeader className="py-2 px-4 bg-muted/50">
                                        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                            <DollarSign className="h-3 w-3" />
                                            Financials
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">{context === 'ar' ? 'Shipper Rate' : 'Lane Rate'}</span>
                                            <span className="font-medium">
                                                {context === 'ar' ? (showARAmount ? `$${shipment.invoiceAmount.toLocaleString()}` : 'Pending...') : (showLaneRate ? `$${shipment.laneRate.toLocaleString()}` : 'Processing...')}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">{context === 'ar' ? 'Broker Amount' : 'Invoice Amount'}</span>
                                            <span className="font-medium">
                                                {context === 'ar' ? (showARAmount ? `$${shipment.invoiceAmount.toLocaleString()}` : 'Pending...') : (showInvoiceAmount ? `$${shipment.invoiceAmount.toLocaleString()}` : 'Processing...')}
                                            </span>
                                        </div>
                                        {(context === 'ap' && shipment.detentionCharge) && (
                                            <>
                                                <Separator />
                                                <div className={`flex justify-between items-center text-sm ${showDetention ? 'text-amber-600' : 'text-muted-foreground opacity-50'}`}>
                                                    <span className="font-medium">Detention</span>
                                                    <span className="font-medium">{showDetention ? `+$${shipment.detentionCharge}` : 'Analyzing...'}</span>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Documents */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Documents ({documents.length})</h4>
                                    {documents.length > 0 ? (
                                        <div className="space-y-2">
                                            {documents.map((doc, i) => (
                                                <a
                                                    key={i}
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-3 bg-card border rounded-lg hover:bg-accent transition-colors flex items-center gap-3 group"
                                                >
                                                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                        <FileText className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors flex items-center gap-1">
                                                            {doc.name}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground">{format(doc.timestamp, 'MMM d, h:mm a')}</p>
                                                    </div>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                                            No documents yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Column 3 & 4: Activity Timeline (Wider) */}
                    <div className="md:col-span-2 flex flex-col overflow-hidden bg-background">
                        <div className="p-4 border-b z-10 sticky top-0 bg-background/95 backdrop-blur">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Activity Timeline
                            </h3>
                        </div>
                        <ScrollArea className="flex-1 p-6">
                            <div className="relative pl-6 border-l ml-3 space-y-8 pb-6">
                                {groupedActivities.length > 0 ? (
                                    groupedActivities.map((group) => {
                                        // Auto-expand active group
                                        const isGroupActive = group.status === 'in-progress';
                                        const shouldBeExpanded = expandedActivities[group.id] || group.traces.length === 1 || isGroupActive;

                                        return (
                                            <div key={group.id} className="relative">
                                                {/* Timeline dot */}
                                                <div className={cn(
                                                    "absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 transition-colors flex items-center justify-center",
                                                    group.status === 'error' ? 'border-destructive bg-destructive' :
                                                        group.status === 'completed' ? 'border-green-500 bg-green-500' :
                                                            'border-primary bg-background'
                                                )}>
                                                    {group.status === 'in-progress' && (
                                                        <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                                                    )}
                                                    {group.status === 'completed' && (
                                                        <Check className="h-2.5 w-2.5 text-white" />
                                                    )}
                                                </div>

                                                <div className="flex flex-col gap-2">
                                                    {/* Header Row */}
                                                    <div
                                                        className="flex items-center justify-between cursor-pointer hover:bg-muted/50 p-2 -ml-2 rounded-md transition-colors"
                                                        onClick={() => group.traces.length > 1 && toggleActivity(group.id)}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "text-sm font-medium",
                                                                group.status === 'error' ? 'text-destructive' : ''
                                                            )}>
                                                                {group.title}
                                                            </span>
                                                            {group.traces.length > 1 && (
                                                                <div className="text-xs text-muted-foreground flex items-center gap-1 bg-muted px-1.5 py-0.5 rounded">
                                                                    {group.traces.length} steps
                                                                    {shouldBeExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-muted-foreground tabular-nums">
                                                            {format(group.timestamp, 'h:mm a')}
                                                        </span>
                                                    </div>

                                                    {/* Expanded / Reasoning Traces */}
                                                    {shouldBeExpanded && (
                                                        <div className="space-y-2 pl-2 border-l-2 border-muted/30 ml-1">
                                                            {group.traces.map((trace, tIdx) => {
                                                                // Logic for trace status interaction
                                                                // If group is in-progress:
                                                                // - Last item is "in-progress" (spinner)
                                                                // - Previous items are "completed" (check)
                                                                // If group is completed:
                                                                // - All items "completed" (check)

                                                                let traceStatus: 'pending' | 'in-progress' | 'completed' = 'completed';

                                                                if (group.status === 'in-progress') {
                                                                    if (tIdx === group.traces.length - 1) {
                                                                        traceStatus = 'in-progress';
                                                                    } else {
                                                                        traceStatus = 'completed';
                                                                    }
                                                                }

                                                                return (
                                                                    <div key={trace.id} className="text-sm">
                                                                        <div className="flex items-start justify-between gap-4">
                                                                            <div className="space-y-0.5 flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    {/* Mini Status Icon for Trace */}
                                                                                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                                                                                        {traceStatus === 'in-progress' ? (
                                                                                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                                                                        ) : traceStatus === 'completed' ? (
                                                                                            <div className="h-3 w-3 rounded-full bg-green-500/20 flex items-center justify-center">
                                                                                                <Check className="h-2 w-2 text-green-600" />
                                                                                            </div>
                                                                                        ) : (
                                                                                            <Circle className="h-2 w-2 text-muted-foreground" />
                                                                                        )}
                                                                                    </div>

                                                                                    <p className={cn(
                                                                                        "text-muted-foreground text-xs font-medium",
                                                                                        traceStatus === 'in-progress' && "text-primary"
                                                                                    )}>
                                                                                        {trace.title}
                                                                                    </p>
                                                                                </div>

                                                                                {trace.description && trace.description !== group.title && (
                                                                                    <p className="text-muted-foreground text-xs pl-6 opacity-90">{trace.description}</p>
                                                                                )}
                                                                            </div>
                                                                            {group.traces.length > 1 && (
                                                                                <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">
                                                                                    {format(new Date(trace.timestamp), 'h:mm:ss')}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {trace.metadata?.document && (
                                                                            <a
                                                                                href={trace.metadata.document.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="ml-6 mt-1.5 flex items-center gap-2 p-1.5 rounded bg-muted/30 w-fit hover:bg-muted hover:text-primary transition-colors border border-transparent hover:border-border"
                                                                            >
                                                                                <FileText className="h-3 w-3" />
                                                                                <span className="text-xs font-medium">{trace.metadata.document.name}</span>
                                                                                <ExternalLink className="h-3 w-3 opacity-50" />
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    )}

                                                    {/* Collapsed Preview (if more than 1 item and collapsed) */}
                                                    {!shouldBeExpanded && group.traces.length > 1 && (
                                                        <p className="text-xs text-muted-foreground italic pl-2">
                                                            ... {group.traces.length} processed items hidden
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        No activity recorded yet for this shipment.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
