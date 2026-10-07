/**
 * The Apothecary Shop — client component (workstream G).
 *
 * Spec §7 order: ritual BUNDLE cards first → "Shop by Goal" buttons (9
 * goals) → category filter pills → product grid. Goal/pill filters map to
 * REAL catalog handles (curated from the quiz concern mappings — no invented
 * products). "Who it's for" on each card is derived from this mapping.
 *
 * Brand: "Amber's Alchemy Apothecary" exact everywhere.
 */
'use client';

import { useMemo, useState } from 'react';
import { PRODUCTS } from '../../lib/catalog/products';
import { BRAND_NAME } from '../../lib/seo/config';
import { SHOP_GOALS, goalLabelsForHandle } from './shop-goals';
import { ProductCard } from './ProductCard';
import { RitualBundleCard } from './RitualBundleCard';
import styles from './shop.module.css';

/** Category filter pills (spec §7) — each maps onto the goal mapping. */
const FILTER_PILLS: Array<{ id: string; label: string; goalId: string | null }> = [
  { id: 'all', label: 'All Remedies', goalId: null },
  { id: 'sleep', label: '🌙 Sleep', goalId: 'sleep' },
  { id: 'energy', label: '⚡ Energy', goalId: 'energy' },
  { id: 'immune', label: '🛡️ Immune', goalId: 'immune' },
  { id: 'beauty', label: '✨ Beauty', goalId: 'beauty' },
  { id: 'pain', label: '🌿 Pain', goalId: 'pain' },
  { id: 'hormonal', label: '🌸 Hormonal', goalId: 'hormonal' },
];

/** Ritual bundles shown at the top (superseded 9-bar collection excluded). */
const RITUAL_BUNDLE_HANDLES = [
  'stress-relief-ritual',
  'focus-clarity-ritual',
  'gentle-detox-ritual',
  'soap-style-collection-5',
];

export function ShopClient() {
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const bundles = useMemo(
    () =>
      RITUAL_BUNDLE_HANDLES.map((h) =>
        PRODUCTS.find((p) => p.handle === h),
      ).filter((p) => p !== undefined),
    [],
  );

  const gridProducts = useMemo(
    () =>
      PRODUCTS.filter(
        (p) => p.category !== 'Bundles' && p.handle !== 'full-soap-collection',
      ),
    [],
  );

  const activeGoalId =
    FILTER_PILLS.find((pill) => pill.id === activeFilter)?.goalId ??
    (SHOP_GOALS.some((g) => g.id === activeFilter) ? activeFilter : null);

  const visibleProducts = useMemo(() => {
    const goal = SHOP_GOALS.find((g) => g.id === activeGoalId);
    if (!goal) return gridProducts;
    return gridProducts.filter((p) => goal.handles.includes(p.handle));
  }, [gridProducts, activeGoalId]);

  const activeLabel =
    activeFilter === 'all'
      ? null
      : (SHOP_GOALS.find((g) => g.id === activeGoalId)?.label ??
        FILTER_PILLS.find((p) => p.id === activeFilter)?.label ??
        null);

  const pickFilter = (id: string) => setActiveFilter(id);

  return (
    <main id="main-content" className={styles.shopMain}>
      <div className={styles.shopHero}>
        <p className="section-ornament" aria-hidden="true">
          ✦
        </p>
        <h1>The Apothecary Shop</h1>
        <p>
          Handcrafted botanical goods from {BRAND_NAME} — made by Amber in
          small batches, never mass-produced.
        </p>
      </div>

      <section aria-label="Ritual bundles" className={styles.bundleSection}>
        <h2 className="section-title">Begin a Ritual</h2>
        <p className="section-subtitle">
          Layered remedies designed to be experienced together — tea, soap,
          balm, and capsules in one unhurried practice.
        </p>
        <div className={styles.bundleGrid}>
          {bundles.map((bundle) => (
            <RitualBundleCard key={bundle.handle} product={bundle} />
          ))}
        </div>
      </section>

      <section aria-label="Shop by goal" className={styles.goalSection}>
        <h2 className="section-title">Shop by Goal</h2>
        <p className="section-subtitle">
          Not sure where to begin? Choose what you&apos;d love support with —
          or <a href="/quiz">take the Find My Remedy quiz ✦</a>.
        </p>
        <div className={styles.goalGrid}>
          {SHOP_GOALS.map((goal) => (
            <button
              key={goal.id}
              type="button"
              className={styles.goalButton}
              aria-pressed={activeFilter === goal.id}
              onClick={() =>
                pickFilter(activeFilter === goal.id ? 'all' : goal.id)
              }
            >
              {goal.icon} {goal.label}
            </button>
          ))}
        </div>
      </section>

      <section aria-label="All remedies">
        <div className={styles.pillRow} role="group" aria-label="Filter remedies">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.id}
              type="button"
              className={styles.filterPill}
              aria-pressed={activeFilter === pill.id}
              onClick={() => pickFilter(pill.id)}
            >
              {pill.label}
            </button>
          ))}
        </div>
        {activeLabel ? (
          <p className={styles.filterNote}>
            Showing remedies for {activeLabel} —{' '}
            <button
              type="button"
              className={styles.filterPill}
              onClick={() => pickFilter('all')}
            >
              Clear ✕
            </button>
          </p>
        ) : null}
        <div className={styles.productGrid}>
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.handle}
              product={product}
              goalLabels={goalLabelsForHandle(product.handle)}
            />
          ))}
          {visibleProducts.length === 0 ? (
            <p className={styles.emptyResult}>
              No remedies are filed under this goal yet — try another, or ask
              Amber for a custom formula.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
