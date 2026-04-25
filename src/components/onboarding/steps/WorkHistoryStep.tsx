import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/friendlyError";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

export default function WorkHistoryStep({ userId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<any>({ role: "", company: "", description: "", start_date: "", end_date: "", reference_name: "", reference_phone: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("worker_work_history").select("*").eq("worker_id", userId).order("start_date", { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [userId]);

  const addRow = async () => {
    if (!draft.role) {
      toast({ title: "Role is required", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { data: row, error } = await supabase
      .from("worker_work_history")
      .insert({
        worker_id: userId,
        role: draft.role,
        company: draft.company || null,
        description: draft.description || null,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        reference_name: draft.reference_name || null,
        reference_phone: draft.reference_phone || null,
      })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed", description: friendlyError(error), variant: "destructive" });
    } else {
      setRows([row, ...rows]);
      setDraft({ role: "", company: "", description: "", start_date: "", end_date: "", reference_name: "", reference_phone: "" });
    }
    setAdding(false);
  };

  const removeRow = async (id: string) => {
    const { error } = await supabase.from("worker_work_history").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: friendlyError(error), variant: "destructive" });
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">List previous jobs or projects. Adding a reference contact builds trust with clients.</p>

      {loading ? (
        <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No work history yet (optional but recommended).</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{r.role}{r.company ? ` @ ${r.company}` : ""}</p>
                  <p className="text-xs text-muted-foreground">
                    {[r.start_date, r.end_date || "Present"].filter(Boolean).join(" → ")}
                  </p>
                  {r.description && <p className="text-xs text-foreground mt-1">{r.description}</p>}
                  {(r.reference_name || r.reference_phone) && (
                    <p className="text-xs text-muted-foreground mt-1">Ref: {r.reference_name} {r.reference_phone}</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => removeRow(r.id)}>
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="border-dashed">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add work history</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Input placeholder="e.g. Site Electrician" value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Company / Client</Label>
              <Input placeholder="e.g. Acme Builders" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                placeholder="What did you do?"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reference Name</Label>
              <Input placeholder="Supervisor / client name" value={draft.reference_name} onChange={(e) => setDraft({ ...draft, reference_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Reference Phone</Label>
              <Input placeholder="2547XXXXXXXX" value={draft.reference_phone} onChange={(e) => setDraft({ ...draft, reference_phone: e.target.value.replace(/[^\d+]/g, "") })} />
            </div>
          </div>
          <Button onClick={addRow} disabled={adding} size="sm">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            Add entry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
