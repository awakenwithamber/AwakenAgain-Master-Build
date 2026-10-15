import { describe, expect, it } from 'vitest';
import {
  validateAffiliateInterest,
  validateNewsletter,
  validatePartnerIdea,
  validateQuizLead,
} from './validation';

describe('validateQuizLead', () => {
  const good = {
    name: 'Amber',
    email: '  A.Friend@Example.COM ',
    consent: true,
    concernId: 'sleep',
    formId: 'tea',
  };

  it('accepts a valid payload and normalizes it', () => {
    const r = validateQuizLead(good);
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      name: 'Amber',
      email: 'a.friend@example.com',
      consent: true,
      concernId: 'sleep',
      formId: 'tea',
    });
  });

  it('rejects missing/invalid email and missing consent', () => {
    expect(validateQuizLead({ ...good, email: 'not-an-email' }).ok).toBe(false);
    expect(validateQuizLead({ ...good, consent: false }).ok).toBe(false);
    expect(validateQuizLead({ ...good, consent: undefined }).ok).toBe(false);
  });

  it('rejects unknown quiz ids (no orphan leads)', () => {
    expect(validateQuizLead({ ...good, concernId: 'zzz' }).ok).toBe(false);
    expect(validateQuizLead({ ...good, formId: 'pill' }).ok).toBe(false);
  });

  it('rejects empty name and non-object bodies', () => {
    expect(validateQuizLead({ ...good, name: '   ' }).ok).toBe(false);
    expect(validateQuizLead(null).ok).toBe(false);
    expect(validateQuizLead('x').ok).toBe(false);
  });
});

describe('validateNewsletter', () => {
  it('accepts a valid signup', () => {
    const r = validateNewsletter({
      email: 'Friend@Example.com',
      consent: true,
      placement: 'footer',
    });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      email: 'friend@example.com',
      placement: 'footer',
    });
  });

  it('defaults placement to footer when absent', () => {
    const r = validateNewsletter({ email: 'a@b.co', consent: true });
    expect(r.ok).toBe(true);
    expect(r.value?.placement).toBe('footer');
  });

  it('rejects bad email, missing consent, non-objects', () => {
    expect(validateNewsletter({ email: 'bad', consent: true }).ok).toBe(false);
    expect(validateNewsletter({ email: 'a@b.co', consent: false }).ok).toBe(false);
    expect(validateNewsletter(null).ok).toBe(false);
  });
});

describe('validateAffiliateInterest', () => {
  const good = {
    name: 'Jo Maker',
    email: '  Jo@Example.COM ',
    consent: true,
    projects: ['brandalchemy', 'awaken-network'],
  };

  it('accepts a valid payload, normalizes, orders + dedupes projects', () => {
    const r = validateAffiliateInterest({
      ...good,
      projects: ['brandalchemy', 'awaken-network', 'brandalchemy'],
    });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      name: 'Jo Maker',
      email: 'jo@example.com',
      consent: true,
      // /network display order, not submission order.
      projectSlugs: ['awaken-network', 'brandalchemy'],
      note: null,
    });
  });

  it('keeps an optional note and rejects an over-long one', () => {
    expect(validateAffiliateInterest({ ...good, note: ' I grow herbs. ' }).value?.note).toBe(
      'I grow herbs.',
    );
    expect(
      validateAffiliateInterest({ ...good, note: 'x'.repeat(1001) }).ok,
    ).toBe(false);
  });

  it('rejects missing consent, invalid email, and empty name', () => {
    expect(validateAffiliateInterest({ ...good, consent: false }).ok).toBe(false);
    expect(validateAffiliateInterest({ ...good, email: 'nope' }).ok).toBe(false);
    expect(validateAffiliateInterest({ ...good, name: ' ' }).ok).toBe(false);
    expect(validateAffiliateInterest(null).ok).toBe(false);
  });

  it('rejects empty, non-array, and unknown-project selections', () => {
    expect(validateAffiliateInterest({ ...good, projects: [] }).ok).toBe(false);
    expect(validateAffiliateInterest({ ...good, projects: 'awaken-network' }).ok).toBe(false);
    expect(validateAffiliateInterest({ ...good, projects: ['moon-base'] }).ok).toBe(false);
    expect(
      validateAffiliateInterest({ ...good, projects: ['awaken-network', 'moon-base'] }).ok,
    ).toBe(false);
  });
});

describe('validatePartnerIdea', () => {
  const good = {
    name: 'Jo Maker',
    email: 'jo@example.com',
    consent: true,
    contributionType: 'skills',
    idea: 'I design labels and would love to help with packaging.',
  };

  it('accepts a valid payload and normalizes it', () => {
    const r = validatePartnerIdea({ ...good, email: '  Jo@Example.COM ' });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({
      name: 'Jo Maker',
      email: 'jo@example.com',
      consent: true,
      contributionType: 'skills',
      links: null,
    });
    expect(r.value?.idea).toContain('packaging');
  });

  it('preserves paragraph breaks in the idea text', () => {
    const r = validatePartnerIdea({ ...good, idea: 'First line.\n\nSecond line.' });
    expect(r.ok).toBe(true);
    expect(r.value?.idea).toBe('First line.\n\nSecond line.');
  });

  it('rejects missing consent, unknown contribution type, and empty idea', () => {
    expect(validatePartnerIdea({ ...good, consent: undefined }).ok).toBe(false);
    expect(validatePartnerIdea({ ...good, contributionType: 'magic' }).ok).toBe(false);
    expect(validatePartnerIdea({ ...good, idea: '   ' }).ok).toBe(false);
    expect(validatePartnerIdea({ ...good, idea: 'x'.repeat(4001) }).ok).toBe(false);
    expect(validatePartnerIdea('x').ok).toBe(false);
  });

  it('keeps optional links and rejects over-long links', () => {
    expect(validatePartnerIdea({ ...good, links: ' https://example.com ' }).value?.links).toBe(
      'https://example.com',
    );
    expect(validatePartnerIdea({ ...good, links: 'x'.repeat(601) }).ok).toBe(false);
  });
});
