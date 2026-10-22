export const NOT_ENOUGH_EVIDENCE = "Not enough to go on yet, add a note";

export const CONNECTION_NEXT_STEPS = [
  { id: "online", label: "Keep chatting online", suggestion: false },
  { id: "community", label: "A community step you could try", suggestion: false },
  { id: "time", label: "Suggest a time", suggestion: true },
] as const;

type ReasonPerson = {
  name: string;
  offers: string[];
  needs: string[];
  tryingTo: string;
};

function list(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function mutualReason(a: ReasonPerson, b: ReasonPerson): string {
  const sentences: string[] = [];
  const aGets = a.tryingTo.trim() ? a.needs.filter((need) => b.offers.includes(need)) : [];
  const bGets = b.tryingTo.trim() ? b.needs.filter((need) => a.offers.includes(need)) : [];
  if (aGets.length) {
    sentences.push(`${a.name} gets ${list(aGets)} from ${b.name}. ${a.name} wrote "${a.tryingTo}".`);
  }
  if (bGets.length) {
    sentences.push(`${b.name} gets ${list(bGets)} from ${a.name}. ${b.name} wrote "${b.tryingTo}".`);
  }
  if (!sentences.length) return NOT_ENOUGH_EVIDENCE;
  return sentences.slice(0, 2).join(" ");
}
