import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, MapPin, Phone, Mail, Globe, ArrowLeft, MessageCircle, Star } from "lucide-react";

export default function MarketplaceProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [activeImg, setActiveImg] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: p } = await supabase.from("supplier_products").select("*").eq("id", id).maybeSingle();
      if (p) {
        const { data: b } = await supabase.from("business_profiles").select("*").eq("id", p.business_id).maybeSingle();
        setProduct(p); setBusiness(b);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!product) return <div className="text-center py-20 text-muted-foreground">Product not found.</div>;

  const stockLabel: Record<string, string> = { in_stock: "In Stock", low: "Low Stock", out_of_stock: "Out of Stock" };

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> Back</Button>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl bg-muted overflow-hidden border border-border">
            {product.images?.[activeImg] ? <img src={product.images[activeImg]} alt={product.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-muted-foreground">No image</div>}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((url: string, i: number) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 shrink-0 ${i === activeImg ? "border-primary" : "border-border"}`}>
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            {product.is_featured && <Badge className="bg-primary"><Star className="w-3 h-3" /> Featured</Badge>}
          </div>
          {product.category && <Badge variant="outline">{product.category}</Badge>}
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-primary">KSH {Number(product.price).toLocaleString()}</p>
            <span className="text-muted-foreground">/ {product.unit}</span>
          </div>
          <Badge variant="outline">{stockLabel[product.stock_status]}</Badge>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>

          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <p><strong>Minimum Order:</strong> {product.min_order_qty} {product.unit}</p>
            {product.delivery_areas?.length > 0 && (
              <p className="mt-1"><strong>Delivery Areas:</strong> {product.delivery_areas.join(", ")}</p>
            )}
          </div>

          {business && (
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                {business.logo_url ? <img src={business.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-muted" />}
                <div className="flex-1 min-w-0">
                  <Link to={`/dashboard/marketplace/business/${business.id}`} className="font-semibold text-foreground hover:text-primary flex items-center gap-1.5">
                    {business.business_name}
                    <ShieldCheck className="w-4 h-4 text-green-600" />
                  </Link>
                  <p className="text-xs text-muted-foreground line-clamp-1">{business.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                {(business.town || business.county) && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {[business.town, business.county].filter(Boolean).join(", ")}</p>}
                {business.business_phone && <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {business.business_phone}</p>}
                {business.business_email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {business.business_email}</p>}
                {business.website && <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> <a href={business.website} target="_blank" rel="noreferrer" className="hover:text-primary">{business.website}</a></p>}
              </div>
              {user && user.id !== business.user_id && (
                <Button asChild className="w-full"><Link to={`/dashboard/chat?to=${business.user_id}`}><MessageCircle className="w-4 h-4" /> Contact Supplier</Link></Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
