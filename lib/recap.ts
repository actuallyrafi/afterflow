// Render-time helpers for the connection page. They never add words: they only
// split text into sentences and drop sentences the page already shows.

/** Splits on sentence ends outside double quotes, so a quote with full stops stays whole. */
export function splitSentences(text: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    current += ch;
    if (ch === '"' || ch === "\u201C" || ch === "\u201D") inQuote = !inQuote;
    if (!inQuote && /[.!?]/.test(ch) && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      if (current.trim()) out.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function quotesIn(text: string): string[] {
  return [...text.matchAll(/["\u201C]([^"\u201D]+)["\u201D]/g)].map((m) => normalise(m[1]));
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/[.!?\s]+$/, "").trim();
}

/**
 * Drops sentences from `text` that repeat something already on the page: the same
 * sentence, or a sentence whose quotes were all already quoted above it.
 */
export function withoutRepeats(text: string, shown: string[]): string {
  const seenSentences = new Set(shown.flatMap(splitSentences).map(normalise));
  const seenQuotes = new Set(shown.flatMap(quotesIn));
  const kept: string[] = [];
  for (const sentence of splitSentences(text)) {
    const key = normalise(sentence);
    if (seenSentences.has(key)) continue;
    const quotes = quotesIn(sentence);
    if (quotes.length > 0 && quotes.every((quote) => seenQuotes.has(quote))) continue;
    seenSentences.add(key);
    kept.push(sentence);
  }
  return kept.join(" ");
}
