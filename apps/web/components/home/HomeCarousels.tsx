/**
 * The two homepage carousels (owner directive 2026-10-30) — server
 * component: builds card models from the canonical catalog and hands
 * them to the client carousel.
 *
 *  - "The Apothecary Shelf" — products that honestly resolve a display
 *    image come first (a picture shelf should show pictures), then the
 *    rest of the priced, purchasable catalog; capped so the glide
 *    stays a glide.
 *  - "The Soap Shelf" — every priced, purchasable soap.
 * Superseded reference listings are excluded from both, exactly as
 * they are excluded from the shop grid. Pricing is display-only from
 * the catalog (toCardModel); the server recomputes at checkout.
 */
import { PRODUCTS } from '../../lib/catalog/products';
import { isSupersededProduct } from '../../lib/catalog/status';
import { getProductDisplayImage } from '../../lib/media/product-image';
import { toCardModel, type HomeProductCardModel } from './product-cards';
import { ProductCarousel } from './ProductCarousel';

const SHELF_CAP = 16;

function models(
  products: typeof PRODUCTS,
): HomeProductCardModel[] {
  const out: HomeProductCardModel[] = [];
  for (const p of products) {
    const m = toCardModel(p);
    if (m) out.push(m);
  }
  return out;
}

export function HomeCarousels() {
  const purchasable = PRODUCTS.filter(
    (p) => !isSupersededProduct(p) && typeof p.price === 'number',
  );
  const withImages = purchasable.filter((p) => getProductDisplayImage(p));
  const withoutImages = purchasable.filter((p) => !getProductDisplayImage(p));
  const shelf = models([...withImages, ...withoutImages]).slice(0, SHELF_CAP);
  const soaps = models(purchasable.filter((p) => p.category === 'Soaps'));

  return (
    <>
      <ProductCarousel
        id="product-carousel"
        title="The Apothecary Shelf"
        sub="Glide along the shelf — every jar, bar, and bundle, one click from its own page. 🌿"
        cards={shelf}
      />
      <ProductCarousel
        id="soap-carousel"
        title="The Soap Shelf"
        sub="Every handcrafted bar in the lineup — roses, waves, and rounds, scented by the garden. ✨"
        cards={soaps}
      />
    </>
  );
}
