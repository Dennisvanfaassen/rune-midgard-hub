import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
export const Route = createFileRoute("/calculator")({ component: RetiredBuilder });
function RetiredBuilder() {
  const { userId } = useAuth();
  return <main className="mx-auto max-w-3xl space-y-4 px-4 py-12">
    <h1 className="text-3xl font-bold">Stat Calculator moved to Xynklon</h1>
    <p className="text-muted-foreground">The website now uses the SoulBound Xynklon stat and skill builder. Copy a share link there and save it on your guild member profile.</p>
    <a className="inline-block rounded bg-primary px-4 py-2 font-semibold text-primary-foreground" href="https://soulbound.xynklon.workers.dev/" target="_blank" rel="noopener noreferrer">Open Xynklon builder ↗</a>
    <p>{userId ? <Link className="text-primary underline" to="/members/$id" params={{ id: userId }}>Go to my profile</Link> : <Link className="text-primary underline" to="/auth">Sign in to save a build link</Link>}</p>
  </main>;
}
