import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StatusBadgeProps {
  status: string;
  className?: string;
  type?: 'shipment' | 'compliance' | 'risk';
}

export function StatusBadge({ status, className, type = 'shipment' }: StatusBadgeProps) {
  const getStyles = () => {
    switch (status.toUpperCase()) {
      // Compliance Statuses
      case 'CLEAR':
        return 'bg-success/20 text-success border-success/30';
      case 'ALERT':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'BLOCKED':
      case 'ESCALATE':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      
      // Risk Statuses
      case 'AUTO_APPROVE':
        return 'bg-success/20 text-success border-success/30';
      case 'OPERATOR_REVIEW':
        return 'bg-warning/20 text-warning border-warning/30';

      // Shipment Statuses
      case 'DRAFT':
        return 'bg-muted/50 text-muted-foreground border-muted';
      case 'PENDING_REVIEW':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'APPROVED':
        return 'bg-success/20 text-success border-success/30';
      case 'REJECTED':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      case 'IN_TRANSIT':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'DELIVERED':
      case 'CLOSED':
        return 'bg-secondary/50 text-secondary-foreground border-secondary';
      default:
        return 'bg-muted/50 text-muted-foreground border-muted';
    }
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap inline-flex items-center",
      getStyles(),
      className
    )}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
