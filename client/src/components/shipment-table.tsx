import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { Shipment, APStatus, ARStatus } from "@shared/schema";

interface ShipmentTableProps {
  shipments: Shipment[];
  activeTab: "ap" | "ar";
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

export function ShipmentTable({ shipments, activeTab, onShipmentClick }: ShipmentTableProps) {
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
                  ${activeTab === "ap"
                    ? shipment.laneRate.toLocaleString()
                    : shipment.invoiceAmount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-medium">${shipment.invoiceAmount.toLocaleString()}</div>
                  {activeTab === "ap" && shipment.detentionCharge && shipment.detentionCharge > 0 && (
                    <div className="text-xs text-muted-foreground">
                      +${shipment.detentionCharge} detention
                    </div>
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
