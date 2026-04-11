import { useEffect, useState } from "react";
import { MessageSquareWarning, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminComplaintsPage() {
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const load = async () => {
    const { data } = await supabase
      .from("complaints")
      .select("*, customer:customer_id(name, email), fundi:fundi_id(name), jobs:job_id(title)")
      .order("created_at", { ascending: false });
    setComplaints(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const reply = async (id: string) => {
    const text = replyText[id]?.trim();
    if (!text) return;
    setReplying(id);
    await supabase.from("complaints").update({ admin_reply: text, status: "resolved", updated_at: new Date().toISOString() } as any).eq("id", id);
    toast({ title: "Reply sent" });
    setReplyText(prev => ({ ...prev, [id]: "" }));
    setReplying(null);
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("complaints").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
    toast({ title: `Status updated to ${status}` });
    load();
  };

  const filtered = filter === "all" ? complaints : complaints.filter(c => c.status === filter);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Complaints Management</h1>
          <p className="text-muted-foreground text-sm">{complaints.length} total complaints</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 bg-muted/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="stat-card text-center py-12 text-muted-foreground text-sm">No complaints found.</div>
      ) : (
        filtered.map(c => (
          <div key={c.id} className="stat-card space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{(c as any).jobs?.title || "Job"}</p>
                <p className="text-xs text-muted-foreground">
                  Customer: {(c as any).customer?.name} ({(c as any).customer?.email}) · Fundi: {(c as any).fundi?.name || "—"}
                </p>
                <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
              </div>
              <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-foreground bg-muted/50 p-3 rounded-lg">{c.message}</p>
            {c.admin_reply && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-medium text-primary mb-1">Your Reply:</p>
                <p className="text-sm text-foreground">{c.admin_reply}</p>
              </div>
            )}
            <div className="flex gap-2">
              <Textarea
                value={replyText[c.id] || ""}
                onChange={e => setReplyText(prev => ({ ...prev, [c.id]: e.target.value }))}
                placeholder="Type your reply..."
                className="bg-muted/50 min-h-[60px] flex-1"
              />
              <Button size="sm" onClick={() => reply(c.id)} disabled={replying === c.id || !replyText[c.id]?.trim()} className="self-end gap-1.5">
                <Send className="w-3.5 h-3.5" /> Reply
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
