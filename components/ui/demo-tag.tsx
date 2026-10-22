/** Small, quiet label for seeded demo people and cards. Never hidden, never loud. */
export function DemoTag({ className = "" }: { className?: string }) {
  return (
    <span className={`demo-tag ${className}`} title="Demo card, not a real person">
      Demo
    </span>
  );
}
