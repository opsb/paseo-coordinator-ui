# paseo-coordinator-ui

A [Paseo](https://paseo.sh) plugin that gives [paseo-coordinator](https://github.com/opsb/paseo-coordinator)
a screen: the cards that wait on you, one slide at a time, with the replies each card accepts as
buttons, and a chat button for anything longer. A **Coordinator** row in the sidebar carries the number
of cards waiting.

Requires Paseo 0.12 or newer, and paseo-coordinator on the machine that runs the daemon.

## What it does

- **One card at a time.** Each slide shows the stream's motif and name, its PRs and tickets as links
  with their state, your last words on it, what changed since, the ask, the coordinator's
  recommendation and evidence, and any project rule that applies. Previous and Next move through the
  deck; dots show where you are and which cards you have answered.
- **Replies as buttons.** Decide: Yes / No. Do: Done. Accept: Accept / Not yet. Every card: Park,
  Skip, Remind at a time you type, or your own words.
- **Chat under the card.** Chat opens a thread beneath the card. What you ask goes to the coordinator
  as a `[card chat]` message naming the card; its answer streams back under the card, and the card
  stays open until you resolve it with a reply above. Refresher and More ask through the same thread.
  The header's Chat button opens the coordinator session itself; Open session opens the session the
  card is about.
- **Gone on press.** A reply hides the card at once. The daemon then ticks it off in the inbox, so it
  stays gone for every client and across reloads. A send that fails brings the card back.
- **Live.** The daemon watches the coordinator's inbox files, so a card appears when the inbox worker
  adds it and leaves when the coordinator or the deck ticks it off.

## How a reply reaches the coordinator

The coordinator reads replies from its chat (`y`, `n`, `done`, `park`, `remind <when>`, `skip`,
`refresher`, `more`, or your own words). The deck sends the same word to the coordinator session as a
chat message, headed by the card it answers and its ask, because the coordinator may have a different
card in front of it in the chat, and because the report behind the card is no longer served once the
card is ticked off:

```
[card reply] 🔑 Google sign-in · session <session-id> · card <key> (already ticked off in the inbox)
Asked: Ship sign-in now, leave Gmail for later?
Reply: y
```

Once the message is away, the daemon ticks the card off in `inbox.md` itself: it takes the scripts'
own `<inbox>.lock` directory, flips `[ ]` to `[x]` on the line whose key matches, and changes nothing
else. The coordinator's later `inbox.sh done` for the same card is then a no-op that also removes the
report. The message is sent with Paseo's `steer` behaviour, so a coordinator mid-relay is not
interrupted.

## What it reads

- `~/.local/state/coordinator/<scope>/inbox.md`: the cards, one per line. Only open cards that wait
  on a person are shown; a `nudge` card is the coordinator's to send and is left out.
- `~/.local/state/coordinator/<scope>/reports/<session-id>.json`: the sweep worker's report behind a
  card, shown only while its key matches the open card, as `inbox.sh report` has it.
- Paseo's own agent and workspace lists, for the coordinator session of each scope (the live session
  labelled `coord-role=coordinator`, scope from `coord-scope`), and each card's session, workspace
  and project.

`COORD_STATE_ROOT` in the daemon's environment moves the state root, as it does for the coordinator's
scripts. Cards are shown in arrival order, scope by scope; the coordinator's ranking by stream, area
and project applies in its chat.

## Install

```bash
paseo plugin install opsb/paseo-coordinator-ui
```

Or from a checkout, for development:

```bash
git clone https://github.com/opsb/paseo-coordinator-ui ~/Projects/paseo-coordinator-ui
paseo plugin install ~/Projects/paseo-coordinator-ui
```

## Development

```bash
npm install
npm run typecheck
npm test
paseo plugin reload paseo-coordinator-ui
```

Tests cover the inbox parser, the report normaliser, the reply message, the state reader and watcher,
the tick-off and its lock, and the session lookup against a fake Paseo API. Seed a throwaway inbox with `COORD_STATE_ROOT`
pointing at a temporary directory to try the screen without a coordinator.

## Files

| File | Purpose |
|---|---|
| `index.client.tsx` | the screen, the sidebar row and a command-centre entry |
| `client/deck-screen.tsx` | the deck: position, sending, moving on |
| `client/card-view.tsx` | one card as a slide, with its replies |
| `client/use-deck.ts` | one long-poll per host, shared by the sidebar badge and the screen |
| `index.server.ts` | the `coordinator.deck.watch` and `coordinator.card.close` RPCs |
| `server/close.ts` | ticks a card off in the inbox under the scripts' lock |
| `server/state.ts` | reads and watches the coordinator's state files |
| `server/sessions.ts` | the coordinator and the session behind each card, from Paseo |
| `shared/inbox.ts` | parses inbox lines |
| `shared/report.ts` | settles a sweep report into one shape |
| `shared/reply.ts` | the replies each kind accepts and the message sent |

## Limits

It shows the inbox of the daemon it runs on, so the coordinator and the deck must share a machine. A
card without a report (a reminder, or a close proposal) shows its ask alone; the coordinator reads the
session when you answer or ask for a refresher. Keyboard shortcuts are not wired up yet.
