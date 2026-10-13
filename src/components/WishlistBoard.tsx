import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CharacterPortrait } from "@/components/CharacterPortrait";

export function WishlistBoard({ newest = false }: { newest?: boolean }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["wishlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gear_wishlist").select("*,profiles(id,display_name,char_name,avatar_path)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const groups = new Map<string, typeof data>();
  for (const item of data) {
    const p = item.profiles;
    if (!p || (filter !== "all" && item.status !== filter)) continue;
    if (!`${p.display_name} ${p.char_name ?? ""} ${item.item_name}`.toLowerCase().includes(search.toLowerCase())) continue;
    groups.set(item.user_id, [...(groups.get(item.user_id) ?? []), item]);
  }
  const entries = [...groups.entries()].slice(0, newest ? 3 : undefined);
  async function toggle(id: string, status: string, owner: string) {
    const { error } = await supabase.from("gear_wishlist").update({ status: status === "have" ? "need" : "have" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["wishlists"] });
    qc.invalidateQueries({ queryKey: ["gear", owner] });
    qc.invalidateQueries({ queryKey: ["members"] });
  }
  return <div>
    {!newest && <div className="mb-6 flex flex-wrap gap-3">
      <Input aria-label="Search wishlists" placeholder="Search members or gear" className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="flex gap-1">{[["all", "All gear"], ["need", "Still needed"], ["have", "Owned"]].map(([key, label]) => <Button key={key} variant={filter === key ? "default" : "outline"} size="sm" onClick={() => setFilter(key)}>{label}</Button>)}</div>
    </div>}
    {isLoading && <p className="text-muted-foreground">Loading wishlists…</p>}
    {isError && <p className="text-destructive">Could not load wishlists.</p>}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {entries.map(([owner, items]) => {
        const p = items[0]?.profiles;
        if (!p) return null;
        return <article key={owner} className="rounded-lg border border-border bg-card p-4">
          <Link to="/members/$id" params={{ id: owner }} className="flex items-center gap-3 border-b border-border pb-3">
            <CharacterPortrait path={p.avatar_path} name={p.char_name || p.display_name} className="h-14 w-12" />
            <div><h3 className="font-bold text-primary">{p.char_name || p.display_name}</h3><p className="text-xs text-muted-foreground">{items.filter((g) => g.status === "need").length} still needed · {items.filter((g) => g.status === "have").length} owned</p></div>
          </Link>
          <ul className="divide-y divide-border">{(newest ? items.slice(0, 4) : items).map((g) => <li key={g.id} className="flex items-start gap-2 py-3">
            {g.status === "have" ? <Check className="mt-1 h-4 w-4 shrink-0 text-success" /> : <Crosshair className="mt-1 h-4 w-4 shrink-0 text-accent" />}
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{g.item_name}</p><p className="text-xs text-muted-foreground">{g.status === "have" ? "I have this gear" : "I still need this gear"}</p></div>
            {owner === userId && <Button aria-label={`Change ownership of ${g.item_name}`} title={g.status === "have" ? "I still need this gear" : "I have this gear"} size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => toggle(g.id, g.status, owner)}>{g.status === "have" ? <Crosshair /> : <Check />}</Button>}
          </li>)}</ul>
          {newest && items.length > 4 && <Link to="/members/$id" params={{ id: owner }} className="text-xs text-primary">View all {items.length} items →</Link>}
        </article>;
      })}
    </div>
    {!isLoading && !isError && !entries.length && <p className="text-muted-foreground">No wishlists found.</p>}
  </div>;
}