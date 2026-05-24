import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShieldCheck, Loader2, Package, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function MarketplacePage() {
  const [products, setProducts] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  useEffect(() => {
    (async () => {
      const { data: prods } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      const list = prods || [];
      setProducts(list);
      const bizIds = Array.from(new Set(list.map(p => p.business_id)));
      if (bizIds.length) {
        const { data: biz } = await supabase
          .from("business_profiles")
          .select("id,business_name,logo_url,county,town,verification_status,user_id")
          .in("id", bizIds)
          .eq("verification_status", "approved");
        const map: Record<string, any> = {};
        (biz || []).forEach((b: any) => { map[b.id] = b; });
        setBusinesses(map);
      }
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => {
    return products
      .filter(p => businesses[p.business_id]) // only approved businesses
      .filter(p => cat === "all" || p.category === cat)
      .filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase()) || (p.description || "").toLowerCase().includes(q.toLowerCase()));
  }, [products, businesses, q, cat]);

  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Package className="w-6 h-6 text-primary" /> Marketplace</h1>
        <p className="text-sm text-muted-foreground">Browse products and services from verified suppliers.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products" className="pl-9" />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          No products match your search yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visible.map(p => {
            const biz = businesses[p.business_id];
            return (
              <Link key={p.id} to={`/dashboard/marketplace/${p.id}`} className="rounded-xl border border-border bg-card overflow-hidden hover:shadow-lg hover:border-primary/40 transition">
                <div className="aspect-square bg-muted relative">
                  {p.images?.[0] ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-muted-foreground text-xs">No image</div>}
                  {p.is_featured && <Badge className="absolute top-2 left-2 bg-primary"><Star className="w-3 h-3" /> Featured</Badge>}
                </div>
                <div className="p-3 space-y-1.5">
                  <h3 className="font-semibold text-foreground line-clamp-1">{p.name}</h3>
                  <p className="text-primary font-bold">KSH {Number(p.price).toLocaleString()}</p>
                  <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                    {biz?.logo_url ? <img src={biz.logo_url} alt="" className="w-5 h-5 rounded-full object-cover" /> : <div className="w-5 h-5 rounded-full bg-muted" />}
                    <span className="text-xs text-muted-foreground line-clamp-1 flex-1">{biz?.business_name}</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
