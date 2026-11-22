import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut, Zap, Coins, Package, Layers, Sparkles, Repeat2, ShoppingBag, Store, Users, Menu, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/auth";
import { cardsQuery, profileQuery } from "@/lib/queries";
import { gameQuery } from "@/lib/game";
import { boosterStock } from "@/lib/cards";
import { getGuestBalance } from "@/lib/guest-collection";
import { useZenkaiPlus } from "@/hooks/use-zenkai-plus";
import { PlusAvatar, PlusBadge, ZenkaiPlus } from "@/components/ZenkaiPlus";
import { plusAvatarImage } from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { useMissionData } from "@/components/MissionsPanel";
import { LocalLevel } from "@/components/LocalLevel";
import { PlayerProfileDialog } from "@/components/PlayerProfile";
import { availableQuestCount } from "@/lib/quests";

const tabs = [
  { to: "/", label: "Boosters", icon: Layers },
  { to: "/collection", label: "Ma Collection", icon: Package },
  { to: "/eveil", label: "Missions", icon: Sparkles },
  { to: "/echanges", label: "Échanges", icon: Repeat2 },
  { to: "/boutique", label: "Boutique", icon: ShoppingBag },
  { to: "/market", label: "Marché", icon: Store },
  { to: "/friends", label: "Amis", icon: Users },
] as const;

export function SiteHeader() {
  const { session, guest, leaveGuestMode } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useQuery({ ...profileQuery(session?.user.id ?? ""), enabled: !!session });
  const cards = useQuery(cardsQuery);
  const game = useQuery({ ...gameQuery(session?.user.id ?? ""), enabled: !!session });
  const plus = useZenkaiPlus();
  const missions = useMissionData(session?.user.id ?? null);
  const localMissions = useMissionData(null, !!session);
  const readyMissions = missions.ready + (session && localMissions.state ? availableQuestCount(localMissions.state) : 0) + (missions.daily && !missions.daily.claimed ? 1 : 0);
  const [now, setNow] = useState<number | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestZen, setGuestZen] = useState<number | null>(null);
  const [guestZenError, setGuestZenError] = useState(false);
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  const closeMobileMenu = () => { if (mobileMenu.current) mobileMenu.current.open = false; };
  useEffect(() => { setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const celebrate = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const { from, to } = event.detail;
      for (let level = from + 1; level <= to; level++) toast.success(`Niveau ${level} atteint ! +100 Zen offerts ★`);
    };
    window.addEventListener("zenkai:level-up", celebrate);
    return () => window.removeEventListener("zenkai:level-up", celebrate);
  }, []);
  useEffect(() => {
    const refresh = () => {
      try {
        setGuestZen(getGuestBalance());
        setGuestZenError(false);
      } catch {
        setGuestZen(null);
        setGuestZenError(true);
      }
    };
    refresh();
    window.addEventListener("zenkai:guest-updated", refresh);
    window.addEventListener("zenkai:zen-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("zenkai:guest-updated", refresh);
      window.removeEventListener("zenkai:zen-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const stock = profile.data && now !== null ? boosterStock(profile.data.boosters_stored, profile.data.stock_updated_at, now).count : null;
  const avatar = cards.data?.find(card => card.id === "al-246")?.image_url;
  const plusActive = plus.state?.active === true && !plus.error;
  const plusAvatar = plusAvatarImage(plus.state?.avatar, cards.data ?? []);
  async function signInGoogle() {
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) toast.error(`Connexion Google impossible : ${error.message}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `Connexion Google impossible : ${error.message}`
          : "Connexion Google impossible. Réessaie.",
      );
    } finally {
      setGoogleLoading(false);
    }
  }
  async function signOut() {
    await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  }
  return <><header className="game-header sticky top-0 z-40 border-b border-border backdrop-blur-xl">
    <div className="game-header-inner mx-auto grid max-w-[100vw] grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-3 py-3 sm:px-4 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:gap-x-4 xl:px-8 xl:py-4">
      <Link to="/" data-secret-logo aria-label="ZENKAI — Accueil et Boosters" className="game-logo flex min-w-0 items-center gap-2">
        <span className="game-logo-mark grid size-9 shrink-0 place-items-center"><Zap className="size-6" /></span>
        <span className="min-w-0"><span className="block font-display text-xl font-black italic sm:text-2xl">ZENKAI</span><span className="hidden text-[8px] font-semibold text-muted-foreground sm:block">ANIME CARD COLLECTION</span></span>
      </Link>
      <nav aria-label="Navigation principale" className="game-nav col-span-2 row-start-2 hidden min-w-0 flex-wrap justify-center gap-1 md:flex xl:col-span-1 xl:col-start-2 xl:row-start-1 xl:mx-auto xl:gap-2">
        {tabs.map(tab => <Button key={tab.to} variant="ghost" asChild className="game-nav-item h-auto min-w-0 flex-1 basis-24 rounded-md px-0.5 py-2 sm:px-1 xl:basis-20 xl:px-2"><Link to={tab.to} activeOptions={{ exact: true }} activeProps={{ className: "game-nav-active" }}><tab.icon className="size-4 shrink-0" /><span className={cn("min-w-0 text-center text-[9px] leading-tight sm:text-xs", tab.to === "/friends" && "whitespace-nowrap")}>{tab.label}{tab.to === "/boutique" && <span className="mx-auto mt-0.5 block w-fit rounded border border-amber-400/30 bg-amber-400/10 px-1 text-[8px] font-semibold leading-tight text-amber-300">Bientôt</span>}</span>{tab.to === "/eveil" && readyMissions > 0 && <span aria-label={`${readyMissions} récompense${readyMissions > 1 ? "s" : ""} disponible${readyMissions > 1 ? "s" : ""}`} className="rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-black">{readyMissions}</span>}</Link></Button>)}
      </nav>
      <div className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center justify-end gap-2 xl:col-start-3">
        <div className="hidden items-center gap-2 md:flex"><ZenkaiPlus cards={cards.data ?? []} /><PlayerProfileDialog /></div>
        <span className="whitespace-nowrap text-[10px] text-amber-400" role={guestZenError ? "alert" : undefined}>{guestZenError ? "Zen locaux indisponibles" : guestZen === null ? "…" : `${guestZen.toLocaleString("fr-FR")} Zen (local)`}</span>
        <div className="md:hidden"><LocalLevel compact /></div>
        <details ref={mobileMenu} className="relative md:hidden">
          <summary aria-label="Plus de navigation" className="grid min-h-11 min-w-11 cursor-pointer list-none place-items-center rounded-md border border-border"><Menu className="size-5" /></summary>
          <div className="absolute right-0 top-full z-50 mt-2 flex w-48 flex-col gap-1 rounded-xl border border-border bg-background p-2 shadow-xl">
            {tabs.filter((tab) => tab.to === "/echanges" || tab.to === "/boutique" || tab.to === "/friends").map((tab) => (
              <Link key={tab.to} to={tab.to} onClick={closeMobileMenu} className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm"><tab.icon className="size-4" />{tab.label}{tab.to === "/boutique" && <span className="text-xs text-amber-300">Bientôt</span>}</Link>
            ))}
            <ZenkaiPlus cards={cards.data ?? []} />
            {session ? <Button variant="ghost" onClick={signOut}>Se déconnecter</Button> : guest ? <>
              <Button variant="ghost" className="min-h-11" disabled={googleLoading} onClick={signInGoogle}>{googleLoading ? "Connexion…" : "Connexion Google"}</Button>
              <Link to="/auth" onClick={closeMobileMenu} className="flex min-h-11 items-center px-2 text-sm">Connexion</Link>
              <Button variant="ghost" onClick={leaveGuestMode}>Quitter le mode invité</Button>
            </> : <><Button variant="ghost" className="min-h-11" disabled={googleLoading} onClick={signInGoogle}>{googleLoading ? "Connexion…" : "Connexion Google"}</Button><Link to="/auth" onClick={closeMobileMenu} className="flex min-h-11 items-center px-2 text-sm">E-mail</Link></>}
          </div>
        </details>
        <div className="hidden md:block">{session ? <div aria-label="Profil joueur" className="player-panel grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-border bg-foreground/5 p-2">
          {plusActive ? <PlusAvatar image={plusAvatar ?? avatar} name="Ton avatar" active /> : avatar ? <img src={avatar} alt="Avatar Son Goku" className="size-9 shrink-0 rounded-md object-cover sm:size-10" /> : <Zap className="size-8 text-rarity-legendaire" />}
          <div className="min-w-0"><p className="max-w-28 truncate text-[11px] font-semibold">{profile.data?.username ?? "Joueur"}</p>{plusActive && <PlusBadge />}<LocalLevel compact /><div className="player-metrics mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-muted-foreground"><span title="Zenkai Coins" className="flex items-center gap-1 whitespace-nowrap"><Coins className="size-3 text-rarity-legendaire" /> {game.data?.coins ?? "…"}</span><span aria-label="Boosters disponibles" className="flex items-center gap-1 text-accent"><Package className="size-3" />{stock === null ? "…" : stock + (game.data?.bonus_boosters ?? 0)}</span></div></div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Se déconnecter" title="Se déconnecter" className="size-7"><LogOut className="size-3.5" /></Button>
        </div> : guest ? (
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
            {plusActive && <PlusAvatar image={plusAvatar} name="Ton avatar" active />}
            <span className="rounded-md border border-border bg-foreground/5 px-2 py-1.5 text-[10px] font-semibold sm:text-xs">
              Invité local
            </span>
            {plusActive && <PlusBadge />}
            <LocalLevel compact />
            <Button variant="ghost" size="sm" disabled={googleLoading} onClick={signInGoogle} className="px-2 text-[10px] sm:text-xs">
              {googleLoading ? "Connexion…" : "Connexion Google"}
            </Button>
            <Link
              to="/auth"
              className="px-1 text-[10px] text-muted-foreground hover:text-foreground sm:text-xs"
            >
              Connexion
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={leaveGuestMode}
              aria-label="Quitter le mode invité"
              title="Quitter le mode invité"
              className="size-7"
            >
              <LogOut className="size-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            <LocalLevel compact />
            <Button
              variant="glass"
              size="sm"
              disabled={googleLoading}
              onClick={signInGoogle}
              className="px-2 text-[10px] sm:text-xs"
            >
              {googleLoading ? "Connexion…" : "Connexion Google"}
            </Button>
            <Button variant="ghost" size="sm" asChild className="px-2 text-[10px] sm:text-xs">
              <Link to="/auth">E-mail</Link>
            </Button>
          </div>
        )}</div>
      </div>
    </div>
  </header>
  <nav aria-label="Navigation mobile" onClick={closeMobileMenu} className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur-xl md:hidden">
    {tabs.filter((tab) => tab.to === "/" || tab.to === "/collection" || tab.to === "/market" || tab.to === "/eveil").sort((a, b) => ["/", "/collection", "/market", "/eveil"].indexOf(a.to) - ["/", "/collection", "/market", "/eveil"].indexOf(b.to)).map((tab) => (
      <Link key={tab.to} to={tab.to} activeOptions={{ exact: true }} activeProps={{ className: "text-amber-300" }} className="relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground">
        <tab.icon className="size-5" />
        <span>{tab.to === "/collection" ? "Collection" : tab.label}</span>
        {tab.to === "/eveil" && readyMissions > 0 && <span aria-label={`${readyMissions} récompense${readyMissions > 1 ? "s" : ""} disponible${readyMissions > 1 ? "s" : ""}`} className="absolute right-1 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-black">{readyMissions}</span>}
      </Link>
    ))}
    <PlayerProfileDialog trigger={<button type="button" className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground"><UserRound className="size-5" />Profil</button>} />
  </nav></>;
}
