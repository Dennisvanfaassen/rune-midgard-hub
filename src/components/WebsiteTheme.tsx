import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const THEMES = [
  { id: "dark-midnight", label: "Midnight", group: "Dark", swatch: "#192439" },
  { id: "dark-forest", label: "Forest", group: "Dark", swatch: "#172b26" },
  { id: "dark-plum", label: "Plum", group: "Dark", swatch: "#302039" },
  { id: "light-ivory", label: "Ivory", group: "Light", swatch: "#faf7f0" },
  { id: "light-sky", label: "Sky", group: "Light", swatch: "#eef6fc" },
  { id: "light-sage", label: "Sage", group: "Light", swatch: "#f0f7ee" },
] as const;
export type ThemeName = typeof THEMES[number]["id"];
export function isThemeName(value: unknown): value is ThemeName {
  return THEMES.some((t) => t.id === value);
}
function applyTheme(id: ThemeName) {
  const root = document.documentElement;
  root.dataset.theme = id;
  root.classList.toggle("dark", id.startsWith("dark-"));
  root.style.colorScheme = id.startsWith("dark-") ? "dark" : "light";
}
export function WebsiteThemeManager() {
  const { session, ready } = useAuth();
  const id = session?.user?.user_metadata?.website_theme;
  useEffect(() => {
    if (!ready) return;
    const theme = isThemeName(id) ? id : "dark-midnight";
    applyTheme(theme);
  }, [id, ready, session?.user.id]);
  return null;
}
export function ThemePreference() {
  const { session } = useAuth();
  const saved = session?.user.user_metadata?.website_theme;
  const current: ThemeName = isThemeName(saved) ? saved : "dark-midnight";
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<ThemeName | null>(null);
  const selected = preview ?? current;
  useEffect(() => { if (!busy) setPreview(null); }, [current]);
  async function choose(theme: ThemeName) {
    if (busy) return;
    setPreview(theme);
    applyTheme(theme);
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ data: { website_theme: theme } });
    setBusy(false);
    if (error) {
      setPreview(null);
      applyTheme(current);
      toast.error("Could not save your website color preference: " + error.message);
    } else {
      toast.success("Website colors saved");
    }
  }
  return <section className="mt-5 rounded-lg border border-border bg-card p-5">
    <h2 className="text-xl font-bold">Website appearance</h2>
    <p className="mt-1 text-sm text-muted-foreground">Choose your favorite background colors. Your choice applies to the entire site and is saved to your account.</p>
    {(["Dark", "Light"] as const).map((group) => <div key={group} className="mt-4">
      <h3 className="mb-2 text-sm font-semibold">{group} themes</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {THEMES.filter((theme) => theme.group === group).map((theme) => <button key={theme.id} type="button"
          disabled={busy} aria-pressed={selected === theme.id}
          onClick={() => choose(theme.id)}
          className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary disabled:opacity-60 ${selected === theme.id ? "border-primary ring-2 ring-primary/40" : "border-border"}`}>
          <span className="h-8 w-8 shrink-0 rounded-md border border-black/15" style={{ backgroundColor: theme.swatch }} />
          <span className="flex-1 text-sm font-semibold">{theme.label}</span>
          {selected === theme.id && <span className="text-xs text-primary">Selected</span>}
        </button>)}
      </div>
    </div>)}
  </section>;
}
