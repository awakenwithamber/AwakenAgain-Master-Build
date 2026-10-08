/**
 * "Best Sellers" — real product cards from the canonical catalog.
 *
 * Server component: resolves product records → card models (prices in
 * integer cents, display only; HerbChips verified against the herb index).
 * The interactive card (image fallback, add-to-cart) is a client component.
 */
import { getProductByHandle } from '../../lib/catalog/products';
import styles from './home.module.css';
import { HomeProductCard } from './HomeProductCard';
import { toCardModel, type HomeProductCardModel } from './product-cards';
import { BEST_SELLER_HANDLES } from './data';

export function BestSellers() {
  const cards: HomeProductCardModel[] = [];
  for (const handle of BEST_SELLER_HANDLES) {
    const product = getProductByHandle(handle);
    if (!product) continue;
    const model = toCardModel(product);
    if (model) cards.push(model);
  }

  return (
    <section className={`${styles.section} ${styles.bgApothecaryBottles}`} aria-labelledby="best-sellers-heading">
      <div className={styles.container}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="best-sellers-heading" className={styles.sectionTitle}>
          Best Sellers
        </h2>
        <p className={styles.sectionSub}>
          Trusted by hundreds of customers — handcrafted with pure botanical
          ingredients.
        </p>
        <ul className={styles.productGrid}>
          {cards.map((card) => (
            <HomeProductCard key={card.handle} product={card} />
          ))}
        </ul>
      </div>
    </section>
  );
}
