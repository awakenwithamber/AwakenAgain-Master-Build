/**
 * Tests — PWA capability honesty (G14).
 * Laws: manifest/icons are wired; service worker + offline fallback are
 * honestly NOT wired; isPwaComplete() is false until all four are wired.
 */
import { describe, expect, it } from 'vitest';
import { PWA_STATUS, isPwaComplete } from './status';

describe('PWA status', () => {
  it('manifest and icons are wired', () => {
    expect(PWA_STATUS.manifest).toBe('wired');
    expect(PWA_STATUS.icons).toBe('wired');
  });

  it('service worker and offline fallback are honestly not wired', () => {
    expect(PWA_STATUS.service_worker).toBe('not_wired');
    expect(PWA_STATUS.offline_fallback).toBe('not_wired');
  });

  it('isPwaComplete() is false while any capability is missing', () => {
    expect(isPwaComplete()).toBe(false);
    expect(
      isPwaComplete({ manifest: 'wired', icons: 'wired', service_worker: 'wired', offline_fallback: 'wired' }),
    ).toBe(true);
  });
});
