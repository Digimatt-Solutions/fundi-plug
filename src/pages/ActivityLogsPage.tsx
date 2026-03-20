import { useEffect, useState } from "react";
import { Activity, User, Shield, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const iconMap: Record<string, any> = {
  "User Registered": User,
  "Worker Approved": Shield,
  "Worker Rejected": Shield,
  "New Booking": Briefcase,
  "Job Completed": Briefcase,
  "Payment Processed": Activity,
};

const colorMap: Record<string, string> = {
  "User Registered": "text-chart-3",
  "Worker Approved": "text-green-500",
  "Worker Rejected": "text-destructive",
  "New Booking": "text-primary",
  "Job Completed": "text-chart-2",
  "Payment Processed": "text-chart-4",
};

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("activity_logs")
        .select("*, profiles:user_id(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    );
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr ago`;
    return `${Math.floor(hrs / 24)} days ago`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-muted-foreground text-sm">Recent platform activity</p>
      </div>

      <div className="stat-card animate-fade-in">
        {logs.length > 0 ? (
          <div className="space-y-0 divide-y divide-border">
            {logs.map((log, i) => {
              const Icon = iconMap[log.action] || Activity;
              const color = colorMap[log.action] || "text-muted-foreground";
              return (
                <div key={log.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                  <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 ${color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(log.created_at)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">No activity logs yet</div>
        )}
      </div>
    </div>
  );
}
