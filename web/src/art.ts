/**
 * Local port of `src/SwarmlerArt.sol` at the pinned source commit.
 *
 * The collection's artwork and rarity are deterministic functions of the token ID, so the site can
 * draw any of the 2,500 Swarmlers instantly, including ones not minted yet, without an RPC call.
 * `svg()` reproduces the contract's SVG byte for byte for a given state (verified in the unit tests
 * and against the live `tokenURI` of minted tokens); the contract remains the source of truth for
 * activity state, which only an on-chain read can supply.
 */

export const MAX_SUPPLY = 2500;

export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

export const RARITIES: readonly Rarity[] = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];

/** Fixed tier sizes over all 2,500 IDs (a permutation, not a random draw). */
export const RARITY_SUPPLY: Record<Rarity, number> = { Common: 1500, Uncommon: 625, Rare: 250, Epic: 100, Legendary: 25 };

export function rarity(id: number): Rarity {
  const roll = (id * 7919) % 2500;
  if (roll < 1500) return 'Common';
  if (roll < 2125) return 'Uncommon';
  if (roll < 2375) return 'Rare';
  if (roll < 2475) return 'Epic';
  return 'Legendary';
}

/** Hue of a Swarmler's legs, eyes and markings, in degrees. */
export function hue(id: number): number {
  return (id * 137) % 360;
}

export function color(id: number): string {
  return `hsl(${hue(id)},80%,65%)`;
}

/** Abdomen half-width: 32 to 48. */
export function bodyWidth(id: number): number {
  return 32 + (id % 17);
}

/** The twelve markings on the abdomen: bit n of the ID lights marking n. */
export function sigilBits(id: number): boolean[] {
  return Array.from({ length: 12 }, (_, bit) => ((id >> bit) & 1) === 1);
}

function sigil(id: number, c: string): string {
  let pattern = '';
  for (let bit = 0; bit < 12; bit++) {
    pattern += `<circle cx="${185 + (bit % 3) * 15}" cy="${193 + Math.floor(bit / 3) * 11}" r="3" fill="${c}" opacity="${((id >> bit) & 1) === 1 ? '1' : '0.15'}"/>`;
  }
  return pattern;
}

/** The contract's SVG for a token in the given activity state. */
export function svg(id: number, active = false): string {
  const c = color(id);
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
    `<rect width="400" height="400" fill="#090d19"/><g stroke="${c}" stroke-width="5" fill="none"><path d="M180 185L100 130L60 75M175 200L85 185L35 135` +
    'M175 220L85 240L40 285M180 240L115 295L100 345M220 185L300 130L340 75' +
    'M225 200L315 185L365 135M225 220L315 240L360 285M220 240L285 295L300 345"/>' +
    `<ellipse cx="200" cy="220" rx="${bodyWidth(id)}" ry="55" fill="#151d32"/>` +
    `<circle cx="200" cy="167" r="30" fill="#151d32"/></g><g fill="${c}">` +
    `<circle cx="190" cy="160" r="${active ? '7' : '3'}"/><circle cx="210" cy="160" r="${active ? '7' : '3'}"/></g>` +
    sigil(id, c) +
    `<text x="200" y="250" text-anchor="middle" fill="white" font-family="monospace" font-size="18">${id}</text>` +
    `<text x="200" y="35" text-anchor="middle" fill="${c}" font-family="monospace" font-size="18">SWARMLER #${id}</text>` +
    `<text x="200" y="380" text-anchor="middle" fill="white" font-family="monospace">${rarity(id)}${active ? ' / ACTIVE' : ' / DORMANT'}</text></svg>`
  );
}

/** A `data:` URL for `<img src>`, drawn locally. */
export function imageUrl(id: number, active = false): string {
  return `data:image/svg+xml;base64,${btoa(svg(id, active))}`;
}

export function isValidId(id: number): boolean {
  return Number.isInteger(id) && id >= 1 && id <= MAX_SUPPLY;
}

/** How many IDs of each tier fall within 1..minted (minted tokens of each tier, since IDs are sequential). */
export function mintedByRarity(minted: number): Record<Rarity, number> {
  const out: Record<Rarity, number> = { Common: 0, Uncommon: 0, Rare: 0, Epic: 0, Legendary: 0 };
  for (let id = 1; id <= Math.min(minted, MAX_SUPPLY); id++) out[rarity(id)]++;
  return out;
}

/** The next ID at or after `from` with the given rarity, or null when none remains. */
export function nextOfRarity(from: number, tier: Rarity): number | null {
  for (let id = Math.max(1, from); id <= MAX_SUPPLY; id++) if (rarity(id) === tier) return id;
  return null;
}
