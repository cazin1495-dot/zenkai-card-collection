import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/auth";
import { betaCountdown, betaEnded, claimBetaAccess, hasBetaAccess, wipeBetaProgress } from "@/lib/beta";

export function BetaGate({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const client = useQueryClient();
  const [effectiveNow, setNow] = useState<number | null>(() => Date.now());
  const [access, setAccess] = useState(() => { try { return hasBetaAccess(); } catch { return false; } });
  const [creator, setCreator] = useState(() => {
    try {
      const host = window.location.hostname;
      if (host.includes("localhost") || host.includes("127.0.0.1") || host.includes("github.dev") || host.includes("id-preview--")) return true;
      return localStorage.getItem("zenkai_creator_bypass") === "1";
    } catch {
      return false;
    }
  });
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [closed, setClosed] = useState(false);
  const [retry, setRetry] = useState(0);
  const clicks = useRef(0);
  const expired = effectiveNow !== null && betaEnded(effectiveNow);

  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      try { setAccess(hasBetaAccess()); }
      catch { setError("Stockage local indisponible. Autorise son utilisation et réessaie."); }
    };
    refresh();
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  useEffect(() => {
    if (!expired || !ready || creator) return;
    let active = true;
    setClosed(false);
    async function closeBeta() {
      try {
        wipeBetaProgress();
        await client.cancelQueries();
        client.clear();
        if (session) {
          const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
          if (signOutError) throw signOutError;
        }
        if (active) { setError(""); setClosed(true); }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? `Clôture locale impossible : ${reason.message}` : "Clôture locale impossible. Réessaie.");
      }
    }
    void closeBeta();
    return () => { active = false; };
  }, [expired, ready, creator, session, client, retry]);

  function unlockCreator() {
    try { localStorage.setItem("zenkai_acces_createur", "1"); } catch {}
    setClosed(false);
    try { localStorage.setItem("zenkai_creator_bypass", "1"); } catch {}
    setClosed(false);
    clicks.current++;
    if (clicks.current >= 5) { setCreator(true); setError(""); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      claimBetaAccess(code);
      setAccess(true);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Accès bêta indisponible.");
    }
  }

  async function google() {
    setGoogleLoading(true);
    try {
      const { error: signInError } = await signInWithGoogle();
      if (signInError) throw signInError;
    } catch (reason) {
      setError(reason instanceof Error ? `Connexion Google impossible : ${reason.message}` : "Connexion Google impossible. Réessaie.");
    } finally { setGoogleLoading(false); }
  }

  if (effectiveNow === null) return <p className="p-6 text-center">Chargement de la bêta…</p>;

  if (!creator && expired) return (
    <div className="grid min-h-screen place-items-center px-4 py-8 text-center">
      <div className="max-w-xl rounded-3xl border border-amber-400/40 bg-gradient-to-br from-violet-950 to-black p-6 sm:p-10">
        <button type="button" onClick={unlockCreator} className="font-display text-3xl font-black text-amber-300">ZENKAI</button>
        {closed ? <p className="mt-6">La Bêta Test d'une semaine est terminée ! Les données locales de test de cet appareil ont été remises à zéro. Rendez-vous très bientôt pour le lancement officiel de Zenkai !</p>
          : <p className="mt-6">{error ? "La clôture locale n'a pas pu être terminée." : "Clôture de la bêta et nettoyage local en cours…"}</p>}
        <p className="mt-4 text-sm text-amber-200">La remise à zéro des données des comptes en ligne reste à effectuer côté serveur.</p>
        {error && <><p role="alert" className="mt-4 text-sm text-destructive">{error}</p><Button className="mt-3" onClick={() => setRetry((value) => value + 1)}>Réessayer</Button></>}
      </div>
    </div>
  );

  const warning = "Connexion Google disponible pendant la Bêta Test. Attention : les cartes, Zen, niveaux et progrès de test sont destinés à être remis à zéro à la sortie officielle. La remise à zéro des comptes en ligne reste à configurer.";
  return <>
    <div className="border-b border-amber-400/40 bg-gradient-to-r from-violet-950 via-amber-950 to-violet-950 px-3 py-2 text-center text-xs font-bold text-amber-200 sm:text-sm">
      {expired ? "✦ BÊTA TERMINÉE · ACCÈS LOCAL CRÉATEUR ✦" : `✦ BÊTA TEST (1 SEMAINE) · FIN DANS : ${betaCountdown(effectiveNow)} · Les progrès de la Bêta seront réinitialisés à la sortie officielle ✦`}
      <p className="mt-1 text-[10px] font-normal text-amber-100 sm:text-xs">{warning}</p>
    </div>
    {access || creator ? children : (
      <div className="grid min-h-[70dvh] place-items-center px-4 py-8 transform-gpu will-change-transform">
        <div className="w-full max-w-md rounded-3xl border border-amber-400/40 bg-[#120d24] p-6 text-center shadow-lg transform-gpu sm:p-8">
          <button type="button" onClick={unlockCreator} className="font-display text-3xl font-black text-amber-300">ZENKAI</button>
          <h1 className="mt-5 text-xl font-bold">Bêta Test Ouverte · 1 semaine</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entre ton code d'accès pour commencer.</p>
          <form onSubmit={submit} className="mt-5 grid gap-3">
            <label htmlFor="beta-code" className="text-left text-sm font-semibold">Code d'accès bêta</label>
            <Input id="beta-code" autoComplete="off" value={code} onChange={(event) => setCode(event.target.value)} />
            <Button type="submit" variant="hero" className="min-h-11">Accéder à la bêta</Button>
          </form>
          {session ? <p className="mt-4 text-sm text-amber-200">Compte connecté</p> : <Button type="button" variant="glass" className="mt-4 min-h-11 w-full" disabled={googleLoading} onClick={google}>{googleLoading ? "Connexion…" : "Continuer avec Google"}</Button>}
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          <p className="mt-5 text-xs text-muted-foreground">{warning}</p>
        </div>
      </div>
    )}
  </>;
}
