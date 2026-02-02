import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Send } from "lucide-react";

interface EmailDraft {
    to: string;
    subject: string;
    body: string;
    attachments?: string[];
}

interface EmailApprovalDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    draft: EmailDraft | null;
    onApprove: () => void;
    onCancel: () => void;
}

export function EmailApprovalDialog({
    open,
    onOpenChange,
    draft,
    onApprove,
    onCancel,
}: EmailApprovalDialogProps) {
    if (!draft) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Mail className="w-5 h-5" />
                        Review Email Draft
                    </DialogTitle>
                    <DialogDescription>
                        Please review the generated email before sending.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
                            <span className="font-medium text-muted-foreground">To:</span>
                            <div className="font-mono bg-muted px-2 py-0.5 rounded text-xs select-all">
                                {draft.to}
                            </div>
                        </div>

                        <div className="grid grid-cols-[60px_1fr] gap-2 items-center">
                            <span className="font-medium text-muted-foreground">Subject:</span>
                            <div className="font-medium select-all">
                                {draft.subject}
                            </div>
                        </div>

                        {draft.attachments && draft.attachments.length > 0 && (
                            <div className="grid grid-cols-[60px_1fr] gap-2 items-start">
                                <span className="font-medium text-muted-foreground">Attach:</span>
                                <div className="flex flex-wrap gap-2">
                                    {draft.attachments.map((file, i) => (
                                        <span key={i} className="bg-muted px-2 py-0.5 rounded text-xs flex items-center gap-1">
                                            📄 {file}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="border rounded-md bg-muted/30">
                        <ScrollArea className="h-[300px] w-full p-4">
                            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
                                {draft.body}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button onClick={onApprove} className="gap-2">
                        <Send className="w-4 h-4" />
                        Approve & Send
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
