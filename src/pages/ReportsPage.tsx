import { useEffect, useState } from "react";
import { BarChart3, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsPage() {
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      const [jobsRes, paymentsRes] = await Promise.all([
        supabase.from("jobs").select("created_at").gte("created_at", sixMonthsAgo.toISOString()),
        supabase.from("payments").select("amount, created_at").eq("status", "completed").gte("created_at", sixMonthsAgo.toISOString()),
      ]);

      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const data: Record<string, { revenue: number; jobs: number }> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = months[d.getMonth()];
        data[key] = { revenue: 0, jobs: 0 };
      }

      (jobsRes.data || []).forEach(j => {
        const m = months[new Date(j.created_at).getMonth()];
        if (data[m]) data[m].jobs += 1;
      });
      (paymentsRes.data || []).forEach(p => {
        const m = months[new Date(p.created_at).getMonth()];
        if (data[m]) data[m].revenue += Number(p.amount);
      });

      setMonthlyData(Object.entries(data).map(([month, v]) => ({ month, ...v })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

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
        {monthlyData.some(d => d.revenue > 0 || d.jobs > 0) ? (
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
        ) : (
          <div className="h-80 flex items-center justify-center text-muted-foreground text-sm">No report data yet — data will appear as jobs and payments are created</div>
        )}
      </div>
    </div>
  );
}
