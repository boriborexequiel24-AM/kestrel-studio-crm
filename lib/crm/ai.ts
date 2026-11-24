import "server-only";
import type { AiProvider, AiRequest, AiResponse } from "@/lib/ai/provider";
import type { Activity, activitiesArea } from "./activities";
import type { companiesArea } from "./companies";
import { clean, fail, isId, isMissingReference, ok, ruleBroken, unexpected, type CrmContext, type NoLiveSandbox, type Result } from "./core";
import type { DealDetail, dealsArea } from "./deals";
import { SUMMARY_LINES, followUpRequest, summaryRequest, toEmail, toLines } from "./prompts";
import { SEEN_COLUMNS, SUMMARY_COLUMNS, activitiesSeen, toSeen, toSummary, type Summary } from "./summaries";
import type { teamArea } from "./team";
import { isOpenStage, type Day } from "./terms";

/** AI actions each Sandbox gets, and the whole demo per UTC day. */
export type AiLimits = { aiActionsPerSandbox: number; aiActionsPerDay: number };

export type AiActionsLeft = { left: number; limit: number };

/** Why an AI action didn't happen, or didn't produce anything. */
export type AiRefusal = "ai_sandbox_limit_reached" | "ai_daily_cap_reached" | "ai_unavailable";

// The database refuses anything above these (see the migration), so neither does the app promise it.
const CEILING: AiLimits = { aiActionsPerSandbox: 50, aiActionsPerDay: 10_000 };

const held = (limit: number, ceiling: number) => Math.min(Math.max(limit, 0), ceiling);

/** A follow-up email to edit, and who it's to. It isn't saved anywhere. */
export type FollowUpDraft = { text: string; contact: { id: string; name: string } | null };

type LogRefusal = Extract<Awaited<ReturnType<ReturnType<typeof activitiesArea>["log"]>>, { ok: false }>["error"];

type Deps = {
  provider: AiProvider;
  limits: AiLimits;
  companies: ReturnType<typeof companiesArea>;
  deals: ReturnType<typeof dealsArea>;
  activities: ReturnType<typeof activitiesArea>;
  team: ReturnType<typeof teamArea>;
};

export function aiArea({ db, inLiveSandbox }: CrmContext, { provider, limits, companies, deals, activities, team }: Deps) {
  const perSandbox = held(limits.aiActionsPerSandbox, CEILING.aiActionsPerSandbox);
  const perDay = held(limits.aiActionsPerDay, CEILING.aiActionsPerDay);

  /**
   * Runs one AI action: the limits are checked and the usage row written before
   * the provider is called, so an action that fails still counts. A cut-off
   * answer is no use to anyone, but what it used is logged.
   */
  async function act(feature: "summary" | "draft", request: AiRequest): Promise<Result<AiResponse, AiRefusal>> {
    const begun = await db.rpc("begin_ai_action", {
      feature,
      sandbox_limit: perSandbox,
      daily_cap: perDay,
    });
    if (begun.error) {
      return fail(ruleBroken(begun.error, "ai_sandbox_limit_reached", "ai_daily_cap_reached") ?? unexpected(begun.error));
    }
    let response: AiResponse;
    try {
      response = await provider.respond(request);
    } catch (error) {
      console.error("AI action failed:", error);
      return fail("ai_unavailable");
    }
    const { inputTokens, outputTokens, costUsd } = response.usage;
    const finished = await db.rpc("finish_ai_action", {
      action: begun.data,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd ?? undefined,
    });
    // The answer is paid for, so a logging problem doesn't throw it away.
    if (finished.error) console.error("AI usage wasn't logged:", finished.error.message);
    return response.complete ? ok(response) : fail("ai_unavailable");
  }

  /** Saves a summary of exactly these Activities. The Sandbox may have run out while the AI was writing. */
  const save = (companyId: string, lines: string[], covered: Activity[]) =>
    inLiveSandbox(async (): Promise<Result<Summary, "not_found">> => {
      const { data, error } = await db
        .from("ai_summaries")
        .upsert(
          { company_id: companyId, lines, activities_seen: activitiesSeen(covered), written_at: new Date().toISOString() },
          { onConflict: "sandbox_id,company_id" },
        )
        .select(SUMMARY_COLUMNS)
        .single();
      if (error) return isMissingReference(error) ? fail("not_found") : unexpected(error);
      const now = await db.from("activities").select(SEEN_COLUMNS).eq("company_id", companyId);
      if (now.error) unexpected(now.error);
      return ok(toSummary(data, now.data.map(toSeen))!);
    });

  return {
    /** How many AI actions this Sandbox has left. */
    actionsLeft: () =>
      inLiveSandbox(async () => {
        const { count, error } = await db.from("ai_usage").select("id", { count: "exact", head: true });
        if (error) unexpected(error);
        return ok<AiActionsLeft>({ left: Math.max(perSandbox - (count ?? 0), 0), limit: perSandbox });
      }),

    /**
     * A Company's story in three lines. The saved one is returned as it is, for
     * free, until the Company's Activities change.
     */
    summarize: (companyId: string, view: { today: Day }) =>
      inLiveSandbox(async (): Promise<Result<Summary, AiRefusal | NoLiveSandbox | "not_found" | "nothing_to_summarize">> => {
        const found = await companies.get(companyId, view);
        if (!found.ok) return found;
        const company = found.value;
        if (company.summary?.upToDate) return ok<Summary>(company.summary);
        if (!company.activities.length && !company.deals.length) return fail("nothing_to_summarize");

        const answer = await act("summary", summaryRequest(company, view.today));
        if (!answer.ok) return answer;
        const lines = toLines(answer.value.text);
        if (lines.length < SUMMARY_LINES) return fail("ai_unavailable");
        // An Activity logged since the Company was read isn't covered, so it makes this out of date.
        return save(companyId, lines, company.activities);
      }),

    /** An email for an open Deal's Next step, steered by an optional one-line instruction. Nothing is sent or saved. */
    draftFollowUp: (dealId: string, ask: { today: Day; instruction?: string }) =>
      inLiveSandbox(async (): Promise<Result<FollowUpDraft, AiRefusal | NoLiveSandbox | "not_found" | "deal_closed">> => {
        const [found, listed] = await Promise.all([deals.get(dealId, ask), team.list()]);
        if (!found.ok) return found;
        if (!listed.ok) return listed;
        if (!isOpenStage(found.value.stage)) return fail("deal_closed");
        const sender = listed.value.find((owner) => owner.isPersona);
        if (!sender) throw new Error("The Sandbox has no Persona.");

        const contact = mainContact(found.value);
        const answer = await act("draft", followUpRequest(found.value, { contact, sender, instruction: clean(ask.instruction), today: ask.today }));
        if (!answer.ok) return answer;
        const text = toEmail(answer.value.text);
        if (!text) return fail("ai_unavailable");
        return ok<FollowUpDraft>({ text, contact: contact && { id: contact.id, name: contact.name } });
      }),

    /** Records a draft, as Maya left it, as an Email about its Deal. This is all that "sending" does. */
    logAsSent: (dealId: string, email: { text: string; contactId: string | null }) =>
      inLiveSandbox(async (): Promise<Result<{ id: string }, "draft_empty" | "not_found" | LogRefusal>> => {
        if (!clean(email.text)) return fail("draft_empty");
        if (!isId(dealId)) return fail("not_found");
        const found = await db.from("deals").select("company_id").eq("id", dealId).maybeSingle();
        if (found.error) unexpected(found.error);
        if (!found.data) return fail("not_found");
        const sent = {
          companyId: found.data.company_id,
          dealId,
          kind: "Email" as const,
          occurredAt: new Date(),
          text: email.text,
        };
        const logged = await activities.log({ ...sent, contactId: email.contactId });
        // The Contact may have gone since the draft was written; the email was still sent.
        if (!logged.ok && logged.error === "contact_not_found") return activities.log(sent);
        return logged;
      }),
  };
}

/** Who a follow-up goes to: whoever the Deal's latest Activity names, or else the Company's first Contact. */
function mainContact({ activities, contacts }: DealDetail) {
  const latest = activities.find((activity) => activity.contact)?.contact;
  return contacts.find((contact) => contact.id === latest?.id) ?? contacts[0] ?? null;
}
