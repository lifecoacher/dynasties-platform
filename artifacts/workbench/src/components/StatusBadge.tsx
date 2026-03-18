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
      case 'CLEAR':
        return 'bg-primary/15 text-primary border-primary/25';
      case 'ALERT':
        return 'bg-warning/15 text-warning border-warning/25';
      case 'BLOCKED':
      case 'ESCALATE':
        return 'bg-destructive/15 text-destructive border-destructive/25';
      
      case 'AUTO_APPROVE':
        return 'bg-primary/15 text-primary border-primary/25';
      case 'OPERATOR_REVIEW':
        return 'bg-warning/15 text-warning border-warning/25';

      case 'DRAFT':
        return 'bg-muted/50 text-muted-foreground border-muted';
      case 'PENDING_REVIEW':
        return 'bg-warning/15 text-[#D4A24C] border-warning/25';
      case 'APPROVED':
        return 'bg-primary/15 text-primary border-primary/25';
      case 'REJECTED':
        return 'bg-destructive/15 text-destructive border-destructive/25';
      case 'IN_TRANSIT':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'AT_PORT':
      case 'CUSTOMS':
        return 'bg-warning/15 text-[#D4A24C] border-warning/25';
      case 'BOOKED':
        return 'bg-primary/10 text-primary/80 border-primary/20';
      case 'DELIVERED':
      case 'CLOSED':
        return 'bg-secondary/50 text-secondary-foreground border-secondary';
      case 'PENDING':
        return 'bg-muted/50 text-muted-foreground border-muted';
      case 'CANCELLED':
        return 'bg-destructive/10 text-destructive/70 border-destructive/20';
      case 'FINANCED':
      case 'FUNDED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
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
