import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Search, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (loc: { latitude: number; longitude: number; address?: string; town?: string; county?: string }) => void;
  disabled?: boolean;
  defaultCountry?: string; // e.g. "ke"
}

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: { town?: string; city?: string; village?: string; suburb?: string; county?: string; state?: string };
};

/**
 * Free Nominatim (OpenStreetMap) geocoder + draggable embedded map preview.
 * No API key needed. Includes "use my location" button.
 */
export default function LocationPicker({ latitude, longitude, onChange, disabled, defaultCountry = "ke" }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=${defaultCountry}&q=${encodeURIComponent(query)}`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(true);
      } catch (e) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, defaultCountry]);

  const pickResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat);
    const lon = parseFloat(r.lon);
    const town = r.address?.town || r.address?.city || r.address?.village || r.address?.suburb;
    const county = r.address?.county || r.address?.state;
    onChange({ latitude: lat, longitude: lon, address: r.display_name, town, county });
    setQuery(r.display_name);
    setOpen(false);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Geolocation not supported", variant: "destructive" });
      return;
    }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lon = pos.coords.longitude;
        // Reverse geocode for address details
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, { headers: { "Accept-Language": "en" } });
          const data: NominatimResult = await res.json();
          const town = data.address?.town || data.address?.city || data.address?.village || data.address?.suburb;
          const county = data.address?.county || data.address?.state;
          onChange({ latitude: lat, longitude: lon, address: data.display_name, town, county });
          setQuery(data.display_name || "");
        } catch {
          onChange({ latitude: lat, longitude: lon });
        }
        setGpsBusy(false);
        toast({ title: "Location captured" });
      },
      (err) => {
        toast({ title: "Could not get location", description: err.message, variant: "destructive" });
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const hasPin = latitude != null && longitude != null;
  const mapSrc = hasPin
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(longitude as number) - 0.01}%2C${(latitude as number) - 0.01}%2C${(longitude as number) + 0.01}%2C${(latitude as number) + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`
    : null;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search for a place, street, town..."
          className="pl-10 pr-10"
          disabled={disabled}
        />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}

        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => pickResult(r)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-start gap-2 border-b border-border/50 last:border-b-0"
              >
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                <span className="line-clamp-2">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-muted-foreground">
          {hasPin ? (
            <span className="font-mono inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {(latitude as number).toFixed(5)}, {(longitude as number).toFixed(5)}</span>
          ) : (
            "Search above, drop a pin from your location, or enter coordinates manually."
          )}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={disabled || gpsBusy}>
          {gpsBusy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Crosshair className="w-4 h-4 mr-1" />}
          Use my location
        </Button>
      </div>

      {mapSrc && (
        <iframe
          title="business-map-pin"
          src={mapSrc}
          className="w-full h-64 rounded-lg border border-border"
          style={{ border: 0 }}
        />
      )}
    </div>
  );
}
