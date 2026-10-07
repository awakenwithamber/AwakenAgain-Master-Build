'use client';

/**
 * Workstream E — Herb Explorer.
 *
 * "Type a symptom or concern — discover the herbs traditionally associated
 * with your needs." + Explore button + 10 quick category buttons.
 *
 * Results render as herb cards; clicking a card opens the botanical
 * index-card modal via the shared 'aa:open-botanical-card' contract event.
 */
import { useState } from 'react';
import {
  CATEGORY_LABELS,
  EXPLORER_QUICK_CATEGORIES,
  searchHerbs,
  type HerbRecord,
} from '../../lib/herbs/herb-data';
import { OPEN_BOTANICAL_CARD_EVENT } from './BotanicalCardHost';

function openBotanicalCard(slug: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_BOTANICAL_CARD_EVENT, { detail: { herb: slug } }),
  );
}

function HerbResultCard({ herb }: { herb: HerbRecord }) {
  return (
    <li>
      <button
        type="button"
        className="aa-explorer-card"
        onClick={() => openBotanicalCard(herb.slug)}
        aria-label={`Open the botanical card for ${herb.name}`}
      >
        {herb.illustration && (
          <div className="aa-explorer-card-img" aria-hidden="true">
            <img src={herb.illustration} alt="" loading="lazy" />
          </div>
        )}
        <div className="aa-explorer-card-body">
          <p className="aa-explorer-card-name">{herb.name}</p>
          <p className="aa-explorer-card-latin">
            <em>{herb.latin}</em>
          </p>
          <p className="aa-explorer-card-cats">
            {herb.categories.map((c) => CATEGORY_LABELS[c]).join(' · ')}
          </p>
        </div>
      </button>
    </li>
  );
}

export function HerbExplorer() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState<string | null>(null);
  const [activeQuick, setActiveQuick] = useState<string | null>(null);

  const runSearch = (q: string) => {
    setQuery(q);
    setSearched(q);
    setActiveQuick(null);
  };

  const runQuick = (label: string, keyword: string) => {
    setQuery('');
    setSearched(keyword);
    setActiveQuick(label);
  };

  const results = searched ? searchHerbs(searched) : [];
  const hasSearched = searched !== null;

  return (
    <section className="aa-explorer" aria-label="Herb Explorer">
      <h2>🔍 Herb Explorer</h2>
      <p>
        Type a symptom or concern — discover the herbs traditionally associated
        with your needs.
      </p>

      <form
        className="aa-explorer-form"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        role="search"
      >
        <label className="aa-explorer-input-label" htmlFor="herb-explorer-input" style={{ position: 'absolute', left: '-9999px' }}>
          Symptom or concern
        </label>
        <input
          id="herb-explorer-input"
          className="aa-explorer-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. insomnia, back pain, bloating, cold…"
          autoComplete="off"
        />
        <button type="submit" className="aa-explorer-button">
          Explore
        </button>
      </form>

      <div className="aa-explorer-quick" role="group" aria-label="Quick categories">
        {EXPLORER_QUICK_CATEGORIES.map((c) => (
          <button
            key={c.label}
            type="button"
            className="aa-explorer-quick-btn"
            aria-pressed={activeQuick === c.label}
            onClick={() => runQuick(c.label, c.keyword)}
          >
            <span aria-hidden="true">{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      <div aria-live="polite">
        {hasSearched && (
          <>
            <p className="aa-explorer-status">
              {results.length > 0
                ? `${results.length} ${results.length === 1 ? 'herb' : 'herbs'} traditionally associated with “${searched}” — tap a card to open its botanical index card.`
                : `No herbs in our archive are currently associated with “${searched}”. Try another word, or browse a quick category above.`}
            </p>
            {results.length > 0 && (
              <ul className="aa-explorer-results">
                {results.map((herb) => (
                  <HerbResultCard key={herb.slug} herb={herb} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <p className="aa-explorer-empty" style={{ marginTop: '1.25rem' }}>
        Associations are drawn from traditional herbalism and the apothecary&apos;s
        archive — they are not medical advice. Herbs are not a substitute for
        professional care.
      </p>
    </section>
  );
}
