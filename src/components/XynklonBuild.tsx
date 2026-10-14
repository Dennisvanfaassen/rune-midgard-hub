import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const BUILDER = "https://soulbound.xynklon.workers.dev/";
export type ExternalBuild = { external_url?: string; source?: string };

export function validateXynklonUrl(raw: string): { url: string; payload: Record<string, unknown> } | null {
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== "https:" || parsed.hostname !== "soulbound.xynklon.workers.dev" || parsed.username || parsed.password || parsed.port || parsed.pathname !== "/") return null;
    const match = /^#calc=([A-Za-z0-9_-]+)$/.exec(parsed.hash);
    if (!match || match[1].length > 12000) return null;
    const code = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(code.padEnd(Math.ceil(code.length / 4) * 4, "="));
    const bytes = Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || Array.isArray(data) || typeof data !== "object") return null;
    const payload = data as Record<string, unknown>;
    if (payload.v !== 1) return null;
    return { url: BUILDER + "#calc=" + match[1], payload };
  } catch { return null; }
}

export function XynklonBuild({ ownerId, isOwner, saved, onSaved }: { ownerId: string; isOwner: boolean; saved: string | null; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(saved ?? "");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const build = saved ? validateXynklonUrl(saved) : null;
  const entries = build ? Object.entries(build.payload).filter(([key, v]) => key !== "v" && (typeof v === "number" || typeof v === "string" || typeof v === "boolean")).slice(0, 16) : [];

  async function save(url: string | null) {
    const parsed = url ? validateXynklonUrl(url) : null;
    if (url && !parsed) { toast.error("Paste a valid Xynklon share link containing #calc=."); return; }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ stat_build: url ? { source: "xynklon", external_url: parsed!.url } : null }).eq("id", ownerId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["profile", ownerId] });
    onSaved();
    setEditing(false);
    toast.success(url ? "Xynklon build saved to your profile" : "Build link removed");
  }

  return <section className="rounded-lg border border-border bg-card p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold">Character build</h2>
        <p className="mt-1 text-sm text-muted-foreground">Stats and skills planned with the SoulBound Xynklon calculator.</p>
      </div>
      {isOwner && <Button variant="outline" size="sm" onClick={() => { setValue(saved ?? ""); setEditing((v) => !v); }}><Link2 className="mr-2 h-4 w-4" />{saved ? "Change link" : "Add build link"}</Button>}
    </div>
    {build && <div className="mt-4 space-y-3">
      <Button asChild><a href={build.url} target="_blank" rel="noopener noreferrer">Open stats & skills in Xynklon <ExternalLink className="ml-2 h-4 w-4" /></a></Button>
      {entries.length ? <div className="flex flex-wrap gap-2 text-sm">{entries.map(([k, v]) => <span key={k} className="rounded bg-secondary px-2 py-1">{k}: {String(v)}</span>)}</div> : <p className="text-xs text-muted-foreground">This shared link contains a calculator version marker but no readable stats or skills. Open it in Xynklon to see the builder.</p>}
    </div>}
    {!build && <p className="mt-3 text-sm text-muted-foreground">{saved ? "This previously saved link is invalid." : "No Xynklon build linked yet."} {isOwner && "Make a build in Xynklon, copy its share URL and add it here."}</p>}
    {editing && isOwner && <div className="mt-4 space-y-3 rounded-md border border-border bg-secondary/30 p-3">
      <label className="block text-sm font-semibold" htmlFor="xynklon-link">Xynklon share URL</label>
      <Input id="xynklon-link" value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://soulbound.xynklon.workers.dev/#calc=..." />
      <p className="text-xs text-muted-foreground">Only valid links from soulbound.xynklon.workers.dev are accepted. A link that contains only &#123;&quot;v&quot;:1&#125; cannot display stats locally.</p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || !value.trim()} onClick={() => save(value)}>Save build link</Button>
        {saved && <Button disabled={busy} variant="outline" onClick={() => save(null)}><Trash2 className="mr-2 h-4 w-4" />Remove link</Button>}
        <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      </div>
    </div>}
    <p className="mt-4 text-xs text-muted-foreground">External calculator: <a className="text-primary underline" href={BUILDER} target="_blank" rel="noopener noreferrer">SoulBound Xynklon ↗</a></p>
  </section>;
}
