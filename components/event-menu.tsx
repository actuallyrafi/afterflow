"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type { EventSummary } from "@/lib/connections";
import { Icon } from "./ui/icons";

/** "all", "none" (not in an event) or an event id. */
export type EventFilter = string;

export function filterLabel(filter: EventFilter, events: EventSummary[]): string {
  if (filter === "none") return "Not in an event";
  return events.find((event) => event.id === filter)?.label ?? "All people";
}

/**
 * A pull-down, like a native menu: the pill shows what you're looking at; the list switches
 * between everyone and each of your events. Private to you, and nothing is counted here.
 */
export function EventMenu({
  token,
  events,
  value,
  onChange,
}: {
  token: string;
  events: EventSummary[];
  value: EventFilter;
  onChange: (next: EventFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const items = () => [...(wrap.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const checked = items().find((item) => item.getAttribute("aria-checked") === "true");
    (checked ?? items()[0])?.focus();
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      const list = items();
      const index = list.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        button.current?.focus();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        list[(index + 1) % list.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        list[(index - 1 + list.length) % list.length]?.focus();
      } else if (event.key === "Tab") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (next: EventFilter) => {
    onChange(next);
    setOpen(false);
    button.current?.focus();
  };

  const Option = ({ id, label }: { id: EventFilter; label: string }) => (
    <button type="button" role="menuitemradio" aria-checked={value === id} onClick={() => pick(id)}>
      <span className="tick">{value === id ? <Icon name="check" size={18} /> : null}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        className="pill pill-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Showing: ${filterLabel(value, events)}. Choose an event`}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="max-w-[240px] truncate">{filterLabel(value, events)}</span>
        <Icon name="chevDown" size={16} />
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label="Show people from" className="menu glass">
          <Option id="all" label="All people" />
          {events.length ? <hr /> : null}
          {events.map((event) => (
            <Option key={event.id} id={event.id} label={event.label} />
          ))}
          {events.length ? <Option id="none" label="Not in an event" /> : null}
          <hr />
          <Link role="menuitem" href={`/m/${token}/events`} onClick={() => setOpen(false)}>
            <span className="tick">
              <Icon name="calendar" size={18} />
            </span>
            <span className="flex-1">{events.length ? "Manage events" : "Make an event"}</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
