# Handover: paseo-coordinator-ui

Written 2026-10-29 on the workstation `faedev` (GCP host fae-eng-dev, user `oliver_getfae_com`) by a
Claude Code session that built this plugin from nothing. Delete this file before publishing the repo.

## What this is

A Paseo plugin (SDK `@getpaseo/plugin` 0.12.0) that gives [paseo-coordinator](https://github.com/opsb/paseo-coordinator)
a screen: a **Coordinator** sidebar row with a count of waiting cards, and a deck that shows one
inbox card at a time with its replies as buttons, a line for your own words, and a Chat button to
the coordinator session. `README.md` describes the behaviour and the file layout; `OVERVIEW.md` is
the registry blurb. Read both first.

## Where it is

- Repo: `faedev:~/Projects/paseo-coordinator-ui`, branch `main`, two commits, clean tree, **no remote**.
  Fetch it with `git clone faedev:Projects/paseo-coordinator-ui` (or rsync the directory; it has no
  build step). `node_modules/` is ignored; `npm install` on the Mac needs a lockfile seeded from a
  sibling plugin (see Gotchas).
- Installed in the workstation's Paseo daemon as a directory plugin (`paseo plugin ls` on faedev
  shows `paseo-coordinator-ui running`). That daemon has no coordinator, so the screen there shows the
  empty state. Remove with `paseo plugin remove paseo-coordinator-ui` on faedev when no longer wanted.
- Sibling plugin for conventions and SDK types: `faedev:~/Projects/paseo-at-a-glance`
  (`node_modules/@getpaseo/{plugin,client,protocol}/dist/*.d.ts` are the only API docs).
- The coordinator's scripts, which define the inbox format the plugin reads and writes:
  https://github.com/opsb/paseo-coordinator, `skills/coordinator/inbox.sh`, `tick.sh`, `SKILL.md`.

## State of the work

Done and verified (`npm test`: 34 tests; `npm run typecheck`: clean; `paseo plugin logs`: "Plugin ready"):

- Sidebar row + badge, screen, command-centre entry (`index.client.tsx`, `client/sidebar-item.tsx`).
- Deck with Previous/Next, position dots, one card per slide (`client/deck-screen.tsx`, `client/card-view.tsx`).
- Replies: Decide y/n, Do done, Accept y/n, Park, Skip, Remind <when>, own words, Refresher/More
  (send then open chat), Open session, Chat (`shared/reply.ts`).
- A press hides the card at once; the reply goes to the coordinator session as a chat message with
  `activeTurnBehavior: "steer"`; then `coordinator.card.close` ticks the line off in `inbox.md`
  under the scripts' `<inbox>.lock` (`server/close.ts`). Failed send brings the card back.
- Daemon side reads `~/.local/state/coordinator/<scope>/inbox.md` + `reports/<session>.json`,
  watches them, long-polls to the client, enriches from Paseo agents/workspaces
  (`server/state.ts`, `server/sessions.ts`, `index.server.ts`).

**Never seen in a browser.** No browser automation host was connected to the workstation session and
the sandbox refused to seed `~/.local/state/coordinator` there, so the screen has only been
typechecked. First job on the Mac: install it against the daemon that runs the coordinator and look.

## Next steps, in order

1. On the Mac: `paseo plugin install ~/Projects/paseo-coordinator-ui` (after fetching), open Paseo,
   press the Coordinator row. Fix layout and anything the RN host rejects. Check compact (phone)
   layout too; `layout.compact` drives padding and the Chat button hint.
2. Answer a real card and confirm: the card vanishes at once, the inbox line flips to `[x]`
   (`~/.local/state/coordinator/<scope>/inbox.md`), the coordinator relays the reply and does not
   choke on the `[card reply]` message. Message shape:
   ```
   [card reply] 🔑 Stream · session <id> · card <key> (already ticked off in the inbox)
   Asked: <the ask>
   Reply: y
   ```
3. Add one line to paseo-coordinator's `SKILL.md` step 5 so the coordinator knows a `[card reply]`
   message names its card, is already ticked off, and needs only the relay. Not done; that repo was
   not touched.
4. Keyboard shortcuts on web (y / n / arrows) are not wired. Nice to have.
5. Publish: `gh repo create opsb/paseo-coordinator-ui --public --source=. --push`, then a
   `registry/paseo-coordinator-ui.json` PR to paseo-cafe. Bump `package.json` version on each release.

## Gotchas met on the workstation

- `npm install` from the scaffold's devDependencies failed with npm's `edgesOut` null error; copying
  `paseo-at-a-glance/package-lock.json` in first made it install in seconds. The lockfile in this repo
  came from there.
- RPC names must match `/^[a-z][a-z0-9._-]*$/`: no capitals (`coordinator.deck.watch`, not `watchDeck`).
- `paseo.agents.list` pages with `pageInfo.nextCursor` / `hasMore`; `sessions.ts` loops over it.
- `inbox.sh report` only serves a report while the card is the session's open card, so once the deck
  ticks a card off the coordinator cannot read it; that is why the reply message carries the ask.
- Prettier is not a dependency; the code is hand-formatted at 120 columns.

## Design decisions the human made

- Option 3 of three for "card disappears on click": hide on the client immediately **and** tick off
  in the inbox from the daemon, with the ask included in the message. Chosen over client-only hiding
  (lost on reload) and over daemon-only (not instant).
- Cards are shown in inbox arrival order, scope by scope, not the coordinator's ranking; the ranking
  lives in the coordinator's chat.
- `nudge` cards are hidden: they are the coordinator's to act on.
