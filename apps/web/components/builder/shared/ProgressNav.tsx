/**
 * ProgressNav — the ritual step indicator shared by the builders.
 * Amber's Alchemy Apothecary.
 */
'use client';

export interface ProgressNavProps<StepKey extends string> {
  steps: readonly StepKey[];
  labels: Record<StepKey, string>;
  current: StepKey;
  onGo: (key: StepKey) => void;
  /** True when the step is complete (shows a check; clickable to go back). */
  isComplete: (key: StepKey) => boolean;
}

export function ProgressNav<StepKey extends string>({
  steps,
  labels,
  current,
  onGo,
  isComplete,
}: ProgressNavProps<StepKey>) {
  const currentIdx = steps.indexOf(current);
  return (
    <nav className="progress" aria-label="Creation ritual progress">
      <ol>
        {steps.map((key, i) => {
          const done = i < currentIdx || (i !== currentIdx && isComplete(key));
          const now = key === current;
          return (
            <li key={key} className={done ? 'done' : now ? 'now' : ''}>
              {done ? (
                <button
                  type="button"
                  className="progress-btn"
                  onClick={() => onGo(key)}
                  aria-label={`Go back to ${labels[key]}`}
                >
                  <span className="n" aria-hidden="true">
                    ✓
                  </span>
                  <span>{labels[key]}</span>
                </button>
              ) : (
                <span aria-current={now ? 'step' : undefined}>
                  <span className="n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{labels[key]}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
