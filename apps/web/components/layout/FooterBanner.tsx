/**
 * Brand banner — full-width apothecary banner above the footer.
 *
 * Uses Amber's branded banner artwork (moon, lavender, "Amber's Alchemy
 * Apothecary" with "Awaken • Heal • Align • Create"). Purely decorative;
 * the footer below carries the navigational links.
 */
export function FooterBanner() {
  return (
    <div
      role="img"
      aria-label="Amber's Alchemy Apothecary — Awaken, Heal, Align, Create. Ancient Wisdom, Modern Magic, A Kinder World."
      style={{
        width: '100%',
        height: 'clamp(90px, 10vw, 160px)',
        backgroundImage: "url('/images/brand/brand-banner.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
