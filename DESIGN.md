# Swarmlers site: design documentation

Extracted from the final source in `web/src` (`index.css`, `App.tsx`, `art.ts`, `WebCanvas.tsx`, `Inspector.tsx`, `Feed.tsx`, `Stats.tsx`, the panel components) after the last change. This is the implemented design, not a proposal. Values below are the ones in the source; rendered observations are from the validation run recorded in `docs/FRONTEND_VALIDATION.md`.

## Idea

The site is built from the collection's own material. The Swarmlers are drawn on chain on a `#090d19` ground with `#151d32` bodies and one vivid hue per ID, so the page uses that ground as its default (dark) theme and amber, the brand spider's eyes, as its single action colour. The deterministic art and rarity rules are ported from `src/SwarmlerArt.sol` into `web/src/art.ts`, which lets the page draw any of the 2,500 IDs instantly: the hero's crawlers, the "next in line" chips, the inspector and the rarity meters all come from that port. Live facts (holders, activity, rewards, events) come from the chain.

Structure, top to bottom: header with section navigation, theme toggle and wallet; hero with headline, one line and the mint card over an animated web; vitals strip; inspector (any ID, next in line, rarity by tier); free claim beside the pairing steps; your Swarmlers; latest Swarmlers; on-chain activity feed; reward pool; trade; fee hook; footer with every address.

## Tokens (`web/src/index.css`, `:root` and `[data-theme='light']`)

| Token | Dark (default) | Light | Job |
| --- | --- | --- | --- |
| `--bg` | `#090d19` | `#f4f5fa` | page; dark inputs |
| `--surface` | `#121a2e` | `#ffffff` | cards, tiles, menus; light inputs |
| `--surface-2` | `#1b2440` | `#e8ebf4` | secondary buttons, meters, banner |
| `--text` | `#e9edf8` | `#10162a` | body text |
| `--text-muted` | `#a3adca` | `#525c78` | labels, hints, leads |
| `--border` | `#283356` | `#ccd3e6` | input and button borders, rules |
| `--accent` | `#f2c94c` | `#8a5604` | primary button fill, supply meter, headline word |
| `--accent-strong` | `#ffd968` | `#6d4303` | primary hover |
| `--on-accent` | `#1b1400` | `#ffffff` | text on accent |
| `--ok` / `--warn` / `--danger` | `#6fd39a` / `#f0b66b` / `#ff8a80` | `#1d6f42` / `#8a4b00` / `#b3261e` | status text and rule; always with words |
| `--focus` | `#8fb4ff` | `#1a5cff` | 2px `:focus-visible` outline, 2px offset |
| `--web-strand` / `--web-dots` | amber at 22% / 14% | brown at 22% / 14% | hero canvas strands and the dotted hero ground |
| `--common` … `--legendary` | `#a3adca`, `#6fd39a`, `#7ea6ff`, `#d79bff`, `#f2c94c` | `#525c78`, `#1d6f42`, `#2756c9`, `#7a2fb5`, `#8a5604` | rarity tier names; the word is always shown with the colour |

Spacing scale 4, 8, 12, 16, 24, 32, 48 px (`--space-1` … `--space-7`). Radii 6, 10, 14 px. Max content width 1120 px. Safe-area insets on the shell's inline padding.

Theme switching: `<html data-theme>` is set before first paint by an inline script in `index.html` from `localStorage["swarmlers-theme"]` (`dark`, `light` or `system`); the default without a stored choice is dark. `web/src/theme.ts` keeps React in sync and updates `meta[name=theme-color]`; `ThemeToggle.tsx` is one button whose label names the theme you get ("Switch to light theme").

## Typography

One text family (`system-ui` stack) and one monospace (`ui-monospace` stack) for addresses, hashes, feed timestamps and the salt input. Six sizes, three weights, measured as 6 per width by the probe:

| Token | Size | Use |
| --- | --- | --- |
| `--size-1` | 13 px | captions, data labels, hints, footer, feed times |
| `--size-2` | 15 px | body, chips |
| `--size-3` | 17 px | buttons, `h3`, fact and tile values, hero line |
| `--size-4` | 20 px | `h2` panel titles |
| `--size-5` | 28 px | large values (next ID, price, minted) |
| `--size-6` | 36 px, 48 px from 720 px | `h1`, weight 700, tracking −0.02em, line-height 1.08 |

Weights 400 body, 500 headings h2/h3, buttons, values, 700 h1 only. Tabular numerals on facts and tiles. Inputs at 16 px. `overflow-wrap: anywhere` on `body`. The headline is six words with one accent-coloured phrase (solid colour, no gradient).

## Components

- **Header** (`App.tsx`): brand mark (SVG spider on the art ground) and name; `nav.nav` with seven in-page anchors, shown from 900 px; `.header-tools` with the theme toggle (`.icon-button`, 44 px, icon plus text from 480 px) and the wallet button.
- **Hero** (`.hero`): dotted ground (`radial-gradient` of `--web-dots`, 22 px grid), the `WebCanvas` behind (`position: absolute`, `z-index: -1`, `aria-hidden`), copy column (`h1` + one muted line, max 44ch) and the action column holding the network banner and the mint card. Two columns from 720 px.
- **WebCanvas** (`WebCanvas.tsx`): 14 spokes, 8 sagging rings, six crawlers coloured with `hue(id)` of the next six IDs in line, walking rings or spokes; the web leans up to 18 px toward the pointer. Runs on `requestAnimationFrame` only when visible, the tab is active and `prefers-reduced-motion` is not `reduce`; otherwise it draws one still frame.
- **Mint card** (`MintPanel.tsx`): "Next ID" and "Price" as large facts, the single primary button, wallet hint, transaction status, then `NextUp` chips for the next four IDs.
- **Stats** (`Stats.tsx`, `.tiles`, `.tile`, `.meter.supply`): four tiles (minted, reward reserve, paid to holders, reward clock), values count up over 900 ms on first appearance (instant under reduced motion), plus a supply progress bar with `role="progressbar"`.
- **Inspector** (`Inspector.tsx`, `.inspect`): image column (local drawing, or the live `tokenURI` image when minted) beside an ID field with Previous/Next buttons, facts (rarity, hue swatch, body width, 12-dot `.sigil`, status, holder, pairing, earned, claimable), then `NextUp` (eight chips, `aria-pressed` on the selected one) and `.tiers` (five meters: minted of total per tier, "Next legendary is #N" links). Selecting a chip, a gallery tile or a feed row opens the inspector at that ID (`inspect-context.tsx`) and scrolls it into view.
- **Chips** (`.chip`): 40 px pill buttons with a colour swatch, the ID and the tier or "next"; selected state adds an accent ring.
- **Feed** (`Feed.tsx`, `.feed`): a live dot (pulses only without reduced motion), block and refresh note, then up to 12 rows: relative time (mono), event text with a coloured dot per kind (mint amber, claim/deposit green, pair/activity blue, config muted), explorer link. Rows are separated by rules, not boxes. Events are read with `eth_getLogs` in 10,000-block chunks back to the deployment block.
- **Card** (`ui.tsx`, `.card`): surface, 14 px radius, 24 px padding, grid gap 16 px, `aria-labelledby` the `h2`; no border, no shadow, never nested.
- **Facts** (`.facts`): auto-fit 130 px columns; label 13 px muted over value 17 px medium; `.big` values 28 px.
- **Buttons**: 44 px minimum, 17 px medium text, 10 px radius; `.primary` is the accent fill, one per action group; `.link-button` for inline ID links. Hover only under `(hover: hover)`; transitions on colour only, gated by reduced motion.
- **Fields**, **Status / Notice**, **Wrong-network banner**, **Wallet menu**, **Owned list**, **Steps**: unchanged from the previous build (visible labels, `aria-describedby` hints, `aria-invalid`, `role="status"`/`role="alert"`, left-rule notices, dropdown with Escape and outside click, 96/72 px image column).
- **Gallery** (`.gallery`, `.gallery-tile`): auto-fill 140 px tiles, each a button with the on-chain image, ID and coloured tier; lifts 3 px on hover when motion is allowed.

## Responsive behaviour

- Single column by default; the hero, inspector and `.grid-2` pairs become two columns from 720 px; stats go from 2 to 4 tiles at 720 px; tiers go from a stack to 5 columns at 720 px; the feed row goes from stacked to three columns at 560 px; the section nav appears at 900 px; the toggle text appears at 480 px.
- Measured on the final export (probe and interaction script): no horizontal scroll at 320, 390 and 1440; at 390 the mint button's bottom edge is at 532 px of 844, under the headline and its one line.
- Motion: the web canvas, the counters, the live dot pulse, the supply meter transition and the gallery lift all stop under `prefers-reduced-motion: reduce`; nothing uses `transition: all`.
- Theme: dark default, light on request, choice persisted; both measured at 4.5:1 or better on every solid pair the probe can resolve.

## Writing

Sentence case throughout. Verb-first buttons ("Connect wallet", "Mint for 0.25 IMD", "Claim free Swarmler", "Switch to light theme", "Previous", "Next"). Empty and waiting states say what is happening ("Reading recent blocks…", "Not minted yet, 2,474 in line"). Errors sit beside the control that failed with a next step. SWARMLER the ERC-20 and Swarmlers the NFTs are named distinctly wherever they meet.

## Share metadata (`web/index.html`)

Title "Swarmlers: spider-crawler agent NFTs that earn IMD", description, `og:title`, `og:description`, `og:type`, `og:image` (`./og.png`, 1200×630, rendered from the site's own palette and three Swarmlers drawn by the art port), `twitter:card`, `theme-color`, SVG favicon matching the header mark.
