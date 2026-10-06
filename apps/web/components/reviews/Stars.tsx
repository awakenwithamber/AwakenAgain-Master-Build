/**
 * Star rating display (G4).
 *
 * Server-safe (no hooks) — used by both ReviewList and ReviewForm.
 */
interface StarsProps {
  value: number;
  size?: number;
  label?: string;
}

export default function Stars({ value, size = 18, label }: StarsProps) {
  const full = Math.round(value);
  return (
    <span
      className="stars"
      role="img"
      aria-label={label ?? `${value} out of 5 stars`}
      style={{ fontSize: size }}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} aria-hidden="true" className={i <= full ? 'star-filled' : 'star-empty'}>
          ★
        </span>
      ))}
    </span>
  );
}
