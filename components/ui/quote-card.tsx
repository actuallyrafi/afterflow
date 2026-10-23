import { useId } from "react";

/**
 * One person's own words, as a quote card (spec v4.1a). Both cards share the same shape and
 * background; only the 4px rule takes the speaker's hue. Curly quotes come from CSS.
 */
export function QuoteCard({ label, text, hue }: { label: string; text: string; hue: number }) {
  const id = useId();
  return (
    <figure className="quote" data-hue={hue} aria-labelledby={id}>
      <figcaption id={id}>{label}</figcaption>
      <blockquote>{text}</blockquote>
    </figure>
  );
}
