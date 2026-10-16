/**
 * @file pdf-fonts.ts
 * @brief Unicode fonts for the scenario PDF: DejaVu Sans (+ Bold) and DejaVu Sans Mono from the
 *        pinned `dejavu-fonts-ttf` package (Bitstream Vera / DejaVu license, free to embed).
 *
 * Vite emits the TTFs as separate assets; they are only fetched when a PDF contains characters the
 * 14 standard PDF fonts cannot show (Polish letters, arrows, ...). Imported only by scenario-pdf.ts,
 * which is itself loaded lazily.
 */
import sansUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import sansBoldUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import monoUrl from 'dejavu-fonts-ttf/ttf/DejaVuSansMono.ttf?url';

/** Base64 TTF data. */
export interface PdfFontFiles {
  sans: string;
  sansBold: string;
  mono: string;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

let cached: Promise<PdfFontFiles | null> | null = null;

async function fetchFont(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return toBase64(await res.arrayBuffer());
}

/** Fetches the fonts once per page (null when they cannot be loaded: the PDF falls back to Latin-1). */
export function loadPdfFonts(): Promise<PdfFontFiles | null> {
  cached ??= Promise.all([fetchFont(sansUrl), fetchFont(sansBoldUrl), fetchFont(monoUrl)])
    .then(([sans, sansBold, mono]) => ({ sans, sansBold, mono }))
    .catch((error: unknown) => {
      console.warn('[Scenarios] PDF fonts could not be loaded, using the standard fonts:', error);
      cached = null;
      return null;
    });
  return cached;
}
