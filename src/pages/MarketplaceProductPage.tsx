import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, MapPin, Phone, Mail, Globe, ArrowLeft, MessageCircle, Star } from "lucide-react";
import waLogo from "@/assets/logo.png";
import { AssetImage } from "@/components/AssetImage";

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
        if (user) {
          supabase.from("activity_logs").insert({
            user_id: user.id,
            action: "Marketplace Product Viewed",
            detail: `Viewed product "${p.name}"${b?.business_name ? ` from ${b.business_name}` : ""}`,
            entity_type: "supplier_product",
            entity_id: p.id,
          }).then(() => {});
        }
      }
      setLoading(false);
    })();
  }, [id, user]);

  const logMarketplaceAction = (action: string, detail: string) => {
    if (!user || !product) return;
    supabase.from("activity_logs").insert({
      user_id: user.id,
      action,
      detail,
      entity_type: "supplier_product",
      entity_id: product.id,
    }).then(() => {});
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!product) return <div className="text-center py-20 text-muted-foreground">Product not found.</div>;

  const stockLabel: Record<string, string> = { in_stock: "In Stock", low: "Low Stock", out_of_stock: "Out of Stock" };

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /> Back</Button>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="aspect-square rounded-2xl bg-muted overflow-hidden border border-border">
            {product.images?.[activeImg] ? <AssetImage src={product.images[activeImg]} bucket="product-images" alt={product.name} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full text-muted-foreground">No image</div>}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {product.images.map((url: string, i: number) => (
                <button key={i} onClick={() => setActiveImg(i)} className={`w-20 h-20 rounded-lg overflow-hidden border-2 shrink-0 ${i === activeImg ? "border-primary" : "border-border"}`}>
                  <AssetImage src={url} bucket="product-images" alt="" className="w-full h-full object-cover" />
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
                {business.logo_url ? <AssetImage src={business.logo_url} bucket="business-assets" alt="" className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-muted" />}
                <div className="flex-1 min-w-0">
                  {business.website ? (
                    <a
                      href={business.website.startsWith("http") ? business.website : `https://${business.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => logMarketplaceAction("Marketplace Business Website Opened", `Opened website for ${business.business_name}`)}
                      className="font-semibold text-foreground hover:text-primary flex items-center gap-1.5"
                    >
                      {business.business_name}
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                    </a>
                  ) : (
                    <Link
                      to={`/dashboard/marketplace/business/${business.id}`}
                      className="font-semibold text-foreground hover:text-primary flex items-center gap-1.5"
                    >
                      {business.business_name}
                      <ShieldCheck className="w-4 h-4 text-green-600" />
                    </Link>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-1">{business.description}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-xs text-muted-foreground">
                {(business.town || business.county) && <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {[business.town, business.county].filter(Boolean).join(", ")}</p>}
                {business.business_phone && (
                  <p className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {business.business_phone}
                    <Badge variant="outline" className="ml-1 h-5 px-1.5 text-[10px] gap-1 border-green-600/40 text-green-700">
                      <ShieldCheck className="w-3 h-3" /> Verified
                    </Badge>
                  </p>
                )}
                {business.business_email && <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {business.business_email}</p>}
                {business.website && <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> <a href={business.website.startsWith("http") ? business.website : `https://${business.website}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary">{business.website}</a></p>}
              </div>
              {(() => {
                const rawPhone = (business.business_phone || "").replace(/\D/g, "");
                const waPhone = rawPhone.startsWith("0") ? "254" + rawPhone.slice(1) : rawPhone;
                const plainMessage = `Hello ${business.business_name}, I saw your product "${product.name}" on the FundiPlug Marketplace and I would like to place an order.\n\n` +
                  `• Product: ${product.name}\n` +
                  `• Price: KSH ${Number(product.price).toLocaleString()} / ${product.unit}\n` +
                  `• Quantity: (please confirm)\n\n` +
                  `Kindly share availability, delivery options and total cost. Thank you.`;
                const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(plainMessage)}` : "";
                const inAppDraft = encodeURIComponent(plainMessage);
                return (
                  <div className="space-y-2">
                    {waPhone ? (
                      <Button asChild className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Order via WhatsApp"
                          onClick={() => logMarketplaceAction("Marketplace WhatsApp Order Initiated", `Started WhatsApp order for "${product.name}" with ${business.business_name}`)}
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                            <path d="M20.52 3.48A11.94 11.94 0 0 0 12 0C5.37 0 .03 5.34.03 11.97c0 2.11.55 4.17 1.6 5.99L0 24l6.18-1.62a11.95 11.95 0 0 0 5.82 1.49h.01c6.63 0 11.97-5.34 11.97-11.97 0-3.19-1.24-6.19-3.46-8.42zM12 21.79h-.01a9.83 9.83 0 0 1-5.01-1.37l-.36-.21-3.67.96.98-3.58-.24-.37A9.81 9.81 0 0 1 2.2 11.97C2.2 6.55 6.58 2.17 12 2.17S21.8 6.55 21.8 11.97 17.42 21.79 12 21.79zm5.43-7.34c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15s-.77.97-.95 1.17c-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.89-.79-1.49-1.77-1.67-2.07-.18-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37s-1.04 1.01-1.04 2.47 1.07 2.87 1.22 3.07c.15.2 2.11 3.22 5.11 4.52.71.31 1.27.5 1.7.64.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.18-1.42-.07-.13-.27-.2-.57-.35z"/>
                          </svg>
                          Order via WhatsApp
                        </a>
                      </Button>
                    ) : (
                      <Button disabled className="w-full">WhatsApp number not available</Button>
                    )}
                    <p className="text-[11px] text-center text-muted-foreground flex items-center justify-center gap-1">
                      <img src={waLogo} alt="" className="w-3 h-3 rounded-sm" />
                      Pre-filled with your enquiry from FundiPlug Marketplace
                    </p>
                    {user && user.id !== business.user_id && (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full"
                        onClick={() => logMarketplaceAction("Marketplace In-App Chat Started", `Opened in-app chat about "${product.name}" with ${business.business_name}`)}
                      >
                        <Link to={`/dashboard/chat?to=${business.user_id}&draft=${inAppDraft}`}>
                          <MessageCircle className="w-4 h-4" /> Or chat in-app (pre-filled)
                        </Link>
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
