import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { buildProfile, canonicalPair, initMatch, STORE_VERSION, type FollowUp, type MatchRow, type MatchStatus, type MatchTextField, type NewMatch, type Profile, type Store } from "./store";
import type { Submission } from "./survey";

type ProfileRow = {
  id: string;
  public_id: string;
  name: string;
  contact: string;
  linkedin?: string | null;
  role: string;
  offers: string[] | string;
  top_offer: string;
  needs: string[] | string;
  top_need: string;
  availability: string;
  trying_to: string;
  consent_at: string;
  created_at: string;
  secret_token: string;
  is_demo: boolean;
};

type MatchRecord = {
  id: string;
  a_id: string;
  b_id: string;
  score: number;
  explanation: string;
  first_action: string;
  a_status: MatchStatus;
  b_status: MatchStatus;
  created_at: string;
  a_follow_up?: FollowUp;
  a_follow_up_at?: string | null;
  b_follow_up?: FollowUp;
  b_follow_up_at?: string | null;
  met?: boolean | number;
  a_note?: string | null;
  b_note?: string | null;
  a_link?: string | null;
  b_link?: string | null;
  a_time?: string | null;
  b_time?: string | null;
};

function asList(value: string[] | string): string[] {
  return typeof value === "string" ? (JSON.parse(value) as string[]) : value;
}

function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    publicId: row.public_id,
    name: row.name,
    contact: row.contact,
    linkedin: row.linkedin ?? "",
    role: row.role,
    offers: asList(row.offers),
    topOffer: row.top_offer,
    needs: asList(row.needs),
    topNeed: row.top_need,
    availability: row.availability,
    tryingTo: row.trying_to,
    consentAt: row.consent_at,
    createdAt: row.created_at,
    secretToken: row.secret_token,
    isDemo: Boolean(row.is_demo),
  };
}

function toMatch(row: MatchRecord): MatchRow {
  return {
    id: row.id,
    aId: row.a_id,
    bId: row.b_id,
    score: Number(row.score),
    explanation: row.explanation,
    firstAction: row.first_action,
    aStatus: row.a_status,
    bStatus: row.b_status,
    createdAt: row.created_at,
    aFollowUp: row.a_follow_up === "yes" || row.a_follow_up === "not_yet" ? row.a_follow_up : null,
    aFollowUpAt: row.a_follow_up_at ?? null,
    bFollowUp: row.b_follow_up === "yes" || row.b_follow_up === "not_yet" ? row.b_follow_up : null,
    bFollowUpAt: row.b_follow_up_at ?? null,
    met: row.met === true || row.met === 1,
    aNote: row.a_note ?? "",
    bNote: row.b_note ?? "",
    aLink: row.a_link ?? "",
    bLink: row.b_link ?? "",
    aTime: row.a_time ?? "",
    bTime: row.b_time ?? "",
  };
}

function profileRow(profile: Profile): ProfileRow {
  return {
    id: profile.id,
    public_id: profile.publicId,
    name: profile.name,
    contact: profile.contact,
    linkedin: profile.linkedin,
    role: profile.role,
    offers: profile.offers,
    top_offer: profile.topOffer,
    needs: profile.needs,
    top_need: profile.topNeed,
    availability: profile.availability,
    trying_to: profile.tryingTo,
    consent_at: profile.consentAt,
    created_at: profile.createdAt,
    secret_token: profile.secretToken,
    is_demo: profile.isDemo,
  };
}

export function createSupabaseStore(url: string, serviceRoleKey: string): Store {
  const supabase: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  async function matchByPair(aId: string, bId: string): Promise<MatchRow | null> {
    const { data, error } = await supabase.from("matches").select("*").eq("a_id", aId).eq("b_id", bId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toMatch(data as MatchRecord) : null;
  }

  return {
    version: STORE_VERSION,
    kind: "supabase",
    async createProfile(input: Submission & { isDemo?: boolean }) {
      const profile = buildProfile(input);
      const { error } = await supabase.from("profiles").insert(profileRow(profile));
      if (error) throw new Error(error.message);
      return profile;
    },
    async getProfileByToken(token) {
      const { data, error } = await supabase.from("profiles").select("*").eq("secret_token", token).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toProfile(data as ProfileRow) : null;
    },
    async getProfileById(id) {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toProfile(data as ProfileRow) : null;
    },
    async getProfileByPublicId(publicId) {
      const { data, error } = await supabase.from("profiles").select("*").eq("public_id", publicId).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toProfile(data as ProfileRow) : null;
    },
    async listProfiles() {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toProfile(row as ProfileRow));
    },
    async createMatch(input: NewMatch) {
      const [aId, bId] = canonicalPair(input.aId, input.bId);
      const existing = await matchByPair(aId, bId);
      if (existing) return existing;
      const match = initMatch({ ...input, aId, bId });
      const { error } = await supabase.from("matches").insert({
        id: match.id,
        a_id: match.aId,
        b_id: match.bId,
        score: match.score,
        explanation: match.explanation,
        first_action: match.firstAction,
        a_status: match.aStatus,
        b_status: match.bStatus,
        created_at: match.createdAt,
        met: match.met,
        a_note: match.aNote,
        b_note: match.bNote,
        a_link: match.aLink,
        b_link: match.bLink,
        a_time: match.aTime,
        b_time: match.bTime,
      });
      if (error) {
        const raced = await matchByPair(aId, bId);
        if (raced) return raced;
        throw new Error(error.message);
      }
      return match;
    },
    async getMatchById(id) {
      const { data, error } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toMatch(data as MatchRecord) : null;
    },
    async listMatches() {
      const { data, error } = await supabase.from("matches").select("*").order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toMatch(row as MatchRecord));
    },
    async listMatchesFor(profileId) {
      const { data, error } = await supabase
        .from("matches")
        .select("*")
        .or(`a_id.eq.${profileId},b_id.eq.${profileId}`);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => toMatch(row as MatchRecord));
    },
    async setStatus(id, side, status) {
      const column = side === "a" ? "a_status" : "b_status";
      const { error } = await supabase.from("matches").update({ [column]: status }).eq("id", id);
      if (error) throw new Error(error.message);
      return this.getMatchById(id);
    },
    async updateScore(id, score) {
      const { error } = await supabase.from("matches").update({ score }).eq("id", id);
      if (error) throw new Error(error.message);
      return this.getMatchById(id);
    },
    async setFollowUp(id, side, value) {
      const at = new Date().toISOString();
      const patch =
        side === "a"
          ? { a_follow_up: value, a_follow_up_at: at }
          : { b_follow_up: value, b_follow_up_at: at };
      const { error } = await supabase.from("matches").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return this.getMatchById(id);
    },
    async setText(id, field: MatchTextField, value) {
      const allowed: MatchTextField[] = ["a_note", "b_note", "a_link", "b_link", "a_time", "b_time"];
      if (!allowed.includes(field)) return null;
      const { error } = await supabase.from("matches").update({ [field]: value }).eq("id", id);
      if (error) throw new Error(error.message);
      return this.getMatchById(id);
    },
    async setMet(id) {
      const { error } = await supabase.from("matches").update({ met: true }).eq("id", id);
      if (error) throw new Error(error.message);
      return this.getMatchById(id);
    },
    async deleteDemos() {
      const { data, error } = await supabase.from("profiles").select("id").eq("is_demo", true);
      if (error) throw new Error(error.message);
      const ids = (data ?? []).map((row) => String((row as { id: string }).id));
      if (ids.length) {
        const { error: matchError } = await supabase.from("matches").delete().or(ids.map((id) => `a_id.eq.${id},b_id.eq.${id}`).join(","));
        if (matchError) throw new Error(matchError.message);
        const { error: profileError } = await supabase.from("profiles").delete().eq("is_demo", true);
        if (profileError) throw new Error(profileError.message);
      }
    },
    async deleteAll() {
      const { error: matchError } = await supabase.from("matches").delete().neq("id", "");
      if (matchError) throw new Error(matchError.message);
      const { error: profileError } = await supabase.from("profiles").delete().neq("id", "");
      if (profileError) throw new Error(profileError.message);
    },
  };
}
