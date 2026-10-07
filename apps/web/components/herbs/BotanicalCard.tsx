'use client';

/**
 * Workstream E — Botanical index-card modal.
 *
 * Dark modal card per the Netlify source-of-truth design (§10): gradient
 * card, 220px illustration header with bottom fade, Cinzel Decorative name,
 * Cormorant italic brass Latin name, properties/uses, circular close ✕.
 *
 * A11y: role="dialog" aria-modal, Escape closes, focus moves into the dialog
 * on open and returns to the opener on close, body scroll locked while open.
 *
 * All associations shown are traditional/energetic associations from the
 * apothecary's own archive — never clinical efficacy claims.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { CATEGORY_LABELS, type HerbRecord } from '../../lib/herbs/herb-data';

export function BotanicalCard({
  herb,
  onClose,
}: {
  herb: HerbRecord;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      // Lightweight focus trap: keep Tab cycling inside the dialog.
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, a[href]',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="aa-botanical-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="aa-botanical-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aa-botanical-name"
      >
        <button
          ref={closeRef}
          type="button"
          className="aa-botanical-close"
          onClick={onClose}
          aria-label={`Close botanical card for ${herb.name}`}
        >
          ✕
        </button>

        {herb.illustration && (
          <div className="aa-botanical-header">
            <img
              src={herb.illustration}
              alt={`Botanical illustration of ${herb.name}`}
              loading="lazy"
            />
          </div>
        )}

        <div className="aa-botanical-body">
          <div className="aa-botanical-emoji" aria-hidden="true">
            🌿
          </div>
          <h2 id="aa-botanical-name" className="aa-botanical-name">
            {herb.name}
          </h2>
          <p className="aa-botanical-latin">
            <em>{herb.latin}</em>
          </p>

          <div className="aa-botanical-cats" aria-label="Traditional associations">
            {herb.categories.map((c) => (
              <span key={c} className="aa-botanical-cat">
                {CATEGORY_LABELS[c]}
              </span>
            ))}
          </div>

          <h3 className="aa-botanical-section-title">✦ Properties &amp; Uses</h3>
          <p className="aa-botanical-props">{herb.energetic}</p>

          <p className="aa-botanical-evidence-note">
            These are traditional and energetic associations from the apothecary&apos;s
            archive — a reflection of how herbalists have worked with {herb.name} across
            generations, not a medical claim.
          </p>

          <Link href={`/herbal-library/${herb.slug}`} className="aa-botanical-library-link">
            View the full library entry →
          </Link>
        </div>
      </div>
    </div>
  );
}
