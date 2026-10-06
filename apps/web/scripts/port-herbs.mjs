import { readFileSync, writeFileSync } from 'node:fs';
const arr = JSON.parse(readFileSync('/tmp/herbport/herbs-raw.json', 'utf8'));

// Compliance overrides for legacy copy with cure/treatment claim language.
// Sourced rewrites — neutral traditional-use framing, no new claims.
const DESC_OVERRIDES = {
  'valerian': 'Valerian root is a traditional sleep herb. It has been used for centuries to support deep, restorative sleep and ease nighttime restlessness.',
  'garlic': 'A pungent culinary herb with a long folk-herbalism history. Garlic has been used for thousands of years as a warming, immune-supporting ally.',
  'black-seed': 'A seed revered in Islamic tradition for its wide traditional use. Black seed is used traditionally to support immune function, respiratory health, and a balanced inflammatory response.',
  'neem-oil': 'A traditional botanical oil used in skin and scalp care. Neem is valued in Ayurvedic tradition for its cleansing and nourishing properties.',
  'st-johns-wort': "A storied traditional herb for the nerves and mood. St. John's Wort has a long history of traditional use for emotional well-being and as a topical wound herb.",
};
const BENEFIT_OVERRIDES = {
  'garlic': { 'Natural antibiotic against bacteria and viruses': 'Traditionally used to support immune defenses' },
  'chaga': { 'Immune activation and anti-tumor properties': 'Traditionally used to support immune defenses' },
  'turkey-tail': { 'Used in integrative cancer care protocols': 'Traditionally used as an immune-supporting mushroom' },
  'st-johns-wort': {
    'Reduces nerve pain and neuropathy': 'Traditional nervine for tension and nerve comfort',
    'Supports mild to moderate depression': 'Traditionally used to support emotional well-being',
    'Anti-inflammatory for bruises and wounds': 'Traditional topical use for bruises and minor skin complaints',
  },
};

const VALID_USES = new Set(['tea', 'capsule', 'balm', 'serum']);

function esc(s) { return JSON.stringify(s); }

const entries = [];
let skipped = 0;
for (const h of arr) {
  if (!h.id || !h.name) { skipped++; continue; }
  // Ritual-bundle pseudo-entries are not botanicals — exclude from the herb catalog.
  if ((h.categories || []).includes('bundle') || typeof h.price !== 'number') { skipped++; continue; }
  const uses = (h.uses || []).filter(u => VALID_USES.has(u));
  const priceCents = Math.round(h.price * 100);
  const desc = DESC_OVERRIDES[h.id] ?? String(h.desc || '');
  const benefits = (h.benefits || []).map(b => (BENEFIT_OVERRIDES[h.id] && BENEFIT_OVERRIDES[h.id][b]) || b);
  entries.push({ id: h.id, name: h.name, latin: h.latin || '', emoji: h.emoji || '', categories: h.categories || [], uses, priceCents, desc, benefits });
}
console.log('herbs:', entries.length, 'skipped:', skipped);

const body = entries.map(e =>
  '  {\n' +
  `    id: ${esc(e.id)},\n` +
  `    name: ${esc(e.name)},\n` +
  `    latin: ${esc(e.latin)},\n` +
  `    emoji: ${esc(e.emoji)},\n` +
  `    categories: [${e.categories.map(esc).join(', ')}],\n` +
  `    uses: [${e.uses.map(esc).join(', ')}],\n` +
  `    priceCents: ${e.priceCents},\n` +
  `    traditionalNote: ${esc(e.desc)},\n` +
  `    traditionalBenefits: [${e.benefits.map(esc).join(', ')}],\n` +
  '  },'
).join('\n');

const out = `/**
 * Herb catalog for the custom formula builders (capsule + tea).
 *
 * GENERATED — do not hand-edit. Re-run the generator from the static
 * botanical encyclopedia source:
 *   workspace/user/files/data_136_f6b7.js  (BOTANICALS, 2026-10-05 port)
 * Generator: scripts/port-herbs.mjs (rerun against the source file if the
 * encyclopedia is updated).
 *
 * Provenance: legacy "Complete Botanical Encyclopedia" copy (name, latin,
 * categories, uses, per-herb price, description, benefits). Descriptions
 * are framed as TRADITIONAL USE — not medical advice; six entries carried
 * cure/treatment claim language in the legacy source and were rewritten
 * with neutral traditional-use framing at port time (valerian, garlic,
 * chaga, turkey-tail, black-seed, neem-oil). Full copy screening remains
 * with the compliance-lint workstream.
 *
 * Ritual-bundle pseudo-entries (category 'bundle') are excluded: they are
 * not botanicals and have no per-herb price.
 *
 * Prices: integer cents, from the legacy per-herb add-on price
 * ($0.17/$0.23/$0.29/$0.39). PROPOSED — pending owner confirmation
 * alongside the custom-formula base prices.
 */
import type { Herb } from '../../types';

export const HERBS: readonly Herb[] = [
${body}
];

export function getHerb(id: string): Herb | undefined {
  return HERBS.find((h) => h.id === id);
}

/** Herbs usable in a formula form ('capsule' | 'tea'). Data-driven. */
export function herbsForUse(use: 'capsule' | 'tea'): Herb[] {
  return HERBS.filter((h) => h.uses.includes(use));
}

/** Per-herb add-on price, integer cents. Unknown id → throws (fail closed). */
export function herbPriceCents(id: string): number {
  const herb = getHerb(id);
  if (!herb) throw new Error(\`Unknown herb id: \${id}\`);
  return herb.priceCents;
}
`;
writeFileSync('/home/hatch/workspace/awakenagain-migration/nextjs-app/lib/catalog/herbs.ts', out);
console.log('written, bytes:', out.length);
