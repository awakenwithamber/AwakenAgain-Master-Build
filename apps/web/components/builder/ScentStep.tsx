'use client';
/**
 * Step 3 — "Choose Your Scent": the two owner-directed paths.
 *
 * (a) ✨ Amber's Signature Scents — the 13 PROPOSED recipes. Labeled
 *     honestly as a proposed collection (owner has NOT approved them final).
 *     Scent cards use labeled illustrated swatch PLACEHOLDERS with an honest
 *     MISSING_ASSET state — never fake scent photography.
 * (b) 🧪 Create Your Own Blend — exactly 1–3 oils from the 12 soap-appropriate
 *     blendable oils (enforced from lib/catalog/oils data), with the dynamic
 *     "Your Alchemy Blend" readout and profile tags.
 *
 * The order record stores EXACT oil IDs (or a recipe ID) — never prose.
 * Reused by the main ritual and by each Alchemy Soap Collection slot.
 */
import { BLENDABLE_OILS, MAX_BLEND_OILS } from '../../lib/catalog/oils';
import { SIGNATURE_SCENTS } from '../../lib/catalog/scents';
import { track } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import type { SeasonalFeature } from '../../types';
import { blendReadout, type ScentPath } from './state';
import styles from './SoapBuilderModal.module.css';

export interface ScentStepProps {
  scentPath: ScentPath;
  signatureId: string | null;
  blendOils: string[];
  /** Seasonal feature as configurable data (e.g. October Pumpkin Spice). */
  seasonal: SeasonalFeature | null;
  onPathChange: (path: ScentPath) => void;
  onSignatureSelect: (id: string) => void;
  onToggleOil: (id: string) => void;
  /** Emitted before the seasonal recipe is selected. */
  onSeasonalSelect: () => void;
  /** Bundle slot index — tags blend analytics to the slot. */
  slotIndex?: number;
  compact?: boolean;
}

function isMeaningfulSafety(safety: string): boolean {
  return !!safety && !/no major flags/i.test(safety);
}

export function ScentStep({
  scentPath,
  signatureId,
  blendOils,
  seasonal,
  onPathChange,
  onSignatureSelect,
  onToggleOil,
  onSeasonalSelect,
  slotIndex,
  compact = false,
}: ScentStepProps) {
  const readout = blendReadout(blendOils);

  const handleToggleOil = (id: string) => {
    const wasSelected = blendOils.includes(id);
    onToggleOil(id);
    track(ANALYTICS_EVENT_NAMES.blendOilToggled, {
      oil_id: id,
      selected: !wasSelected,
      oil_count: wasSelected ? blendOils.length - 1 : Math.min(blendOils.length + 1, MAX_BLEND_OILS),
      ...(slotIndex === undefined ? {} : { slot_index: slotIndex }),
    });
    if (!wasSelected && blendOils.length + 1 === MAX_BLEND_OILS) {
      track(ANALYTICS_EVENT_NAMES.blendCompleted, {
        oils: [...blendOils, id],
        profile_tags: blendReadout([...blendOils, id]).tags,
        oil_count: MAX_BLEND_OILS,
        ...(slotIndex === undefined ? {} : { slot_index: slotIndex }),
      });
    }
  };

  return (
    <div>
      {seasonal?.recipe_id && (
        <button
          type="button"
          className={styles.seasonalCard}
          onClick={() => {
            onSeasonalSelect();
            onSignatureSelect(seasonal.recipe_id as string);
          }}
        >
          <span className={styles.seasonalBadge}>{seasonal.tagline}</span>
          <span className={styles.seasonalName}>{seasonal.name}</span>
          <span className={styles.seasonalCopy}>{seasonal.copy}</span>
          <span className={styles.honestyNote}>
            {seasonal.copyRule}
            {seasonal.safetyNote ? ` ${seasonal.safetyNote}` : ''}
          </span>
        </button>
      )}

      <div className={styles.pathTabs} role="tablist" aria-label="Scent paths">
        <button
          type="button"
          role="tab"
          className={styles.pathTab}
          aria-selected={scentPath === 'signature'}
          onClick={() => onPathChange('signature')}
        >
          ✨ Amber&apos;s Signature Scents
        </button>
        <button
          type="button"
          role="tab"
          className={styles.pathTab}
          aria-selected={scentPath === 'blend'}
          onClick={() => onPathChange('blend')}
        >
          🧪 Create Your Own Blend
        </button>
      </div>

      {scentPath === 'signature' ? (
        <div>
          <p className={styles.proposedNote}>
            A <strong>proposed collection</strong> — these 13 recipes are under
            review and not yet final. One tap, fully composed.
          </p>
          <div className={compact ? styles.cardGrid : `${styles.cardGrid} ${styles.cardGridScent}`}>
            {SIGNATURE_SCENTS.map((r, i) => (
              <button
                key={r.id}
                type="button"
                className={styles.card}
                aria-pressed={signatureId === r.id}
                onClick={() => onSignatureSelect(r.id)}
              >
                <span
                  className={styles.scentSwatch}
                  aria-hidden="true"
                  style={{
                    background: `linear-gradient(135deg, ${r.palette[0] ?? '#6B4E9B'}, ${r.palette[1] ?? '#2E7D5B'})`,
                  }}
                />
                <span className={styles.cardName}>
                  {i + 1}. {r.name}
                </span>
                <span className={styles.scentOils}>{r.oils.join(', ')}</span>
                <span className={styles.scentSensory}>{r.sensory}</span>
                {isMeaningfulSafety(r.safety) && (
                  <span className={styles.scentSafety}>Note: {r.safety}</span>
                )}
                <span className={styles.checkBadge} aria-hidden="true">✓</span>
              </button>
            ))}
          </div>
          <p className={styles.honestyNote}>
            Scent is invisible — swatches are illustrated placeholders
            (MISSING_ASSET). Photography is never faked for scent.
          </p>
        </div>
      ) : (
        <div>
          <p className={styles.blendHint}>
            Select 1–{MAX_BLEND_OILS} essential oils from the soap-appropriate
            list. Three oils is the magic number — your blend is complete!
          </p>
          <div className={styles.oilChips} role="group" aria-label="Blendable oils">
            {BLENDABLE_OILS.map((o) => {
              const on = blendOils.includes(o.id);
              const disabled = !on && blendOils.length >= MAX_BLEND_OILS;
              return (
                <button
                  key={o.id}
                  type="button"
                  className={styles.oilChip}
                  aria-pressed={on}
                  disabled={disabled}
                  onClick={() => handleToggleOil(o.id)}
                >
                  <span className={styles.oilDot} aria-hidden="true" />
                  {o.name}
                </button>
              );
            })}
          </div>
          <div className={styles.blendDisplay} aria-live="polite">
            <h4>Your Alchemy Blend</h4>
            {blendOils.length === 0 ? (
              <p className={styles.blendHint}>Choose your first oil above.</p>
            ) : (
              <>
                <p className={styles.blendOils}>{readout.names.join(' + ')}</p>
                <p className={styles.blendTags}>{readout.tags.join(' • ')}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
