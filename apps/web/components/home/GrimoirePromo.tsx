/**
 * "The Living Grimoire" — homepage promotion section.
 *
 * Always visible: explains what the Grimoire is, what it does, and the
 * $7.77/month membership. Compliant language throughout — traditional
 * uses and education, never treatment claims.
 */
import styles from './home.module.css';

export function GrimoirePromo() {
  return (
    <section
      className={`${styles.section} ${styles.paneBg} ${styles.bgRitualBowl}`}
      aria-labelledby="grimoire-promo-heading"
    >
      <div className={`${styles.paneInner} ${styles.container}`}>
        <div className={styles.ornament} aria-hidden="true">
          ✦ ─────────────── ✦
        </div>
        <h2 id="grimoire-promo-heading" className={styles.sectionTitle}>
          The Living Grimoire
        </h2>
        <p className={styles.sectionSub}>
          A handmade-style book of herbal wisdom — traditional uses, botanical
          illustrations, recipes, and rituals, gathered from generations of
          herbal practice and written for your own apothecary shelf.
        </p>
        <div className={styles.grimoirePromoGrid}>
          <div className={styles.grimoirePromoCard}>
            <h3 className={styles.grimoirePromoTitle}>Learn the Traditions</h3>
            <p className={styles.grimoirePromoCopy}>
              Explore how herbs have been traditionally used across cultures —
              for rest, balance, vitality, and everyday wellness rituals.
            </p>
          </div>
          <div className={styles.grimoirePromoCard}>
            <h3 className={styles.grimoirePromoTitle}>Recipes & Rituals</h3>
            <p className={styles.grimoirePromoCopy}>
              Monthly articles, exclusive recipes, and seasonal rituals you can
              practice at home with your own herbs and remedies.
            </p>
          </div>
          <div className={styles.grimoirePromoCard}>
            <h3 className={styles.grimoirePromoTitle}>Membership Benefits</h3>
            <p className={styles.grimoirePromoCopy}>
              $7.77/month — 10% off everything in the shop, early access to new
              formulas, personalized recommendations, and subscriber gifts.
              Safety information is always free, never paywalled.
            </p>
          </div>
        </div>
        <div className={styles.heroCtas}>
          <a className={styles.btnPrimary} href="/grimoire">
            ✦ Open the Grimoire
          </a>
          <a className={styles.btnSecondary} href="/grimoire/subscribe">
            Become a Keeper — $7.77/mo
          </a>
        </div>
      </div>
    </section>
  );
}
