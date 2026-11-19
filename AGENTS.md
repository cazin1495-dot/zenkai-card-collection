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
- Card metadata (incl. AniList portrait URL, genre, saga, role, quote) lives in `public.cards`; it was imported once from the AniList GraphQL API. Legacy fictional cards are kept with `active=false`. Transcendance is a per-copy state on `user_cards`, not a card rarity. Client rule constants in `src/lib/cards.ts` mirror the SQL and are covered by tests.
- Rarity colors are semantic tokens (`--rarity-*`) with matching `glow-*` utilities in `src/styles.css`; components pick them via the `RARITY` map.
