/**
 * PageBackground — per-page faint artwork layer (owner directive
 * 2026-11-12). Renders the route's artwork from lib/page-backgrounds
 * as a decorative, fixed, full-viewport layer behind all content:
 *
 * - aria-hidden + pointer-events-none: it can never be read by
 *   assistive tech, intercept a click, or shift layout;
 * - the image sits at the route's low opacity (0.10–0.18 band) and
 *   the .aa-page-bg-veil plum gradient paints ABOVE the image, so
 *   body/text contrast is unchanged or better — readability first;
 * - z-index discipline mirrors the site-wide .aa-bg-layer (fixed,
 *   z-index: -1): later in the DOM than .aa-bg-layer, so the page
 *   artwork paints above the global shelf layer and below content.
 *
 * Usage: mount once inside the page's <main>, e.g.
 *   <PageBackground route="/grimoire" />
 * Unknown routes render nothing.
 */
import { pageBackgroundFor } from '../../lib/page-backgrounds';

export function PageBackground({ route }: { route: string }) {
  const spec = pageBackgroundFor(route);
  if (!spec) return null;
  return (
    <div className="aa-page-bg" aria-hidden="true" data-bg-route={spec.route}>
      <div
        className="aa-page-bg-img"
        style={{
          backgroundImage: `url("${spec.src}")`,
          opacity: spec.opacity,
        }}
      />
      <div className="aa-page-bg-veil" />
    </div>
  );
}
