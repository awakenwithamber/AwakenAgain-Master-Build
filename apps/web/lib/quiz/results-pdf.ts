/**
 * Quiz results PDF — a real, generated PDF of a visitor's Synthesis.
 *
 * Owner directive 2026-10-22: after the quiz, the visitor can download
 * their results as a PDF listing the botanicals their answers point to
 * and why. The legacy site's "download" produced an HTML file; this is
 * an actual PDF document, generated server-side from the recomputed
 * advisor snapshot (the client's render is never trusted for it).
 *
 * No PDF dependency exists in this app, so this module is a small,
 * careful PDF 1.4 writer: Letter pages, the standard Helvetica family
 * (no embedding needed), word-wrapped text with real Helvetica glyph
 * widths, and a correct cross-reference table. Text is sanitized to
 * WinAnsi — the brand's ✦ ornament is dropped in print, bullets and
 * dashes map to their WinAnsi codes.
 */
import type { AdvisorResultSnapshot } from './advisor';
import {
  ADVISOR_SPECIALTIES_LINE,
  ADVISOR_WHY_ALLIES_HEADING,
  ADVISOR_WHY_ALLIES_PARAGRAPHS,
} from './advisor';

/* ------------------------------------------------------------------ */
/* Helvetica AFM widths (units of 1/1000 em), ASCII 32–126             */
/* ------------------------------------------------------------------ */

const HELVETICA_WIDTHS: readonly number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

function textWidth(text: string, fontSize: number, bold: boolean): number {
  let units = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 32;
    const w = code >= 32 && code <= 126 ? HELVETICA_WIDTHS[code - 32] : 556;
    units += bold ? w * 1.02 : w;
  }
  return (units / 1000) * fontSize;
}

/** Sanitize a string for a WinAnsi PDF literal: returns escaped bytes-as-latin1. */
function pdfText(text: string): string {
  const map: Record<string, string> = {
    '•': '\\225',
    '–': '\\226',
    '—': '\\227',
    '‘': '\\221',
    '’': '\\222',
    '“': '\\223',
    '”': '\\224',
    '…': '\\205',
    '✦': '',
    '✨': '',
  };
  let out = '';
  for (const ch of text) {
    if (map[ch] !== undefined) {
      out += map[ch];
    } else if (ch === '(' || ch === ')' || ch === '\\') {
      out += `\\${ch}`;
    } else {
      const code = ch.codePointAt(0) ?? 63;
      out += code >= 32 && code <= 126 ? ch : '?';
    }
  }
  return out;
}

function wrapText(text: string, fontSize: number, bold: boolean, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, fontSize, bold) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/* ------------------------------------------------------------------ */
/* Document builder                                                    */
/* ------------------------------------------------------------------ */

type FontKey = 'regular' | 'bold' | 'italic';

const FONT_RESOURCE: Record<FontKey, string> = {
  regular: 'F1',
  bold: 'F2',
  italic: 'F3',
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface TextOp {
  font: FontKey;
  size: number;
  x: number;
  y: number;
  text: string;
  color: [number, number, number];
}

const INK: [number, number, number] = [0.16, 0.1, 0.24];
const GOLD: [number, number, number] = [0.62, 0.47, 0.13];
const MUTED: [number, number, number] = [0.42, 0.34, 0.2];

class PdfPage {
  ops: string[] = [];
  addText(op: TextOp) {
    const [r, g, b] = op.color;
    this.ops.push(
      `BT /${FONT_RESOURCE[op.font]} ${op.size} Tf ${r} ${g} ${b} rg ` +
        `${op.x.toFixed(1)} ${op.y.toFixed(1)} Td (${pdfText(op.text)}) Tj ET`,
    );
  }
  addRule(y: number) {
    this.ops.push(
      `0.62 0.47 0.13 RG 0.8 w ${MARGIN} ${y.toFixed(1)} m ${PAGE_WIDTH - MARGIN} ${y.toFixed(1)} l S`,
    );
  }
  stream(): string {
    return this.ops.join('\n');
  }
}

export interface QuizPdfInput {
  snapshot: AdvisorResultSnapshot;
  name?: string | null;
  dateStr: string;
}

/** Build the results PDF. Returns the complete document bytes. */
export function buildQuizResultsPdf(input: QuizPdfInput): Uint8Array {
  const { snapshot: s, dateStr } = input;
  const pages: PdfPage[] = [];
  let page = new PdfPage();
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const newPage = () => {
    page = new PdfPage();
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN) newPage();
  };
  const para = (
    text: string,
    opts: { font?: FontKey; size?: number; color?: [number, number, number]; gap?: number; indent?: number } = {},
  ) => {
    const font = opts.font ?? 'regular';
    const size = opts.size ?? 11;
    const lineHeight = size * 1.45;
    const indent = opts.indent ?? 0;
    for (const line of wrapText(text, size, font === 'bold', CONTENT_WIDTH - indent)) {
      ensure(lineHeight);
      page.addText({ font, size, x: MARGIN + indent, y, text: line, color: opts.color ?? INK });
      y -= lineHeight;
    }
    y -= opts.gap ?? 6;
  };
  const heading = (text: string, size = 15) => {
    y -= 8;
    ensure(size * 1.6);
    page.addText({ font: 'bold', size, x: MARGIN, y, text, color: GOLD });
    y -= size * 1.6;
  };

  /* Header */
  para("AMBER'S ALCHEMY APOTHECARY", { font: 'bold', size: 10, color: GOLD, gap: 2 });
  para('Your Personal Herbal Allies', { font: 'bold', size: 22, gap: 2 });
  para(
    `${s.primaryPattern || 'Your personalized report'} · ${s.allies.length} plant allies · ${dateStr}`,
    { size: 10, color: MUTED, gap: 4 },
  );
  ensure(12);
  page.addRule(y + 4);
  y -= 14;

  if (input.name) para(`Prepared for ${input.name}.`, { font: 'italic', size: 11, gap: 8 });

  for (const line of s.summaryLines) para(line, { size: 11 });

  /* Patterns */
  if (s.patterns.length > 0) {
    heading('Your Pattern' + (s.patterns.length > 1 ? 's' : ''));
    for (const p of s.patterns) {
      para(p.name, { font: 'bold', size: 12, gap: 2 });
      para(p.summary, { size: 11, gap: 2 });
      para(`Root support: ${p.rootSupport}`, { size: 11, gap: 8 });
    }
  }

  /* Allies */
  heading('Your Personal Herbal Allies');
  for (const ally of s.allies) {
    ensure(64);
    para(`${ally.name}${ally.latin ? ` (${ally.latin})` : ''}`, { font: 'bold', size: 12, gap: 2 });
    para(`Primary benefit: ${ally.benefit}`, { size: 11, gap: 1 });
    para(ally.whyLine, { size: 11, gap: 1 });
    if (ally.traditionalNote) para(`Traditional use: ${ally.traditionalNote}`, { size: 11, gap: 1 });
    para(`Why it may help now: ${ally.primaryBenefit}`, { size: 11, gap: 10 });
  }

  /* Why these allies — Amber's narrative */
  heading(ADVISOR_WHY_ALLIES_HEADING.replace('’', "'"));
  for (const p of ADVISOR_WHY_ALLIES_PARAGRAPHS) para(p, { size: 11 });
  para(ADVISOR_SPECIALTIES_LINE, { font: 'italic', size: 11, gap: 10 });

  /* Rituals */
  if (s.rituals.length > 0) {
    heading('Gentle Rituals for Your Pattern');
    for (const r of s.rituals) {
      para(`${r.title} — ${r.desc}`, { size: 11, gap: 4 });
    }
    y -= 4;
  }

  /* Form + next steps */
  heading('Your Personalized Formula');
  para(s.formExplanation, { size: 11 });
  para(
    'Build your custom formula, or book a call or Zoom with Amber to go deeper: awakenagain.com/custom-formula · awakenagain.com/contact · Text Amber at (801) 819-6795.',
    { size: 11, gap: 10 },
  );

  /* Footer disclaimer */
  ensure(40);
  page.addRule(y + 8);
  y -= 16;
  para(
    'These botanical recommendations support general wellness and self-care. They are not intended to diagnose, treat, cure, or prevent any disease. If you are pregnant, nursing, taking medications, or navigating a medical condition, please consult a qualified healthcare professional before use.',
    { size: 8.5, color: MUTED, gap: 2 },
  );
  para('awakenagain.com', { size: 8.5, color: MUTED });

  /* Serialize */
  const objects: string[] = [];
  // 1: catalog, 2: pages, 3-5: fonts, 6+: page/content pairs
  const pageObjNums: number[] = [];
  let nextObj = 6;
  for (let i = 0; i < pages.length; i++) {
    pageObjNums.push(nextObj);
    nextObj += 2;
  }
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] =
    `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  objects[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
  pages.forEach((p, i) => {
    const pageNum = pageObjNums[i];
    const contentNum = pageNum + 1;
    const stream = p.stream();
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentNum} 0 R >>`;
    objects[contentNum] =
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let n = 1; n < objects.length; n++) {
    if (!objects[n]) continue;
    offsets[n] = out.length;
    out += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefStart = out.length;
  const count = objects.length;
  out += `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n++) {
    out += `${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new TextEncoder().encode(out);
}
