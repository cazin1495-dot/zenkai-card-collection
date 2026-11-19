import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { to: "/", label: "Boosters" },
  { to: "/collection", label: "Ma Collection" },
  { to: "/echanges", label: "Échanges" },
] as const;

export function SiteHeader() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="size-4 text-primary-foreground" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">ZENKAI</span>
        </Link>

        <nav className="mx-auto flex items-center gap-1 rounded-full border border-border bg-surface/60 p-1">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              activeOptions={{ exact: true }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:px-4 sm:text-sm"
              activeProps={{ className: "bg-gradient-primary !text-primary-foreground shadow-glow" }}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="hidden sm:block">
          {session ? (
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Se déconnecter">
              <LogOut />
              Déconnexion
            </Button>
          ) : (
            <Button variant="glass" size="sm" asChild>
              <Link to="/auth">Connexion</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
