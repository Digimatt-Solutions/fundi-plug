import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X } from "lucide-react";
import FileUploader from "../FileUploader";

interface Props {
  data: any;
  setData: (patch: any) => void;
  userId: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SkillsStep({ data, setData, userId }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [subSkillInput, setSubSkillInput] = useState("");
  const [toolInput, setToolInput] = useState("");

  useEffect(() => {
    supabase.from("service_categories").select("id, name").order("name").then(({ data }) => {
      setCategories(data || []);
    });
  }, []);

  const skills: string[] = data.skills || [];
  const toggleSkill = (id: string) => {
    const next = skills.includes(id) ? skills.filter((s) => s !== id) : [...skills, id];
    setData({ skills: next });
  };

  const subSkills: string[] = data.sub_skills || [];
  const addSubSkill = () => {
    const v = subSkillInput.trim();
    if (!v || subSkills.includes(v)) return;
    setData({ sub_skills: [...subSkills, v] });
    setSubSkillInput("");
  };
  const removeSubSkill = (s: string) => setData({ sub_skills: subSkills.filter((x) => x !== s) });

  const tools: string[] = data.tools_owned || [];
  const addTool = () => {
    const v = toolInput.trim();
    if (!v || tools.includes(v)) return;
    setData({ tools_owned: [...tools, v] });
    setToolInput("");
  };
  const removeTool = (s: string) => setData({ tools_owned: tools.filter((x) => x !== s) });

  const days: number[] = data.availability_days || [];
  const toggleDay = (i: number) => {
    setData({ availability_days: days.includes(i) ? days.filter((d) => d !== i) : [...days, i] });
  };

  const portfolio: string[] = data.portfolio_urls || [];
  const addPortfolio = (url: string | null) => {
    if (!url) return;
    setData({ portfolio_urls: [...portfolio, url] });
  };
  const removePortfolio = (i: number) =>
    setData({ portfolio_urls: portfolio.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-5">
      {/* Skills */}
      <div>
        <Label>Service Categories *</Label>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">
          {categories.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2 rounded-md border bg-card p-2 cursor-pointer hover:bg-accent/50"
            >
              <Checkbox checked={skills.includes(c.id)} onCheckedChange={() => toggleSkill(c.id)} />
              <span className="text-sm">{c.name}</span>
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Label className="text-xs">Other (specify)</Label>
          <Input
            placeholder="A skill not listed above"
            value={data.other_skill || ""}
            onChange={(e) => setData({ other_skill: e.target.value })}
          />
        </div>
      </div>

      {/* Sub-skills */}
      <div>
        <Label>Sub-skills / specialties</Label>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="e.g. Tile laying, PVC pipework"
            value={subSkillInput}
            onChange={(e) => setSubSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSubSkill();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addSubSkill}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {subSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {subSkills.map((s) => (
              <Badge key={s} variant="secondary" className="gap-1">
                {s}
                <button onClick={() => removeSubSkill(s)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Experience */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label>Years of Experience *</Label>
          <Input
            type="number"
            min="0"
            value={data.years_experience ?? ""}
            onChange={(e) => setData({ years_experience: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label>Experience Level *</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={data.experience_level || ""}
            onChange={(e) => setData({ experience_level: e.target.value })}
          >
            <option value="">Select…</option>
            <option value="entry">Entry (0–2 yrs)</option>
            <option value="intermediate">Intermediate (3–6 yrs)</option>
            <option value="expert">Expert (7+ yrs)</option>
          </select>
        </div>
      </div>

      {/* Pricing */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <p className="text-sm font-medium text-foreground">Pricing (KSH)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>Daily Rate *</Label>
            <Input
              type="number"
              min="0"
              placeholder="e.g. 2500"
              value={data.daily_rate ?? ""}
              onChange={(e) => setData({ daily_rate: parseFloat(e.target.value) || null })}
            />
          </div>
          <div>
            <Label>Hourly Rate (optional)</Label>
            <Input
              type="number"
              min="0"
              placeholder="e.g. 350"
              value={data.hourly_rate ?? ""}
              onChange={(e) => setData({ hourly_rate: parseFloat(e.target.value) || null })}
            />
          </div>
        </div>
      </div>

      {/* Tools */}
      <div>
        <Label>Tools Owned</Label>
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="e.g. Drill, Welding machine"
            value={toolInput}
            onChange={(e) => setToolInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTool();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addTool}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        {tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tools.map((s) => (
              <Badge key={s} variant="outline" className="gap-1">
                {s}
                <button onClick={() => removeTool(s)} className="hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Availability */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
        <p className="text-sm font-medium text-foreground">Availability</p>
        <div>
          <Label className="text-xs">Working days</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(i)}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  days.includes(i)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs">Commitment</Label>
          <div className="flex gap-2 mt-1">
            {["full_time", "part_time"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setData({ availability_type: v })}
                className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                  data.availability_type === v
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border"
                }`}
              >
                {v === "full_time" ? "Full-time" : "Part-time"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio */}
      <div>
        <Label>Portfolio (sample work images)</Label>
        <p className="text-xs text-muted-foreground mb-2">Add up to 6 images of your past work</p>
        {portfolio.length < 6 && (
          <FileUploader
            bucket="portfolio"
            userId={userId}
            value={null}
            onChange={addPortfolio}
            label=""
            helper="JPG/PNG, up to 10 MB each"
          />
        )}
        {portfolio.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
            {portfolio.map((url, i) => (
              <div key={i} className="relative group">
                <img loading="lazy" decoding="async" src={url} alt="work" className="w-full aspect-square object-cover rounded border" />
                <button
                  type="button"
                  onClick={() => removePortfolio(i)}
                  className="absolute top-1 right-1 bg-background/80 backdrop-blur rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
