export const STRONG_MATCH_THRESHOLD = 24;

const NORMAL_TAG = 12;
const TOP_TAG = 36;

const STOP = new Set(
  `a an the to for and or of in on at i im i'm me my we our you your is it this that with from be am are was were trying try tries tried want wants wanted need needs needed looking look looks make makes making build building built someone who what how why when just into about over out up down not no nor but so if then than too very can cannot will do does did doing have has had having get got thing things one something stuck happen really still also them they their its it's month tonight`.split(
    /\s+/,
  ),
);

const ROOTS: Record<string, string> = {
  code: "code",
  coding: "code",
  coder: "code",
  codes: "code",
  design: "design",
  designer: "design",
  designing: "design",
  designs: "design",
  market: "market",
  marketing: "market",
  markets: "market",
  product: "product",
  products: "product",
  data: "data",
  community: "community",
  communities: "community",
  intro: "introduction",
  intros: "introduction",
  introduction: "introduction",
  introductions: "introduction",
  domain: "domain",
  expertise: "expertise",
  mentor: "mentor",
  mentoring: "mentor",
  teammate: "teammate",
  teammates: "teammate",
  feedback: "feedback",
  collaborator: "collaborator",
  collaborate: "collaborator",
  collaborating: "collaborator",
  collaboration: "collaborator",
  onboard: "onboard",
  onboarding: "onboard",
};

export type ScoreInput = {
  offers: string[];
  topOffer: string;
  needs: string[];
  topNeed: string;
  availability: string;
  tryingTo: string;
  role: string;
};

export type ScoreResult = {
  score: number;
  show: boolean;
  skillAB: number;
  skillBA: number;
  keywordAB: number;
  keywordBA: number;
  mutual: boolean;
  availabilityPoints: number;
};

function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) {
    const base = word.slice(0, -3);
    if (base.length >= 4) {
      if (base.length >= 5 && base.endsWith(base[base.length - 1]) && !"aeiou".includes(base[base.length - 1])) {
        return base.slice(0, -1);
      }
      return base;
    }
  }
  if (word.length > 5 && word.endsWith("ed")) {
    const base = word.slice(0, -2);
    if (base.length >= 4) return base;
  }
  if (word.length > 4 && word.endsWith("er")) {
    const base = word.slice(0, -2);
    if (base.length >= 4) return base;
  }
  if (word.length > 4 && word.endsWith("es")) {
    const base = word.slice(0, -2);
    if (base.length >= 4) return base;
  }
  if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss")) {
    const base = word.slice(0, -1);
    if (base.length >= 4) return base;
  }
  return word;
}

export function keywords(text: string): Set<string> {
  const out = new Set<string>();
  const tokens = text.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").split(/\s+/);
  for (const raw of tokens) {
    if (!raw || raw.length < 2 || STOP.has(raw)) continue;
    if (ROOTS[raw]) {
      out.add(ROOTS[raw]);
      continue;
    }
    const stemmed = stem(raw);
    if (!stemmed || stemmed.length < 2 || STOP.has(stemmed)) continue;
    out.add(ROOTS[stemmed] ?? stemmed);
  }
  return out;
}

export function keywordHits(
  freeText: string,
  other: { offers: string[]; role: string; tryingTo: string },
): number {
  const mine = keywords(freeText);
  const theirs = keywords(`${other.offers.join(" ")} ${other.role} ${other.tryingTo}`);
  let count = 0;
  for (const word of mine) {
    if (theirs.has(word)) count += 1;
  }
  return count;
}

export function directionPoints(
  needs: string[],
  topNeed: string,
  offers: string[],
  topOffer: string,
): number {
  const offerSet = new Set(offers);
  const seen = new Set<string>();
  let points = 0;
  for (const need of needs) {
    if (seen.has(need)) continue;
    seen.add(need);
    if (!offerSet.has(need)) continue;
    points += need === topNeed || need === topOffer ? TOP_TAG : NORMAL_TAG;
  }
  return points;
}

const SOON = new Set(["Right now at the event", "Later tonight"]);

function availabilityPoints(a: string, b: string, mutualSkill: boolean): number {
  let points = 0;
  if (a && a === b) points = 16;
  else if (SOON.has(a) && SOON.has(b)) points = 6;
  if (!mutualSkill) points = Math.round(points * 0.25);
  return points;
}

function keywordPoints(hits: number): number {
  return Math.min(hits, 4) * 6;
}

export function scoreMatch(a: ScoreInput, b: ScoreInput): ScoreResult {
  const skillAB = directionPoints(a.needs, a.topNeed, b.offers, b.topOffer);
  const skillBA = directionPoints(b.needs, b.topNeed, a.offers, a.topOffer);
  const keywordAB = keywordHits(a.tryingTo, b);
  const keywordBA = keywordHits(b.tryingTo, a);
  const mutual = skillAB > 0 && skillBA > 0;
  const hasEvidence = skillAB + skillBA > 0 || keywordAB + keywordBA > 0;
  if (!hasEvidence) {
    return {
      score: 0,
      show: false,
      skillAB,
      skillBA,
      keywordAB,
      keywordBA,
      mutual,
      availabilityPoints: 0,
    };
  }
  const skillPoints = mutual ? skillAB + skillBA : Math.round((skillAB + skillBA) * 0.25);
  const avail = availabilityPoints(a.availability, b.availability, mutual);
  const score = Math.min(100, skillPoints + keywordPoints(keywordAB) + keywordPoints(keywordBA) + avail);
  return {
    score,
    show: score >= STRONG_MATCH_THRESHOLD,
    skillAB,
    skillBA,
    keywordAB,
    keywordBA,
    mutual,
    availabilityPoints: avail,
  };
}

export function selectStrong<T extends { score: number; show: boolean }>(ranked: T[], limit = 3): T[] {
  return ranked
    .filter((row) => row.show)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}
