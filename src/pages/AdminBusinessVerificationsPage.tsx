import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, XCircle, MapPin, Mail, Phone, Globe } from "lucide-react";
import { AssetImage } from "@/components/AssetImage";

export default function AdminBusinessVerificationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");
  const [viewing, setViewing] = useState<any>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [reason, setReason] = useState("");

  const load = async () => {
    const { data } = await supabase.from("business_profiles").select("*").order("submitted_at", { ascending: false });
    const list = data || [];
    setItems(list);
    const uids = Array.from(new Set(list.map(b => b.user_id)));
    if (uids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,name,email,phone,avatar_url").in("id", uids);
      const map: Record<string, any> = {};
      (profs || []).forEach((p: any) => { map[p.id] = p; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approve = async (b: any) => {
    if (!user) return;
    const { error } = await supabase.from("business_profiles").update({
      verification_status: "approved", approved_at: new Date().toISOString(), approved_by: user.id, rejection_reason: null,
    }).eq("id", b.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Business approved" });
    setViewing(null); load();
  };

  const reject = async () => {
    if (!rejecting || !reason.trim()) return;
    const { error } = await supabase.from("business_profiles").update({
      verification_status: "rejected", rejection_reason: reason,
    }).eq("id", rejecting.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Business rejected" });
    setRejecting(null); setReason(""); setViewing(null); load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const filtered = items.filter(i => i.verification_status === tab);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Business Verifications</h1>
        <p className="text-sm text-muted-foreground">Review and approve supplier business profiles.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pending">Pending ({items.filter(i => i.verification_status === "pending").length})</TabsTrigger>
          <TabsTrigger value="approved">Approved ({items.filter(i => i.verification_status === "approved").length})</TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({items.filter(i => i.verification_status === "rejected").length})</TabsTrigger>
          <TabsTrigger value="draft">Draft ({items.filter(i => i.verification_status === "draft").length})</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">No businesses in this state.</div>
          ) : (
            <div className="grid gap-3">
              {filtered.map(b => {
                const p = profiles[b.user_id];
                return (
                  <div key={b.id} className="rounded-xl border border-border bg-card p-4 flex items-center gap-4 flex-wrap">
                    {b.logo_url ? <AssetImage src={b.logo_url} bucket="business-assets" alt="" className="w-14 h-14 rounded-lg object-cover" /> : <div className="w-14 h-14 rounded-lg bg-muted" />}
                    <div className="flex-1 min-w-[200px]">
                      <p className="font-semibold text-foreground">{b.business_name || "(unnamed)"}</p>
                      <p className="text-xs text-muted-foreground">{p?.name} - {p?.email}</p>
                      <p className="text-xs text-muted-foreground">{b.category} {b.county && `· ${b.county}`}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setViewing(b)}>Review</Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={v => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.business_name}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              {viewing.banner_url && <AssetImage src={viewing.banner_url} bucket="business-assets" alt="" className="w-full h-32 object-cover rounded-lg" />}
              <div className="flex items-center gap-3">
                {viewing.logo_url && <AssetImage src={viewing.logo_url} bucket="business-assets" alt="" className="w-16 h-16 rounded-lg object-cover" />}
                <div>
                  <p className="font-semibold">{viewing.business_name}</p>
                  <Badge variant="outline">{viewing.category}{viewing.category_other ? `: ${viewing.category_other}` : ""}</Badge>
                </div>
              </div>
              {viewing.description && <p className="text-sm text-muted-foreground">{viewing.description}</p>}
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                {viewing.physical_address && <p><MapPin className="w-3.5 h-3.5 inline mr-1" /> {viewing.physical_address}, {viewing.town}, {viewing.county}</p>}
                {viewing.business_phone && <p><Phone className="w-3.5 h-3.5 inline mr-1" /> {viewing.business_phone}</p>}
                {viewing.business_email && <p><Mail className="w-3.5 h-3.5 inline mr-1" /> {viewing.business_email}</p>}
                {viewing.website && <p><Globe className="w-3.5 h-3.5 inline mr-1" /> {viewing.website}</p>}
                <p><strong>KRA PIN:</strong> {viewing.kra_pin || "-"}</p>
                <p><strong>Reg #:</strong> {viewing.registration_number || "-"}</p>
                <p><strong>Years:</strong> {viewing.years_in_operation || "-"}</p>
              </div>
              {viewing.rejection_reason && (
                <div className="rounded border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
                  Previous rejection: {viewing.rejection_reason}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {viewing && viewing.verification_status !== "approved" && (
              <Button onClick={() => approve(viewing)} className="bg-green-600 hover:bg-green-700"><ShieldCheck className="w-4 h-4" /> Approve</Button>
            )}
            {viewing && viewing.verification_status !== "rejected" && (
              <Button variant="destructive" onClick={() => setRejecting(viewing)}><XCircle className="w-4 h-4" /> Reject</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejecting} onOpenChange={v => !v && setRejecting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject business</DialogTitle></DialogHeader>
          <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for rejection (visible to supplier)" rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={!reason.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
