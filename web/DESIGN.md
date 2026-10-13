# Swarmlers site: design documentation

Extracted from the final source in `web/src` (`index.css`, `App.tsx`, the panel components). This is the implemented design, not a proposal. A copy lives at `docs/DESIGN.md`; the assignment's write scope does not include the repository root, so the root-level file requested by the acceptance criteria could not be created there.

## Idea

One page that reads like a control panel: the mint action and its state first, everything else below in the order a holder needs it. One accent colour (amber, the Swarmler's eyes) marks the single primary action in each panel; everything else is neutral.

## Tokens (`web/src/index.css`, `:root`)

Colour, by role. Light values first, dark values from the `prefers-color-scheme: dark` block.

| Token | Light | Dark | Job |
| --- | --- | --- | --- |
| `--bg` | `#f6f5f1` | `#121418` | page |
| `--surface` | `#ffffff` | `#1b1e24` | cards, inputs, menus |
| `--surface-2` | `#efede7` | `#242830` | secondary buttons, banner, image placeholders |
| `--text` | `#171a1f` | `#eeeae0` | body text |
| `--text-muted` | `#5a606b` | `#a8acb5` | labels, hints, leads |
| `--border` | `#d8d5cc` | `#353a44` | card and input borders, notice rule |
| `--accent` | `#8a5604` | `#f2c94c` | primary button fill |
| `--accent-strong` | `#6d4303` | `#ffd968` | primary hover |
| `--on-accent` | `#ffffff` | `#1b1400` | text on accent |
| `--ok` / `--warn` / `--danger` | `#1d6f42` / `#8a4b00` / `#b3261e` | `#6fd39a` / `#f0b66b` / `#ff8a80` | status text and rule colour; always paired with words, never colour alone |
| `--focus` | `#1a5cff` | `#7ea6ff` | 2px `:focus-visible` outline with 2px offset |

Spacing scale: 4, 8, 12, 16, 24, 32, 48 px (`--space-1` … `--space-7`). Radii: 6, 10, 14 px (`--radius-s/m/l`). Max content width 1040 px. Safe-area insets on the shell's inline padding.

## Typography

One family for text (`system-ui` stack) and one monospace (`ui-monospace` stack) for addresses, hashes and the salt input. Six sizes, three weights:

| Token | Size | Use |
| --- | --- | --- |
| `--size-1` | 13 px | captions, data labels, hints, footer |
| `--size-2` | 15 px | body |
| `--size-3` | 17 px | buttons, `h3`, fact values |
| `--size-4` | 20 px | `h2` panel titles |
| `--size-5` | 26 px | large fact values (minted, price, reserve) |
| `--size-6` | 36 px | `h1` headline, weight 700, tracking −0.02em |

Weights 400 (body), 500 (headings h2/h3, buttons, fact values), 700 (h1 only). Numbers use `font-variant-numeric: tabular-nums` in facts. Inputs are 16 px to avoid iOS zoom. `overflow-wrap: anywhere` on `body` keeps full addresses and long values from forcing horizontal scroll; critical values are never clipped or ellipsised.

## Components

- **Shell / header** (`App.tsx`): `.shell` centres content; `.header` is a flex row with the brand (icon + name, a link home) at the leading edge and the wallet button at the trailing edge. A skip link precedes it.
- **Hero** (`.hero`): `h1` "Mint a Swarmler, earn IMD." plus one plain line. No kicker, no slogan stack.
- **Card** (`ui.tsx` `Card`, `.card`): surface, 1px border, 14 px radius, 24 px padding, grid gap 16 px, `aria-labelledby` the `h2`. Panels: Mint, Claim one free, Your Swarmlers, Latest Swarmlers, How pairing works, Reward pool, Trade SWARMLER, Fee hook pool, Owner setup (owner only), plus the wrong-network banner.
- **Facts** (`.facts`, `Fact`): `dl` grid, auto-fit 130 px columns; label 13 px muted over value 17 px medium; `.big` values 26 px.
- **Buttons**: 44 px minimum height, 17 px medium text, 10 px radius. `.primary` is the accent fill, one per view/panel action group; secondary buttons use `--surface-2` with a border. Disabled at 55% opacity with `not-allowed` cursor; hover only under `@media (hover: hover)`; colour transitions only under `prefers-reduced-motion: no-preference`.
- **Fields** (`.field`): visible `label for`, input, hint `span` referenced by `aria-describedby`; `aria-invalid` sets a danger border. `inputmode` numeric/decimal where appropriate; `autocomplete="off"` on contract inputs.
- **Status / Notice** (`TxStatus`, `Notice`, `.status`): left-rule text block (3 px rule, 12 px inset), coloured by `ok` / `warn` / `error`; `role="status"` + `aria-live="polite"` for progress and success, `role="alert"` for errors. An empty idle status region stays mounted so repeated announcements fire.
- **Wrong-network banner** (`.banner`): surface-2, border, one primary control "Switch to Ethereum".
- **Wallet menu** (`.menu`): absolute dropdown anchored to the trailing edge, closes on Escape and outside click, `role="menu"` / `menuitem`.
- **Gallery** (`.gallery`): auto-fill 140 px tiles of on-chain SVG with id and rarity. **Owned list** (`.owned`): 96 px image column (72 px under 420 px wide) beside metadata, facts and actions.
- **Steps** (`.steps`): ordered list for pairing instructions next to the panel that needs them.

## Responsive behaviour

- Single column by default; `.grid-2` becomes two columns from 720 px (Mint beside Claim; swap amount beside slippage).
- `body { min-width: 320px }`; no fixed widths on text containers; menus cap at `calc(100vw - 32px)`.
- Measured (taste@1 probe and the interaction script): no horizontal scroll at 320, 390 and 1440; the mint control and wallet button are within the first 844 px at 390 (button bottom at 677 px).
- Motion: only button colour transitions, gated behind `prefers-reduced-motion: no-preference`; nothing animates endlessly.
- Theme follows the system via `color-scheme: light dark` and the dark token block; there is no in-page theme toggle.

## Writing

Sentence case throughout. Verb-first buttons ("Connect wallet", "Mint for 0.25 IMD", "Claim free Swarmler", "Switch to Ethereum", "Deposit", "Forward IMD fees to rewards"). Errors say what to do next, next to the button that failed (`errors.ts`). Empty states point forward ("This wallet holds no Swarmlers yet. Mint or claim one above."). The ERC-20 (SWARMLER) and the NFTs (Swarmlers) are named distinctly everywhere they meet.

## Share metadata (`index.html`)

Title "Swarmlers: mint, claim and earn IMD", description, `og:title`, `og:description`, `og:type`, `og:image` (`./og.png`, 1200×630, relative because the hosted address is not yet fixed), `twitter:card`, SVG favicon.
