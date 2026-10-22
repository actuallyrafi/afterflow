export type Partner = { name: string; contacts: string[] };

export type EventContext = {
  name: string;
  date: string;
  venue: { name: string; address: string };
  schedule: { time: string; label: string }[];
  discordChannels: string[];
  techPartners: Partner[];
  communityPartners: Partner[];
};

export type SurveyQuote = {
  name: string;
  role: string;
  offers: string[];
  topOffer: string;
  needs: string[];
  topNeed: string;
  availability: string;
  tryingTo: string;
};

type Rule = {
  kind: "partner" | "channel";
  name: string;
  phrases: string[];
  weight: number;
};

const RULES: Rule[] = [
  { kind: "partner", name: "Supabase", phrases: ["supabase", "postgres", "database", "backend"], weight: 3 },
  { kind: "channel", name: "#supabase", phrases: ["supabase", "postgres"], weight: 2 },
  { kind: "partner", name: "Cognee", phrases: ["cognee", "rag", "knowledge graph"], weight: 3 },
  { kind: "channel", name: "#cognee", phrases: ["cognee"], weight: 2 },
  { kind: "partner", name: "Zero", phrases: ["privacy"], weight: 2 },
  { kind: "channel", name: "#zero", phrases: ["privacy"], weight: 1 },
  { kind: "partner", name: "SpaceXAI/Grok Bot and Cursor", phrases: ["grok", "cursor", "spacexai"], weight: 3 },
  { kind: "channel", name: "#grok-bot", phrases: ["grok"], weight: 2 },
  { kind: "partner", name: "Expedite", phrases: ["expedite", "lyric square", "venue"], weight: 3 },
  { kind: "partner", name: "Unicorn Mafia", phrases: ["unicorn"], weight: 3 },
  { kind: "partner", name: "basedcollective", phrases: ["basedcollective"], weight: 3 },
  { kind: "partner", name: "Kickstart Global", phrases: ["kickstart"], weight: 3 },
  { kind: "partner", name: "Hackradar", phrases: ["hackradar"], weight: 3 },
  { kind: "partner", name: "AI Agents Lab", phrases: ["agents lab"], weight: 3 },
  { kind: "partner", name: "Corgi Community", phrases: ["corgi"], weight: 3 },
  { kind: "partner", name: "Night Office", phrases: ["night office"], weight: 3 },
  { kind: "partner", name: "The Hack Collective", phrases: ["hack collective"], weight: 3 },
  { kind: "partner", name: "United Italian Societies", phrases: ["italian"], weight: 3 },
  { kind: "partner", name: "Outpost", phrases: ["outpost"], weight: 3 },
  { kind: "partner", name: "AI Pilled", phrases: ["ai pilled", "pilled"], weight: 3 },
  { kind: "channel", name: "#coupon-codes", phrases: ["coupon", "coupons"], weight: 3 },
  { kind: "channel", name: "#notion", phrases: ["notion"], weight: 3 },
  { kind: "channel", name: "#welcome", phrases: ["welcome"], weight: 2 },
  { kind: "channel", name: "#general", phrases: ["general chat"], weight: 1 },
];

function partners(ctx: EventContext): Partner[] {
  return [...ctx.techPartners, ...ctx.communityPartners];
}

function blobOf(a: SurveyQuote, b: SurveyQuote): string {
  return [a.tryingTo, b.tryingTo, a.role, b.role, a.topOffer, b.topOffer, a.topNeed, b.topNeed, ...a.offers, ...b.offers, ...a.needs, ...b.needs]
    .join(" \n ")
    .toLowerCase();
}

function phraseHit(blob: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(blob);
}

export function allowedNextSteps(ctx: EventContext): string[] {
  const steps: string[] = [];
  for (const partner of partners(ctx)) {
    for (const contact of partner.contacts) {
      steps.push(`Find ${contact} (${partner.name})`);
    }
  }
  for (const channel of ctx.discordChannels) {
    steps.push(`Post in ${channel}`);
  }
  return steps;
}

export function pickNextStep(a: SurveyQuote, b: SurveyQuote, ctx: EventContext): string {
  const allowed = new Set(allowedNextSteps(ctx));
  const blob = blobOf(a, b);
  let best = "";
  let bestScore = 0;
  for (const rule of RULES) {
    const hits = rule.phrases.filter((phrase) => phraseHit(blob, phrase)).length;
    if (!hits) continue;
    let score = hits * rule.weight;
    let label = "";
    if (rule.kind === "partner") {
      const partner = partners(ctx).find((item) => item.name === rule.name);
      if (!partner || partner.contacts.length === 0) continue;
      let contact = partner.contacts[0];
      for (const name of partner.contacts) {
        if (blob.includes(name.toLowerCase())) {
          contact = name;
          score += 5;
          break;
        }
      }
      label = `Find ${contact} (${partner.name})`;
    } else {
      if (!ctx.discordChannels.includes(rule.name)) continue;
      label = `Post in ${rule.name}`;
    }
    if (!allowed.has(label)) continue;
    if (score > bestScore) {
      best = label;
      bestScore = score;
    }
  }
  if (best) return best;
  if (ctx.discordChannels.includes("#team-up")) return "Post in #team-up";
  return `Post in ${ctx.discordChannels[0]}`;
}

function humanList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function quotesBothFreeTexts(explanation: string, a: string, b: string): boolean {
  return explanation.includes(`"${a}"`) && explanation.includes(`"${b}"`);
}

export function templateMatchCopy(
  a: SurveyQuote,
  b: SurveyQuote,
  ctx: EventContext,
): { explanation: string; firstAction: string } {
  const aGets = a.needs.filter((need) => b.offers.includes(need));
  const bGets = b.needs.filter((need) => a.offers.includes(need));
  const parts = [
    `${a.name} (${a.role}) wrote "${a.tryingTo}".`,
    `${b.name} (${b.role}) wrote "${b.tryingTo}".`,
  ];
  if (aGets.length) {
    parts.push(
      `${a.name} is looking for ${humanList(aGets)} (top need: ${a.topNeed}). ${b.name} offers ${humanList(b.offers)} (top offer: ${b.topOffer}).`,
    );
  }
  if (bGets.length) {
    parts.push(
      `${b.name} is looking for ${humanList(bGets)} (top need: ${b.topNeed}). ${a.name} offers ${humanList(a.offers)} (top offer: ${a.topOffer}).`,
    );
  }
  if (!aGets.length && !bGets.length) {
    parts.push(
      `${a.name} offers ${humanList(a.offers)} and is looking for ${humanList(a.needs)}. ${b.name} offers ${humanList(b.offers)} and is looking for ${humanList(b.needs)}.`,
    );
  }
  if (a.availability && a.availability === b.availability) {
    parts.push(`Both are free "${a.availability}".`);
  }
  return { explanation: parts.join(" "), firstAction: pickNextStep(a, b, ctx) };
}
