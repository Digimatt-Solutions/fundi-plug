import { BarChart3, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const monthlyData = [
  { month: "Jan", revenue: 4200, jobs: 38 },
  { month: "Feb", revenue: 5100, jobs: 45 },
  { month: "Mar", revenue: 6800, jobs: 62 },
  { month: "Apr", revenue: 5900, jobs: 51 },
  { month: "May", revenue: 7200, jobs: 68 },
  { month: "Jun", revenue: 8400, jobs: 74 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground text-sm">Platform analytics and reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"><Filter className="w-4 h-4 mr-2" /> Filter</Button>
          <Button size="sm"><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

      <div className="stat-card animate-fade-in">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Monthly Revenue & Jobs
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
            <XAxis dataKey="month" stroke="hsl(220, 10%, 46%)" fontSize={12} />
            <YAxis stroke="hsl(220, 10%, 46%)" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: "8px", color: "hsl(220, 14%, 90%)" }} />
            <Bar dataKey="revenue" fill="hsl(22, 93%, 49%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="jobs" fill="hsl(173, 58%, 39%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
