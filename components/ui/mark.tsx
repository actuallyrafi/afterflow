/** A person's mark: one rounded square, their own hue, their initials, a small dot. */

export function hueOf(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return (hash % 6) + 1;
}

export function initials(name: string, count: 1 | 2): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (count === 1 || words.length === 1) return (words[0][0] ?? "?").toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

const SIZES = {
  30: { box: 30, font: 13, radius: 11 },
  40: { box: 40, font: 15, radius: 15 },
  48: { box: 48, font: 19, radius: 19 },
  56: { box: 56, font: 22, radius: 22 },
  64: { box: 64, font: 25, radius: 25 },
  96: { box: 96, font: 38, radius: 38 },
} as const;

export function Mark({
  name,
  seed,
  size = 48,
  state,
  onPlate = false,
  letters,
}: {
  name: string;
  seed: string;
  size?: keyof typeof SIZES;
  state?: "pending" | "muted";
  onPlate?: boolean;
  letters?: 1 | 2;
}) {
  const dims = SIZES[size];
  const count = letters ?? (size <= 40 ? 1 : 2);
  const classes = ["mark", `hue-${hueOf(seed)}`];
  if (size === 30) classes.push("nodot");
  if (state === "pending") classes.push("pending", "breathe");
  if (state === "muted") classes.push("muted");
  if (onPlate) classes.push("on-plate");
  return (
    <span aria-hidden="true" className={classes.join(" ")} style={{ width: dims.box, height: dims.box, fontSize: dims.font }}>
      {initials(name, count)}
    </span>
  );
}
