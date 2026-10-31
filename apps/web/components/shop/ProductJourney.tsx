/**
 * Product-page journey sections (owner directive 2026-10-30) — additive
 * sections rendered by app/shop/[slug]/page.tsx:
 *
 *  - BalmBanner: the owner's own words on how every balm is made,
 *    printed at the very top of the balm pages (copy lives on the
 *    product record as `page_banner`; this component only renders it).
 *  - PackageOptions: every bundle offers two honest paths — the bundle
 *    exactly as Amber composed it, or "Create Your Own," which LINKS to
 *    the apothecary's existing builder and quiz surfaces (the builders
 *    themselves are never duplicated or edited here). Choosing an
 *    herbal path brings the visitor to the Herbal Allies Quiz.
 *  - KeepWandering: tasteful cross-mentions at the foot of the page so
 *    a visitor can step onward — to the quiz, the builders, the shop,
 *    and the Living Grimoire — in the apothecary's own voice.
 */
import Link from 'next/link';
import type { Product } from '../../types';
import styles from './shop.module.css';

export function BalmBanner({ text }: { text: string }) {
  return (
    <section className={styles.balmBanner} aria-label="How every balm is made">
      <h2>How every balm begins</h2>
      <p>{text}</p>
    </section>
  );
}

export function PackageOptions() {
  return (
    <section className={styles.packageOptions} aria-label="Two ways to bring this bundle home">
      <h2>Two ways to bring this bundle home</h2>
      <div className={styles.optionCards}>
        <div className={styles.optionCard}>
          <h3>The Recommended Bundle</h3>
          <p>
            Amber composed this bundle herself — the tea, the soap, the
            balm, the capsules — layered in the order she meant them to be
            met. Take it exactly as she built it, and simply begin.
          </p>
          <p>
            <a href="#purchase">Choose the bundle as composed ↑</a>
          </p>
        </div>
        <div className={styles.optionCard}>
          <h3>Create Your Own</h3>
          <p>
            Or wander the workbench and make it yours. Choose your soap's
            shape and size in the Soap Builder, blend a tea or compose
            capsules around your own botanicals — and if an herbal path
            is calling, the Herbal Allies Quiz will walk you to your
            formula first.
          </p>
          <ul>
            <li>
              <Link href="/soap-builder">Build your own soap</Link>
            </li>
            <li>
              <Link href="/custom-formula/tea">Blend your own tea</Link>
            </li>
            <li>
              <Link href="/custom-formula/capsules">Compose your own capsules</Link>
            </li>
            <li>
              <Link href="/quiz">Take the Herbal Allies Quiz</Link>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function KeepWandering({ product }: { product: Product }) {
  return (
    <section className={styles.keepWandering} aria-label="Keep wandering the apothecary">
      <h2>Keep wandering</h2>
      <p>
        Every shelf here leads to another. If this {product.category === 'Soaps' ? 'bar' : 'blend'}{' '}
        isn't quite the one, the apothecary has other doors: take the{' '}
        <Link href="/quiz">Herbal Allies Quiz</Link> and let Gaia walk you
        to your formula, step up to the{' '}
        <Link href="/soap-builder">Soap Builder</Link> or the{' '}
        <Link href="/custom-formula">Create Your Own</Link> workbench, browse
        the whole <Link href="/shop">shop shelf</Link>, or sit awhile with{' '}
        <Link href="/grimoire">the Living Grimoire of Light &amp; Magic</Link>.
      </p>
    </section>
  );
}
