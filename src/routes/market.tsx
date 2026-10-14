import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ListingCard, useListings } from "@/components/MarketListing";
import { loadEngine, type Engine, type RoItem } from "@/lib/ro/engine";
import { itemLabel } from "@/lib/ro/jobs";
import { itemDisplay } from "@/lib/ro/slots";
import { formatZeny } from "@/lib/forum";

export const Route = createFileRoute("/market")({
  head: () => ({ meta: [
    { title: "Guild Marketplace · Rune Midgard" },
    { name: "description", content: "Buy and sell items to Rune Midgard guildmates for guild prices." },
    { property: "og:title", content: "Guild Marketplace · Rune Midgard" },
    { property: "og:description", content: "Buy and sell items to Rune Midgard guildmates for guild prices." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Market,
});

function Market() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const listings = useListings();
  const [q, setQ] = useState("");
  const [show, setShow] = useState("open");
  const [sort, setSort] = useState("newest");
  const [open, setOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["market"] });
  const list = (listings.data ?? [])
    .filter((l) => (show === "all" || (show === "mine" ? l.seller_id === userId : show === "free" ? l.status === "open" && l.price === 0 : l.status === show)) && itemDisplay(l.item_key, l.item_name).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (sort === "low") return a.price - b.price || b.created_at.localeCompare(a.created_at);
      if (sort === "high") return b.price - a.price || b.created_at.localeCompare(a.created_at);
      if (sort === "name") return itemDisplay(a.item_key, a.item_name).localeCompare(itemDisplay(b.item_key, b.item_name));
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
  return <main className="mx-auto max-w-6xl px-4 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-4xl font-bold">Guild Marketplace</h1><p className="text-muted-foreground">Guild prices for guildmates. Contact the seller in game or on Discord.</p></div>
      {userId ? <Button onClick={() => setOpen(!open)}>{open ? "Cancel" : "Sell an item"}</Button> : <Button asChild variant="outline"><Link to="/auth">Sign in to sell</Link></Button>}
    </div>
    {open && userId && <NewListing userId={userId} onDone={() => { setOpen(false); refresh(); }} />}
    <div className="mt-6 flex flex-wrap gap-3">
      <Input aria-label="Search items" className="max-w-sm" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="flex gap-1">{[["open", "For sale"], ["free", "Free items"], ["all", "All"], ...(userId ? [["mine", "My listings"]] : [])].map(([k, label]) => <Button key={k} size="sm" variant={show === k ? "default" : "outline"} onClick={() => setShow(k ?? "open")}>{label}</Button>)}</div>
    </div>
    {listings.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}
    {listings.isError && <p className="mt-6 text-destructive">Could not load the marketplace.</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((l) => <ListingCard key={l.id} l={l} mine={l.seller_id === userId} onChange={refresh} />)}
    </div>
    {!listings.isLoading && list.length === 0 && <p className="mt-6 text-muted-foreground">No items listed.</p>}
  </main>;
}

function NewListing({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [engine, setEngine] = useState<Engine | null>(null);
  useEffect(() => { loadEngine().then(setEngine); }, []);
  const [search, setSearch] = useState("");
  const [item, setItem] = useState<RoItem | null>(null);
  const [f, setF] = useState({ quantity: "1", price: "", note: "" });
  const [isFree, setIsFree] = useState(false);
  const [busy, setBusy] = useState(false);
  const results = useMemo(() => !engine || search.length < 2 || item ? [] : engine.items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 10), [engine, search, item]);
  async function submit() {
    const name = item ? itemLabel(item) : search.trim();
    const price = isFree ? 0 : Math.round(Number(f.price.replace(/[^\d]/g, "")));
    const quantity = Math.round(Number(f.quantity));
    if (!name) { toast.error("Choose an item"); return; }
    if (!Number.isFinite(price) || (!isFree && (f.price.trim() === "" || price <= 0))) { toast.error("Enter your asking price in zeny"); return; }
    if (!(quantity >= 1 && quantity <= 30000)) { toast.error("Quantity must be 1 to 30,000"); return; }
    setBusy(true);
    const { error } = await supabase.from("market_listings").insert({ seller_id: userId, item_key: item?.key ?? `custom:${name}`, item_name: name, quantity, price, note: f.note.trim() || null });
    setBusy(false);
    if (error) toast.error(error.message); else { toast.success("Listed on the marketplace"); onDone(); }
  }
  return <div className="mt-6 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
    <div className="relative space-y-1 sm:col-span-2"><Label>Item</Label>
      <Input placeholder={engine ? "Search item (e.g. Manteau)" : "Loading item list…"} value={item ? itemLabel(item) : search} onChange={(e) => { setItem(null); setSearch(e.target.value); }} />
      {results.length > 0 && <div className="absolute z-10 mt-1 w-full divide-y divide-border rounded-md border border-border bg-popover shadow-lg">
        {results.map((i) => <button key={i.key} className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => setItem(i)}><span>{itemLabel(i)}</span><span className="text-xs text-muted-foreground">{i.type}</span></button>)}
      </div>}
    </div>
    <div className="space-y-1"><Label>Quantity</Label><Input type="number" min={1} max={30000} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></div>
    <div className="space-y-1">
      <Label>Total price (zeny)</Label>
      <Input inputMode="numeric" disabled={isFree} placeholder={isFree ? "FREE" : "e.g. 250000"} value={isFree ? "" : f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <label className="flex cursor-pointer items-center gap-2 pt-2 text-sm"><input type="checkbox" checked={isFree} onChange={(e) => { setIsFree(e.target.checked); if (e.target.checked) setF((prev) => ({ ...prev, price: "" })); }} /> Give away for free (0 Zeny)</label>
    </div>
    <div className="space-y-1 sm:col-span-4"><Label>Note</Label><Textarea maxLength={500} placeholder="Refine, cards, where to meet…" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
    <div className="sm:col-span-4"><Button disabled={busy} onClick={submit}>List item{isFree ? " for FREE" : f.price && Number.isFinite(+f.price.replace(/[^\d]/g, "")) ? ` for ${formatZeny(+f.price.replace(/[^\d]/g, ""))}` : ""}</Button></div>
  </div>;
}
