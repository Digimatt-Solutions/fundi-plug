import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MapPin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

export default function LocationStep({ data, setData }: Props) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const pickLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setData({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        toast({ title: "Location captured" });
        setBusy(false);
      },
      (err) => {
        toast({ title: "Could not get location", description: err.message, variant: "destructive" });
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const lat = data.latitude;
  const lng = data.longitude;
  const hasGps = lat != null && lng != null;
  const mapSrc = hasGps
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01}%2C${lat - 0.01}%2C${lng + 0.01}%2C${lat + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`
    : null;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Country *</Label>
          <Input
            value={data.country || "Kenya"}
            onChange={(e) => setData({ country: e.target.value })}
          />
        </div>
        <div>
          <Label>County *</Label>
          <Input value={data.county || ""} onChange={(e) => setData({ county: e.target.value })} />
        </div>
        <div>
          <Label>Constituency *</Label>
          <Input
            value={data.constituency || ""}
            onChange={(e) => setData({ constituency: e.target.value })}
          />
        </div>
        <div>
          <Label>Ward *</Label>
          <Input value={data.ward || ""} onChange={(e) => setData({ ward: e.target.value })} />
        </div>
      </div>

      <div>
        <Label>Exact Address *</Label>
        <Input
          placeholder="Street, building, estate"
          value={data.exact_address || ""}
          onChange={(e) => setData({ exact_address: e.target.value })}
        />
      </div>
      <div>
        <Label>Nearest Landmark</Label>
        <Input
          placeholder="e.g. Next to Total petrol station"
          value={data.landmark || ""}
          onChange={(e) => setData({ landmark: e.target.value })}
        />
      </div>

      {/* GPS picker */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">GPS pin</p>
            <p className="text-xs text-muted-foreground">
              {hasGps ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "Not set"}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={pickLocation} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />}
            {hasGps ? "Update pin" : "Use my current location"}
          </Button>
        </div>
        {mapSrc && (
          <iframe
            title="map-pin"
            src={mapSrc}
            className="w-full h-48 rounded border"
            style={{ border: 0 }}
          />
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Service Area *</Label>
          <Input
            placeholder="Areas you serve"
            value={data.service_area || ""}
            onChange={(e) => setData({ service_area: e.target.value })}
          />
        </div>
        <div>
          <Label>Service Radius (km)</Label>
          <Input
            type="number"
            min="0"
            placeholder="e.g. 10"
            value={data.service_radius_km ?? ""}
            onChange={(e) => setData({ service_radius_km: parseInt(e.target.value) || null })}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Willing to travel for jobs</p>
            <p className="text-xs text-muted-foreground">Outside your service area</p>
          </div>
          <Switch
            checked={!!data.willing_to_travel}
            onCheckedChange={(v) => setData({ willing_to_travel: v })}
          />
        </div>
        {data.willing_to_travel && (
          <div>
            <Label>Maximum travel distance (km)</Label>
            <Input
              type="number"
              min="0"
              placeholder="e.g. 50"
              value={data.max_travel_km ?? ""}
              onChange={(e) => setData({ max_travel_km: parseInt(e.target.value) || null })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
