import { Activity, User, Shield, Briefcase } from "lucide-react";

const logs = [
  { id: 1, action: "Worker Approved", user: "Admin", detail: "James Henderson approved as Electrician", time: "2 min ago", icon: Shield, color: "text-green-500" },
  { id: 2, action: "New Booking", user: "Sarah Mitchell", detail: "Booked plumbing service", time: "15 min ago", icon: Briefcase, color: "text-primary" },
  { id: 3, action: "User Registered", user: "Carlos Rivera", detail: "Signed up as Worker", time: "1 hr ago", icon: User, color: "text-chart-3" },
  { id: 4, action: "Payment Processed", user: "System", detail: "$120 payment for Job #2891", time: "2 hrs ago", icon: Activity, color: "text-chart-4" },
  { id: 5, action: "Worker Rejected", user: "Admin", detail: "Mark Thompson verification rejected", time: "3 hrs ago", icon: Shield, color: "text-destructive" },
  { id: 6, action: "Job Completed", user: "Maria Lopez", detail: "Completed electrical wiring job", time: "5 hrs ago", icon: Briefcase, color: "text-chart-2" },
];

export default function ActivityLogsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Activity Logs</h1>
        <p className="text-muted-foreground text-sm">Recent platform activity</p>
      </div>

      <div className="stat-card animate-fade-in">
        <div className="space-y-0 divide-y divide-border">
          {logs.map((log, i) => (
            <div key={log.id} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 ${log.color}`}>
                <log.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{log.action}</p>
                <p className="text-xs text-muted-foreground">{log.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
