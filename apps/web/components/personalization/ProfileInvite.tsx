/**
 * Profile invite (owner spec 2026-10-14): a gentle one-line prompt at a
 * save-moment (soap-builder reveal, quiz results, cart, order success).
 * Never a popup, never on a first visit, shown at most once per moment
 * per visitor, dismissible. It points only at flows that exist today —
 * the newsletter or the Living Grimoire email sign-in — because saved
 * profiles are Phase 3. Visibility rules live in
 * lib/personalization/invites.ts (unit-tested).
 */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { inviteVisibleNow } from '../../lib/personalization/client';
import {
  INVITE_COPY,
  type InviteMoment,
} from '../../lib/personalization/invites';
import styles from './personalization.module.css';

export function ProfileInvite({ moment }: { moment: InviteMoment }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // inviteVisibleNow applies the tested rules (not a first visit, not
    // seen before) and marks the moment seen as it shows — once, ever.
    setVisible(inviteVisibleNow(moment));
  }, [moment]);

  if (!visible) return null;
  const copy = INVITE_COPY[moment];

  return (
    <div className={styles.invite} role="note" aria-label="A note from the apothecary">
      <p className={styles.inviteLine}>{copy.line}</p>
      <Link className={styles.inviteCta} href={copy.ctaHref}>
        {copy.ctaLabel}
      </Link>
      <button
        type="button"
        className={styles.inviteDismiss}
        aria-label="Dismiss this note"
        onClick={() => setVisible(false)}
      >
        ×
      </button>
    </div>
  );
}
