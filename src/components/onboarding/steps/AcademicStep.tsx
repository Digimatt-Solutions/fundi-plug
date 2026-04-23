import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import FileUploader from "../FileUploader";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

const LEVELS = ["Primary", "Secondary / KCSE", "Certificate", "Diploma", "Degree", "Masters", "PhD", "Trade / Vocational"];
const STATUSES = ["Completed", "Ongoing", "Dropped"];

export default function AcademicStep({ userId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<any>({ level: "", institution: "", course: "", status: "Completed", start_date: "", end_date: "", file_url: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("worker_education").select("*").eq("worker_id", userId).order("created_at", { ascending: false });
      setRows(data || []);
      setLoading(false);
    })();
  }, [userId]);

  const addRow = async () => {
    if (!draft.level || !draft.institution) {
      toast({ title: "Add Level and Institution", variant: "destructive" });
      return;
    }
    setAdding(true);
    const payload = {
      worker_id: userId,
      level: draft.level,
      institution: draft.institution,
      course: draft.course || null,
      status: draft.status || null,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      file_url: draft.file_url || null,
    };
    const { data: row, error } = await supabase.from("worker_education").insert(payload).select().single();
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      setRows([row, ...rows]);
      setDraft({ level: "", institution: "", course: "", status: "Completed", start_date: "", end_date: "", file_url: "" });
    }
    setAdding(false);
  };

  const removeRow = async (id: string) => {
    const { error } = await supabase.from("worker_education").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    setRows(rows.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">Add your highest qualifications. You can add multiple entries and attach a certificate file for each.</p>

      {/* Existing rows */}
      {loading ? (
        <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No education entries yet.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{r.level} - {r.institution}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[r.course, r.status, [r.start_date, r.end_date].filter(Boolean).join(" → ")].filter(Boolean).join(" · ")}
                  </p>
                  {r.file_url && (
                    <a href={r.file_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">View certificate</a>
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

      {/* Add new */}
      <Card className="border-dashed">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium text-foreground">Add education</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Level *</Label>
              <Select value={draft.level} onValueChange={(v) => setDraft({ ...draft, level: v })}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v })}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Institution *</Label>
              <Input placeholder="e.g. Kenya Technical Trainers College" value={draft.institution} onChange={(e) => setDraft({ ...draft, institution: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Course</Label>
              <Input placeholder="e.g. Diploma in Electrical Engineering" value={draft.course} onChange={(e) => setDraft({ ...draft, course: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Input type="date" value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Input type="date" value={draft.end_date} onChange={(e) => setDraft({ ...draft, end_date: e.target.value })} />
            </div>
          </div>
          <FileUploader
            bucket="verification-docs"
            userId={userId}
            value={draft.file_url}
            onChange={(url) => setDraft({ ...draft, file_url: url || "" })}
            label="Certificate (optional)"
            accept="image/*,application/pdf"
            prefix="education"
          />
          <Button onClick={addRow} disabled={adding} size="sm">
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            Add entry
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
