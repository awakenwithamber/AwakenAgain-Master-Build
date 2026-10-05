/** Minimal storefront header — server component. */
export function SiteHeader() {
  return (
    <header>
      <nav aria-label="Storefront">
        <p>
          <strong>Amber&apos;s Alchemy Apothecary</strong>
        </p>
        <ul>
          <li>
            <a href="/shop">Shop</a>
          </li>
          <li>
            <a href="/soap-shop">Soap Shop</a>
          </li>
          <li>
            <a href="/about">About Amber</a>
          </li>
          <li>
            <a href="/cart">Cart</a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
