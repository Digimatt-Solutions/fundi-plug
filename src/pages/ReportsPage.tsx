import { useEffect, useState, useRef } from "react";
import { BarChart3, Download, Users, Briefcase, CreditCard, ArrowDownCircle, TrendingUp, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";

const COLORS = ["hsl(22,93%,49%)", "hsl(173,58%,39%)", "hsl(220,70%,55%)", "hsl(340,65%,47%)", "hsl(45,93%,47%)", "hsl(280,60%,50%)"];

function PrintableSection({ children, title }: { children: React.ReactNode; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const handlePrint = () => {
    const content = ref.current;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title} - FundiPlug</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#222}table{width:100%;border-collapse:collapse;margin:16px 0}
      th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:13px}th{background:#f5f5f5;font-weight:600}
      h1,h2,h3{margin:8px 0}.stat{display:inline-block;padding:12px 20px;border:1px solid #ddd;border-radius:8px;margin:4px;min-width:140px}
      .stat-value{font-size:24px;font-weight:700}.stat-label{font-size:12px;color:#666;margin-top:4px}
      @media print{body{padding:20px}}</style></head><body>
      <h1 style="color:#f0620e">FundiPlug - ${title}</h1>
      <p style="color:#666;font-size:12px">Generated: ${new Date().toLocaleString()}</p><hr/>
      ${content.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 500);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </Button>
      </div>
      <div ref={ref}>{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
      sixMonthsAgo.setDate(1);

      const [profilesRes, rolesRes, wpRes, catRes, jobsRes, paymentsRes, withdrawalsRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
        supabase.from("worker_profiles").select("*"),
        supabase.from("service_categories").select("*"),
        supabase.from("jobs").select("*, service_categories:category_id(name)"),
        supabase.from("payments").select("*"),
        supabase.from("withdrawals").select("*, profiles:worker_id(name)"),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];
      const wps = wpRes.data || [];
      const cats = catRes.data || [];
      const allJobs = jobsRes.data || [];
      const allPayments = paymentsRes.data || [];
      const allWithdrawals = withdrawalsRes.data || [];

      const roleMap: Record<string, string> = {};
      roles.forEach(r => { roleMap[r.user_id] = r.role; });

      const wpMap: Record<string, any> = {};
      wps.forEach(w => { wpMap[w.user_id] = w; });

      const workerProfiles = profiles.filter(p => roleMap[p.id] === "worker").map(p => ({
        ...p, role: "worker", wp: wpMap[p.id] || {},
      }));
      const clientProfiles = profiles.filter(p => roleMap[p.id] === "customer").map(p => ({
        ...p, role: "customer",
        jobCount: allJobs.filter(j => j.customer_id === p.id).length,
        totalSpent: allPayments.filter(pay => pay.payer_id === p.id && pay.status === "completed").reduce((s, pay) => s + Number(pay.amount), 0),
      }));

      // Category stats
      const catStats = cats.map(c => ({
        ...c,
        workerCount: wps.filter(w => (w.skills || []).includes(c.id)).length,
        jobCount: allJobs.filter(j => j.category_id === c.id).length,
        revenue: allPayments.filter(pay => {
          const job = allJobs.find(j => j.id === pay.job_id);
          return job?.category_id === c.id && pay.status === "completed";
        }).reduce((s, pay) => s + Number(pay.amount), 0),
      }));

      // Monthly chart data
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const data: Record<string, { revenue: number; jobs: number; disbursements: number }> = {};
      for (let i = 0; i < 6; i++) {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        data[months[d.getMonth()]] = { revenue: 0, jobs: 0, disbursements: 0 };
      }
      allJobs.forEach(j => {
        const m = months[new Date(j.created_at).getMonth()];
        if (data[m]) data[m].jobs += 1;
      });
      allPayments.filter(p => p.status === "completed").forEach(p => {
        const m = months[new Date(p.created_at).getMonth()];
        if (data[m]) data[m].revenue += Number(p.amount);
      });
      allWithdrawals.filter(w => w.status === "completed").forEach(w => {
        const m = months[new Date(w.requested_at).getMonth()];
        if (data[m]) data[m].disbursements += Number(w.amount);
      });

      setWorkers(workerProfiles);
      setClients(clientProfiles);
      setCategories(catStats);
      setJobs(allJobs);
      setPayments(allPayments);
      setWithdrawals(allWithdrawals);
      setMonthlyData(Object.entries(data).map(([month, v]) => ({ month, ...v })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const totalRevenue = payments.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0);
  const totalCommission = payments.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.commission || 0), 0);
  const totalDisbursed = withdrawals.filter(w => w.status === "completed").reduce((s, w) => s + Number(w.amount), 0);
  const completedJobs = jobs.filter(j => j.status === "completed").length;
  const jobStatusData = [
    { name: "Pending", value: jobs.filter(j => j.status === "pending").length },
    { name: "Accepted", value: jobs.filter(j => j.status === "accepted").length },
    { name: "In Progress", value: jobs.filter(j => j.status === "in_progress").length },
    { name: "Completed", value: completedJobs },
    { name: "Cancelled", value: jobs.filter(j => j.status === "cancelled").length },
  ].filter(d => d.value > 0);

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(","), ...data.map(row => keys.map(k => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" /> Reports & Analytics
        </h1>
        <p className="text-muted-foreground text-sm">Comprehensive platform analytics and printable reports</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue", value: `KSH ${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-green-500" },
          { label: "Commission Earned", value: `KSH ${totalCommission.toLocaleString()}`, icon: CreditCard, color: "text-primary" },
          { label: "Total Disbursed", value: `KSH ${totalDisbursed.toLocaleString()}`, icon: ArrowDownCircle, color: "text-blue-500" },
          { label: "Completed Jobs", value: completedJobs.toString(), icon: Briefcase, color: "text-chart-4" },
        ].map((s, i) => (
          <Card key={i} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-muted flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fundis">Fundis</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="disbursements">Disbursements</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <PrintableSection title="Platform Overview">
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat"><div className="stat-value">{workers.length}</div><div className="stat-label">Total Fundis</div></div>
                <div className="stat"><div className="stat-value">{clients.length}</div><div className="stat-label">Total Clients</div></div>
                <div className="stat"><div className="stat-value">{jobs.length}</div><div className="stat-label">Total Jobs</div></div>
                <div className="stat"><div className="stat-value">{payments.length}</div><div className="stat-label">Total Payments</div></div>
              </div>
              <div className="stat-card">
                <h2 className="text-lg font-semibold text-foreground mb-4">Monthly Revenue, Jobs & Disbursements</h2>
                {monthlyData.some(d => d.revenue > 0 || d.jobs > 0) ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
                      <Legend />
                      <Bar dataKey="revenue" fill={COLORS[0]} radius={[4,4,0,0]} name="Revenue (KSH)" />
                      <Bar dataKey="jobs" fill={COLORS[1]} radius={[4,4,0,0]} name="Jobs" />
                      <Bar dataKey="disbursements" fill={COLORS[2]} radius={[4,4,0,0]} name="Disbursements (KSH)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">No data yet</div>}
              </div>
              {jobStatusData.length > 0 && (
                <div className="stat-card">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Jobs by Status</h2>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={jobStatusData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {jobStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </PrintableSection>
        </TabsContent>

        {/* Fundis Report */}
        <TabsContent value="fundis">
          <PrintableSection title="Fundi Report">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Fundi Directory ({workers.length})</h2>
                <Button size="sm" variant="outline" onClick={() => exportCSV(workers.map(w => ({
                  Name: w.name, Email: w.email, Phone: w.phone || "", Status: w.wp?.verification_status || "pending",
                  Experience: w.wp?.years_experience || 0, Rate: w.wp?.hourly_rate || "", County: w.wp?.county || "", Gender: w.wp?.gender || "",
                })), "fundis_report.csv")} className="gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead><TableHead>Experience</TableHead><TableHead>Rate (KSH)</TableHead>
                      <TableHead>County</TableHead><TableHead>Gender</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workers.map(w => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.name}</TableCell>
                        <TableCell className="text-xs">{w.email}</TableCell>
                        <TableCell className="text-xs">{w.phone || "-"}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${w.wp?.verification_status === "approved" ? "bg-green-500/10 text-green-500" : "bg-chart-4/10 text-chart-4"}`}>{w.wp?.verification_status || "pending"}</span></TableCell>
                        <TableCell>{w.wp?.years_experience || 0} yrs</TableCell>
                        <TableCell>{w.wp?.hourly_rate || "-"}</TableCell>
                        <TableCell className="text-xs">{w.wp?.county || "-"}</TableCell>
                        <TableCell className="text-xs capitalize">{w.wp?.gender || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PrintableSection>
        </TabsContent>

        {/* Clients Report */}
        <TabsContent value="clients">
          <PrintableSection title="Client Report">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><Users className="w-5 h-5 text-primary" /> Client Directory ({clients.length})</h2>
                <Button size="sm" variant="outline" onClick={() => exportCSV(clients.map(c => ({
                  Name: c.name, Email: c.email, Phone: c.phone || "", Jobs: c.jobCount, TotalSpent: c.totalSpent, Joined: new Date(c.created_at).toLocaleDateString(),
                })), "clients_report.csv")} className="gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead>
                      <TableHead>Jobs Posted</TableHead><TableHead>Total Spent</TableHead><TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs">{c.email}</TableCell>
                        <TableCell className="text-xs">{c.phone || "-"}</TableCell>
                        <TableCell>{c.jobCount}</TableCell>
                        <TableCell>KSH {c.totalSpent.toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PrintableSection>
        </TabsContent>

        {/* Categories Report */}
        <TabsContent value="categories">
          <PrintableSection title="Service Categories Report">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Service Categories ({categories.length})</h2>
                <Button size="sm" variant="outline" onClick={() => exportCSV(categories.map(c => ({
                  Category: c.name, Fundis: c.workerCount, Jobs: c.jobCount, Revenue: c.revenue,
                })), "categories_report.csv")} className="gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              {categories.some(c => c.jobCount > 0) && (
                <div className="stat-card">
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={categories.filter(c => c.jobCount > 0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} angle={-30} textAnchor="end" height={60} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="jobCount" fill={COLORS[0]} name="Jobs" radius={[4,4,0,0]} />
                      <Bar dataKey="workerCount" fill={COLORS[1]} name="Fundis" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead><TableHead>Icon</TableHead><TableHead>Fundis</TableHead>
                      <TableHead>Jobs</TableHead><TableHead>Revenue (KSH)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.icon}</TableCell>
                        <TableCell>{c.workerCount}</TableCell>
                        <TableCell>{c.jobCount}</TableCell>
                        <TableCell>KSH {c.revenue.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PrintableSection>
        </TabsContent>

        {/* Financial Report */}
        <TabsContent value="financial">
          <PrintableSection title="Financial Report">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="stat"><div className="stat-value">KSH {totalRevenue.toLocaleString()}</div><div className="stat-label">Total Revenue</div></div>
                <div className="stat"><div className="stat-value">KSH {totalCommission.toLocaleString()}</div><div className="stat-label">Platform Commission</div></div>
                <div className="stat"><div className="stat-value">KSH {totalDisbursed.toLocaleString()}</div><div className="stat-label">Total Disbursed</div></div>
                <div className="stat"><div className="stat-value">{payments.length}</div><div className="stat-label">Transactions</div></div>
              </div>
              <div className="flex items-center justify-end">
                <Button size="sm" variant="outline" onClick={() => exportCSV(payments.map(p => ({
                  ID: p.id, Amount: p.amount, Commission: p.commission || 0, Status: p.status, Date: new Date(p.created_at).toLocaleDateString(),
                })), "financial_report.csv")} className="gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead><TableHead>Amount (KSH)</TableHead><TableHead>Commission</TableHead>
                      <TableHead>Status</TableHead><TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.slice(0, 50).map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">KSH {Number(p.amount).toLocaleString()}</TableCell>
                        <TableCell>KSH {Number(p.commission || 0).toLocaleString()}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${p.status === "completed" ? "bg-green-500/10 text-green-500" : "bg-chart-4/10 text-chart-4"}`}>{p.status}</span></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.stripe_payment_id || p.id.slice(0, 8)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PrintableSection>
        </TabsContent>

        {/* Jobs Report */}
        <TabsContent value="jobs">
          <PrintableSection title="Jobs Report">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">All Jobs ({jobs.length})</h2>
                <Button size="sm" variant="outline" onClick={() => exportCSV(jobs.map(j => ({
                  Title: j.title, Category: (j as any).service_categories?.name || "-", Status: j.status, Budget: j.budget || "-",
                  Type: j.is_instant ? "Instant" : "Marketplace", Address: j.address || "", Date: new Date(j.created_at).toLocaleDateString(),
                })), "jobs_report.csv")} className="gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.slice(0, 50).map(j => (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium">{j.title}</TableCell>
                        <TableCell className="text-xs">{(j as any).service_categories?.name || "-"}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${j.status === "completed" ? "bg-green-500/10 text-green-500" : j.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-chart-4/10 text-chart-4"}`}>{j.status.replace("_", " ")}</span></TableCell>
                        <TableCell>{j.budget ? `KSH ${Number(j.budget).toLocaleString()}` : "-"}</TableCell>
                        <TableCell className="text-xs">{j.is_instant ? "Instant" : "Marketplace"}</TableCell>
                        <TableCell className="text-xs">{new Date(j.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PrintableSection>
        </TabsContent>

        {/* Disbursements Report */}
        <TabsContent value="disbursements">
          <PrintableSection title="Disbursements Report">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="stat"><div className="stat-value">KSH {totalDisbursed.toLocaleString()}</div><div className="stat-label">Total Disbursed</div></div>
                <div className="stat"><div className="stat-value">{withdrawals.filter(w => w.status === "completed").length}</div><div className="stat-label">Completed Payouts</div></div>
                <div className="stat"><div className="stat-value">{withdrawals.filter(w => w.status === "pending").length}</div><div className="stat-label">Pending Requests</div></div>
              </div>
              <div className="flex items-center justify-end">
                <Button size="sm" variant="outline" onClick={() => exportCSV(withdrawals.map(w => ({
                  Fundi: (w as any).profiles?.name || "-", Amount: w.amount, Status: w.status,
                  Requested: new Date(w.requested_at).toLocaleDateString(), Processed: w.processed_at ? new Date(w.processed_at).toLocaleDateString() : "-",
                  Notes: w.admin_notes || "",
                })), "disbursements_report.csv")} className="gap-1.5"><Download className="w-4 h-4" /> Export CSV</Button>
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fundi</TableHead><TableHead>Amount (KSH)</TableHead><TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead><TableHead>Processed</TableHead><TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals.map(w => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{(w as any).profiles?.name || "-"}</TableCell>
                        <TableCell>KSH {Number(w.amount).toLocaleString()}</TableCell>
                        <TableCell><span className={`px-2 py-0.5 rounded-full text-xs capitalize ${w.status === "completed" ? "bg-green-500/10 text-green-500" : w.status === "pending" ? "bg-chart-4/10 text-chart-4" : "bg-destructive/10 text-destructive"}`}>{w.status}</span></TableCell>
                        <TableCell className="text-xs">{new Date(w.requested_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-xs">{w.processed_at ? new Date(w.processed_at).toLocaleDateString() : "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{w.admin_notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </PrintableSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
