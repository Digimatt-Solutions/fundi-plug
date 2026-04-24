import { useEffect, useState } from "react";
import { Activity, Download, Globe, Monitor, Smartphone, Tablet, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from "@/assets/logo.png";

type Visit = {
  id: string;
  path: string;
  device: string | null;
  browser: string | null;
  os: string | null;
  country: string | null;
  city: string | null;
  referrer: string | null;
  created_at: string;
};

const COLORS = ["hsl(22, 93%, 49%)", "hsl(200, 80%, 55%)", "hsl(140, 60%, 50%)", "hsl(280, 60%, 60%)", "hsl(40, 90%, 55%)", "hsl(0, 70%, 60%)"];

function tally(arr: (string | null)[]) {
  const map: Record<string, number> = {};
  arr.forEach((v) => {
    const k = v || "Unknown";
    map[k] = (map[k] || 0) + 1;
  });
  return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

function deviceIcon(name: string) {
  if (/mobile/i.test(name)) return Smartphone;
  if (/tablet/i.test(name)) return Tablet;
  return Monitor;
}

export default function TrafficAnalytics() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("site_visits")
        .select("id, path, device, browser, os, country, city, referrer, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      setVisits((data as Visit[]) || []);
      setLoading(false);
    })();
  }, []);

  const totalVisits = visits.length;
  const uniqueCountries = new Set(visits.map((v) => v.country).filter(Boolean)).size;
  const devices = tally(visits.map((v) => v.device));
  const browsers = tally(visits.map((v) => v.browser));
  const countries = tally(visits.map((v) => v.country)).slice(0, 8);
  const oses = tally(visits.map((v) => v.os));

  // Last 14 days line
  const days: { date: string; visits: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key.slice(5), visits: 0 });
  }
  visits.forEach((v) => {
    const k = v.created_at.slice(5, 10);
    const d = days.find((x) => x.date === k);
    if (d) d.visits += 1;
  });

  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Header band
      doc.setFillColor(240, 98, 14); // brand orange
      doc.rect(0, 0, pageW, 70, "F");

      // Logo
      try {
        const img = await fetch(logo).then((r) => r.blob()).then(
          (b) => new Promise<string>((res) => { const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(b); })
        );
        doc.addImage(img, "PNG", 24, 14, 42, 42);
      } catch { /* ignore */ }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("FundiPlug — Traffic Report", 80, 38);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated ${new Date().toLocaleString()}  •  Last 30 days`, 80, 56);

      // Summary
      doc.setTextColor(33, 33, 33);
      let y = 100;
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Summary", 24, y); y += 14;
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`Total visits: ${totalVisits}`, 24, y); y += 14;
      doc.text(`Unique countries: ${uniqueCountries}`, 24, y); y += 14;
      doc.text(`Top device: ${devices[0]?.name || "n/a"} (${devices[0]?.value || 0})`, 24, y); y += 14;
      doc.text(`Top browser: ${browsers[0]?.name || "n/a"} (${browsers[0]?.value || 0})`, 24, y); y += 20;

      autoTable(doc, { startY: y, head: [["Device", "Visits"]], body: devices.map((d) => [d.name, String(d.value)]), theme: "striped", headStyles: { fillColor: [240, 98, 14] } });
      autoTable(doc, { head: [["Browser", "Visits"]], body: browsers.map((b) => [b.name, String(b.value)]), theme: "striped", headStyles: { fillColor: [240, 98, 14] } });
      autoTable(doc, { head: [["Country", "Visits"]], body: countries.map((c) => [c.name, String(c.value)]), theme: "striped", headStyles: { fillColor: [240, 98, 14] } });
      autoTable(doc, { head: [["Operating System", "Visits"]], body: oses.map((o) => [o.name, String(o.value)]), theme: "striped", headStyles: { fillColor: [240, 98, 14] } });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(120);
        doc.text(`FundiPlug Analytics  •  Page ${i} of ${pageCount}`, 24, doc.internal.pageSize.getHeight() - 16);
      }

      doc.save(`fundiplug-traffic-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="stat-card animate-fade-in">
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="stat-card animate-fade-in space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> Traffic — Last 30 Days
          </h3>
          <p className="text-xs text-muted-foreground">Visitors, devices, browsers and countries</p>
        </div>
        <Button size="sm" onClick={exportPDF} disabled={exporting} className="gap-1.5">
          <Download className="w-4 h-4" /> {exporting ? "Generating..." : "Download PDF"}
        </Button>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Total Visits</span><Users className="w-4 h-4 text-primary" /></div>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{totalVisits.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Countries</span><Globe className="w-4 h-4 text-chart-2" /></div>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{uniqueCountries}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Top Device</span>
            {(() => { const Icon = deviceIcon(devices[0]?.name || ""); return <Icon className="w-4 h-4 text-chart-3" />; })()}
          </div>
          <p className="text-base font-semibold text-foreground mt-1 truncate">{devices[0]?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{devices[0]?.value || 0} visits</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Top Browser</span><Monitor className="w-4 h-4 text-chart-4" /></div>
          <p className="text-base font-semibold text-foreground mt-1 truncate">{browsers[0]?.name || "—"}</p>
          <p className="text-xs text-muted-foreground">{browsers[0]?.value || 0} visits</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Visits over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis dataKey="date" stroke="hsl(220, 10%, 46%)" fontSize={10} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: 8, color: "hsl(220, 14%, 90%)" }} />
              <Line type="monotone" dataKey="visits" stroke="hsl(22, 93%, 49%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Devices</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={devices} dataKey="value" nameKey="name" outerRadius={70} label>
                {devices.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: 8, color: "hsl(220, 14%, 90%)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Browsers</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={browsers}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis dataKey="name" stroke="hsl(220, 10%, 46%)" fontSize={10} />
              <YAxis stroke="hsl(220, 10%, 46%)" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: 8, color: "hsl(220, 14%, 90%)" }} />
              <Bar dataKey="value" fill="hsl(200, 80%, 55%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">Top countries</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={countries} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 20%)" />
              <XAxis type="number" stroke="hsl(220, 10%, 46%)" fontSize={10} allowDecimals={false} />
              <YAxis type="category" dataKey="name" stroke="hsl(220, 10%, 46%)" fontSize={10} width={80} />
              <Tooltip contentStyle={{ backgroundColor: "hsl(222, 28%, 12%)", border: "1px solid hsl(222, 20%, 20%)", borderRadius: 8, color: "hsl(220, 14%, 90%)" }} />
              <Bar dataKey="value" fill="hsl(140, 60%, 50%)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
