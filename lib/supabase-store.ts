import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  applyMatchPatch,
  applyProfilePatch,
  buildProfile,
  canonicalPair,
  initMatch,
  matchState,
  normalizeProfile,
  sqlRowToMatch,
  STORE_VERSION,
  type BlockRecord,
  type MatchRow,
  type NewMatch,
  type NewProfile,
  type Profile,
  type Store,
} from "./store";

function toProfile(row: unknown): Profile | null {
  return normalizeProfile(row);
}

function toMatch(row: unknown): MatchRow | null {
  return row && typeof row === "object" ? sqlRowToMatch(row as Record<string, unknown>) : null;
}

function profileRow(profile: Profile) {
  // Legacy columns (role, offers, …) are written empty; trying_to holds the answer.
  return {
    id: profile.id,
    public_id: profile.publicId,
    name: profile.name,
    contact: profile.contact,
    linkedin: "",
    role: "",
    offers: [],
    top_offer: "",
    needs: [],
    top_need: "",
    availability: "",
    trying_to: profile.answer,
    reminders: profile.reminders,
    consent_at: profile.consentAt,
    created_at: profile.createdAt,
    secret_token: profile.secretToken,
    is_demo: profile.isDemo,
  };
}

function matchColumns(match: MatchRow) {
  return {
    a_status: match.aStatus,
    b_status: match.bStatus,
    a_follow_up: match.aFollowUp,
    a_follow_up_at: match.aFollowUpAt,
    b_follow_up: match.bFollowUp,
    b_follow_up_at: match.bFollowUpAt,
    met: match.met,
    a_note: match.aNote,
    b_note: match.bNote,
    state: JSON.parse(matchState(match)) as Record<string, unknown>,
  };
}

export function createSupabaseStore(url: string, serviceRoleKey: string): Store {
  const supabase: SupabaseClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const fail = (error: { message: string } | null) => {
    if (error) throw new Error(error.message);
  };

  async function one(column: string, value: string): Promise<Profile | null> {
    const { data, error } = await supabase.from("profiles").select("*").eq(column, value).maybeSingle();
    fail(error);
    return data ? toProfile(data) : null;
  }

  async function matchByPair(aId: string, bId: string): Promise<MatchRow | null> {
    const { data, error } = await supabase.from("matches").select("*").eq("a_id", aId).eq("b_id", bId).maybeSingle();
    fail(error);
    return data ? toMatch(data) : null;
  }

  const store: Store = {
    version: STORE_VERSION,
    kind: "supabase",
    async createProfile(input: NewProfile) {
      const profile = buildProfile(input);
      const { error } = await supabase.from("profiles").insert(profileRow(profile));
      fail(error);
      return profile;
    },
    getProfileByToken: (token) => one("secret_token", token),
    getProfileById: (id) => one("id", id),
    getProfileByPublicId: (publicId) => one("public_id", publicId),
    async listProfiles() {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      fail(error);
      return (data ?? []).map(toProfile).filter((row): row is Profile => Boolean(row));
    },
    async updateProfile(id, patch) {
      const current = await store.getProfileById(id);
      if (!current) return null;
      const next = applyProfilePatch(current, patch);
      const { error } = await supabase
        .from("profiles")
        .update({ name: next.name, contact: next.contact, trying_to: next.answer, reminders: next.reminders })
        .eq("id", id);
      fail(error);
      return next;
    },
    async deleteProfile(id) {
      fail((await supabase.from("matches").delete().or(`a_id.eq.${id},b_id.eq.${id}`)).error);
      fail((await supabase.from("blocks").delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`)).error);
      fail((await supabase.from("profiles").delete().eq("id", id)).error);
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
        score: 0,
        explanation: "",
        first_action: "",
        created_at: match.createdAt,
        ...matchColumns(match),
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
      fail(error);
      return data ? toMatch(data) : null;
    },
    async listMatches() {
      const { data, error } = await supabase.from("matches").select("*").order("created_at", { ascending: true });
      fail(error);
      return (data ?? []).map(toMatch).filter((row): row is MatchRow => Boolean(row));
    },
    async listMatchesFor(profileId) {
      const { data, error } = await supabase.from("matches").select("*").or(`a_id.eq.${profileId},b_id.eq.${profileId}`);
      fail(error);
      return (data ?? []).map(toMatch).filter((row): row is MatchRow => Boolean(row));
    },
    async patchMatch(id, patch) {
      const current = await store.getMatchById(id);
      if (!current) return null;
      const next = applyMatchPatch(current, patch);
      fail((await supabase.from("matches").update(matchColumns(next)).eq("id", id)).error);
      return next;
    },
    async deleteMatch(id) {
      fail((await supabase.from("matches").delete().eq("id", id)).error);
    },
    async addBlock(blockerId, blockedId) {
      const record: BlockRecord = { blockerId, blockedId, createdAt: new Date().toISOString() };
      const { error } = await supabase
        .from("blocks")
        .upsert(
          { blocker_id: blockerId, blocked_id: blockedId, created_at: record.createdAt },
          { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
        );
      fail(error);
      return record;
    },
    async removeBlock(blockerId, blockedId) {
      fail((await supabase.from("blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId)).error);
    },
    async listBlocksFor(profileId) {
      const { data, error } = await supabase
        .from("blocks")
        .select("*")
        .or(`blocker_id.eq.${profileId},blocked_id.eq.${profileId}`);
      fail(error);
      return (data ?? []).map((row) => ({
        blockerId: String((row as Record<string, unknown>).blocker_id),
        blockedId: String((row as Record<string, unknown>).blocked_id),
        createdAt: String((row as Record<string, unknown>).created_at),
      }));
    },
    async deleteDemos() {
      const { data, error } = await supabase.from("profiles").select("id").eq("is_demo", true);
      fail(error);
      for (const row of data ?? []) await store.deleteProfile(String((row as { id: string }).id));
    },
    async deleteAll() {
      fail((await supabase.from("matches").delete().neq("id", "")).error);
      fail((await supabase.from("blocks").delete().neq("blocker_id", "")).error);
      fail((await supabase.from("profiles").delete().neq("id", "")).error);
    },
  };
  return store;
}
