/**
 * Product like button (Phase 3 Step 3).
 *
 * A like is an explicit tap: it is stored on this device immediately
 * (lib/accounts/likes-local — like the cart, no consent gate for an
 * explicit action), and when the visitor is signed in the toggle sync
 * also replaces the profile's like set with the device's. On the
 * profile page, likes render with titles and can be removed there too.
 */
'use client';

import { useEffect, useState } from 'react';
import { getLocalLikesNow, toggleLikeNow } from '../../lib/accounts/client';
import styles from '../account/account.module.css';

export function LikeButton({ handle }: { handle: string }) {
  const [liked, setLiked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLiked(getLocalLikesNow().includes(handle));
    setMounted(true);
  }, [handle]);

  return (
    <button
      type="button"
      className={styles.likeBtn}
      aria-pressed={mounted ? liked : false}
      onClick={() => setLiked(toggleLikeNow(handle).includes(handle))}
    >
      {liked ? '♥ Liked' : '♡ Like'}
    </button>
  );
}
