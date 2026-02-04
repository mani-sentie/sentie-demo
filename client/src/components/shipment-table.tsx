import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Shipment, APStatus, ARStatus, APInvoice, APInvoiceStatus, Activity } from "@shared/schema";

// Helper to get the "worst" status among AP invoices (for color coding)
const getWorstAPInvoiceStatus = (invoices: APInvoice[]): APInvoiceStatus => {
  const statusPriority: APInvoiceStatus[] = ["in_dispute", "pending", "received", "in_review", "audit_pass", "paid"];
  for (const status of statusPriority) {
    if (invoices.some(inv => inv.status === status)) {
      return status;
    }
  }
  return "pending";
};

// Helper to calculate total AP invoice amount
const getTotalAPAmount = (invoices: APInvoice[]): number => {
  return invoices.reduce((sum, inv) => sum + inv.amount + (inv.detentionCharge || 0), 0);
};

interface ShipmentTableProps {
  shipments: Shipment[];
  activeTab: "ap" | "ar";
  activities: Activity[];
  onShipmentClick?: (shipment: Shipment) => void;
}

const apStatusConfig: Record<APStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  received: { label: "Received", variant: "secondary" },
  in_review: { label: "In Review", variant: "outline" },
  audit_pass: { label: "Audit Pass", variant: "default" },
  in_dispute: { label: "In Dispute", variant: "destructive" },
  paid: { label: "Paid", variant: "default" },
  input_required: { label: "Input Required", variant: "destructive" }
};

const arStatusConfig: Record<ARStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  preparing: { label: "Preparing", variant: "secondary" },
  for_review: { label: "For Review", variant: "outline" },
  submitted: { label: "Submitted", variant: "default" },
  in_dispute: { label: "In Dispute", variant: "destructive" },
  collected: { label: "Collected", variant: "default" },
  input_required: { label: "Input Required", variant: "destructive" }
};

export function ShipmentTable({ shipments, activeTab, activities, onShipmentClick }: ShipmentTableProps) {
  const documentsByShipment = useMemo(() => {
    const map = new Map<string, string[]>();
    activities.forEach((activity) => {
      const documentName = activity.metadata?.document?.name;
      if (!documentName) return;
      const current = map.get(activity.shipmentId);
      if (current) {
        current.push(documentName.toLowerCase());
      } else {
        map.set(activity.shipmentId, [documentName.toLowerCase()]);
      }
    });
    return map;
  }, [activities]);

  const hasDocumentNamed = (documentNames: string[], needle: string) =>
    documentNames.some((name) => name.includes(needle));

  if (shipments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No shipments match the selected filter</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment #</TableHead>
            <TableHead>Route</TableHead>
            {activeTab === "ap" ? (
              <TableHead>Carrier</TableHead>
            ) : (
              <TableHead>Shipper</TableHead>
            )}
            <TableHead className="text-right">{activeTab === "ap" ? "Lane Rate" : "Amount"}</TableHead>
            <TableHead className="text-right">Invoice</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => {
            const statusConfig = activeTab === "ap"
              ? apStatusConfig[shipment.apStatus]
              : arStatusConfig[shipment.arStatus];
            const documentNames = documentsByShipment.get(shipment.id) ?? [];
            const hasRateConfirmation = hasDocumentNamed(documentNames, "rate confirmation");
            const hasBrokerInvoice = hasDocumentNamed(documentNames, "broker invoice");
            const hasCarrierInvoice = hasDocumentNamed(documentNames, "carrier invoice");
            const hasCustomsInvoice = hasDocumentNamed(documentNames, "customs");
            const hasWarehouseInvoice = hasDocumentNamed(documentNames, "warehouse invoice");
            const invoiceHasDocs = (invoice: APInvoice) =>
              invoice.status !== "pending"
              || (invoice.type === "carrier" ? hasCarrierInvoice : invoice.type === "customs" ? hasCustomsInvoice : hasWarehouseInvoice);
            const receivedInvoices = shipment.apInvoices.filter(invoiceHasDocs);
            const apInvoiceTotal = getTotalAPAmount(receivedInvoices);
            const receivedInvoiceCount = receivedInvoices.length;
            const totalInvoiceCount = shipment.apInvoices.length;
            const invoiceSummary = totalInvoiceCount === receivedInvoiceCount
              ? `${totalInvoiceCount} invoice${totalInvoiceCount !== 1 ? 's' : ''}`
              : `${receivedInvoiceCount} of ${totalInvoiceCount} invoices received`;

            return (
              <TableRow
                key={shipment.id}
                data-testid={`shipment-row-${shipment.id}`}
                className={onShipmentClick ? "cursor-pointer hover:bg-muted/50" : ""}
                onClick={() => onShipmentClick?.(shipment)}
              >
                <TableCell className="font-medium">{shipment.shipmentNumber}</TableCell>
                <TableCell>
                  <div className="text-sm">
                    <div className="font-medium">{shipment.origin}</div>
                    <div className="text-muted-foreground">→ {shipment.destination}</div>
                  </div>
                </TableCell>
                {activeTab === "ap" ? (
                  <TableCell>{shipment.carrier}</TableCell>
                ) : (
                  <TableCell>{shipment.shipper}</TableCell>
                )}
                <TableCell className="text-right font-medium">
                  {activeTab === "ap"
                    ? (hasRateConfirmation ? `$${shipment.laneRate.toLocaleString()}` : "Pending...")
                    : (hasBrokerInvoice ? `$${shipment.arInvoiceAmount.toLocaleString()}` : "Pending...")}
                </TableCell>
                <TableCell className="text-right">
                  {activeTab === "ap" ? (
                    receivedInvoiceCount > 0 ? (
                      <>
                        <div className="font-medium">${apInvoiceTotal.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {invoiceSummary}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted-foreground italic">Awaiting invoices</div>
                    )
                  ) : (
                    <div className="font-medium">${shipment.arInvoiceAmount.toLocaleString()}</div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={statusConfig.variant}>
                    {statusConfig.label}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
