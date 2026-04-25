import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  "Electrician": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
  "Plumber": "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop",
  "Carpenter": "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=300&fit=crop",
  "Painter": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop",
  "Mason": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop",
  "Welder": "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400&h=300&fit=crop",
  "Mechanic": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=300&fit=crop",
  "Cleaner": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop",
  "Tiler": "https://images.unsplash.com/photo-1523413363574-c30aa1c2a516?w=600&h=400&fit=crop",
  "Roofer": "https://images.unsplash.com/photo-1632759145355-8b8f4c4d8f6f?w=600&h=400&fit=crop",
  "HVAC Technician": "https://images.unsplash.com/photo-1617104678098-de229db51175?w=600&h=400&fit=crop",
};

interface Props {
  categories: any[];
  selectedCategory: string;
  onSelect: (id: string) => void;
  onClear: () => void;
  t: (s: string) => string;
}

export default function CategoriesScroller({ categories, selectedCategory, onSelect, onClear, t }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, categories.length]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
      <h2 className="text-lg font-semibold text-foreground mb-3">{t("Service Categories")}</h2>
      <div className="relative group">
        {canLeft && (
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollBy(-1)}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-md items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}
        {canRight && (
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollBy(1)}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-md items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((cat) => {
            const img = cat.image_url || DEFAULT_CATEGORY_IMAGES[cat.name] || "";
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={`stat-card overflow-hidden p-0 flex flex-col items-center cursor-pointer transition-colors active:scale-[0.97] shrink-0 snap-start basis-[calc((100%-1.5rem)/3)] sm:basis-[180px] ${isSelected ? "border-primary ring-2 ring-primary/30" : "hover:border-primary/40"}`}
              >
                {img ? (
                  <div className="w-full h-20 overflow-hidden">
                    <img loading="lazy" decoding="async" src={img} alt={cat.name} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-full h-20 flex items-center justify-center bg-muted">
                    <span className="text-3xl">{cat.icon}</span>
                  </div>
                )}
                <div className="p-2 text-center w-full">
                  <span className="text-xs font-medium text-foreground block truncate">{cat.name}</span>
                  <span className="text-[10px] text-muted-foreground block">{cat.count} {t("available")}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {selectedCategory !== "all" && (
        <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={onClear}>
          ✕ {t("All Categories")}
        </Button>
      )}
    </div>
  );
}
