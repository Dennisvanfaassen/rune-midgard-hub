import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGuildBadges() {
  return useQuery({
    queryKey: ["guild-member-roles"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("guild_member_roles").select("user_id,role");
      if (error) return {} as Record<string,string>;
      return Object.fromEntries((data ?? []).map((r) => [r.user_id, r.role])) as Record<string,string>;
    },
  });
}
export function GuildBadge({ role }: { role?: string | null | undefined }) {
  if (role !== "Admin" && role !== "Officer") return null;
  return <span title={role === "Admin" ? "Rune Midgard administrator" : "Rune Midgard officer"}
    className={role === "Admin"
      ? "inline-flex shrink-0 items-center rounded-full border border-amber-400/60 bg-amber-400/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-amber-500"
      : "inline-flex shrink-0 items-center rounded-full border border-sky-400/60 bg-sky-400/15 px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide text-sky-500"}>
    {role}
  </span>;
}
