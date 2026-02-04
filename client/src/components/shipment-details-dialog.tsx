import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Truck, MapPin, DollarSign, Clock, CheckCircle, AlertCircle, Mail, ExternalLink, Circle, Loader2, ChevronDown, ChevronRight, Check } from "lucide-react";
import type { Shipment, Activity, Document, APInvoice, APInvoiceStatus, APInvoiceType } from "@shared/schema";
import { Truck as TruckIcon, Package, Building2 } from "lucide-react";
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

type ChecklistItemStatus = 'pending' | 'in-progress' | 'completed' | 'issue' | 'action_required';

interface ChecklistItem {
    id: string;
    label: string;
    status: ChecklistItemStatus;
}

interface GroupedActivity {
    id: string;
    title: string;
    status: 'completed' | 'in-progress' | 'pending' | 'error' | 'action_required';
    timestamp: Date;
    traces: Activity[];
    description?: string;
}

export function ShipmentDetailsDialog({ shipment, activities, open, onOpenChange, onAction, context = 'ap' }: ShipmentDetailsDialogProps) {
    if (!shipment) return null;

    const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
    const pendingActivity = activities.find(a => a.shipmentId === shipment.id && a.metadata?.pendingAction);
    const hasPendingAction = Boolean(shipment.pendingAction);
    const isAPComplete = shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid';
    const canStartAR = isAPComplete;
    const isARComplete = canStartAR && (shipment.arStatus === 'submitted' || shipment.arStatus === 'collected');

    const toggleActivity = (id: string) => {
        setExpandedActivities(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- Checklist Logic ---
    const applyPendingActionGate = (items: ChecklistItem[]): ChecklistItem[] => {
        if (!hasPendingAction) return items;

        const updated = items.map(item => ({ ...item }));
        const firstNonCompletedIndex = updated.findIndex(item => item.status !== 'completed');

        if (firstNonCompletedIndex === -1) {
            const lastIndex = updated.length - 1;
            updated[lastIndex] = { ...updated[lastIndex], status: 'action_required' };
            return updated;
        }

        if (updated[firstNonCompletedIndex].status !== 'issue') {
            updated[firstNonCompletedIndex].status = 'action_required';
        }

        for (let i = firstNonCompletedIndex + 1; i < updated.length; i++) {
            updated[i].status = 'pending';
        }

        return updated;
    };

    const getChecklistItems = (): ChecklistItem[] => {
        const items: ChecklistItem[] = [];

        if (context === 'ap') {
            // AP Logic
            const hasLoadData = true; // Always true if viewing details
            const ratesValidated = activities.some(a => a.title.includes('Rate Con Verified') || shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid');

            // Accessorials checked:
            // 1. If no detention charge, it passes logic (skipped/auto-approved).
            // 2. If detention charge exists, it MUST have detention-specific verification activities (ELD or Gate Log).
            // NOTE: Do NOT bypass this check based on apStatus - detention must be resolved first.
            // NOTE: If there's a pending action (e.g. draft to review), detention is NOT verified yet.
            const carrierInvoice = shipment.apInvoices.find(inv => inv.type === 'carrier');
            const hasDetention = (carrierInvoice?.detentionCharge ?? 0) > 0;
            const detentionVerified = !shipment.pendingAction && activities.some(a =>
                (a.title.includes('ELD') || a.title.includes('Gate Log') || a.title.includes('Detention')) &&
                (a.title.includes('Verified') || a.title.includes('Resolved'))
            );
            const accessorialsChecked = !hasDetention || detentionVerified;

            const evidencesChecked = activities.some(a => a.metadata?.document); // Simplified check

            // Done: Strict check. Must be audit_pass or paid AND if detention existed, it must be resolved.
            // (The status check usually covers it, but let's be safe).
            const isDone = (shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid') && accessorialsChecked;

            // Sequential Logic Helper
            // Item N is 'in-progress' only if Item N-1 is 'completed'.
            // Item N is 'completed' if the condition is met.

            const check1 = hasLoadData;
            const check2 = check1 && (ratesValidated || isDone);
            // Crucial: check3 (Accessorials) won't complete if detention exists but isn't verified.
            const check3 = check2 && accessorialsChecked;
            const check4 = check3 && (evidencesChecked || isDone);
            const check5 = isDone;

            const getStatus = (isCompleted: boolean, previousCompleted: boolean): ChecklistItemStatus => {
                if (isCompleted) return 'completed';
                if (previousCompleted) {
                    if (shipment.apStatus === 'in_dispute') return 'issue';
                    if (shipment.apStatus === 'input_required') return 'action_required';
                    return 'in-progress';
                }
                return 'pending';
            };

            items.push({ id: 'ap-1', label: 'Validating load data', status: getStatus(check1, true) });
            items.push({ id: 'ap-2', label: 'Validating rates', status: getStatus(check2, check1) });
            items.push({ id: 'ap-3', label: 'Checking accessorials', status: getStatus(check3, check2) });
            items.push({ id: 'ap-4', label: 'Checking evidences', status: getStatus(check4, check3) });
            items.push({ id: 'ap-5', label: 'Done', status: getStatus(check5, check4) });

        } else {
            // AR Logic
            const sent = isARComplete;

            const hasLoadData = canStartAR; // AR only starts after AP completes
            // Tie logic strictly to activities or final status
            const loadedRateContract = canStartAR && (sent || activities.some(a => a.category === 'ar' && (a.title.includes('Agreement') || a.title.includes('Contract'))));
            const calculatedCharge = canStartAR && (sent || activities.some(a => a.category === 'ar' && a.type === 'invoice_created'));
            const foundAccessorials = canStartAR && (sent || activities.some(a => a.category === 'ar' && a.title.includes('Evidence')));
            const builtPacket = canStartAR && (sent || activities.some(a => a.category === 'ar' && (a.title.includes('Packet') || a.title.includes('Drafting'))));

            const check1 = hasLoadData;
            const check2 = check1 && loadedRateContract;
            const check3 = check2 && calculatedCharge;
            const check4 = check3 && (foundAccessorials || true); // Accessorials optional in AR flow often, but let's keep sequence
            const check5 = check4 && builtPacket;
            const check6 = sent;

            const getStatus = (isCompleted: boolean, previousCompleted: boolean): ChecklistItemStatus => {
                if (!canStartAR) return 'pending';
                if (isCompleted) return 'completed';
                if (previousCompleted) {
                    if (shipment.arStatus === 'in_dispute') return 'issue';
                    if (shipment.arStatus === 'input_required') return 'action_required';
                    return 'in-progress';
                }
                return 'pending';
            };

            items.push({ id: 'ar-1', label: 'Collecting load data', status: getStatus(check1, true) });
            items.push({ id: 'ar-2', label: 'Loading rate contract', status: getStatus(check2, check1) });
            items.push({ id: 'ar-3', label: 'Calculating rate charge', status: getStatus(check3, check2) });
            items.push({ id: 'ar-4', label: 'Finding accessorials', status: getStatus(check4, check3) });
            items.push({ id: 'ar-5', label: 'Building evidence packet', status: getStatus(check5, check4) });
            items.push({ id: 'ar-6', label: 'Send', status: getStatus(check6, check5) });
        }
        return applyPendingActionGate(items);
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
            { id: 'processing', keywords: ['Scanning', 'Verifying', 'Verification', 'OCR', 'Rate', 'Calculat', 'Stop-off', 'Analyz', 'Validat', 'Verified', 'Confirm', 'Check'], title: 'Document Processing' },
            { id: 'detention', keywords: ['Gate Log', 'ELD', 'Detention'], title: 'Detention Issue' },
            { id: 'evidence', keywords: ['Evidence', 'Packet', 'Generating'], title: 'Evidence Building' },
            { id: 'other', keywords: [], title: 'Other Activity' }
        ];

        // Grouping
        const bucketMap: Record<string, GroupedActivity> = {};

        sorted.forEach(act => {
            let matchedCat = mainCategories.find(cat => cat.keywords.some(k => act.title.includes(k) || act.description?.includes(k)));
            // Special casing: if email related, it might be 'other' or start of process
            if (!matchedCat) matchedCat = mainCategories.find(c => c.id === 'other');

            if (matchedCat && matchedCat.id !== 'other') {
                if (!bucketMap[matchedCat.id]) {
                    bucketMap[matchedCat.id] = {
                        id: matchedCat.id,
                        title: matchedCat.title,
                        status: 'completed', // Default
                        timestamp: new Date(act.timestamp),
                        traces: [],
                        description: act.description
                    };
                }
                // Keep latest timestamp
                if (new Date(act.timestamp) > bucketMap[matchedCat.id].timestamp) {
                    bucketMap[matchedCat.id].timestamp = new Date(act.timestamp);
                }
                bucketMap[matchedCat.id].traces.push(act);
            } else {
                // Should non-matches be their own group or lumped into "Other"?
                // "Other" is cleaner for hierarchy unless it's a major milestone like "Payment Received".
                // Let's keep major milestones separate if they don't match processing keywords.

                // If it's a critical status change like "AP Audit Complete" or "Email Sent", maybe keep separate?
                // NOTE: Detention-related issue_found activities should fall through to keyword matching to be grouped with detention
                const isDetentionIssue = act.type === 'issue_found' && (act.title.includes('Detention') || act.description?.includes('Detention'));
                if (!isDetentionIssue && (act.type === 'audit_complete' || act.type === 'payment_sent' || act.type === 'payment_received' || act.type === 'email_sent' || act.type === 'email_received' || act.type === 'issue_found' || act.type === 'email_draft' || act.type === 'approval_requested')) {
                    const status: GroupedActivity['status'] = 'completed';
                    // Drafts/Approvals are 'completed' by default (historical).
                    // They will be promoted to 'action_required' only if they are the LATEST active step.

                    groups.push({
                        id: act.id,
                        title: act.title,
                        status: status,
                        timestamp: new Date(act.timestamp),
                        traces: [act],
                        description: act.description
                    });
                } else if (isDetentionIssue) {
                    // Detention issues go into the detention bucket
                    if (!bucketMap['detention']) {
                        bucketMap['detention'] = {
                            id: 'detention',
                            title: 'Detention Issue',
                            status: 'action_required',
                            timestamp: new Date(act.timestamp),
                            traces: [],
                            description: act.description
                        };
                    }
                    if (new Date(act.timestamp) > bucketMap['detention'].timestamp) {
                        bucketMap['detention'].timestamp = new Date(act.timestamp);
                    }
                    bucketMap['detention'].traces.push(act);
                } else {
                    // Fallback to 'other' bucket
                    if (!bucketMap['other']) {
                        bucketMap['other'] = {
                            id: 'other',
                            title: 'Other Activity',
                            status: 'completed',
                            timestamp: new Date(act.timestamp),
                            traces: [],
                            description: act.description
                        };
                    }
                    if (new Date(act.timestamp) > bucketMap['other'].timestamp) {
                        bucketMap['other'].timestamp = new Date(act.timestamp);
                    }
                    bucketMap['other'].traces.push(act);
                }
            }
        });

        // Add grouped buckets to the list and refine titles/status
        Object.values(bucketMap).forEach(g => {
            // Detention Issue status logic: orange until resolved, then green
            if (g.id === 'detention') {
                const isResolved = g.traces.some(t => t.title.includes("Verified") || t.title.includes("Resolved"));
                g.status = isResolved ? 'completed' : 'action_required';
                // Keep title as "Detention Issue" always
                g.title = "Detention Issue";
            }

            // Sort traces: Oldest first for sequential reasoning traces
            g.traces.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            groups.push(g);
        });

        // Re-sort everything by timestamp (Oldest First)
        return groups.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    };

    const scopedActivities = activities.filter(a => a.shipmentId === shipment.id && (!context || a.category === context));
    const groupedActivities = groupActivities(context === 'ar' && !canStartAR ? [] : scopedActivities);

    // Determine current processing state for UI
    const isShipmentComplete = context === 'ap' ? isAPComplete : isARComplete;

    // If shipment is not complete, the LAST group (latest in time) is the "Active" one.
    if (!isShipmentComplete && groupedActivities.length > 0) {
        const lastIndex = groupedActivities.length - 1;

        if (shipment.pendingAction) {
            groupedActivities[lastIndex].status = 'action_required';
        } else if (groupedActivities[lastIndex].status !== 'error') {
            groupedActivities[lastIndex].status = 'in-progress';
        }
    }

    // Extract documents (same as before logic, just helper now)
    const documents = (context === 'ar' && !canStartAR ? [] : scopedActivities)
        .filter(a => a.metadata?.document)
        .map(a => ({
            name: a.metadata!.document!.name,
            url: a.metadata!.document!.url,
            type: a.type,
            timestamp: new Date(a.timestamp)
        }))
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const documentNames = documents.map(doc => doc.name.toLowerCase());
    const hasDocumentNamed = (needle: string) => documentNames.some(name => name.includes(needle));
    const hasBrokerInvoiceDoc = hasDocumentNamed("broker invoice");
    const hasCarrierInvoiceDoc = hasDocumentNamed("carrier invoice");
    const hasCustomsInvoiceDoc = hasDocumentNamed("customs");
    const hasWarehouseInvoiceDoc = hasDocumentNamed("warehouse invoice");
    const showARAmount = canStartAR && (isARComplete || hasBrokerInvoiceDoc);
    const hasInvoiceDocForType = (type: APInvoiceType) => {
        if (type === "carrier") return hasCarrierInvoiceDoc;
        if (type === "customs") return hasCustomsInvoiceDoc;
        return hasWarehouseInvoiceDoc;
    };
    const isInvoiceAmountVisible = (invoice: APInvoice) =>
        invoice.status !== "pending" || hasInvoiceDocForType(invoice.type);
    const apInvoicesWithDocs = shipment.apInvoices.filter(inv => isInvoiceAmountVisible(inv));
    const apTotalAmount = apInvoicesWithDocs.reduce((sum, inv) => sum + inv.amount + (inv.detentionCharge || 0), 0);

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
                                        if (shipment.pendingAction === 'verify_docs') {
                                            return "Action Required: Verify Detention Documents";
                                        }
                                        // Find the activity that triggered this action
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
                                {shipment.pendingAction === 'verify_docs' ? 'Verify Documents' : 'Review Draft'}
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
                                            ) : item.status === 'issue' ? (
                                                <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center text-destructive-foreground">
                                                    <AlertCircle className="h-4 w-4" />
                                                </div>
                                            ) : item.status === 'action_required' ? (
                                                <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center text-white">
                                                    <AlertCircle className="h-4 w-4" />
                                                </div>
                                            ) : (
                                                <div className="h-6 w-6 rounded-full border-2 border-muted bg-muted/50" />
                                            )}
                                        </div>
                                        <div>
                                            <p className={cn(
                                                "text-sm font-medium leading-none mb-1 pt-1.5",
                                                item.status === 'pending' ? "text-muted-foreground" :
                                                    item.status === 'issue' ? "text-destructive" :
                                                        item.status === 'action_required' ? "text-orange-600" :
                                                            "text-foreground"
                                            )}>
                                                {item.label}
                                            </p>
                                            {item.status === 'in-progress' && (
                                                <p className="text-xs text-muted-foreground">Currently processing...</p>
                                            )}
                                            {item.status === 'issue' && (
                                                <p className="text-xs text-destructive font-medium">Issue Detected</p>
                                            )}
                                            {item.status === 'action_required' && (
                                                <p className="text-xs text-orange-600 font-medium">Action Required</p>
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
                                            {context === 'ap' ? `AP Invoices (${shipment.apInvoices.length})` : 'AR Invoice'}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 space-y-2">
                                        {context === 'ap' ? (
                                            <>
                                                {/* AP Invoices List */}
                                                {shipment.apInvoices.length > 0 ? (
                                                    <>
                                                        {shipment.apInvoices.map((invoice, idx) => {
                                                            const InvoiceIcon = invoice.type === 'carrier' ? TruckIcon : invoice.type === 'customs' ? FileText : Building2;
                                                            const typeLabel = invoice.type === 'carrier' ? 'Carrier' : invoice.type === 'customs' ? 'Customs' : 'Warehouse';
                                                            const statusColor = invoice.status === 'audit_pass' || invoice.status === 'paid' ? 'text-green-600' :
                                                                invoice.status === 'in_dispute' ? 'text-red-600' :
                                                                    invoice.status === 'in_review' ? 'text-blue-600' :
                                                                        invoice.status === 'received' ? 'text-amber-600' : 'text-muted-foreground';
                                                            const statusLabel = invoice.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
                                                            const isAmountVisible = isInvoiceAmountVisible(invoice);

                                                            return (
                                                                <div key={invoice.id}>
                                                                    {idx > 0 && <Separator className="my-2" />}
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex items-center gap-2">
                                                                                <InvoiceIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                                                <span className="text-xs font-medium text-muted-foreground">{typeLabel}</span>
                                                                            </div>
                                                                            <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
                                                                        </div>
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-sm truncate max-w-[120px]">{invoice.vendor}</span>
                                                                            <span className="text-sm font-semibold">
                                                                                {isAmountVisible ? `$${(invoice.amount + (invoice.detentionCharge || 0)).toLocaleString()}` : 'Pending...'}
                                                                            </span>
                                                                        </div>
                                                                        {isAmountVisible && invoice.detentionCharge && invoice.detentionCharge > 0 && (
                                                                            <div className="text-xs text-amber-600 text-right">
                                                                                incl. ${invoice.detentionCharge} detention
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        <Separator className="my-2" />
                                                        <div className="flex justify-between items-center pt-1">
                                                            <span className="text-sm font-semibold">Total AP</span>
                                                            <span className="text-sm font-bold">
                                                                {apInvoicesWithDocs.length > 0 ? `$${apTotalAmount.toLocaleString()}` : 'Pending...'}
                                                            </span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="text-center py-4 text-sm text-muted-foreground italic">
                                                        No invoices received yet
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                {/* AR Single Invoice */}
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Shipper Rate</span>
                                                    <span className="font-medium">
                                                        {showARAmount ? `$${shipment.arInvoiceAmount.toLocaleString()}` : 'Pending...'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-muted-foreground">Broker Invoice</span>
                                                    <span className="font-medium">
                                                        {showARAmount ? `$${shipment.arInvoiceAmount.toLocaleString()}` : 'Pending...'}
                                                    </span>
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
                                                        group.status === 'action_required' ? 'border-orange-500 bg-orange-500' :
                                                            group.status === 'completed' ? 'border-green-500 bg-green-500' :
                                                                'border-primary bg-background'
                                                )}>
                                                    {group.status === 'in-progress' && (
                                                        <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" />
                                                    )}
                                                    {group.status === 'completed' && (
                                                        <Check className="h-2.5 w-2.5 text-white" />
                                                    )}
                                                    {group.status === 'action_required' && (
                                                        <AlertCircle className="h-2.5 w-2.5 text-white" />
                                                    )}
                                                    {group.status === 'error' && (
                                                        <AlertCircle className="h-2.5 w-2.5 text-white" />
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
                                                                group.status === 'error' ? 'text-destructive' :
                                                                    group.status === 'action_required' ? 'text-orange-600' : ''
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
