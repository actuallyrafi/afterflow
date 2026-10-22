"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./ui/icons";

/** A note in the timeline. Shared notes are seen by both; private notes only by you. */
export function NoteCard({
  kind,
  value,
  placeholder,
  max,
  onSave,
}: {
  kind: "shared" | "private";
  value: string;
  placeholder: string;
  max: number;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing || !area.current) return;
    const el = area.current;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editing]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  const tag =
    kind === "shared" ? (
      <span className="tag block">Shared note · you both see this</span>
    ) : (
      <span className="tag flex items-center gap-1">
        <Icon name="lock" size={12} />
        Your note · only you
      </span>
    );

  if (!editing) {
    return (
      <button
        type="button"
        className={`note ${kind === "private" ? "private" : ""}`}
        onClick={() => setEditing(true)}
        aria-label={`${kind === "shared" ? "Shared note, you both see this" : "Your note, only you see this"}: ${value || "empty"}. Edit`}
      >
        {tag}
        <span className={`mt-0.5 block ${kind === "private" ? "text-muted" : ""} ${value ? "" : "text-faint"}`}>
          {value || placeholder}
        </span>
      </button>
    );
  }

  return (
    <form
      className={`note ${kind === "private" ? "private" : ""}`}
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const ok = await onSave(draft.trim());
        setSaving(false);
        if (ok) setEditing(false);
      }}
    >
      <label htmlFor={`note-${kind}`}>{tag}</label>
      <textarea
        id={`note-${kind}`}
        ref={area}
        value={draft}
        maxLength={max}
        rows={1}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setEditing(false);
          }
        }}
        className="mt-0.5"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <button type="button" className="btn btn-sm btn-plain" onClick={() => setEditing(false)}>
          Cancel
        </button>
        <button type="submit" className="btn btn-sm btn-ink" disabled={saving} aria-busy={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
