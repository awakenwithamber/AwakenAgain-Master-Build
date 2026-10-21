/**
 * Health check — GET /api/health (Stage 5, audit Deliverable I Part 3:
 * "no /api/health or equivalent" was an ABSENT row in the gap table).
 *
 * Deliberately minimal and leak-free: it answers only that the app is
 * serving and whether the database is CONFIGURED (env presence only —
 * the same driver-selection fact lib/events/event-store.ts uses). It
 * never returns connection strings, hosts, keys, versions, or error
 * details, and it does not touch the database (a health probe must not
 * burn Neon compute or wake a scaled-to-zero database). Point an
 * external uptime check at this route + the homepage.
 */
import { NextResponse } from 'next/server';

// Health must reflect the live process, never a cached snapshot.
export const dynamic = 'force-dynamic';

export function GET() {
  const databaseConfigured =
    typeof process.env.DATABASE_URL === 'string' &&
    process.env.DATABASE_URL.length > 0;
  return NextResponse.json(
    {
      status: 'ok',
      time: new Date().toISOString(),
      database: databaseConfigured ? 'configured' : 'not-configured',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
