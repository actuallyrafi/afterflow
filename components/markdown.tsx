import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={index} href={link[2]} className="underline">
          {link[1]}
        </a>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="mt-4 leading-relaxed">
        {inline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (!list.length) return;
    const items = list;
    list = [];
    blocks.push(
      <ul key={`ul-${blocks.length}`} className="mt-4 list-disc pl-5">
        {items.map((item, index) => (
          <li key={index} className="mt-1">
            {inline(item)}
          </li>
        ))}
      </ul>,
    );
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }
    if (trimmed.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h3 key={`h-${blocks.length}`} className="mt-8 text-xl font-semibold">
          {inline(trimmed.slice(4))}
        </h3>,
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h2 key={`h-${blocks.length}`} className="mt-8 font-display text-3xl">
          {inline(trimmed.slice(3))}
        </h2>,
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      flushParagraph();
      flushList();
      blocks.push(
        <h1 key={`h-${blocks.length}`} className="font-display text-5xl leading-none">
          {inline(trimmed.slice(2))}
        </h1>,
      );
      continue;
    }
    if (trimmed.startsWith("- ")) {
      flushParagraph();
      list.push(trimmed.slice(2));
      continue;
    }
    flushList();
    paragraph.push(trimmed);
  }
  flushParagraph();
  flushList();
  return <article>{blocks}</article>;
}
