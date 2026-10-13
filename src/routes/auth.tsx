import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in · Rune Midgard" },
      { name: "description", content: "Sign in or join the Rune Midgard guild website." },
      { property: "og:title", content: "Sign in · Rune Midgard" },
      { property: "og:description", content: "Sign in or join the Rune Midgard guild website." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  name: z.string().trim().max(40).optional(),
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const { userId } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (userId) navigate({ to: "/members/$id", params: { id: userId } }); }, [userId, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = schema.safeParse({ email, password, name: name || undefined });
    if (!p.success) return toast.error(p.error.issues[0].message);
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin, data: { display_name: name } } });
      if (error) toast.error(error.message); else toast.success("Check your email to confirm your account.");
    }
    setBusy(false);
  }
  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-bold">{mode === "in" ? "Welcome back" : "Join the guild"}</h1>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-6">
        {mode === "up" && <div className="space-y-1"><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></div>}
        <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1"><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" disabled={busy}>{mode === "in" ? "Sign in" : "Create account"}</Button>
        <Button type="button" variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
      </form>
      <button className="mt-4 text-sm text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>
        {mode === "in" ? "New here? Create an account" : "Already a member? Sign in"}
      </button>
    </main>
  );
}
