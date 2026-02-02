import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Truck, MapPin, DollarSign, Clock, CheckCircle, AlertCircle, Mail, ExternalLink } from "lucide-react";
import type { Shipment, Activity, Document } from "@shared/schema";
import { format } from "date-fns";

interface ShipmentDetailsDialogProps {
    shipment: Shipment | null;
    activities: Activity[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onAction?: (shipmentId: string) => void;
}

export function ShipmentDetailsDialog({ shipment, activities, open, onOpenChange, onAction }: ShipmentDetailsDialogProps) {
    if (!shipment) return null;

    const shipmentActivities = activities.filter(a => a.shipmentId === shipment.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Extract documents from activities
    const documents: { name: string; url: string; type: string; timestamp: Date }[] = [];
    shipmentActivities.forEach(activity => {
        if (activity.metadata?.document) {
            documents.push({
                name: activity.metadata.document.name,
                url: activity.metadata.document.url,
                type: activity.type,
                timestamp: new Date(activity.timestamp)
            });
        }
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
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
                            <Badge variant={shipment.apStatus === 'audit_pass' || shipment.apStatus === 'paid' ? 'default' : 'secondary'}>
                                AP: {shipment.apStatus.replace('_', ' ')}
                            </Badge>
                            <Badge variant={shipment.arStatus === 'submitted' || shipment.arStatus === 'collected' ? 'default' : 'outline'}>
                                AR: {shipment.arStatus.replace('_', ' ')}
                            </Badge>
                        </div>
                    </div>
                </DialogHeader>

                {shipment.pendingAction && (
                    <div className="px-6 pb-2">
                        <div className="bg-orange-50 border border-orange-200 rounded-md p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-orange-800">
                                <AlertCircle className="h-5 w-5" />
                                <span className="font-medium">Action Required: Email Draft Pending Review</span>
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

                <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3">
                    {/* Left Column: Details & Documents */}
                    <div className="md:col-span-1 border-r bg-muted/30 flex flex-col overflow-hidden">
                        <ScrollArea className="h-full">
                            <div className="p-6 space-y-6">
                                {/* Route Details */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-muted/50">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <MapPin className="h-4 w-4" />
                                            Route Information
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Origin</p>
                                            <p className="font-medium text-sm">{shipment.origin}</p>
                                        </div>
                                        <Separator />
                                        <div className="space-y-1">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">Destination</p>
                                            <p className="font-medium text-sm">{shipment.destination}</p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Financials */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-muted/50">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <DollarSign className="h-4 w-4" />
                                            Financials
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Lane Rate</span>
                                            <span className="font-medium">${shipment.laneRate.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">Invoice Amount</span>
                                            <span className="font-medium">${shipment.invoiceAmount.toLocaleString()}</span>
                                        </div>
                                        {shipment.detentionCharge && (
                                            <>
                                                <Separator />
                                                <div className="flex justify-between items-center text-amber-600">
                                                    <span className="text-sm font-medium">Detention</span>
                                                    <span className="font-medium">+${shipment.detentionCharge}</span>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Documents */}
                                <Card>
                                    <CardHeader className="py-3 px-4 bg-muted/50">
                                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                                            <FileText className="h-4 w-4" />
                                            Documents ({documents.length})
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        {documents.length > 0 ? (
                                            <div className="divide-y">
                                                {documents.map((doc, i) => (
                                                    <a
                                                        key={i}
                                                        href={doc.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-3 hover:bg-muted/50 transition-colors flex items-center justify-between group block"
                                                    >
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                                                                <FileText className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors flex items-center gap-2">
                                                                    {doc.name}
                                                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">{format(doc.timestamp, 'MMM d, h:mm a')}</p>
                                                            </div>
                                                        </div>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-sm text-muted-foreground">
                                                No documents yet
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right Column: Activity Timeline */}
                    <div className="md:col-span-2 flex flex-col overflow-hidden h-[600px] md:h-auto">
                        <div className="p-4 border-b bg-background z-10">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Activity Timeline
                            </h3>
                        </div>
                        <ScrollArea className="flex-1 p-6">
                            <div className="relative pl-6 border-l ml-3 space-y-8 pb-6">
                                {shipmentActivities.length > 0 ? (
                                    shipmentActivities.map((activity, index) => (
                                        <div key={activity.id} className="relative">
                                            {/* Timeline dot */}
                                            <div className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 ${activity.type.includes('issue') ? 'border-destructive bg-destructive' :
                                                activity.type.includes('audit_pass') || activity.type.includes('payment') ? 'border-green-500 bg-green-500' :
                                                    'border-primary bg-background'
                                                }`} />

                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={`text-sm font-medium ${activity.type.includes('issue') ? 'text-destructive' : ''
                                                        }`}>
                                                        {activity.title}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground tabular-nums">
                                                        {format(new Date(activity.timestamp), 'h:mm:ss a')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {activity.description}
                                                </p>
                                                {activity.metadata?.document && (
                                                    <a
                                                        href={activity.metadata.document.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mt-2 flex items-center gap-2 p-2 rounded bg-muted/50 w-fit hover:bg-muted hover:text-primary transition-colors"
                                                    >
                                                        <FileText className="h-3 w-3" />
                                                        <span className="text-xs font-medium">{activity.metadata.document.name}</span>
                                                        <ExternalLink className="h-3 w-3 opacity-50" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))
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
