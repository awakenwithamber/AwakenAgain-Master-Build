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
        aspectRatio: '5 / 1',
        minHeight: '120px',
        backgroundImage: "url('/images/banners/brand-banner.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
