<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Booster opening runs only through the `public.open_boosters(category, count)` security-definer DB function (stock regen, randomness, inserts); Transcendance attempts only through `public.attempt_transcendance(user_card_id)`. Clients have no insert/update rights on `user_cards`, so rules can't be bypassed.
- Keep pity in a read-only owner-scoped table, locked and advanced per booster inside open_boosters; keep rarity-roll logic in its immutable SQL helper so batch draws, concurrency and tests share the same authoritative rules.
- Card metadata (incl. AniList portrait URL, genre, saga, role, quote) lives in `public.cards`; it was imported once from the AniList GraphQL API. Legacy fictional cards are kept with `active=false`. Transcendance is a per-copy state on `user_cards`, not a card rarity. Client rule constants in `src/lib/cards.ts` mirror the SQL and are covered by tests.
- Rarity colors are semantic tokens (`--rarity-*`) with matching `glow-*` utilities in `src/styles.css`; components pick them via the `RARITY` map.
- Resolve evolved card identity centrally in `cardIdentity`; keep original metadata and per-copy evolution separate so collection and booster views agree.
- Start the original awakening audio unmuted inside the click gesture; reveal evolution only after the quote timeline ends or is explicitly skipped and confirmed RPC success, and refresh collection on close to avoid interrupting playback.
- Drive awakening phrases and their animation progress from audio.currentTime, and finish on the audio ended event; centralize phrase windows in the timeline helper to keep pauses, buffering and seeks synchronized.
- Drive cinematic face alternation from the shared audio timeline over permanently decoded layers; soften rapid-swap contrast and respect reduced motion to avoid strobing while keeping the confirmed result gated by audio completion.
- Keep opening aura colors, maximum-rarity detection and effect tiers in the shared opening helper, independent from card identity and database rarity rules; resolve beam-dependent CSS tokens on the opening wrapper rather than the root.
- Blend black-backed pack art at both image and composited-body levels without parent filters; keep the draw's afterglow outside the pack so it survives tearing, reveals and batch summaries.
- Keep the shared game header tied to the real profile stock; unimplemented currency and level fields remain unavailable, and new hub destinations reuse existing evolution actions rather than inventing game rules.
- Keep interactive holographic tilt in a separate wrapper from the card flip transform so evolved cards share pointer effects without breaking booster reveals.
- Render premium cards full-art with a subtle glass metadata overlay; isolate the masked energy border from the pointer-reactive low-opacity portrait varnish to preserve illustration contrast at rest.
- Keep ornamental TCG framing, engraved foil and collector metadata inside the shared Transcendance card face, with subtle overlays and reduced-motion fallbacks so all views share the physical finish without altering card identity.
- Keep the post-awakening form comparison local to the dialog; switching portraits must never change the persisted per-copy evolution state.
- Keep complete comparison faces permanently mounted and eagerly decoded, with an opaque base under the awakened clip-path layer; synchronize its vertical reveal and scanner beam with identical duration/easing, and lock the sliding selector until the scan finishes to avoid interrupted swaps.
