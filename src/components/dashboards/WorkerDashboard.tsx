import { Briefcase, CreditCard, Star, Clock, ToggleLeft, ToggleRight } from "lucide-react";
import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const earningsData = [
  { day: "Mon", amount: 120 }, { day: "Tue", amount: 85 },
  { day: "Wed", amount: 200 }, { day: "Thu", amount: 150 },
  { day: "Fri", amount: 290 }, { day: "Sat", amount: 180 },
  { day: "Sun", amount: 95 },
];

const recentJobs = [
  { id: 1, title: "Electrical Wiring Repair", customer: "Sarah M.", status: "Completed", amount: "$120", date: "Today" },
  { id: 2, title: "Plumbing Installation", customer: "Mike R.", status: "In Progress", amount: "$85", date: "Today" },
  { id: 3, title: "Light Fixture Install", customer: "Emily K.", status: "Pending", amount: "$65", date: "Yesterday" },
];

export default function WorkerDashboard() {
  const [isOnline, setIsOnline] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Worker Dashboard</h1>
          <p className="text-muted-foreground text-sm">Manage your jobs and availability</p>
        </div>
        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            isOnline ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground"
          }`}
        >
          {isOnline ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          {isOnline ? "Online" : "Offline"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Earnings", value: "$3,420", icon: CreditCard, color: "text-primary", bg: "bg-primary/10" },
          { label: "Jobs Completed", value: "47", icon: Briefcase, color: "text-chart-2", bg: "bg-chart-2/10" },
          { label: "Average Rating", value: "4.8", icon: Star, color: "text-chart-4", bg: "bg-chart-4/10" },
          { label: "Pending Jobs", value: "3", icon: Clock, color: "text-chart-3", bg: "bg-chart-3/10" },
        ].map((stat, i) => (
          <div key={stat.label} className="stat-card animate-fade-in" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="stat-card animate-fade-in" style={{ animationDelay: "400ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Earnings</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={earningsData}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(22, 93%, 49%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis dataKey="day" stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} />
              <Area type="monotone" dataKey="amount" stroke="hsl(22, 93%, 49%)" fill="url(#earnGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="stat-card animate-fade-in" style={{ animationDelay: "500ms" }}>
          <h3 className="text-lg font-semibold text-foreground mb-4">Recent Jobs</h3>
          <div className="space-y-3">
            {recentJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{job.title}</p>
                  <p className="text-xs text-muted-foreground">{job.customer} · {job.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{job.amount}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    job.status === "Completed" ? "bg-green-500/10 text-green-500" :
                    job.status === "In Progress" ? "bg-primary/10 text-primary" :
                    "bg-chart-4/10 text-chart-4"
                  }`}>{job.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
