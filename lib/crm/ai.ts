import "server-only";
import type { AiInputItem, AiProvider, AiResponse, AiUsage } from "@/lib/ai/provider";
import type { Activity, activitiesArea } from "./activities";
import type { companiesArea } from "./companies";
import { clean, fail, isId, isMissingReference, ok, ruleBroken, unexpected, type CrmContext, type NoLiveSandbox, type Result } from "./core";
import type { DealDetail, dealsArea, pipelineArea } from "./deals";
import { createLookups, type RecordLink } from "./lookups";
import { SUMMARY_LINES, askRequest, followUpRequest, summaryRequest, toAnswer, toChat, toEmail, toLines } from "./prompts";
import type { retainersArea } from "./retainers";
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

/** One message of a chat. The chat lives in the visitor's tab and comes along with each question. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/** An answer, with the Deals and Companies it names as links, and what was looked up for it. */
export type Answer = { parts: ({ type: "text"; text: string } | RecordLink)[]; lookedUp: string[] };

type LogRefusal = Extract<Awaited<ReturnType<ReturnType<typeof activitiesArea>["log"]>>, { ok: false }>["error"];

type Deps = {
  provider: AiProvider;
  limits: AiLimits;
  companies: ReturnType<typeof companiesArea>;
  deals: ReturnType<typeof dealsArea>;
  pipeline: ReturnType<typeof pipelineArea>;
  retainers: ReturnType<typeof retainersArea>;
  activities: ReturnType<typeof activitiesArea>;
  team: ReturnType<typeof teamArea>;
};

export function aiArea({ db, inLiveSandbox }: CrmContext, deps: Deps) {
  const { provider, limits, companies, deals, activities, team } = deps;
  const perSandbox = held(limits.aiActionsPerSandbox, CEILING.aiActionsPerSandbox);
  const perDay = held(limits.aiActionsPerDay, CEILING.aiActionsPerDay);

  /**
   * Runs one AI action, which may call the provider more than once. The limits
   * are checked and the usage row written before it's called, so an action that
   * fails still counts, and whatever it used by then is logged. `work` returns
   * null when the answer is no use to anyone.
   */
  async function act<T>(
    feature: "summary" | "draft" | "ask",
    work: (respond: AiProvider["respond"]) => Promise<T | null>,
  ): Promise<Result<T, AiRefusal>> {
    const begun = await db.rpc("begin_ai_action", {
      feature,
      sandbox_limit: perSandbox,
      daily_cap: perDay,
    });
    if (begun.error) {
      return fail(ruleBroken(begun.error, "ai_sandbox_limit_reached", "ai_daily_cap_reached") ?? unexpected(begun.error));
    }

    const used: AiUsage[] = [];
    let providerFailed = false;
    const respond: AiProvider["respond"] = async (request) => {
      try {
        const response = await provider.respond(request);
        used.push(response.usage);
        return response;
      } catch (error) {
        providerFailed = true;
        throw error;
      }
    };
    let result: T | null = null;
    let bug: unknown;
    try {
      result = await work(respond);
    } catch (error) {
      if (providerFailed) console.error("AI action failed:", error);
      else bug = error;
    }

    if (used.length) {
      const total = (count: (usage: AiUsage) => number) => used.reduce((sum, usage) => sum + count(usage), 0);
      const finished = await db.rpc("finish_ai_action", {
        action: begun.data,
        input_tokens: total((usage) => usage.inputTokens),
        output_tokens: total((usage) => usage.outputTokens),
        cost_usd: used.some((usage) => usage.costUsd === null) ? undefined : total((usage) => usage.costUsd!),
      });
      // The answer is paid for, so a logging problem doesn't throw it away.
      if (finished.error) console.error("AI usage wasn't logged:", finished.error.message);
    }
    // Not the provider's doing, so not something to tell the visitor to retry.
    if (bug) throw bug;
    return result === null ? fail("ai_unavailable") : ok(result);
  }

  /** What a whole answer says; nothing if it was cut off. */
  const whole = (response: AiResponse) => (response.complete ? response.text : "");

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

        const lines = await act("summary", async (respond) => {
          const answer = toLines(whole(await respond(summaryRequest(company, view.today))));
          return answer.length === SUMMARY_LINES ? answer : null;
        });
        // An Activity logged since the Company was read isn't covered, so it makes this out of date.
        return lines.ok ? save(companyId, lines.value, company.activities) : lines;
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
        const request = followUpRequest(found.value, { contact, sender, instruction: clean(ask.instruction), today: ask.today });
        return act("draft", async (respond): Promise<FollowUpDraft | null> => {
          const text = toEmail(whole(await respond(request)));
          return text ? { text, contact: contact && { id: contact.id, name: contact.name } } : null;
        });
      }),

    /**
     * Answers a question about the pipeline by looking things up in the
     * visitor's own Sandbox. Read-only, and the chat isn't stored.
     */
    ask: (chat: { today: Day; messages: ChatMessage[] }) =>
      inLiveSandbox(async (): Promise<Result<Answer, AiRefusal | NoLiveSandbox | "question_required">> => {
        const messages = toChat(chat.messages);
        if (!messages) return fail("question_required");
        const listed = await team.list();
        if (!listed.ok) return listed;
        const about = { team: listed.value, today: chat.today };
        const lookups = createLookups(deps, about);

        const answered = await act("ask", async (respond) => {
          const input: AiInputItem[] = messages.map((message) => ({ type: "message", ...message }));
          for (let round = 1; round <= MAX_ROUNDS; round++) {
            const response = await respond(askRequest({ ...about, input, tools: lookups.tools, mustAnswer: round === MAX_ROUNDS }));
            if (!response.complete) return null;
            if (!response.toolCalls.length) return toAnswerParts(toAnswer(response.text), lookups);
            for (const call of response.toolCalls) {
              input.push({ type: "tool_call", call }, { type: "tool_result", callId: call.id, output: await lookups.look(call) });
            }
            if (lookups.lost()) return null;
          }
          return null;
        });
        const lost = lookups.lost();
        return lost ? fail(lost) : answered;
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

// Calls to the provider for one question: the last has to be the answer.
const MAX_ROUNDS = 4;

// "[[D1]]" as asked for, and the other ways a model writes it: "[[ d1 ]]",
// "[[D1, C2]]", "[[D1: its title]]", "[D1]", or just "D1".
const SHORT_NAMES = /\[\[([^\[\]]*)\]\]|\[([DC]\d{1,3})\]|\b([DC]\d{1,3})\b/g;

/** Splits an answer at its short names, each becoming a link to the record a lookup found. */
function toAnswerParts(text: string, lookups: ReturnType<typeof createLookups>): Answer | null {
  if (!text) return null;
  const parts: Answer["parts"] = [];
  const say = (words: string) => {
    if (words) parts.push({ type: "text", text: words });
  };
  // The link shows the record's name, so the name written out next to it goes.
  const show = (link: RecordLink) => {
    const [before, gap] = parts.slice(-2);
    if (before?.type === link.type && before.id === link.id && gap?.type === "text" && !gap.text.trim()) {
      parts.pop();
      return;
    }
    const last = parts.at(-1);
    if (last?.type === "text") last.text = withoutNameAtEnd(last.text, link.name);
    if (last?.type === "text" && !last.text) parts.pop();
    parts.push(link);
  };
  const sayAfter = (words: string) => {
    const last = parts.at(-1);
    say(last && last.type !== "text" ? withoutNameAtStart(words, last.name) : words);
  };

  let end = 0;
  for (const match of text.matchAll(SHORT_NAMES)) {
    const [written, doubled, single, bare] = match;
    sayAfter(text.slice(end, match.index));
    end = match.index + written.length;
    const names = doubled === undefined ? [single ?? bare] : doubled.split(/[:|]/)[0].split(",");
    names.forEach((name, index) => {
      if (index) say(", ");
      const link = lookups.link(name.trim().toUpperCase());
      // Bare text may only look like a short name, so it stays if it isn't one.
      if (link) show(link);
      // Something in brackets that never was a short name, such as a Company that isn't there, stays as written.
      else say(bare ?? (doubled !== undefined && !/^\s*[DC]\d+\s*$/i.test(name) ? name.trim() : "(a record I can't find)"));
    });
  }
  sayAfter(text.slice(end));
  return { parts, lookedUp: lookups.labels() };
}

/** " Harbor & Pine has" or " (Harbor & Pine) has" after a link to Harbor & Pine is " has". */
function withoutNameAtStart(text: string, name: string): string {
  const [, opened, rest] = /^\s+(\(?)([\s\S]*)$/.exec(text) ?? [];
  if (!rest?.startsWith(name)) return text;
  const after = rest.slice(name.length);
  if (opened) return after.startsWith(")") ? after.slice(1) : text;
  return /^\w/.test(after) ? text : after;
}

/** "So Harbor & Pine " before a link to Harbor & Pine is "So ". */
function withoutNameAtEnd(text: string, name: string): string {
  const trimmed = text.trimEnd();
  if (trimmed === text || !trimmed.endsWith(name)) return text;
  const before = trimmed.slice(0, -name.length);
  return /\w$/.test(before) ? text : before;
}

/** Who a follow-up goes to: whoever the Deal's latest Activity names, or else the Company's first Contact. */
function mainContact({ activities, contacts }: DealDetail) {
  const latest = activities.find((activity) => activity.contact)?.contact;
  return contacts.find((contact) => contact.id === latest?.id) ?? contacts[0] ?? null;
}
