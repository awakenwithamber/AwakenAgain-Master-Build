/**
 * Gaia-guided profile creation — with the owner's skip-or-tour choice
 * (2026-11-08). At the gate the visitor chooses:
 *
 * - TOUR: Gaia walks the garden one feature at a time (lib/chat/
 *   gaia-profile.ts GAIA_TOUR_STOPS), then asks for the profile one
 *   step at a time, each step stating its requirement BEFORE input.
 * - SKIP: straight to the plain form — the SAME fields, the SAME
 *   privacy rules, all requirements listed at the top.
 *
 * Both paths end the same way: the profile saves, and Gaia's quiz
 * invitation stands prominent (the quiz feeds the feed's herbal
 * allies). Server refusals return as a prominent banner where the
 * action happens (visible-notices rule) — never a small hidden line.
 *
 * Client checks are a preview only: POST /api/account/member-profile
 * re-validates everything server-side (required fields, the 13+ age
 * gate, the EXIF/GPS photo strip, the automatic star chart).
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  GAIA_MODE_QUESTION,
  GAIA_PROFILE_DONE,
  GAIA_PROFILE_GREETING,
  GAIA_PROFILE_STEPS,
  GAIA_QUIZ_INVITATION,
  GAIA_TOUR_STOPS,
} from '../../lib/chat/gaia-profile';
import { splitNormalizedPhone } from '../../lib/accounts/phone';
import type { OwnMemberFeed } from '../../lib/accounts/member-feed';
import {
  AddressFields,
  addressFieldsFromSaved,
  addressPayload,
  type AddressFieldValues,
} from './AddressFields';
import { PhoneField } from './PhoneField';
import accountStyles from './account.module.css';
import styles from './member.module.css';

interface GaiaProfileFlowProps {
  /** The existing profile when editing; null when creating. */
  initial: OwnMemberFeed | null;
}

const MAX_PHOTO_FILE_BYTES = 400 * 1024;
type Mode = 'choose' | 'tour' | 'form';

export function GaiaProfileFlow({ initial }: GaiaProfileFlowProps) {
  const router = useRouter();
  const editing = initial !== null;
  const split = splitNormalizedPhone(initial?.phone);

  // Editing skips the gate choice — the member knows the garden.
  const [mode, setMode] = useState<Mode>(editing ? 'form' : 'choose');
  const [tourIndex, setTourIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [fullName, setFullName] = useState(initial?.full_name ?? '');
  const [birthday, setBirthday] = useState(initial?.birthday ?? '');
  const [bio, setBio] = useState(initial?.bio ?? '');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [phoneCountry, setPhoneCountry] = useState(split?.country.iso2 ?? 'US');
  const [phoneNumber, setPhoneNumber] = useState(split?.national ?? '');
  const [address, setAddress] = useState<AddressFieldValues>(
    addressFieldsFromSaved(initial?.address ?? null),
  );
  const [birthTime, setBirthTime] = useState(initial?.star_chart?.birth_time ?? '');
  const [birthPlace, setBirthPlace] = useState(initial?.star_chart?.birth_place ?? '');
  const [facebook, setFacebook] = useState(initial?.socials.facebook ?? '');
  const [tiktok, setTiktok] = useState(initial?.socials.tiktok ?? '');
  const [instagram, setInstagram] = useState(initial?.socials.instagram ?? '');
  const [feedVisibility, setFeedVisibility] = useState<'public' | 'private'>(
    initial?.feed_visibility ?? 'public',
  );
  const [photosVisibility, setPhotosVisibility] = useState<'private' | 'shared'>(
    initial?.progress_photos_visibility ?? 'private',
  );
  const [remindersOptIn, setRemindersOptIn] = useState(
    initial?.progress_reminders_opt_in ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const step = GAIA_PROFILE_STEPS[stepIndex];
  const isLastStep = stepIndex === GAIA_PROFILE_STEPS.length - 1;
  const inFieldSteps = mode === 'tour' && tourIndex >= GAIA_TOUR_STOPS.length;

  const readPhoto = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_PHOTO_FILE_BYTES) {
      setErrors([
        'That photo is larger than 400 KB — please choose a smaller one. (The limit is stated before you submit, on purpose.)',
      ]);
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

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    const payload: Record<string, unknown> = {
      full_name: fullName,
      birthday,
      bio,
      phone_country: phoneCountry,
      phone_number: phoneNumber,
      address: addressPayload(address),
      birth_time: birthTime,
      birth_place: birthPlace,
      feed_visibility: feedVisibility,
      progress_photos_visibility: photosVisibility,
      progress_reminders_opt_in: remindersOptIn,
      socials: { facebook, tiktok, instagram },
    };
    if (photoDataUrl) payload.photo_data_url = photoDataUrl;
    try {
      const response = await fetch('/api/account/member-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { ok: boolean; errors?: string[] };
      if (!response.ok || !data.ok) {
        setErrors(data.errors ?? ['Something went wrong saving your profile. Please try again.']);
        setBusy(false);
        return;
      }
      setDone(true);
      setBusy(false);
      router.refresh();
    } catch {
      setErrors(['We could not reach the apothecary just now. Please try again.']);
      setBusy(false);
    }
  };

  const errorBanner = errors.length > 0 && (
    <div className={styles.noticeBanner} role="alert">
      <strong>Gaia could not plant that yet:</strong>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );

  const privacyFields = (
    <div>
      <div className={styles.toggleRow}>
        <span>
          <strong>Feed visibility</strong>
          <br />
          Public lets friends find your garden; Private keeps the whole feed to you.
        </span>
        <select
          value={feedVisibility}
          onChange={(e) => setFeedVisibility(e.target.value as 'public' | 'private')}
          aria-label="Feed visibility"
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
      </div>
      <div className={styles.toggleRow}>
        <span>
          <strong>Progress photos</strong>
          <br />
          Private by default — shared only if you choose, and only for members 18+.
        </span>
        <select
          value={photosVisibility}
          onChange={(e) => setPhotosVisibility(e.target.value as 'private' | 'shared')}
          aria-label="Progress photos visibility"
        >
          <option value="private">Private</option>
          <option value="shared">Shared</option>
        </select>
      </div>
      <div className={styles.toggleRow}>
        <span>
          <strong>Check-in reminder emails</strong>
          <br />
          Opt-in only. Every reminder carries a one-click unsubscribe.
        </span>
        <select
          value={remindersOptIn ? 'on' : 'off'}
          onChange={(e) => setRemindersOptIn(e.target.value === 'on')}
          aria-label="Check-in reminder emails"
        >
          <option value="off">Off</option>
          <option value="on">On — remind me</option>
        </select>
      </div>
    </div>
  );

  const photoField = (
    <div>
      {(photoDataUrl ?? initial?.photo_data_url) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.photoPreview}
          src={photoDataUrl ?? initial?.photo_data_url}
          alt="Your profile photo"
        />
      )}
      <label>
        Profile photo (JPG, PNG, or WebP, under 400 KB — location data is stripped before it is stored)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => readPhoto(e.target.files?.[0] ?? null)}
          required={!editing}
        />
      </label>
    </div>
  );

  if (done) {
    return (
      <div className={accountStyles.card}>
        <div className={styles.gaiaBubble}>
          <p className={styles.gaiaName}>Gaia</p>
          <p>{GAIA_PROFILE_DONE}</p>
        </div>
        <div className={styles.reminderBanner} role="status">
          <strong>{GAIA_QUIZ_INVITATION.heading}</strong>
          <p>{GAIA_QUIZ_INVITATION.body}</p>
          <p className={accountStyles.actions}>
            <a className="btn-primary" href={GAIA_QUIZ_INVITATION.ctaHref}>
              {GAIA_QUIZ_INVITATION.ctaLabel}
            </a>{' '}
            <a className="btn-secondary" href="/profile">
              See your feed →
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (mode === 'choose') {
    return (
      <div className={accountStyles.card}>
        <div className={styles.gaiaBubble}>
          <p className={styles.gaiaName}>Gaia</p>
          <p>{GAIA_PROFILE_GREETING}</p>
          <p>{GAIA_MODE_QUESTION}</p>
        </div>
        <p className={accountStyles.actions}>
          <button type="button" className="btn-primary" onClick={() => setMode('tour')}>
            Take Gaia’s tour ✦
          </button>{' '}
          <button type="button" className="btn-secondary" onClick={() => setMode('form')}>
            Skip — straight to the form
          </button>
        </p>
      </div>
    );
  }

  if (mode === 'tour' && !inFieldSteps) {
    const stop = GAIA_TOUR_STOPS[tourIndex];
    return (
      <div className={accountStyles.card}>
        <div className={styles.gaiaBubble}>
          <p className={styles.gaiaName}>Gaia’s tour · {tourIndex + 1} of {GAIA_TOUR_STOPS.length}</p>
          <p>
            <strong>{stop.title}</strong>
          </p>
          <p>{stop.body}</p>
        </div>
        <div className={styles.stepNav}>
          <button
            type="button"
            className="btn-secondary"
            disabled={tourIndex === 0}
            onClick={() => setTourIndex((i) => Math.max(0, i - 1))}
          >
            ← Back
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setMode('form')}
          >
            Skip the rest — the form, please
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setTourIndex((i) => i + 1)}
          >
            {tourIndex === GAIA_TOUR_STOPS.length - 1 ? 'Now let’s plant my profile →' : 'Next wonder →'}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'form') {
    return (
      <div className={accountStyles.card}>
        {errorBanner}
        <h2>{editing ? 'Your profile' : 'Create your profile'}</h2>
        <p className={styles.requirement}>
          Required: your full name, your birthday (profiles are 13+; your exact birthday is
          never shown publicly — only your sun sign), a brief bio, and a profile photo (JPG,
          PNG, or WebP under 400 KB; location data is stripped before storage). Optional:
          phone, address (never shown publicly), birth time and place for your fuller star
          chart, and your social profile links.
        </p>
        <form
          className={accountStyles.form}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </label>
          <label>
            Birthday
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} required />
          </label>
          <label>
            Brief bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} required />
          </label>
          {photoField}
          <PhoneField
            idPrefix="gaia-profile"
            country={phoneCountry}
            number={phoneNumber}
            onChange={(country, number) => {
              setPhoneCountry(country);
              setPhoneNumber(number);
            }}
          />
          <AddressFields
            idPrefix="gaia-profile"
            values={address}
            onChange={setAddress}
            legend="Your address (optional — never shown publicly)"
          />
          <label>
            Birth time (optional, 24-hour)
            <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
          </label>
          <label>
            Birth place (optional)
            <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="City, State / Country" />
          </label>
          <label>
            Facebook (handle or profile link)
            <input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
          </label>
          <label>
            TikTok (handle or profile link)
            <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
          </label>
          <label>
            Instagram (handle or profile link)
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
          </label>
          {privacyFields}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Planting…' : editing ? 'Save my profile' : 'Plant my profile'}
          </button>
        </form>
      </div>
    );
  }

  // Tour mode, field steps.
  return (
    <div className={accountStyles.card}>
      {errorBanner}
      <div className={styles.gaiaBubble}>
        <p className={styles.gaiaName}>Gaia</p>
        <p>{step.prompt}</p>
      </div>
      <p className={styles.requirement}>{step.requirement}</p>
      <form
        className={accountStyles.form}
        onSubmit={(e) => {
          e.preventDefault();
          if (isLastStep) void submit();
          else setStepIndex((i) => Math.min(i + 1, GAIA_PROFILE_STEPS.length - 1));
        }}
      >
        {step.field === 'full_name' && (
          <label>
            Full name
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
          </label>
        )}
        {step.field === 'birthday' && (
          <label>
            Birthday
            <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} required />
          </label>
        )}
        {step.field === 'bio' && (
          <label>
            Brief bio
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={500} required />
          </label>
        )}
        {step.field === 'photo' && photoField}
        {step.field === 'phone' && (
          <PhoneField
            idPrefix="gaia-profile"
            country={phoneCountry}
            number={phoneNumber}
            onChange={(country, number) => {
              setPhoneCountry(country);
              setPhoneNumber(number);
            }}
          />
        )}
        {step.field === 'address' && (
          <AddressFields
            idPrefix="gaia-profile"
            values={address}
            onChange={setAddress}
            legend="Your address (optional — never shown publicly)"
          />
        )}
        {step.field === 'birth_chart' && (
          <>
            <label>
              Birth time (optional, 24-hour)
              <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            </label>
            <label>
              Birth place (optional)
              <input value={birthPlace} onChange={(e) => setBirthPlace(e.target.value)} placeholder="City, State / Country" />
            </label>
          </>
        )}
        {step.field === 'socials' && (
          <>
            <label>
              Facebook (handle or profile link)
              <input value={facebook} onChange={(e) => setFacebook(e.target.value)} />
            </label>
            <label>
              TikTok (handle or profile link)
              <input value={tiktok} onChange={(e) => setTiktok(e.target.value)} />
            </label>
            <label>
              Instagram (handle or profile link)
              <input value={instagram} onChange={(e) => setInstagram(e.target.value)} />
            </label>
          </>
        )}
        {step.field === 'privacy' && privacyFields}

        <div className={styles.stepNav}>
          <button
            type="button"
            className="btn-secondary"
            disabled={stepIndex === 0 || busy}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            ← Back
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {isLastStep ? (busy ? 'Planting…' : editing ? 'Save my profile' : 'Plant my profile') : 'Continue →'}
          </button>
        </div>
        <p className={styles.requirement}>
          Step {stepIndex + 1} of {GAIA_PROFILE_STEPS.length} · Address, phone, and your exact
          birthday are never shown publicly — only your sun sign is.
        </p>
      </form>
    </div>
  );
}
