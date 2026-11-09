/**
 * Profile owner controls — privacy toggles + the progress check-in
 * form (Gaia profile build, Phases A + B).
 *
 * Toggles save through the ONE member-profile endpoint, re-sending
 * the member's current profile with only the toggles changed (the
 * server re-validates everything; the stored photo is kept when no
 * new photo is sent). Every save answers from server truth via
 * router.refresh.
 *
 * The check-in form renders only when the server-composed feed says
 * progress photos are allowed (18+, from the saved birthday) — and
 * the server enforces the same gate again on POST; this form is a
 * convenience, never the authority. Its photo requirement (format,
 * size, EXIF strip) is stated before submit, per the visible-notices
 * rule, and server refusals surface in the prominent banner.
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { splitNormalizedPhone } from '../../lib/accounts/phone';
import type { OwnMemberFeed } from '../../lib/accounts/member-feed';
import accountStyles from './account.module.css';
import styles from './member.module.css';

const MAX_PHOTO_FILE_BYTES = 400 * 1024;

export function PrivacyControls({ feed }: { feed: OwnMemberFeed }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [savedNote, setSavedNote] = useState('');

  const save = async (patch: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    setSavedNote('');
    const split = splitNormalizedPhone(feed.phone);
    const payload: Record<string, unknown> = {
      full_name: feed.full_name,
      birthday: feed.birthday,
      bio: feed.bio,
      phone_country: split?.country.iso2 ?? 'US',
      phone_number: split?.national ?? feed.phone ?? '',
      address: feed.address,
      birth_time: feed.star_chart?.birth_time ?? '',
      birth_place: feed.star_chart?.birth_place ?? '',
      feed_visibility: feed.feed_visibility,
      progress_photos_visibility: feed.progress_photos_visibility,
      progress_reminders_opt_in: feed.progress_reminders_opt_in,
      socials: feed.socials,
      ...patch,
    };
    try {
      const response = await fetch('/api/account/member-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok: boolean; errors?: string[] };
      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Something went wrong saving. Please try again.']);
      } else {
        setSavedNote('Saved — your garden gates are set just so.');
        router.refresh();
      }
    } catch {
      setErrors(['We could not reach the apothecary just now. Please try again.']);
    }
    setBusy(false);
  };

  return (
    <section className={accountStyles.card} aria-label="Privacy controls">
      <h3>🔒 Your garden gates — privacy</h3>
      {errors.length > 0 && (
        <div className={styles.noticeBanner} role="alert">
          <strong>Those settings could not be saved:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {savedNote && <p className={accountStyles.note}>{savedNote}</p>}
      <div className={styles.toggleRow}>
        <span>
          <strong>Feed:</strong> {feed.feed_visibility === 'public' ? 'Public — anyone with your link can visit' : 'Private — only you can see it'}
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void save({ feed_visibility: feed.feed_visibility === 'public' ? 'private' : 'public' })}
        >
          Make it {feed.feed_visibility === 'public' ? 'private' : 'public'}
        </button>
      </div>
      <div className={styles.toggleRow}>
        <span>
          <strong>Progress photos:</strong> {feed.progress_photos_visibility === 'shared' ? 'Shared — visitors can see your timeline' : 'Private — only you can see them (the default)'}
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() =>
            void save({
              progress_photos_visibility: feed.progress_photos_visibility === 'shared' ? 'private' : 'shared',
            })
          }
        >
          {feed.progress_photos_visibility === 'shared' ? 'Make them private' : 'Share them'}
        </button>
      </div>
      <div className={styles.toggleRow}>
        <span>
          <strong>Check-in reminder emails:</strong> {feed.progress_reminders_opt_in ? 'On — one email when a check-in is due' : 'Off'}
        </span>
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => void save({ progress_reminders_opt_in: !feed.progress_reminders_opt_in })}
        >
          Turn them {feed.progress_reminders_opt_in ? 'off' : 'on'}
        </button>
      </div>
      <p className={accountStyles.note}>
        Your address, phone number, and exact birthday are never shown publicly — in any setting.
      </p>
    </section>
  );
}

export function CheckinForm({ feed }: { feed: OwnMemberFeed }) {
  const router = useRouter();
  const [kind, setKind] = useState<'before' | 'after' | 'checkin'>('checkin');
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  if (!feed.reminder.progress_allowed) {
    return (
      <section className={accountStyles.card} aria-label="Progress check-ins">
        <h3>🌱 Progress check-ins</h3>
        <p className={styles.emptyState}>
          Before-and-after progress photos are for members 18 and older — that part of the
          garden opens at 18. Everything else here is fully yours.
        </p>
      </section>
    );
  }

  const readPhoto = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_FILE_BYTES) {
      setErrors(['That photo is larger than 400 KB — please choose a smaller one.']);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
        setErrors([]);
      }
    };
    reader.readAsDataURL(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!photoDataUrl) {
      setErrors(['Please choose this check-in’s photo first.']);
      return;
    }
    setBusy(true);
    setErrors([]);
    setSaved(false);
    try {
      const response = await fetch('/api/account/progress-checkin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, note, photo_data_url: photoDataUrl }),
      });
      const data = (await response.json()) as { ok: boolean; errors?: string[] };
      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Something went wrong saving your check-in. Please try again.']);
      } else {
        setSaved(true);
        setPhotoDataUrl(null);
        setNote('');
        router.refresh();
      }
    } catch {
      setErrors(['We could not reach the apothecary just now. Please try again.']);
    }
    setBusy(false);
  };

  return (
    <section className={accountStyles.card} aria-label="Progress check-ins">
      <h3>🌱 Add a progress check-in</h3>
      {feed.reminder.due ? (
        <div className={styles.reminderBanner} role="status">
          <strong>Your garden is asking for its photo.</strong> A check-in is due — add this
          week’s picture beside your last one and watch how far you’ve come.
        </div>
      ) : (
        <p className={accountStyles.note}>
          Next check-in due{' '}
          {feed.reminder.next_due_at
            ? new Date(feed.reminder.next_due_at).toLocaleDateString()
            : 'soon'}
          {' '}— check-ins come every other week.
        </p>
      )}
      {errors.length > 0 && (
        <div className={styles.noticeBanner} role="alert">
          <strong>That check-in could not be saved:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {saved && <p className={accountStyles.note}>Saved to your timeline ✦</p>}
      <form className={accountStyles.form} onSubmit={submit}>
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="before">Before</option>
            <option value="checkin">Check-in</option>
            <option value="after">After</option>
          </select>
        </label>
        <label>
          Photo (JPG, PNG, or WebP, under 400 KB — location data is stripped before it is stored)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => readPhoto(e.target.files?.[0] ?? null)}
            required
          />
        </label>
        <label>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={280} />
        </label>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save check-in'}
        </button>
      </form>
    </section>
  );
}
