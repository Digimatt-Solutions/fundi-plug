import { Lock, Clock } from "lucide-react";

interface Props {
  job: {
    final_price?: number | null;
    budget?: number | null;
    customer_price_confirmed?: boolean;
    worker_price_confirmed?: boolean;
    price_locked_at?: string | null;
  };
  className?: string;
}

export default function PriceLockBadge({ job, className = "" }: Props) {
  const amount = job.final_price ?? job.budget;
  if (job.price_locked_at) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600 ${className}`}>
        <Lock className="w-3 h-3" /> Final: KSH {amount ? Number(amount).toLocaleString() : "-"}
      </span>
    );
  }
  if (job.customer_price_confirmed && !job.worker_price_confirmed) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-chart-4/10 text-chart-4 ${className}`}>
        <Clock className="w-3 h-3" /> Waiting fundi confirm: KSH {amount ? Number(amount).toLocaleString() : "-"}
      </span>
    );
  }
  if (!job.customer_price_confirmed) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary ${className}`}>
        <Clock className="w-3 h-3" /> Awaiting price lock
      </span>
    );
  }
  return null;
}
