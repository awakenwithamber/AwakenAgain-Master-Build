/**
 * Gaia nudge card (2026-10-25, copy pack §6).
 *
 * A small, NON-BLOCKING suggestion card from Gaia. It sits bottom-right
 * ABOVE the Gaia FAB (bottom offset clears the FAB, narrow width) so it
 * never covers page controls the way the FAB alone overlapped the
 * builder step chips in Amber's screenshot. One suggestion at a time,
 * always dismissible, never a modal.
 *
 * Timing/selection live in the pure module lib/personalization/
 * gaia-nudges.ts; this component owns the clock (checks in on an
 * interval + on navigation), the overlay coordination, and rendering:
 *   - first nudge ≥60s after load, ≤1 per 7 min, max 3 per session
 *   - dismissing snoozes the next nudge for 7 minutes
 *   - suppressed while the Gaia chat is open ('aa:gaia-chat-open') or
 *     the contact popup is open ('aa:contact-open'); an open overlay
 *     also hides a currently-visible card
 *   - reduced motion: no slide/fade animation
 *
 * Signals are first-party only: page context + the consent-gated
 * interest profile (read via the existing client helpers — a null
 * profile when consent isn't accepted means no profiling) + first-touch
 * utm_source/utm_campaign captured from the landing URL into
 * sessionStorage. No ad-platform data exists on-site; none is used.
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  initialGaiaNudgeRotation,
  nextGaiaNudge,
  recordGaiaNudgeDismissed,
  recordGaiaNudgeShown,
  type GaiaNudge,
  type GaiaNudgeRotation,
} from '../../lib/personalization/gaia-nudges';
import { readProfile } from '../../lib/personalization/interests';
import { getConsentStateNow } from '../../lib/personalization/client';
import {
  CONTACT_CLOSED_EVENT,
  CONTACT_OPEN_EVENT,
  GAIA_CHAT_CLOSED_EVENT,
  GAIA_CHAT_OPEN_EVENT,
} from '../../lib/personalization/overlay-events';
import { openContactPopup } from '../contact/ContactPopup';

const UTM_SOURCE_KEY = 'aa_utm_source';
const UTM_CAMPAIGN_KEY = 'aa_utm_campaign';
const TICK_MS = 5_000;

/** Capture first-touch utm params from the landing URL (once per session). */
function captureFirstTouchUtm(): void {
  try {
    if (!sessionStorage.getItem(UTM_SOURCE_KEY)) {
      const params = new URLSearchParams(window.location.search);
      const source = params.get('utm_source');
      const campaign = params.get('utm_campaign');
      if (source) sessionStorage.setItem(UTM_SOURCE_KEY, source);
      if (campaign) sessionStorage.setItem(UTM_CAMPAIGN_KEY, campaign);
    }
  } catch {
    // Storage unavailable — nudges simply lose the utm signal.
  }
}

function readUtm(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

const cardStyle: React.CSSProperties = {
  position: 'fixed',
  right: '1.25rem',
  // Above the Gaia FAB (FAB sits at bottom 1.25rem) — never over it,
  // never over the page's own bottom-right controls.
  bottom: '5.5rem',
  zIndex: 940,
  width: 'min(19rem, calc(100vw - 2.5rem))',
  background: 'linear-gradient(160deg, var(--plum-mid), var(--plum-deep))',
  border: '1px solid var(--brass)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow)',
  padding: '1rem 1.1rem 0.9rem',
  color: 'var(--text-body)',
};

export function GaiaNudge() {
  const pathname = usePathname();
  const [nudge, setNudge] = useState<GaiaNudge | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const rotationRef = useRef<GaiaNudgeRotation | null>(null);
  const overlayOpenRef = useRef(false);
  const visibleRef = useRef(false);
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  useEffect(() => {
    rotationRef.current = initialGaiaNudgeRotation(Date.now());
    captureFirstTouchUtm();
    try {
      setReducedMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    } catch {
      // matchMedia unavailable — animations stay minimal anyway.
    }

    const setOverlay = (open: boolean) => {
      overlayOpenRef.current = open;
      if (open && visibleRef.current) {
        // An overlay opened over a visible nudge: hide + count as a
        // dismissal so the cadence snoozes instead of nagging on close.
        visibleRef.current = false;
        setNudge(null);
        if (rotationRef.current) {
          rotationRef.current = recordGaiaNudgeDismissed(
            rotationRef.current,
            Date.now(),
          );
        }
      }
    };
    const onOverlayOpen = () => setOverlay(true);
    const onOverlayClosed = () => setOverlay(false);
    window.addEventListener(GAIA_CHAT_OPEN_EVENT, onOverlayOpen);
    window.addEventListener(CONTACT_OPEN_EVENT, onOverlayOpen);
    window.addEventListener(GAIA_CHAT_CLOSED_EVENT, onOverlayClosed);
    window.addEventListener(CONTACT_CLOSED_EVENT, onOverlayClosed);

    const tick = () => {
      if (visibleRef.current || overlayOpenRef.current) return;
      const rotation = rotationRef.current;
      if (!rotation) return;
      // Interest profile ONLY when consent is accepted — the existing
      // helpers enforce the gate for writes; for reads we check the
      // consent state explicitly so a declined visitor is never profiled.
      let profile = null;
      try {
        if (getConsentStateNow() === 'accepted') {
          profile = readProfile(window.localStorage);
        }
      } catch {
        profile = null;
      }
      const next = nextGaiaNudge(
        {
          pathname: pathnameRef.current ?? '/',
          profile,
          utmSource: readUtm(UTM_SOURCE_KEY),
          utmCampaign: readUtm(UTM_CAMPAIGN_KEY),
        },
        rotation,
        Date.now(),
      );
      if (next) {
        rotationRef.current = recordGaiaNudgeShown(
          rotation,
          next.kind,
          Date.now(),
        );
        visibleRef.current = true;
        setNudge(next);
      }
    };
    const interval = setInterval(tick, TICK_MS);
    return () => {
      clearInterval(interval);
      window.removeEventListener(GAIA_CHAT_OPEN_EVENT, onOverlayOpen);
      window.removeEventListener(CONTACT_OPEN_EVENT, onOverlayOpen);
      window.removeEventListener(GAIA_CHAT_CLOSED_EVENT, onOverlayClosed);
      window.removeEventListener(CONTACT_CLOSED_EVENT, onOverlayClosed);
    };
  }, []);

  if (!nudge) return null;

  const dismiss = () => {
    visibleRef.current = false;
    setNudge(null);
    if (rotationRef.current) {
      rotationRef.current = recordGaiaNudgeDismissed(
        rotationRef.current,
        Date.now(),
      );
    }
  };

  return (
    <div
      style={{
        ...cardStyle,
        animation: reducedMotion ? undefined : 'aa-nudge-in 240ms ease-out',
      }}
      role="note"
      aria-label="A suggestion from Gaia"
    >
      <style>{`@keyframes aa-nudge-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } } @media (prefers-reduced-motion: reduce) { div[aria-label="A suggestion from Gaia"] { animation: none !important; } }`}</style>
      <p style={{ margin: '0 2rem 0.7rem 0', lineHeight: 1.55 }}>
        <strong style={{ color: 'var(--parchment)' }}>✦ Gaia: </strong>
        {nudge.text}
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {nudge.href && (
          <Link
            href={nudge.href}
            onClick={() => {
              visibleRef.current = false;
            }}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, var(--brass), var(--brass-lt))',
              color: 'var(--plum-dark)',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '0.92rem',
            }}
          >
            {nudge.ctaLabel}
          </Link>
        )}
        {nudge.offerContact && (
          <button
            type="button"
            onClick={() => {
              dismiss();
              openContactPopup();
            }}
            style={{
              padding: '0.45rem 1rem',
              borderRadius: '999px',
              background: 'transparent',
              border: '1px solid var(--brass)',
              color: 'var(--parchment)',
              fontSize: '0.92rem',
              cursor: 'pointer',
            }}
          >
            Message Amber
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss this suggestion"
        style={{
          position: 'absolute',
          top: '0.55rem',
          right: '0.55rem',
          background: 'transparent',
          border: '1px solid var(--border, var(--aa-gold))',
          borderRadius: '999px',
          color: 'var(--parchment)',
          width: '1.8rem',
          height: '1.8rem',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
