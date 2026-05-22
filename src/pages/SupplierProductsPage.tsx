import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Pencil, Trash2, Upload, Lock, X, Star } from "lucide-react";
import { Link } from "react-router-dom";

const UNITS = ["piece", "kg", "box", "bag", "litre", "metre", "pack", "set", "carton"];
const STOCK = [{ v: "in_stock", l: "In Stock" }, { v: "low", l: "Low Stock" }, { v: "out_of_stock", l: "Out of Stock" }];

export default function SupplierProductsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: biz } = await supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle();
    setBusiness(biz);
    if (biz?.verification_status === "approved") {
      const { data } = await supabase.from("supplier_products").select("*").eq("supplier_id", user.id).order("created_at", { ascending: false });
      setProducts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const openNew = () => {
    setEditing({
      name: "", category: business?.category || "", description: "", images: [],
      price: 0, unit: "piece", stock_status: "in_stock", min_order_qty: 1,
      delivery_areas: [], is_featured: false, is_active: true,
    });
    setOpen(true);
  };

  const openEdit = (p: any) => { setEditing({ ...p }); setOpen(true); };

  const uploadImage = async (file: File) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setEditing((e: any) => ({ ...e, images: [...(e.images || []), data.publicUrl] }));
  };

  const removeImage = (url: string) => setEditing((e: any) => ({ ...e, images: e.images.filter((u: string) => u !== url) }));

  const save = async () => {
    if (!editing.name?.trim()) { toast({ title: "Product name required", variant: "destructive" }); return; }
    if (!user || !business) return;
    setSaving(true);
    const payload = {
      business_id: business.id,
      supplier_id: user.id,
      name: editing.name,
      category: editing.category || null,
      description: editing.description || null,
      images: editing.images || [],
      price: Number(editing.price) || 0,
      unit: editing.unit,
      stock_status: editing.stock_status,
      min_order_qty: Number(editing.min_order_qty) || 1,
      delivery_areas: editing.delivery_areas || [],
      is_featured: !!editing.is_featured,
      is_active: !!editing.is_active,
    };
    const { error } = editing.id
      ? await supabase.from("supplier_products").update(payload).eq("id", editing.id)
      : await supabase.from("supplier_products").insert(payload);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: editing.id ? "Product updated" : "Product added" });
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const { error } = await supabase.from("supplier_products").delete().eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Deleted" }); load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  if (!business || business.verification_status !== "approved") {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-border bg-card p-10 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-7 h-7 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Products are locked</h2>
        <p className="text-sm text-muted-foreground">
          {!business
            ? "Complete and submit your Business Profile to start listing products."
            : business.verification_status === "pending"
              ? "Your business is pending admin verification. You'll unlock product management once approved."
              : business.verification_status === "rejected"
                ? "Your business was rejected. Please update and resubmit to unlock products."
                : "Submit your Business Profile for verification to unlock products."}
        </p>
        <Button asChild><Link to="/dashboard/business-profile">Go to Business Profile</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Products & Services</h1>
          <p className="text-sm text-muted-foreground">{products.length} listed</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4" /> Add Product</Button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-muted-foreground mb-4">No products yet.</p>
          <Button onClick={openNew}><Plus className="w-4 h-4" /> Add your first product</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(p => (
            <div key={p.id} className="rounded-xl border border-border bg-card overflow-hidden flex flex-col">
              <div className="aspect-video bg-muted relative">
                {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No image</div>}
                {p.is_featured && <Badge className="absolute top-2 left-2 bg-primary"><Star className="w-3 h-3" /> Featured</Badge>}
                {!p.is_active && <Badge className="absolute top-2 right-2" variant="secondary">Inactive</Badge>}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-foreground line-clamp-1">{p.name}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-primary">KSH {Number(p.price).toLocaleString()}<span className="text-xs text-muted-foreground font-normal">/{p.unit}</span></span>
                  <Badge variant="outline" className="text-xs">{STOCK.find(s => s.v === p.stock_status)?.l}</Badge>
                </div>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="flex-1"><Pencil className="w-3.5 h-3.5" /> Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => remove(p.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2"><Label>Name *</Label><Input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Category</Label><Input value={editing.category || ""} onChange={e => setEditing({ ...editing, category: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Price (KSH)</Label><Input type="number" min={0} value={editing.price} onChange={e => setEditing({ ...editing, price: e.target.value })} /></div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Select value={editing.unit} onValueChange={v => setEditing({ ...editing, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Stock Status</Label>
                  <Select value={editing.stock_status} onValueChange={v => setEditing({ ...editing, stock_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STOCK.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>Min Order Qty</Label><Input type="number" min={1} value={editing.min_order_qty} onChange={e => setEditing({ ...editing, min_order_qty: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Delivery Areas (comma-separated)</Label><Input value={(editing.delivery_areas || []).join(", ")} onChange={e => setEditing({ ...editing, delivery_areas: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea rows={3} value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
              </div>
              <div>
                <Label>Images</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {(editing.images || []).map((url: string) => (
                    <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => removeImage(url)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:bg-muted">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.is_featured} onCheckedChange={(v: any) => setEditing({ ...editing, is_featured: !!v })} /> Featured</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={editing.is_active} onCheckedChange={(v: any) => setEditing({ ...editing, is_active: !!v })} /> Active (visible in marketplace)</label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
