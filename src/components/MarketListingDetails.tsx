import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatZeny } from "@/lib/forum";

export function MarketListingDetails({ listingId, sellerId, status }: { listingId: string; sellerId: string; status: string }) {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [comment, setComment] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = userId === sellerId;
  const comments = useQuery({
    queryKey: ["market", "comments", listingId],
    queryFn: async () => {
      const { data, error } = await supabase.from("market_comments").select("id,body,created_at,author_id,profiles!market_comments_author_id_fkey(id,display_name,char_name)").eq("listing_id", listingId).order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const offers = useQuery({
    queryKey: ["market", "offers", listingId, userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("market_offers").select("id,amount,message,status,created_at,buyer_id,profiles!market_offers_buyer_id_fkey(id,display_name,char_name)").eq("listing_id", listingId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["market", "comments", listingId] });
    qc.invalidateQueries({ queryKey: ["market", "offers", listingId] });
  };
  async function postComment() {
    if (!userId || !comment.trim() || busy) return;
    setBusy(true);
    const { error } = await supabase.from("market_comments").insert({ listing_id: listingId, author_id: userId, body: comment.trim() });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setComment(""); refresh(); }
  }
  async function sendOffer() {
    if (!userId || mine || status !== "open" || busy) return;
    const zeny = Number(amount.replace(/[.,\s]/g, ""));
    if (!Number.isSafeInteger(zeny) || zeny < 1 || zeny > 1000000000000) { toast.error("Enter a valid zeny amount."); return; }
    setBusy(true);
    const { error } = await supabase.from("market_offers").insert({ listing_id: listingId, buyer_id: userId, amount: zeny, message: message.trim() || null });
    setBusy(false);
    if (error) toast.error(error.message);
    else { setAmount(""); setMessage(""); toast.success("Offer sent to the seller"); refresh(); }
  }
  async function respond(offerId: string, action: "accepted" | "declined") {
    setBusy(true);
    const { error } = await supabase.rpc("market_respond_offer", { p_offer: offerId, p_action: action });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success(action === "accepted" ? "Offer accepted" : "Offer declined"); refresh(); }
  }
  async function withdraw(offerId: string) {
    setBusy(true);
    const { error } = await supabase.rpc("market_withdraw_offer", { p_offer: offerId });
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Offer withdrawn"); refresh(); }
  }
  return <div className="mt-4 space-y-5 border-t border-border pt-4">
    <section>
      <h4 className="font-semibold">Comments</h4>
      <p className="text-xs text-muted-foreground">Public questions and replies about this listing.</p>
      <div className="mt-3 space-y-2">
        {(comments.data ?? []).map((c) => <div key={c.id} className="rounded-md bg-secondary/50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2 text-xs">
            <Link to="/members/$id" params={{ id: c.author_id }} className="font-semibold text-primary">{c.profiles?.char_name || c.profiles?.display_name || "Member"}</Link>
            <span className="text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
          {userId === c.author_id && <Button size="sm" variant="ghost" className="mt-1 h-6 px-0 text-xs text-destructive" onClick={async () => {
            const { error } = await supabase.from("market_comments").delete().eq("id", c.id);
            if (error) toast.error(error.message); else refresh();
          }}>Delete</Button>}
        </div>)}
        {comments.isError && <p className="text-xs text-destructive">Could not load comments. Make sure the marketplace SQL migration has been applied.</p>}
        {!comments.isLoading && !comments.isError && !comments.data?.length && <p className="text-xs text-muted-foreground">No comments yet.</p>}
      </div>
      {userId ? <div className="mt-3 space-y-2">
        <Textarea maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ask a question or leave a comment…" rows={2} />
        <Button size="sm" disabled={busy || !comment.trim()} onClick={postComment}>Post comment</Button>
      </div> : <p className="mt-3 text-xs"><Link to="/auth" className="text-primary underline">Sign in</Link> to comment.</p>}
    </section>
    <section className="border-t border-border pt-4">
      <h4 className="font-semibold">Offers</h4>
      <p className="text-xs text-muted-foreground">Offers are private: only the seller and the person making an offer can see them.</p>
      {userId && !mine && status === "open" && <div className="mt-3 space-y-2">
        <Input aria-label="Offer amount in zeny" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Your offer in zeny" />
        <Textarea maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Optional message to the seller" rows={2} />
        <Button size="sm" disabled={busy || !amount.trim()} onClick={sendOffer}>Submit offer</Button>
      </div>}
      {!userId && <p className="mt-3 text-xs"><Link to="/auth" className="text-primary underline">Sign in</Link> to make an offer.</p>}
      <div className="mt-3 space-y-2">
        {(offers.data ?? []).map((o) => <div key={o.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-primary">{formatZeny(o.amount)}</span>
            <span className="text-xs capitalize text-muted-foreground">{o.status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{mine ? (o.profiles?.char_name || o.profiles?.display_name || "Buyer") : "Your offer"} · {new Date(o.created_at).toLocaleString()}</p>
          {o.message && <p className="mt-2 whitespace-pre-wrap break-words">{o.message}</p>}
          {o.status === "pending" && mine && <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => respond(o.id, "accepted")}>Accept</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => respond(o.id, "declined")}>Decline</Button>
          </div>}
          {o.status === "pending" && !mine && <Button size="sm" variant="outline" disabled={busy} className="mt-2" onClick={() => withdraw(o.id)}>Withdraw</Button>}
        </div>)}
        {offers.isError && <p className="text-xs text-destructive">Could not load offers. Apply the marketplace SQL migration first.</p>}
        {userId && !offers.isLoading && !offers.isError && !offers.data?.length && <p className="text-xs text-muted-foreground">{mine ? "No offers yet." : "You haven't made an offer."}</p>}
      </div>
    </section>
  </div>;
}
