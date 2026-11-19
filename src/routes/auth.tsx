import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Zenkai" },
      { name: "description", content: "Connecte-toi ou crée ton compte Zenkai pour garder ta collection de cartes." },
      { property: "og:title", content: "Connexion — Zenkai" },
      { property: "og:description", content: "Connecte-toi ou crée ton compte Zenkai pour garder ta collection de cartes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
  );
}

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/", replace: true });
  }, [session, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("E-mail ou mot de passe incorrect.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { username: username.trim() } },
      });
      if (error) toast.error(error.message);
      else if (!data.session) setSent(true);
    }
    setLoading(false);
  }

  async function social(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (result.error) toast.error("La connexion a échoué. Réessaie.");
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-14">
      <div className="rounded-3xl border border-border bg-surface/70 p-6 shadow-glow backdrop-blur sm:p-8">
        <h1 className="text-2xl font-black">{mode === "signin" ? "Bon retour !" : "Rejoins Zenkai"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin" ? "Connecte-toi pour ouvrir tes boosters." : "Crée ton compte et commence ta collection."}
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-border bg-background/60 p-4 text-sm">
            Vérifie ta boîte mail : clique sur le lien reçu pour confirmer ton compte, puis reviens ici.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-2">
              <Button type="button" variant="glass" onClick={() => social("google")}>
                <GoogleLogo /> Continuer avec Google
              </Button>
              <Button type="button" variant="glass" onClick={() => social("lovable")}>
                <LovableMark /> Continuer avec Lovable
              </Button>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={onSubmit} className="grid gap-4">
              {mode === "signup" && (
                <div className="grid gap-1.5">
                  <Label htmlFor="username">Pseudo</Label>
                  <Input id="username" required maxLength={24} value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" variant="hero" size="lg" className="rounded-full" disabled={loading}>
                {mode === "signin" ? "Se connecter" : "Créer mon compte"}
              </Button>
            </form>
          </>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Pas encore de compte ?" : "Déjà inscrit ?"}{" "}
          <button
            type="button"
            className={cn("font-semibold text-primary hover:underline")}
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setSent(false);
            }}
          >
            {mode === "signin" ? "Créer un compte" : "Se connecter"}
          </button>
        </p>
      </div>
    </div>
  );
}
