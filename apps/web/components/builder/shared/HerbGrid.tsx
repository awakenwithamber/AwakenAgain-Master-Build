/**
 * HerbGrid — searchable, filterable botanical picker for the custom
 * formula builders. Amber's Alchemy Apothecary.
 *
 * Presentational: selection state and the herb list come from props; all
 * rules (max herbs, form usability) live in lib/custom-formula/formula.ts.
 */
'use client';

import { useMemo, useState } from 'react';
import { formatPrice } from '../../../lib/pricing/pricing';
import {
  filterFormulaHerbs,
  herbCategories,
} from '../../../lib/custom-formula/formula';
import type { Herb, HerbCategory } from '../../../types';

export interface HerbGridProps {
  herbs: Herb[];
  selectedIds: string[];
  maxHerbs: number;
  onToggle: (id: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  sleep: 'Sleep & Calm',
  energy: 'Energy & Vitality',
  immune: 'Immune Support',
  beauty: 'Beauty & Skin',
  pain: 'Pain & Inflammation',
  hormonal: 'Hormonal Balance',
  digestive: 'Digestion',
  spiritual: 'Spiritual & Ritual',
  adaptogen: 'Adaptogens',
  mushroom: 'Mushrooms',
  detox: 'Detox',
  stress: 'Stress',
  focus: 'Focus',
  cognitive: 'Cognitive',
  mood: 'Mood',
  emotional: 'Emotional',
};

export function HerbGrid({ herbs, selectedIds, maxHerbs, onToggle }: HerbGridProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<HerbCategory | ''>('');

  const categories = useMemo(() => herbCategories(herbs), [herbs]);
  const filtered = useMemo(
    () => filterFormulaHerbs(herbs, query, category),
    [herbs, query, category],
  );
  const maxReached = selectedIds.length >= maxHerbs;

  return (
    <div>
      <div className="herb-tools">
        <input
          type="search"
          placeholder="Search botanicals… (name, latin, use)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search botanicals"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as HerbCategory | '')}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>
      <p className="herb-count" aria-live="polite">
        {selectedIds.length} of {maxHerbs} botanicals selected
        {filtered.length !== herbs.length && ` · ${filtered.length} shown`}
      </p>
      {filtered.length === 0 ? (
        <p className="cc-empty">No botanicals found. Try a different search or category.</p>
      ) : (
        <div className="herb-grid">
          {filtered.map((h) => {
            const selected = selectedIds.includes(h.id);
            const disabled = !selected && maxReached;
            return (
              <button
                key={h.id}
                type="button"
                className="herb-card"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onToggle(h.id)}
                aria-label={`${h.name}${selected ? ' (selected)' : ''}`}
              >
                <span className="h-check" aria-hidden="true">
                  ✓
                </span>
                <span className="h-emoji" aria-hidden="true">
                  {h.emoji}
                </span>
                <span className="h-name">{h.name}</span>
                <span className="h-latin">{h.latin}</span>
                <span className="h-cats">
                  {h.categories.slice(0, 3).map((c) => (
                    <span key={c} className="h-cat">
                      {CATEGORY_LABELS[c] ?? c}
                    </span>
                  ))}
                </span>
                <span className="h-note">{h.traditionalNote}</span>
                <span className="h-price">+{formatPrice(h.priceCents)}</span>
              </button>
            );
          })}
        </div>
      )}
      {maxReached && (
        <p className="hint">
          You can select up to {maxHerbs} botanicals for a balanced formula.
          Remove one to add another.
        </p>
      )}
    </div>
  );
}
