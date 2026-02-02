import { Button } from "@/components/ui/button";
import type { APStatus, ARStatus } from "@shared/schema";

interface StatusFiltersProps {
  activeTab: "ap" | "ar";
  apFilter: APStatus | "all";
  arFilter: ARStatus | "all";
  onApFilterChange: (filter: APStatus | "all") => void;
  onArFilterChange: (filter: ARStatus | "all") => void;
  apCounts: Record<APStatus | "total", number>;
  arCounts: Record<ARStatus | "total", number>;
}

export function StatusFilters({
  activeTab,
  apFilter,
  arFilter,
  onApFilterChange,
  onArFilterChange,
  apCounts,
  arCounts
}: StatusFiltersProps) {
  if (activeTab === "ap") {
    return (
      <div className="flex flex-wrap gap-2">
        <FilterButton
          label="All"
          count={apCounts.total}
          active={apFilter === "all"}
          onClick={() => onApFilterChange("all")}
          testId="filter-ap-all"
        />
        <FilterButton
          label="Received"
          count={apCounts.received}
          active={apFilter === "received"}
          onClick={() => onApFilterChange("received")}
          testId="filter-ap-received"
        />
        <FilterButton
          label="In Review"
          count={apCounts.in_review}
          active={apFilter === "in_review"}
          onClick={() => onApFilterChange("in_review")}
          testId="filter-ap-in-review"
        />
        <FilterButton
          label="Audit Pass"
          count={apCounts.audit_pass}
          active={apFilter === "audit_pass"}
          onClick={() => onApFilterChange("audit_pass")}
          testId="filter-ap-audit-pass"
        />
        <FilterButton
          label="In Dispute"
          count={apCounts.in_dispute}
          active={apFilter === "in_dispute"}
          onClick={() => onApFilterChange("in_dispute")}
          testId="filter-ap-in-dispute"
        />
        <FilterButton
          label="Paid"
          count={apCounts.paid}
          active={apFilter === "paid"}
          onClick={() => onApFilterChange("paid")}
          testId="filter-ap-paid"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <FilterButton
        label="All"
        count={arCounts.total}
        active={arFilter === "all"}
        onClick={() => onArFilterChange("all")}
        testId="filter-ar-all"
      />
      <FilterButton
        label="Preparing"
        count={arCounts.preparing}
        active={arFilter === "preparing"}
        onClick={() => onArFilterChange("preparing")}
        testId="filter-ar-preparing"
      />
      <FilterButton
        label="For Review"
        count={arCounts.for_review}
        active={arFilter === "for_review"}
        onClick={() => onArFilterChange("for_review")}
        testId="filter-ar-for-review"
      />
      <FilterButton
        label="Submitted"
        count={arCounts.submitted}
        active={arFilter === "submitted"}
        onClick={() => onArFilterChange("submitted")}
        testId="filter-ar-submitted"
      />
      <FilterButton
        label="In Dispute"
        count={arCounts.in_dispute}
        active={arFilter === "in_dispute"}
        onClick={() => onArFilterChange("in_dispute")}
        testId="filter-ar-in-dispute"
      />
      <FilterButton
        label="Collected"
        count={arCounts.collected}
        active={arFilter === "collected"}
        onClick={() => onArFilterChange("collected")}
        testId="filter-ar-collected"
      />
    </div>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
  testId
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="gap-1.5"
      data-testid={testId}
    >
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
        active ? 'bg-primary-foreground/20' : 'bg-muted'
      }`}>
        {count}
      </span>
    </Button>
  );
}
