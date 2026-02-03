import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, ExternalLink } from "lucide-react";

interface VerificationDocument {
    name: string;
    url: string;
}

interface DocumentVerificationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    documents: VerificationDocument[];
    onApprove: () => void;
}

export function DocumentVerificationDialog({
    open,
    onOpenChange,
    documents,
    onApprove,
}: DocumentVerificationDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-orange-600" />
                        Verify Detention Documents
                    </DialogTitle>
                    <DialogDescription>
                        Please review the submitted documents before approving the detention charge.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Documents to Verify</h4>
                    <div className="space-y-2">
                        {documents.length > 0 ? (
                            documents.map((doc, i) => (
                                <div key={i} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-background p-2 rounded border">
                                            <FileText className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <span className="text-sm font-medium">{doc.name}</span>
                                    </div>
                                    <Button variant="outline" size="sm" asChild>
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="gap-2">
                                            View
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="text-sm text-center py-4 text-muted-foreground italic">
                                No specific documents found. Please review the shipment grouping.
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={onApprove} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="w-4 h-4" />
                        Approve & Verify
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
