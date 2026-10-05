/**
 * Two-path scent selector for Amber's Alchemy Apothecary soap customization.
 * (a) Amber's Signature Scents — 13 recipes, PROPOSED (owner approval pending).
 * (b) Create Your Own Blend — 1–3 oils from the blendable list, max 3 enforced.
 *
 * The §14 order-record rule: the selection is stored as EITHER a signature
 * recipe ID OR the exact custom-blend oil IDs — never "custom scent".
 * Client analytics: scent_selected with path + recipe_id / oils only (no PII).
 */
'use client';

import { useState } from 'react';
import {
  BLENDABLE_OILS,
  MAX_BLEND_OILS,
  blendProfileTags,
} from '../../lib/catalog/oils';
import { SIGNATURE_SCENTS } from '../../lib/catalog/scents';
import { track } from '../../lib/analytics/posthog';
import { ANALYTICS_EVENT_NAMES } from '../../lib/analytics/events';
import type { ScentSelection } from '../../types';

type ScentPath = 'signature' | 'custom_blend';

interface Props {
  value: ScentSelection;
  onChange: (scent: ScentSelection) => void;
  /** Slot index for bundle-slot analytics context (client event props only). */
  slotIndex?: number;
  /** Field name prefix for accessibility labeling. */
  idPrefix: string;
}

export function ScentPathPicker({ value, onChange, slotIndex, idPrefix }: Props) {
  const [path, setPath] = useState<ScentPath>(
    value.type === 'signature' ? 'signature' : 'custom_blend',
  );

  const selectPath = (next: ScentPath) => {
    setPath(next);
    if (next === 'signature') {
      const recipe = SIGNATURE_SCENTS[0];
      const selection: ScentSelection = { type: 'signature', recipe_id: recipe.id };
      onChange(selection);
      track(ANALYTICS_EVENT_NAMES.scentSelected, {
        path: 'signature',
        recipe_id: recipe.id,
      });
    } else {
      const firstOil = BLENDABLE_OILS[0].id;
      const selection: ScentSelection = { type: 'custom_blend', oils: [firstOil] };
      onChange(selection);
      track(ANALYTICS_EVENT_NAMES.scentSelected, {
        path: 'custom_blend',
        oils: [firstOil],
        oil_count: 1,
        profile_tags: blendProfileTags([firstOil]),
      });
    }
  };

  const toggleOil = (oilId: string) => {
    if (value.type !== 'custom_blend') return;
    const current = value.oils;
    const selected = !current.includes(oilId);
    let next: string[];
    if (selected) {
      if (current.length >= MAX_BLEND_OILS) return; // max 3 enforced
      next = [...current, oilId];
    } else {
      next = current.filter((id) => id !== oilId);
      if (next.length === 0) return; // at least 1 oil
    }
    onChange({ type: 'custom_blend', oils: next });
    track(ANALYTICS_EVENT_NAMES.blendOilToggled, {
      oil_id: oilId,
      selected,
      oil_count: next.length,
      ...(slotIndex !== undefined ? { slot_index: slotIndex } : {}),
    });
  };

  return (
    <fieldset>
      <legend>Scent</legend>
      <div role="radiogroup" aria-label="Scent path">
        <label>
          <input
            type="radio"
            name={`${idPrefix}-scent-path`}
            checked={path === 'signature'}
            onChange={() => selectPath('signature')}
          />
          Amber&apos;s Signature Scents
        </label>
        <label>
          <input
            type="radio"
            name={`${idPrefix}-scent-path`}
            checked={path === 'custom_blend'}
            onChange={() => selectPath('custom_blend')}
          />
          Create Your Own Blend (1–3 oils)
        </label>
      </div>

      {path === 'signature' ? (
        <div>
          <p>
            <small>
              The 13 signature recipes are proposed and pending final approval — the
              lineup may change before production.
            </small>
          </p>
          <label>
            Signature scent
            <select
              value={value.type === 'signature' ? value.recipe_id : SIGNATURE_SCENTS[0].id}
              onChange={(e) => {
                const recipe = SIGNATURE_SCENTS.find((r) => r.id === e.target.value);
                if (!recipe) return;
                onChange({ type: 'signature', recipe_id: recipe.id });
                track(ANALYTICS_EVENT_NAMES.scentSelected, {
                  path: 'signature',
                  recipe_id: recipe.id,
                });
              }}
            >
              {SIGNATURE_SCENTS.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name} — {recipe.profile}
                </option>
              ))}
            </select>
          </label>
          {value.type === 'signature' ? (
            <p>
              <small>
                {SIGNATURE_SCENTS.find((r) => r.id === value.recipe_id)?.sensory}
                {' — '}
                evidence strength:{' '}
                {SIGNATURE_SCENTS.find((r) => r.id === value.recipe_id)?.evidence}
              </small>
            </p>
          ) : null}
        </div>
      ) : (
        <div>
          <p>
            Pick 1 to 3 oils from Amber&apos;s soap-appropriate inventory. The order
            record stores the exact oil IDs.
          </p>
          <div role="group" aria-label="Blend oils">
            {BLENDABLE_OILS.map((oil) => {
              const checked =
                value.type === 'custom_blend' && value.oils.includes(oil.id);
              const disabled =
                !checked &&
                value.type === 'custom_blend' &&
                value.oils.length >= MAX_BLEND_OILS;
              return (
                <label key={oil.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleOil(oil.id)}
                  />
                  {oil.name}
                  <small> {oil.profileTags.slice(0, 3).join(' · ')}</small>
                </label>
              );
            })}
          </div>
          {value.type === 'custom_blend' ? (
            <p>
              <small>
                Your blend profile: {blendProfileTags(value.oils).join(' · ')}
              </small>
            </p>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
