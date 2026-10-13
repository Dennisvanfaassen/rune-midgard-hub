import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import crest from "@/assets/guild-blue-logo.png.asset.json";

const NAV = [
  { to: "/parties", label: "Party Planner" },
  { to: "/members", label: "Members" },
  { to: "/wishlists", label: "Wishlists" },
  { to: "/calculator", label: "Stat Calculator" },
  { to: "/skills", label: "Skill Simulator" },
] as const;

export function SiteHeader() {
  const { userId, ready } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <img src={crest.url} alt="" width={36} height={36} className="h-9 w-9" />
          <span className="font-display text-lg font-bold tracking-wide text-primary">Rune Midgard</span>
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "rounded-md px-3 py-1.5 bg-secondary text-primary" }}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {ready && userId ? (
            <>
              <Button asChild variant="outline" size="sm"><Link to="/members/$id" params={{ id: userId }}>My profile</Link></Button>
              <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
            </>
          ) : ready ? (
            <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
