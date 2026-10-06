/**
 * SafetyPanel — renders the typed safety evaluation and the acknowledgment
 * checkbox for the custom formula builders. Amber's Alchemy Apothecary.
 *
 * Presentational: flags come from lib/custom-formula/safety.ts
 * (evaluateFormula). The checkbox carries the legacy #custom-formula
 * ccSafetyCheck behavior: the customer must confirm they have read and
 * understood the herbal safety notice before adding to cart.
 */
'use client';

import type { SafetyFlag } from '../../../lib/custom-formula/safety';
import { getHerb } from '../../../lib/catalog/herbs';

export interface SafetyPanelProps {
  flags: SafetyFlag[];
  acknowledged: boolean;
  onAcknowledge: (v: boolean) => void;
}

const SEVERITY_ICON: Record<SafetyFlag['severity'], string> = {
  info: 'ℹ️',
  review: '🔍',
  caution: '⚠️',
};

export function SafetyPanel({ flags, acknowledged, onAcknowledge }: SafetyPanelProps) {
  return (
    <div>
      <div className="safety-list" role="list" aria-label="Herbal safety notice">
        {flags.map((f, i) => (
          <div key={i} className={`safety-flag ${f.severity}`} role="listitem">
            <span className="s-title">
              <span aria-hidden="true">{SEVERITY_ICON[f.severity]} </span>
              {f.title}
            </span>
            <span className="s-detail">{f.detail}</span>
            {f.herbIds.length > 0 && (
              <span className="s-herbs">
                {f.herbIds.map((id) => getHerb(id)?.name ?? id).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>
      <label className="safety-ack">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => onAcknowledge(e.target.checked)}
        />
        <span>
          I have read and understood the herbal safety notice above. I
          understand these statements are traditional herbalism notes, not
          medical advice, and I will consult a qualified healthcare
          professional about pregnancy, nursing, medications, or medical
          conditions before use.
        </span>
      </label>
      <p className="disclaimer">
        These statements have not been evaluated by the Food and Drug
        Administration. This product is not intended to diagnose, treat,
        cure, or prevent any disease.
      </p>
    </div>
  );
}
