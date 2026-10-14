import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Posts a summary of a newly planned party to the guild's Discord #party-planner webhook. */
export const announceParty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ partyId: z.string().uuid(), origin: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    const webhook = process.env["DISCORD_PARTY_WEBHOOK_URL"]?.trim();
    if (!webhook) { console.error("Discord announce: webhook not configured"); return { sent: false, reason: "not_configured" }; }
    if (!/^https:\/\/((ptb|canary)\.)?(discord|discordapp)\.com\/api\/webhooks\//.test(webhook)) { console.error("Discord announce: webhook link not recognised"); return { sent: false, reason: "bad_link" }; }
    const { data: p, error: partyError } = await context.supabase.from("parties")
      .select("id,title,place,notes,starts_at,creator_id")
      .eq("id", data.partyId).maybeSingle();
    if (partyError) { console.error("Discord announce: party lookup failed", partyError); return { sent: false, reason: "lookup_error" }; }
    if (!p) { console.error("Discord announce: party not found or hidden by RLS", data.partyId); return { sent: false, reason: "not_found" }; }
    if (p.creator_id !== context.userId) { console.error("Discord announce: user mismatch", data.partyId); return { sent: false, reason: "not_allowed" }; }
    const [slotResult, organiserResult] = await Promise.all([
      context.supabase.from("party_slots").select("position,role,user_id").eq("party_id", p.id),
      context.supabase.from("profiles").select("display_name,char_name").eq("id", context.userId).maybeSingle(),
    ]);
    if (slotResult.error) { console.error("Discord announce: slots lookup failed", slotResult.error); return { sent: false, reason: "lookup_error" }; }
    const partySlots = slotResult.data ?? [];
    const organiser = organiserResult.data;
    const ts = Math.floor(new Date(p.starts_at).getTime() / 1000);
    const slots = [...partySlots].sort((a, b) => a.position - b.position);
    const roles = slots.map((s, i) => `\`${String(i + 1).padStart(2, " ")}\` ${s.role === "Any" ? "Any class" : s.role === "Supernovice" ? "Super Novice" : s.role}`).join("\n");
    const url = `${new URL(data.origin).origin}/parties/${p.id}`;
    const embed = {
      title: `⚔️ ${p.title}`.slice(0, 256),
      url,
      color: 0x3b82f6,
      description: (p.notes ?? "").slice(0, 1000) || undefined,
      fields: [
        { name: "🕒 When", value: `<t:${ts}:F>\n<t:${ts}:R>`, inline: true },
        { name: "📍 Where", value: p.place.slice(0, 200), inline: true },
        { name: "👑 Organiser", value: (organiser?.char_name || organiser?.display_name || "Guildmate").slice(0, 100), inline: true },
        { name: `🧩 Slots (${slots.length}/12)`, value: roles.slice(0, 1000) || "Open" },
        { name: "Join", value: `[Sign up on the Rune Midgard site](${url})` },
      ],
      footer: { text: "Rune Midgard Party Planner" },
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "Rune Midgard", embeds: [embed], allowed_mentions: { parse: [] } }) });
    if (!res.ok) { console.error(`Discord webhook failed [${res.status}]: ${await res.text()}`); return { sent: false, reason: "discord_error", status: res.status }; }
    return { sent: true };
  });

export const DISCORD_REASON: Record<string, string> = {
  not_configured: "Discord link is not set up yet",
  bad_link: "The saved Discord link isn't a webhook link",
  not_allowed: "Only the organiser can post this party",
  not_found: "Party is missing or unavailable to the Discord service",
  lookup_error: "Could not read the saved party from the database",
  discord_error: "Discord refused the message",
};
