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
    const { data: p } = await context.supabase.from("parties")
      .select("id,title,place,notes,starts_at,creator_id,profiles(display_name,char_name),party_slots(position,role,user_id)")
      .eq("id", data.partyId).maybeSingle();
    if (!p || p.creator_id !== context.userId) { console.error("Discord announce: party not found or not creator", data.partyId); return { sent: false, reason: "not_allowed" }; }
    const ts = Math.floor(new Date(p.starts_at).getTime() / 1000);
    const slots = [...p.party_slots].sort((a, b) => a.position - b.position);
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
        { name: "👑 Organiser", value: (p.profiles?.char_name || p.profiles?.display_name || "Guildmate").slice(0, 100), inline: true },
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
  discord_error: "Discord refused the message",
};
