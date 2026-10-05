/**
 * Port the canonical v3 catalog JSON into typed TypeScript modules.
 * Run: node scripts/port-catalog.mjs
 * Source: ../catalog-enrichment/products.canonical.v3.json (DRAFT, owner approval pending)
 * Output: lib/catalog/products/ (sharded generated modules + index — do not hand-edit; re-run this script)
 *
 * Sharding note: a single products.ts exceeded tooling file-size limits for the
 * GitHub push path, so each record gets its own module. The public surface
 * (PRODUCTS, CATALOG_PROVENANCE, getProductByHandle, getProductsByCategory)
 * is unchanged — import from '../catalog/products' as before.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '../../catalog-enrichment/products.canonical.v3.json');
const OUT_DIR = join(here, '../lib/catalog/products');

const raw = JSON.parse(readFileSync(SRC, 'utf8'));
const records = Array.isArray(raw) ? raw : raw.products;
if (!Array.isArray(records)) {
  console.error('Unexpected catalog JSON shape');
  process.exit(1);
}

const generated = new Date().toISOString();
const fileHeader = `/**
 * GENERATED — do not hand-edit. Re-run \`node scripts/port-catalog.mjs\`.
 * Source: awakenagain-migration/catalog-enrichment/products.canonical.v3.json
 * Status: DRAFT — owner approval pending (see UNRESOLVED_ITEMS_v3.md).
 * Generated: ${generated.slice(0, 10)}
 */
`;

function safeFileName(handle, i) {
  const s = String(handle || `record-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || `record-${i}`;
}

// Clear previously generated record shards (keep hand-written files like *.test.ts).
mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) {
  if (/^rec-.*\.ts$/.test(f) || f === 'index.ts') {
    rmSync(join(OUT_DIR, f));
  }
}

const seen = new Set();
const imports = [];
records.forEach((rec, i) => {
  let base = safeFileName(rec.handle, i);
  let name = base;
  let n = 1;
  while (seen.has(name)) name = `${base}-${++n}`;
  seen.add(name);
  const varName = `rec_${name.replace(/-/g, '_')}`;
  writeFileSync(
    join(OUT_DIR, `rec-${name}.ts`),
    `${fileHeader}import type { Product } from '../../../types';\n\nexport const RECORD: Product = ${JSON.stringify(rec, null, 2)};\n`,
  );
  imports.push({ varName, file: `./rec-${name}` });
});

const indexSrc = `${fileHeader}import type { Product } from '../../../types';
${imports.map((im) => `import { RECORD as ${im.varName} } from '${im.file}';`).join('\n')}

export const CATALOG_PROVENANCE = {
  source: 'products.canonical.v3.json',
  recordCount: ${records.length},
  generatedAt: '${generated}',
  status: 'PROPOSED',
} as const;

export const PRODUCTS: Product[] = [
${imports.map((im) => `  ${im.varName},`).join('\n')}
];

export function getProductByHandle(handle: string): Product | undefined {
  return PRODUCTS.find((p) => p.handle === handle);
}

export function getProductsByCategory(category: string): Product[] {
  return PRODUCTS.filter((p) => p.category === category);
}
`;
writeFileSync(join(OUT_DIR, 'index.ts'), indexSrc);
console.log(`Wrote ${OUT_DIR}/ (${records.length} records, ${imports.length} shards + index)`);
