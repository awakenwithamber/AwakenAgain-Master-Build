/**
 * App icon for Amber's Alchemy Apothecary (G14).
 *
 * Generated brand mark: dark purple field (#17102b) with a gold (#d9a93c)
 * "AA" monogram and crescent — mystical/botanical, no product imagery, no
 * fabricated photography. Served by Next.js at /icon.
 */
import { ImageResponse } from 'next/og';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#17102b',
          borderRadius: '18%',
          border: '10px solid #d9a93c',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 200,
            fontWeight: 700,
            color: '#d9a93c',
            fontFamily: 'Georgia, serif',
            letterSpacing: '-0.04em',
          }}
        >
          A<span style={{ color: '#f0c96a' }}>A</span>
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 44,
            color: '#f3ecdb',
            fontFamily: 'Georgia, serif',
            marginTop: 8,
            letterSpacing: '0.18em',
          }}
        >
          APOTHECARY
        </div>
      </div>
    ),
    { ...size },
  );
}
