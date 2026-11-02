/**
 * Meta pixel — dark-by-default gate, consent gate, consent-change
 * decision table, ViewContent payloads, and fbq dispatch (mock fbq).
 *
 * The browser boot (script injection) is window-bound and not exercised
 * here — the same split lib/personalization/consent.ts uses (pure rules
 * tested, browser adapters thin). What IS proven here is the full gate
 * chain every event passes through: no ID → nothing; no consent →
 * nothing; ID + consent + fbq → the event fires with the right shape.
 */
import { describe, expect, it, vi } from 'vitest';
import {
  META_PIXEL_ID_ENV,
  buildViewContentParams,
  dispatchMetaEvent,
  planMetaConsentActions,
  resolveMetaPixelId,
  shouldActivateMetaPixel,
  type FbqFunction,
} from './meta-pixel';
import * as metaPixelModule from './meta-pixel';

const PIXEL_ID = '123456789012345';

function mockFbq() {
  const calls: unknown[][] = [];
  const fbq: FbqFunction = vi.fn((...args: unknown[]) => {
    calls.push(args);
  });
  return { fbq, calls };
}

describe('resolveMetaPixelId — the env gate', () => {
  it('returns null when the var is unset (pixel absent)', () => {
    expect(resolveMetaPixelId({})).toBeNull();
  });

  it('returns null for empty and whitespace-only values', () => {
    expect(resolveMetaPixelId({ [META_PIXEL_ID_ENV]: '' })).toBeNull();
    expect(resolveMetaPixelId({ [META_PIXEL_ID_ENV]: '   ' })).toBeNull();
  });

  it('returns the exact configured ID when set (trimmed)', () => {
    expect(resolveMetaPixelId({ [META_PIXEL_ID_ENV]: PIXEL_ID })).toBe(PIXEL_ID);
    expect(resolveMetaPixelId({ [META_PIXEL_ID_ENV]: ` ${PIXEL_ID} ` })).toBe(
      PIXEL_ID,
    );
  });
});

describe('shouldActivateMetaPixel — ID AND consent, both required', () => {
  it('is dark without an ID even when consent is accepted', () => {
    expect(shouldActivateMetaPixel(null, 'accepted')).toBe(false);
  });

  it('is dark before consent is granted', () => {
    expect(shouldActivateMetaPixel(PIXEL_ID, 'unknown')).toBe(false);
  });

  it('is dark after consent is declined', () => {
    expect(shouldActivateMetaPixel(PIXEL_ID, 'declined')).toBe(false);
  });

  it('activates only with an ID and accepted consent', () => {
    expect(shouldActivateMetaPixel(PIXEL_ID, 'accepted')).toBe(true);
  });
});

describe('planMetaConsentActions — consent-change decision table', () => {
  it('first acceptance boots the pixel', () => {
    expect(planMetaConsentActions('accepted', false)).toEqual({
      load: true,
      grant: false,
      revoke: false,
    });
  });

  it('re-acceptance after a revoke re-grants instead of rebooting', () => {
    expect(planMetaConsentActions('accepted', true)).toEqual({
      load: false,
      grant: true,
      revoke: false,
    });
  });

  it('decline revokes a booted pixel and never boots an unbooted one', () => {
    expect(planMetaConsentActions('declined', true)).toEqual({
      load: false,
      grant: false,
      revoke: true,
    });
    expect(planMetaConsentActions('declined', false)).toEqual({
      load: false,
      grant: false,
      revoke: false,
    });
  });

  it('withdrawal (unknown) revokes a booted pixel, mirroring PostHog opt-out', () => {
    expect(planMetaConsentActions('unknown', true)).toEqual({
      load: false,
      grant: false,
      revoke: true,
    });
    expect(planMetaConsentActions('unknown', false)).toEqual({
      load: false,
      grant: false,
      revoke: false,
    });
  });
});

describe('buildViewContentParams', () => {
  it('builds the minimal product payload', () => {
    expect(buildViewContentParams({ handle: 'gaias-rose-soap' })).toEqual({
      content_ids: ['gaias-rose-soap'],
      content_type: 'product',
    });
  });

  it('adds name, category, and a decimal USD value from integer cents', () => {
    expect(
      buildViewContentParams({
        handle: 'dream-ease-capsules',
        title: 'DreamEase',
        category: 'Capsule Formulas',
        priceCents: 3844,
      }),
    ).toEqual({
      content_ids: ['dream-ease-capsules'],
      content_type: 'product',
      content_name: 'DreamEase',
      content_category: 'Capsule Formulas',
      value: 38.44,
      currency: 'USD',
    });
  });
});

describe('dispatchMetaEvent — the gate chain with a mock fbq', () => {
  it('fires nothing when the pixel ID is unset (env dark)', () => {
    const { fbq, calls } = mockFbq();
    expect(
      dispatchMetaEvent(
        { pixelId: null, consentState: 'accepted', fbq },
        'PageView',
      ),
    ).toBe(false);
    expect(calls).toEqual([]);
  });

  it('fires nothing before consent is granted', () => {
    const { fbq, calls } = mockFbq();
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'unknown', fbq },
        'PageView',
      ),
    ).toBe(false);
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'declined', fbq },
        'PageView',
      ),
    ).toBe(false);
    expect(calls).toEqual([]);
  });

  it('fires nothing when fbq is not installed', () => {
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'accepted', fbq: undefined },
        'PageView',
      ),
    ).toBe(false);
  });

  it('fires PageView once consent is granted and the ID is set', () => {
    const { fbq, calls } = mockFbq();
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'accepted', fbq },
        'PageView',
      ),
    ).toBe(true);
    expect(calls).toEqual([['track', 'PageView']]);
  });

  it('fires ViewContent with the built product payload', () => {
    const { fbq, calls } = mockFbq();
    const params = buildViewContentParams({
      handle: 'gaias-rose-soap',
      priceCents: 1977,
    });
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'accepted', fbq },
        'ViewContent',
        params as unknown as Record<string, unknown>,
      ),
    ).toBe(true);
    expect(calls).toEqual([
      [
        'track',
        'ViewContent',
        {
          content_ids: ['gaias-rose-soap'],
          content_type: 'product',
          value: 19.77,
          currency: 'USD',
        },
      ],
    ]);
  });

  it('fires Lead through the same gate', () => {
    const { fbq, calls } = mockFbq();
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'accepted', fbq },
        'Lead',
      ),
    ).toBe(true);
    expect(calls).toEqual([['track', 'Lead']]);
  });

  it('swallows a throwing fbq instead of surfacing an error', () => {
    const fbq: FbqFunction = () => {
      throw new Error('blocked by an ad blocker');
    };
    expect(
      dispatchMetaEvent(
        { pixelId: PIXEL_ID, consentState: 'accepted', fbq },
        'PageView',
      ),
    ).toBe(false);
  });
});

describe('no Purchase surface — checkout completes off-site', () => {
  it('exports no Purchase tracking function', () => {
    const exported = Object.keys(metaPixelModule);
    expect(exported.some((name) => /purchase/i.test(name))).toBe(false);
    expect(
      (metaPixelModule as Record<string, unknown>).trackMetaPurchase,
    ).toBeUndefined();
  });

  it('the standard-event type surface is PageView/ViewContent/Lead only', () => {
    // dispatchMetaEvent accepts only the MetaStandardEvent union; the
    // runtime proof is the exported track functions list.
    const trackers = Object.keys(metaPixelModule).filter((name) =>
      name.startsWith('trackMeta'),
    );
    expect(trackers.sort()).toEqual([
      'trackMetaLead',
      'trackMetaPageView',
      'trackMetaViewContent',
      'trackMetaViewContentOnce',
    ]);
  });
});
