import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Mail, FileText, AlertTriangle, CheckCircle, Send, FileCheck, DollarSign, Clock, ExternalLink } from "lucide-react";
import type { Activity, ActivityType } from "@shared/schema";

interface ActivityStreamProps {
  activities: Activity[];
  emptyMessage: string;
  onAction?: (activity: Activity) => void;
}

const activityIcons: Record<ActivityType, React.ReactNode> = {
  email_received: <Mail className="w-4 h-4" />,
  email_sent: <Send className="w-4 h-4" />,
  email_draft: <Mail className="w-4 h-4" />,
  document_scanned: <FileText className="w-4 h-4" />,
  issue_found: <AlertTriangle className="w-4 h-4" />,
  approval_requested: <CheckCircle className="w-4 h-4" />,
  invoice_created: <FileCheck className="w-4 h-4" />,
  audit_complete: <CheckCircle className="w-4 h-4" />,
  payment_sent: <DollarSign className="w-4 h-4" />,
  payment_received: <DollarSign className="w-4 h-4" />
};

const activityColors: Record<ActivityType, string> = {
  email_received: "bg-blue-500",
  email_sent: "bg-indigo-500",
  email_draft: "bg-orange-500",
  document_scanned: "bg-purple-500",
  issue_found: "bg-amber-500",
  approval_requested: "bg-orange-500",
  invoice_created: "bg-emerald-500",
  audit_complete: "bg-green-500",
  payment_sent: "bg-teal-500",
  payment_received: "bg-green-600"
};

const activityLabels: Record<ActivityType, string> = {
  email_received: "Email Received",
  email_sent: "Email Sent",
  email_draft: "Draft Created",
  document_scanned: "Document Scan",
  issue_found: "Issue Found",
  approval_requested: "Approval Request",
  invoice_created: "Invoice Created",
  audit_complete: "Audit Complete",
  payment_sent: "Payment Sent",
  payment_received: "Payment Received"
};

export function ActivityStream({ activities, emptyMessage, onAction }: ActivityStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && activities.length > 0) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activities.length]);

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
      <div className="space-y-4">
        {activities.map((activity, index) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            isNew={index === 0}
            onAction={onAction}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ActivityItem({ activity, isNew, onAction }: { activity: Activity; isNew: boolean; onAction?: (activity: Activity) => void }) {
  const formattedTime = activity.timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const document = activity.metadata?.document as { name: string; url: string } | undefined;
  const isPendingAction = activity.metadata?.pendingAction === true;

  return (
    <div
      className={`relative flex gap-4 p-4 rounded-lg border transition-all duration-500 ${isNew ? 'bg-primary/5 border-primary/30 animate-in fade-in slide-in-from-top-2' : 'bg-card border-card-border'
        }`}
      data-testid={`activity-item-${activity.id}`}
    >
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${activityColors[activity.type]}`}>
        {activityIcons[activity.type]}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
          <h4 className="font-medium text-foreground">{activity.title}</h4>
          <Badge variant="outline" className="text-xs font-normal shrink-0">
            {formattedTime}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {activityLabels[activity.type]}
          </Badge>

          {document && (
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              data-testid={`doc-link-${activity.id}`}
            >
              <FileText className="w-3 h-3" />
              {document.name}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {isPendingAction && onAction && (
            <button
              onClick={() => onAction(activity)}
              className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium hover:underline ml-2"
              data-testid={`action-btn-${activity.id}`}
            >
              <Mail className="w-3 h-3" />
              Review Draft
            </button>
          )}
        </div>
      </div>

      {isNew && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
        </div>
      )}
    </div>
  );
}
