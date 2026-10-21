/**
 * The signed-in profile for /account (Phase 3 Step 3).
 *
 * Renders the server-composed ProfileView (account fold + linked quiz
 * leads + order history) with the interactive pieces as client
 * actions: remove a like/search, sync this device, download the data
 * export, delete the account. Every action goes through the
 * /api/account/* routes — this component holds no authority.
 */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  adoptServerLikes,
  syncDeviceToProfile,
} from '../../lib/accounts/client';
import { formatPrice } from '../../lib/pricing/pricing';
import type { ProfileView } from '../../lib/accounts/profile';
import styles from './account.module.css';

/**
 * Payment-method labels — mirrored from lib/orders/payments.ts
 * (paymentMethodLabel). That module reads ledgers with node:fs and so
 * cannot enter a client bundle; the labels are duplicated here
 * deliberately, and the admin/orders surfaces keep the source copy.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash_app_or_venmo: 'Cash App / Venmo',
  bookipi_card_invoice: 'Card — Bookipi invoice',
  stripe_card_embedded: 'Card — embedded checkout',
};

function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

const INTEREST_LABELS: Record<string, string> = {
  herbs: 'Herbs',
  soaps: 'Soaps',
  grimoire: 'Grimoire',
  readings: 'Readings',
  quiz: 'Quiz',
  articles: 'Articles',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok && json.ok === true, json };
  } catch {
    return { ok: false, json: {} };
  }
}

function SubscriptionSection({ profile }: { profile: ProfileView }) {
  const [portalError, setPortalError] = useState<string | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const sub = profile.subscription;

  const openPortal = async () => {
    if (portalBusy) return;
    setPortalBusy(true);
    setPortalError(null);
    const res = await postJson('/api/subscriptions/portal', {});
    const url = res.json.url as string | undefined;
    if (res.ok && url) {
      window.location.assign(url);
      return;
    }
    const errors = res.json.errors as string[] | undefined;
    setPortalError(errors?.[0] ?? 'Could not open subscription management.');
    setPortalBusy(false);
  };

  return (
    <section className={styles.card} aria-labelledby="account-subscription">
      <h2 id="account-subscription">Living Grimoire membership</h2>
      {!sub || sub.display_status === 'none' ? (
        <p>
          No Living Grimoire membership under this email yet.{' '}
          <Link href="/grimoire/subscribe">Join the Living Grimoire →</Link>
        </p>
      ) : sub.display_status === 'active' ? (
        <p>
          <strong>Active.</strong>{' '}
          {sub.paid_through || sub.current_period_end
            ? `Your current paid period runs through ${fmtDate(
                (sub.paid_through ?? sub.current_period_end) as string,
              )}${
                sub.has_stripe_subscription
                  ? ' — your card renews it automatically unless you cancel.'
                  : '.'
              }`
            : sub.has_stripe_subscription
              ? 'Your card renews it automatically each month unless you cancel.'
              : 'Amber confirmed your membership personally.'}
        </p>
      ) : sub.display_status === 'past_due' ? (
        <p role="alert">
          <strong>Your payment failed.</strong> Your access continues until{' '}
          {sub.grace_deadline ? fmtDate(sub.grace_deadline) : 'the end of the grace period'}{' '}
          — update your card to keep access.
        </p>
      ) : sub.display_status === 'past_due_lapsed' ? (
        <p>
          <strong>Your payment failed</strong> and the grace period has ended, so
          membership access is paused. Update your card to reactivate — a
          successful payment restores access right away.
        </p>
      ) : sub.display_status === 'cancel_at_period_end' ||
        sub.display_status === 'ending_paid_through' ? (
        <p>
          <strong>Cancelling.</strong> Your membership ends when the paid period
          ends
          {sub.paid_through
            ? ` on ${fmtDate(sub.paid_through)}`
            : ''}
          {' '}— you keep full access until then, and you will not be charged again.
        </p>
      ) : sub.display_status === 'lapsed' ? (
        <p>
          <strong>Membership lapsed.</strong> Your paid period has ended.{' '}
          <Link href="/grimoire/subscribe">Reactivate your membership →</Link>{' '}
          — a new subscription or a successful payment restores access.
        </p>
      ) : sub.display_status === 'pending_payment' ? (
        <p>
          <strong>Awaiting payment.</strong> Your signup is recorded; membership
          starts when payment is confirmed.
        </p>
      ) : (
        <p>
          <strong>Membership cancelled.</strong>{' '}
          <Link href="/grimoire/subscribe">Rejoin the Living Grimoire →</Link>
        </p>
      )}
      {sub?.has_stripe_subscription ? (
        <div className={styles.actions}>
          <button
            className="btn-secondary"
            type="button"
            onClick={openPortal}
            disabled={portalBusy}
          >
            {portalBusy ? 'Opening…' : 'Manage / cancel subscription'}
          </button>
          {portalError ? (
            <p className={styles.meta} role="alert">
              {portalError}
            </p>
          ) : null}
        </div>
      ) : null}
      <p className={styles.meta}>
        The separate $8.88 permanent unlock, if you hold one, is never affected
        by subscription cancellation.
      </p>
    </section>
  );
}

export function AccountProfile({ profile }: { profile: ProfileView }) {
  const [likes, setLikes] = useState(profile.likes);
  const [searches, setSearches] = useState(profile.searches);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const removeLike = async (handle: string) => {
    const next = likes.filter((l) => l.handle !== handle);
    const res = await postJson('/api/account/likes', {
      likes: next.map((l) => l.handle),
      mode: 'replace',
    });
    if (res.ok) {
      setLikes(next);
      adoptServerLikes(next.map((l) => l.handle));
    }
  };

  const removeSearch = async (id: string) => {
    const res = await postJson('/api/account/searches', {
      action: 'remove',
      search_id: id,
    });
    if (res.ok) {
      setSearches(
        (res.json.searches as ProfileView['searches'] | undefined) ??
          searches.filter((s) => s.id !== id),
      );
    }
  };

  const signOut = async () => {
    await postJson('/api/account/sign-out', {});
    window.location.assign('/account');
  };

  const sync = async () => {
    const ok = await syncDeviceToProfile();
    setSyncNote(
      ok
        ? 'Synced — reloading your profile…'
        : 'Sync did not land. Please try again in a moment.',
    );
    if (ok) window.location.reload();
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);
    const res = await postJson('/api/account/delete', {
      confirm_email: confirmEmail.trim(),
    });
    if (res.ok) {
      window.location.assign('/account');
      return;
    }
    const errors = res.json.errors as string[] | undefined;
    setDeleteError(errors?.[0] ?? 'Deletion did not go through. Please try again.');
  };

  const interestEntries = profile.progress?.interests
    ? Object.entries(profile.progress.interests).filter(([, v]) => v > 0)
    : [];

  return (
    <>
      <section className={styles.card} aria-labelledby="account-overview">
        <h2 id="account-overview">Welcome back</h2>
        <p>
          Signed in as <strong>{profile.email}</strong>
          {profile.created_at
            ? ` · profile created ${fmtDate(profile.created_at)}`
            : ''}
          .
        </p>
        <div className={styles.actions}>
          <button className="btn-secondary" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>

      <SubscriptionSection profile={profile} />

      <section className={styles.card} aria-labelledby="account-allies">
        <h2 id="account-allies">✦ Your herbal allies</h2>
        {profile.quiz_results.length === 0 ? (
          <p>
            No quiz results saved yet.{' '}
            <Link href="/quiz">Take the Herbal Allies Quiz</Link> and your
            allies will live here.
          </p>
        ) : (
          profile.quiz_results.map((saved, i) => (
            <div key={`${saved.saved_at}-${i}`}>
              <h3>
                {saved.result.concernLabel} · {saved.result.formLabel}
              </h3>
              <p className={styles.meta}>
                {fmtDate(saved.saved_at)} ·{' '}
                {saved.via === 'lead'
                  ? 'saved from your earlier quiz visit'
                  : 'saved from your quiz'}
              </p>
              <ul className={styles.allyList}>
                {saved.result.allies.map((ally) => (
                  <li key={ally.name}>
                    <strong>{ally.name}</strong> <em>({ally.latin})</em> —{' '}
                    {ally.note}
                  </li>
                ))}
              </ul>
              {saved.result.productHandles.length > 0 && (
                <p>
                  From the apothecary:{' '}
                  {saved.result.productHandles.map((handle, j) => (
                    <span key={handle}>
                      {j > 0 ? ' · ' : ''}
                      <Link href={`/shop/${handle}`}>{handle}</Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
          ))
        )}
      </section>

      <section className={styles.card} aria-labelledby="account-likes">
        <h2 id="account-likes">♥ Your likes</h2>
        {likes.length === 0 ? (
          <p>
            Nothing liked yet. Tap the heart on any{' '}
            <Link href="/shop">product</Link> and it will be kept here.
          </p>
        ) : (
          <ul className={styles.list}>
            {likes.map((like) => (
              <li key={like.handle} className={styles.listRow}>
                <Link href={`/shop/${like.handle}`}>{like.title}</Link>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeLike(like.handle)}
                  aria-label={`Remove ${like.title} from your likes`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="account-searches">
        <h2 id="account-searches">Saved searches</h2>
        {searches.length === 0 ? (
          <p>
            No saved searches yet. Use “Save this search” in the catalog
            search or the Herb Explorer and it will be kept here.
          </p>
        ) : (
          <ul className={styles.list}>
            {searches.map((search) => (
              <li key={search.id} className={styles.listRow}>
                <span>
                  <Link
                    href={search.surface === 'herbs' ? '/herb-index' : '/shop'}
                  >
                    “{search.query}”
                  </Link>{' '}
                  <span className={styles.meta}>
                    {search.surface === 'herbs' ? 'Herb Explorer' : 'Catalog'} ·{' '}
                    {fmtDate(search.saved_at)}
                  </span>
                </span>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeSearch(search.id)}
                  aria-label={`Remove saved search ${search.query}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="account-progress">
        <h2 id="account-progress">Your journey</h2>
        <p>
          {profile.progress?.quiz_completed_at
            ? `Herbal Allies Quiz completed — ${fmtDate(profile.progress.quiz_completed_at)}.`
            : 'Herbal Allies Quiz not completed yet.'}{' '}
          <Link href="/quiz">Visit the quiz →</Link>
        </p>
        {interestEntries.length > 0 ? (
          <div>
            {interestEntries.map(([category, score]) => (
              <div key={category} className={styles.progressRow}>
                <span className={styles.progressLabel}>
                  {INTEREST_LABELS[category] ?? category}
                </span>
                <span className={styles.progressTrack}>
                  <span
                    className={styles.progressFill}
                    style={{ width: `${Math.min(100, (score / 30) * 100)}%` }}
                  />
                </span>
                <span className={styles.meta}>{score}</span>
              </div>
            ))}
            <p className={styles.meta}>
              The interests this device has gathered, saved to your
              profile on sync.
            </p>
          </div>
        ) : (
          <p className={styles.meta}>
            No interest journey synced yet — use “Sync this device” below
            after browsing with analytics consent on.
          </p>
        )}
      </section>

      <section className={styles.card} aria-labelledby="account-orders">
        <h2 id="account-orders">Order history</h2>
        {profile.orders.length === 0 ? (
          <p>
            No orders under this email yet. When you order with this
            address, your orders will appear here.
          </p>
        ) : (
          <ul className={styles.list}>
            {profile.orders.map((order) => (
              <li key={order.order_id} className={styles.listRow}>
                <span>
                  <strong>{order.order_id}</strong>{' '}
                  <span className={styles.meta}>
                    {fmtDate(order.created_at)} · {order.item_count}{' '}
                    {order.item_count === 1 ? 'item' : 'items'} ·{' '}
                    {formatPrice(order.total_cents)} ·{' '}
                    {paymentMethodLabel(order.payment_method)}
                  </span>
                </span>
                <span className={styles.meta}>
                  {order.status === 'paid'
                    ? '✓ Paid'
                    : order.status === 'cancelled'
                      ? 'Cancelled'
                      : order.status === 'refunded'
                        ? 'Refunded'
                        : order.status === 'disputed'
                          ? 'Disputed'
                          : 'Awaiting payment'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.meta}>
          Looking up a delivery? <Link href="/order-status">Order Status</Link>{' '}
          has tracking.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="account-data">
        <h2 id="account-data">Your data</h2>
        <p>
          Everything stored for your account — profile, quiz results,
          leads, and orders — in one file, whenever you want it.
        </p>
        <div className={styles.actions}>
          <a className="btn-primary" href="/api/account/export" download>
            Download my data
          </a>
          <button className="btn-secondary" type="button" onClick={sync}>
            Sync this device
          </button>
        </div>
        {syncNote && <p className={styles.meta}>{syncNote}</p>}
      </section>

      <section
        className={`${styles.card} ${styles.dangerZone}`}
        aria-labelledby="account-delete"
      >
        <h2 id="account-delete">Delete my account</h2>
        <p>
          Deleting closes the account for good: you will no longer be
          able to sign in with this email, and your profile, likes,
          searches, and saved results stop being shown. Past order
          records live in the apothecary&apos;s order ledger and are not
          erased — they simply stop appearing here.
        </p>
        {!deleteOpen ? (
          <button
            className={styles.deleteBtn}
            type="button"
            onClick={() => setDeleteOpen(true)}
          >
            Delete my account…
          </button>
        ) : (
          <form className={styles.deleteForm} onSubmit={deleteAccount}>
            <label>
              Type your account email to confirm
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={profile.email}
                autoComplete="off"
                required
              />
            </label>
            {deleteError && (
              <p className={styles.errors} role="alert">
                {deleteError}
              </p>
            )}
            <button className={styles.deleteBtn} type="submit">
              Permanently delete my account
            </button>
          </form>
        )}
      </section>
    </>
  );
}
