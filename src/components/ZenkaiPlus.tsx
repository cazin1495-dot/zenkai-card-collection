import { useState } from "react";
import { Crown, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useZenkaiPlus } from "@/hooks/use-zenkai-plus";
import { PLUS_AVATARS, plusAvatarImage, setPlus } from "@/lib/subscription";
import type { Card } from "@/lib/cards";

export function PlusBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/50 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-black text-amber-400">
      <Crown className="size-3" /> ZENKAI+
    </span>
  );
}

export function PlusAvatar({
  image,
  name,
  active,
}: {
  image?: string | null | undefined;
  name: string;
  active: boolean;
}) {
  return (
    <span
      className={`relative inline-flex size-10 shrink-0 rounded-full ${active ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-violet-700 shadow-[0_0_15px_rgba(251,191,36,0.55)]" : ""}`}
    >
      {image ? (
        <img src={image} alt={name} className="size-full rounded-full object-cover" />
      ) : (
        <Zap className="size-full rounded-full bg-surface p-2 text-primary" />
      )}
      {active && (
        <Crown
          aria-label="Zenkai+"
          className="absolute -right-1 -top-1 size-4 rounded-full bg-background text-amber-400"
        />
      )}
    </span>
  );
}

export function ZenkaiPlus({ cards = [] }: { cards?: readonly Card[] }) {
  const { session, guest } = useAuth();
  const { state, error } = useZenkaiPlus();
  const [open, setOpen] = useState(false);
  const userId = session?.user.id ?? null;

  function update(update: { active?: boolean; avatar?: string }) {
    try {
      const welcome = setPlus(userId, guest, update);
      if (update.active !== undefined) {
        toast.success(
          welcome > 0
            ? `Zenkai+ test activé · +${welcome} Zen invités.`
            : `Zenkai+ test ${update.active ? "activé" : "désactivé"}.`,
        );
      }
    } catch (reason) {
      toast.error(
        `Zenkai+ indisponible : ${reason instanceof Error ? reason.message : "erreur inconnue"}`,
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="glass"
          className="h-auto shrink-0 rounded-full border-amber-400/60 px-3 py-2 text-xs font-bold text-amber-400"
        >
          <Crown className="size-4" /> Zenkai+
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-primary/40 bg-surface">
        <DialogHeader>
          <DialogTitle className="text-xl text-primary">Zenkai+</DialogTitle>
          <DialogDescription>
            3,99 € / mois · sans engagement. Offre indicative : mode test gratuit, sans paiement ni
            abonnement réel.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Stock de 20 boosters : indisponible dans cette démonstration.</li>
          <li>+300 Zen à la première activation : uniquement pour la collection invitée locale.</li>
          <li>+20 % de Zen au recyclage de la collection locale.</li>
          <li>Badge, cadre et avatars exclusifs : visibles uniquement sur cet appareil.</li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Aucun effet sur le compte connecté, le stock serveur, la régénération ou la pity.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            État Zenkai+ indisponible : vérifie le stockage local.
          </p>
        )}
        {!session && !guest && (
          <p className="text-sm text-muted-foreground">
            Connecte-toi ou utilise le mode invité pour tester.
          </p>
        )}
        <Button
          variant="hero"
          disabled={(!session && !guest) || !state || error}
          onClick={() => update({ active: !state?.active })}
        >
          {state?.active ? "Désactiver Zenkai+" : "Activer Zenkai+ (Mode Test)"}
        </Button>
        <div>
          <h3 className="mb-3 text-sm font-bold">Avatars exclusifs Zenkai+</h3>
          <div className="grid grid-cols-3 gap-3">
            {PLUS_AVATARS.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                disabled={!state?.active || error}
                onClick={() => update({ avatar: avatar.id })}
                aria-pressed={state?.avatar === avatar.id}
                className="rounded-xl border border-border p-2 text-center disabled:opacity-50 aria-pressed:border-primary"
              >
                {plusAvatarImage(avatar.id, cards) ? (
                  <img src={plusAvatarImage(avatar.id, cards)} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ) : (
                  <span className="grid aspect-square w-full place-items-center rounded-lg bg-muted text-xs text-muted-foreground">Portrait indisponible</span>
                )}
                <span className="mt-1 block text-xs">{avatar.name}</span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
