/**
 * Journal article header image — client component (workstream G).
 *
 * Wired to /images/journal/<slug>.webp (workstream H may populate later);
 * graceful fallback: a failed load removes the image slot entirely so the
 * layout never shows a broken-image icon.
 */
'use client';

import { useState } from 'react';
import styles from './journal.module.css';

export function JournalImage({
  slug,
  title,
}: {
  slug: string;
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <div className={styles.journalHeroImage}>
      <img
        src={`/images/journal/${slug}.webp`}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
