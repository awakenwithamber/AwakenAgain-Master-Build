/**
 * Contact page for Amber's Alchemy Apothecary (G5).
 *
 * Server component: metadata + brand layout + verified contact details.
 * The interactive form lives in ContactForm.tsx (client component) —
 * client validation mirrors the server rules in lib/contact/contact.ts,
 * but the SERVER always re-validates (CLIENT=PREVIEW, SERVER=AUTHORITY).
 *
 * Contact identity (verified 2026-10-04): awaken@consultant.com,
 * (801) 414-8984, tel:+18014148984.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '../../components/shop/SiteHeader';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    "Reach Amber at Amber's Alchemy Apothecary — questions about orders, custom soaps, the Living Grimoire, or wholesale. Amber reads every message herself.",
};

const CONTACT_EMAIL = 'awaken@consultant.com';
const CONTACT_PHONE_DISPLAY = '(801) 414-8984';
const CONTACT_PHONE_TEL = 'tel:+18014148984';

export default function ContactPage() {
  return (
    <>
      <SiteHeader />
      <main
        style={{
          maxWidth: '44rem',
          margin: '0 auto',
          padding: '2rem 1.25rem 4rem',
        }}
      >
        <p
          style={{
            color: 'var(--aa-gold)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            fontSize: '0.8rem',
            marginBottom: '0.5rem',
          }}
        >
          Say hello
        </p>
        <h1 style={{ color: 'var(--aa-cream)', marginTop: 0 }}>
          Contact the Apothecary
        </h1>
        <p style={{ color: 'var(--aa-cream-dim)' }}>
          Questions about an order, a custom soap, the Living Grimoire, or a
          collaboration? Send a message below — Amber reads every one herself
          and replies personally.
        </p>

        <section
          aria-label="Direct contact details"
          style={{
            border: '1px solid var(--aa-gold)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            margin: '1.5rem 0 2rem',
            background: 'var(--aa-purple)',
          }}
        >
          <h2
            style={{
              color: 'var(--aa-gold-bright)',
              fontSize: '1rem',
              marginTop: 0,
            }}
          >
            Prefer to reach out directly?
          </h2>
          <p style={{ margin: '0.5rem 0' }}>
            Email:{' '}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              style={{ color: 'var(--aa-gold-bright)' }}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
          <p style={{ margin: '0.5rem 0 0' }}>
            Phone:{' '}
            <a
              href={CONTACT_PHONE_TEL}
              style={{ color: 'var(--aa-gold-bright)' }}
            >
              {CONTACT_PHONE_DISPLAY}
            </a>
          </p>
        </section>

        <ContactForm />

        <section
          aria-label="Connect with Amber"
          style={{
            border: '1px solid var(--aa-gold)',
            borderRadius: '0.75rem',
            padding: '1.25rem',
            margin: '2rem 0 0',
            background: 'var(--aa-purple)',
          }}
        >
          <h2
            style={{
              color: 'var(--aa-gold-bright)',
              fontSize: '1rem',
              marginTop: 0,
            }}
          >
            Connect With Amber
          </h2>
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              margin: '0.5rem 0 0',
              color: 'var(--aa-cream)',
            }}
          >
            <li style={{ marginBottom: '0.6rem' }}>
              📧{' '}
              <a
                href="mailto:awaken@consultant.com"
                style={{ color: 'var(--aa-gold-bright)' }}
              >
                awaken@consultant.com
              </a>
            </li>
            <li style={{ marginBottom: '0.6rem' }}>
              📘 Facebook — follow Awaken With Amber for rituals, drops, and
              live sessions.
            </li>
            <li style={{ marginBottom: '0.6rem' }}>
              📸 @awakenwithamber — daily apothecary notes on Instagram.
            </li>
            <li>
              📅{' '}
              <a
                href="mailto:awaken@consultant.com?subject=Free%20Consultation%20Request"
                style={{ color: 'var(--aa-gold-bright)' }}
              >
                Book a Free Consultation
              </a>{' '}
              — write to arrange a time with Amber.
            </li>
          </ul>
        </section>
      </main>
    </>
  );
}
