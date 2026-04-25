import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Edit2, Upload, Image } from "lucide-react";
import {
import { friendlyError } from "@/lib/friendlyError";
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "Electrician": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
  "Plumber": "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop",
  "Carpenter": "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop",
  "Painter": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop",
  "Mason": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop",
  "Welder": "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
  "Mechanic": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop",
  "Cleaner": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop",
  "Gardener": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop",
  "Tiler": "https://images.unsplash.com/photo-1523413363574-c30aa1c2a516?w=400&h=300&fit=crop",
};

export default function AdminCategoriesPage() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🔧");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    const { data } = await supabase.from("service_categories").select("*").order("name");
    setCategories(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setName(""); setIcon("🔧"); setDescription(""); setImageUrl(""); setShowDialog(true); };
  const openEdit = (cat: any) => { setEditId(cat.id); setName(cat.name); setIcon(cat.icon || "🔧"); setDescription(cat.description || ""); setImageUrl(cat.image_url || ""); setShowDialog(true); };

  const uploadImage = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("category-images").upload(path, file);
    if (error) { toast({ title: "Upload failed", description: friendlyError(error), variant: "destructive" }); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("category-images").getPublicUrl(path);
    setImageUrl(publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const finalImage = imageUrl || DEFAULT_CATEGORY_IMAGES[name.trim()] || "";
    if (editId) {
      await supabase.from("service_categories").update({ name: name.trim(), icon, description: description.trim() || null, image_url: finalImage || null }).eq("id", editId);
      toast({ title: "Category updated" });
    } else {
      await supabase.from("service_categories").insert({ name: name.trim(), icon, description: description.trim() || null, image_url: finalImage || null });
      toast({ title: "Category created" });
    }
    setSaving(false);
    setShowDialog(false);
    load();
  };

  const deleteCategory = async (id: string) => {
    await supabase.from("service_categories").delete().eq("id", id);
    toast({ title: "Category deleted" });
    load();
  };

  if (loading) {
    return <div className="space-y-6"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Service Categories</h1>
          <p className="text-muted-foreground text-sm">Manage skill categories for fundis</p>
        </div>
        <Button onClick={openCreate} className="active:scale-[0.97]"><Plus className="w-4 h-4 mr-2" /> Add Category</Button>
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat, i) => {
            const img = cat.image_url || DEFAULT_CATEGORY_IMAGES[cat.name] || "";
            return (
              <div key={cat.id} className="stat-card overflow-hidden p-0 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                {img ? (
                  <div className="h-36 bg-muted overflow-hidden">
                    <img loading="lazy" decoding="async" src={img} alt={cat.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="h-36 bg-muted flex items-center justify-center">
                    <span className="text-5xl">{cat.icon}</span>
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{cat.name}</p>
                      {cat.description && <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => openEdit(cat)}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive" onClick={() => deleteCategory(cat.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="stat-card flex flex-col items-center py-16 text-center">
          <p className="text-foreground font-medium">No categories yet</p>
          <p className="text-sm text-muted-foreground">Add service categories for fundis to select</p>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {imageUrl ? (
              <div className="relative h-32 rounded-lg overflow-hidden bg-muted">
                <img loading="lazy" decoding="async" src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-background/80 rounded-full p-1 text-xs text-destructive hover:bg-background">✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 transition-colors"
              >
                {uploading ? "Uploading..." : <><Upload className="w-5 h-5" /><span className="text-sm">Upload category image</span></>}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
            <div className="flex gap-3">
              <div className="space-y-2 w-20">
                <label className="text-sm font-medium text-foreground">Icon</label>
                <Input value={icon} onChange={(e) => setIcon(e.target.value)} className="bg-muted/50 text-center text-xl" maxLength={2} />
              </div>
              <div className="space-y-2 flex-1">
                <label className="text-sm font-medium text-foreground">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electrician" className="bg-muted/50" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Description</label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Image URL (optional)</label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://... or upload above" className="bg-muted/50" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>{saving ? "Saving..." : editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
