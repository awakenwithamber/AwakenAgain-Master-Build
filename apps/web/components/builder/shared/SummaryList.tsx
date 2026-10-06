/**
 * SummaryList — the reveal summary table shared by the builders.
 * Amber's Alchemy Apothecary.
 */
'use client';

import type { ReactNode } from 'react';

export interface SummaryRow {
  term: string;
  detail: ReactNode;
}

export function SummaryList({ rows, label }: { rows: SummaryRow[]; label: string }) {
  return (
    <dl className="summary" role="status" aria-label={label}>
      {rows.map((r) => (
        <div key={r.term}>
          <dt>{r.term}</dt>
          <dd>{r.detail}</dd>
        </div>
      ))}
    </dl>
  );
}
