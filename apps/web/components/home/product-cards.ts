/**
 * Pure helpers that turn canonical catalog products into homepage
 * product-card models. No JSX here so unit tests can import this module
 * directly (the repo's vitest transform cannot parse JSX).
 *
 * Pricing is DISPLAY ONLY from the canonical catalog (integer cents);
 * the cart store and server recompute authoritatively at checkout.
 */
import { getProductByHandle } from '../../lib/catalog/products';
import { getHerb } from '../../lib/catalog/herbs';
import { toCents } from '../../lib/pricing/pricing';
import type { Product } from '../../types';

export interface HerbChipModel {
  slug: string;
  label: string;
}

export interface HomeProductCardModel {
  handle: string;
  title: string;
  category: string;
  priceCents: number;
  shortDescription: string | null;
  benefitLine: string | null;
  imageSrc: string;
  fallbackEmoji: string;
  herbChips: HerbChipModel[];
  whyItWorks: { name: string; role: string | null }[];
  variantId?: string;
}

/** Canonical herb slug aliases for catalog ingredient names. */
export const HERB_ALIASES: Record<string, string> = {
  'valerian-root': 'valerian',
  'rose-petals': 'rose',
};

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface FeaturedIngredient {
  name?: string;
  role_in_formula?: string;
}

/**
 * Key-botanical chips — only for herbs that exist in the botanical index,
 * so every chip opens a real botanical card.
 */
export function resolveHerbChips(product: Product): HerbChipModel[] {
  const raw = (product as Record<string, unknown>)['featured_ingredients'];
  if (!Array.isArray(raw)) return [];
  const chips: HerbChipModel[] = [];
  for (const entry of raw.slice(0, 5)) {
    const ing = entry as FeaturedIngredient;
    if (!ing.name) continue;
    const candidate = slugify(ing.name);
    const slug = HERB_ALIASES[candidate] ?? candidate;
    if (getHerb(slug)) {
      chips.push({ slug, label: ing.name });
    }
  }
  return chips;
}

export function resolveWhyItWorks(
  product: Product,
): HomeProductCardModel['whyItWorks'] {
  const raw = (product as Record<string, unknown>)['featured_ingredients'];
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 5).map((entry) => {
    const ing = entry as FeaturedIngredient;
    return { name: ing.name ?? 'Botanical', role: ing.role_in_formula ?? null };
  });
}

/** Null when the product has no established price — never invent one. */
export function toCardModel(product: Product): HomeProductCardModel | null {
  if (typeof product.price !== 'number') return null;
  const tradUses = (product as Record<string, unknown>)['traditional_uses'];
  const benefitLine =
    Array.isArray(tradUses) && typeof tradUses[0] === 'string'
      ? (tradUses[0] as string)
      : null;
  const variants = product.variants ?? [];
  const firstVariant = variants[0];
  return {
    handle: product.handle,
    title: product.title,
    category: product.category,
    priceCents: toCents(product.price),
    shortDescription: product.short_description ?? null,
    benefitLine,
    imageSrc: `/images/products/${product.handle}.webp`,
    fallbackEmoji: '🌿',
    herbChips: resolveHerbChips(product),
    whyItWorks: resolveWhyItWorks(product),
    variantId:
      firstVariant && typeof firstVariant.variant_id === 'string'
        ? firstVariant.variant_id
        : undefined,
  };
}

export function getProduct(handle: string): Product | undefined {
  return getProductByHandle(handle);
}
