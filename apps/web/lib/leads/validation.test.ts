import { describe, expect, it } from 'vitest';
import { validateNewsletter, validateQuizLead } from './validation';

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
