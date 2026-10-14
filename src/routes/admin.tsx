import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Guild administration · Rune Midgard" }] }),
  component: AdminPanel,
});
type Role = "Admin" | "Officer" | "Guildmember";
function AdminPanel() {
  const { userId, ready } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const access = useQuery({
    queryKey: ["guild-my-role", userId], enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("guild_my_role");
      if (error) throw error;
      return data as Role;
    },
  });
  const members = useQuery({
    queryKey: ["admin-members"],
    enabled: access.data === "Admin",
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id,display_name,char_name,job,created_at").order("display_name"),
        supabase.from("guild_member_roles").select("user_id,role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      return (profiles.data ?? []).map((profile) => ({
        ...profile,
        role: ((roles.data ?? []).find((r) => r.user_id === profile.id)?.role ?? "Guildmember") as Role,
      }));
    },
  });
  async function updateRole(id: string, role: "Officer" | "Guildmember") {
    setBusy(id);
    const { error } = await supabase.rpc("guild_set_role", { target_user: id, new_role: role });
    setBusy(null);
    if (error) toast.error(error.message);
    else { toast.success("Guild role updated"); qc.invalidateQueries({ queryKey: ["admin-members"] }); qc.invalidateQueries({ queryKey: ["guild-member-roles"] }); }
  }
  async function removeMember(id: string, name: string) {
    const confirmation = window.prompt(`Permanently delete ${name}'s account and revoke their login? This cannot be undone. Type DELETE to confirm.`);
    if (confirmation !== "DELETE") return;
    setBusy(id);
    const { error } = await supabase.rpc("guild_delete_member", { target_user: id });
    setBusy(null);
    if (error) toast.error(`Deletion failed: ${error.message}`);
    else {
      toast.success("Account deleted");
      qc.invalidateQueries({ queryKey: ["admin-members"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    }
  }
  if (!ready || (userId && access.isLoading)) return <main className="mx-auto max-w-5xl px-4 py-10">Checking administrator access…</main>;
  if (!userId) return <main className="mx-auto max-w-5xl px-4 py-10">Please <Link to="/auth" className="text-primary underline">sign in</Link>.</main>;
  if (access.isError) return <main className="mx-auto max-w-5xl px-4 py-10 text-destructive">Administrator setup unavailable. Apply the guild roles SQL migration first.</main>;
  if (access.data !== "Admin") return <main className="mx-auto max-w-5xl px-4 py-10"><h1 className="text-2xl font-bold">Access denied</h1><p className="mt-2 text-muted-foreground">Only the guild administrator can manage members.</p></main>;
  const filtered = (members.data ?? []).filter((p) => `${p.display_name} ${p.char_name || ""}`.toLowerCase().includes(q.toLowerCase()));
  return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10">
    <div><h1 className="text-4xl font-bold">Guild administration</h1><p className="mt-2 text-muted-foreground">Manage website member roles and accounts. Only administrators have access.</p></div>
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Members ({members.data?.length ?? 0})</h2><Input aria-label="Search guild members" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search members…" /></div>
      {members.isLoading && <p className="mt-4 text-muted-foreground">Loading members…</p>}
      {members.isError && <p className="mt-4 text-destructive">Could not load guild members. Check the SQL migration and permissions.</p>}
      <div className="mt-5 space-y-2">{filtered.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
        <div className="min-w-40 flex-1"><Link to="/members/$id" params={{ id: member.id }} className="font-semibold text-primary hover:underline">{member.char_name || member.display_name}</Link><p className="text-xs text-muted-foreground">{member.display_name} · {member.job}</p></div>
        {member.id === userId || member.role === "Admin" ?
          <span className="rounded-md border border-primary/40 px-3 py-2 text-sm font-semibold">{member.role}</span> :
          <select aria-label={`Role for ${member.display_name}`} disabled={busy === member.id} className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={member.role} onChange={(e) => updateRole(member.id, e.target.value as "Officer" | "Guildmember")}>
            <option value="Guildmember">Guildmember</option><option value="Officer">Officer</option>
          </select>}
        {member.id !== userId && member.role !== "Admin" && <Button size="sm" variant="destructive" disabled={busy === member.id} onClick={() => removeMember(member.id, member.char_name || member.display_name)}>Delete member</Button>}
      </div>)}</div>
    </section>
  </main>;
}
