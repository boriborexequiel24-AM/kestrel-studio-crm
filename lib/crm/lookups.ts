import "server-only";
import type { AiTool, AiToolCall } from "@/lib/ai/provider";
import { fullName, longDay } from "@/lib/format";
import type { companiesArea } from "./companies";
import { isDay, type NoLiveSandbox } from "./core";
import type { DealCard, pipelineArea } from "./deals";
import { cut, named } from "./prompts";
import type { retainersArea } from "./retainers";
import type { Owner } from "./team";
import { DEAL_STAGES, isOpenStage, type Day, type DealKind, type DealStage } from "./terms";

// What Ask the pipeline may look up: a fixed, read-only list, each through the
// visitor's own session, so RLS holds it to their Sandbox.

/** A record an answer can link to. */
export type RecordLink = { type: "deal" | "company"; id: string; name: string };

type Areas = {
  companies: ReturnType<typeof companiesArea>;
  pipeline: ReturnType<typeof pipelineArea>;
  retainers: ReturnType<typeof retainersArea>;
};

const DEAL_KINDS: readonly DealKind[] = ["New business", "Renewal"];
const MAX_ROWS = 40;
const MAX_ACTIVITIES = 10;
const MAX_TEXT = 300;
const MAX_STEP = 120;
// What every lookup of one question may hand the model, all together.
const MAX_OUTPUT = 30_000;
const MAX_CALLS = 12;

const EVERYONE = "everyone";
const nullable = (type: string, values?: readonly string[]) => ({ type: [type, "null"], ...(values && { enum: [...values, null] }) });
// Exact days: asked for "next month" as a number of days, a model counts 31 from today.
const PERIOD = {
  from: { ...nullable("string"), description: "First day, as YYYY-MM-DD, or null for no limit." },
  to: { ...nullable("string"), description: "Last day, as YYYY-MM-DD, or null for no limit." },
};
const BAD_PERIOD = "from and to must be days as YYYY-MM-DD, from no later than to, or null.";
const params = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** The lookups for one question. They remember every record they name, so the answer can link to it. */
export function createLookups({ companies, pipeline, retainers }: Areas, { team, today }: { team: Owner[]; today: Day }) {
  const links = new Map<string, RecordLink>();
  const refs = new Map<string, string>();
  const labels: string[] = [];
  let calls = 0;
  let lost: NoLiveSandbox | null = null;
  let handedOver = 0;

  /** A short name for a record, "D1" or "C2", that the model uses instead of its id. */
  function ref(link: RecordLink): string {
    const key = `${link.type}:${link.id}`;
    const known = refs.get(key);
    if (known) return known;
    const letter = link.type === "deal" ? "D" : "C";
    const made = `${letter}${[...links.values()].filter((each) => each.type === link.type).length + 1}`;
    refs.set(key, made);
    links.set(made, link);
    return made;
  }

  const companyRef = ({ id, name }: { id: string; name: string }) => ref({ type: "company", id, name });

  const dealRow = (deal: DealCard) => withoutBlanks({
    deal: ref({ type: "deal", id: deal.id, name: deal.title }),
    title: named(deal.title),
    company: companyRef(deal.company),
    company_name: named(deal.company.name),
    owner: fullName(deal.owner),
    kind: deal.kind,
    stage: deal.stage,
    monthly_value: deal.monthlyValue,
    proposal_sent_on: deal.proposal?.sentAt?.toISOString().slice(0, 10),
    ...(isOpenStage(deal.stage) && {
      next_step: deal.nextStep && cut(deal.nextStep.text, MAX_STEP),
      next_step_due: deal.nextStep?.due,
      overdue: deal.nextStep?.overdue,
    }),
    closed_on: deal.closedOn,
    lost_reason: deal.lostReason,
  });

  const rows = (deals: DealCard[]) => ({
    total: deals.length,
    shown: Math.min(deals.length, MAX_ROWS),
    monthly_value: deals.reduce((sum, deal) => sum + deal.monthlyValue, 0),
    deals: deals.slice(0, MAX_ROWS).map(dealRow),
  });

  /** The Sandbox ran out while the AI was answering: there's nothing left to answer from. */
  function gone(error: NoLiveSandbox): Found {
    lost = error;
    return problem("The records can't be read.");
  }

  const run: Record<string, (args: Record<string, unknown>) => Promise<Found>> = {
    async find_deals({ stage, owner, kind, overdue }) {
      if (!isOneOf(stage, DEAL_STAGES) || !isOneOf(kind, DEAL_KINDS) || !isOneOf(owner, team.map(fullName)) || !isBooleanOrNull(overdue)) {
        return problem("Use only the Stages, Owners and kinds listed, or null.");
      }
      const scope = { today, owners: EVERYONE } as const;
      const read = stage && !isOpenStage(stage) ? await pipeline.closed(scope) : await pipeline.board(scope);
      if (!read.ok) return gone(read.error);
      const deals = (Array.isArray(read.value) ? read.value : read.value.deals).filter(
        (deal) =>
          (!stage || deal.stage === stage) &&
          (!owner || fullName(deal.owner) === owner) &&
          (!kind || deal.kind === kind) &&
          (overdue === null || overdue === undefined || (deal.nextStep?.overdue ?? false) === overdue),
      );
      return { label: dealsLabel({ stage, owner, kind, overdue }), output: rows(deals) };
    },

    async retainers_ending(args) {
      if (!isPeriod(args)) return problem(BAD_PERIOD);
      const read = await retainers.list({ today });
      if (!read.ok) return gone(read.error);
      const ending = read.value.filter((each) => each.state !== "Ended" && isWithin(each.endDate, args));
      return {
        label: periodLabel("Retainers ending", args) ?? "Active Retainers",
        output: {
          total: ending.length,
          retainers: ending.slice(0, MAX_ROWS).map((each) => ({
            company: companyRef(each.company),
            company_name: named(each.company.name),
            title: named(each.deal.title),
            owner: fullName(each.owner),
            monthly_fee: each.monthlyFee,
            ends: each.endDate,
            renewal: each.openRenewal
              ? { deal: ref({ type: "deal", id: each.openRenewal.id, name: each.openRenewal.title }), stage: each.openRenewal.stage }
              : null,
          })),
        },
      };
    },

    async company_activities({ company }) {
      const wanted = typeof company === "string" ? cut(company, MAX_TEXT).trim() : "";
      if (!wanted) return problem("Give the Company's name.");
      const listed = await companies.list({ today, search: wanted });
      if (!listed.ok) return gone(listed.error);
      const match = listed.value.find((each) => each.name.toLowerCase() === wanted.toLowerCase()) ?? listed.value[0];
      const nobody = { ...problem("No Company has that name."), label: `Companies named ${named(wanted)}` };
      if (!match) return nobody;
      const read = await companies.get(match.id, { today });
      if (!read.ok) return read.error === "not_found" ? nobody : gone(read.error);
      const { activities, status } = read.value;
      return {
        label: `Activities of ${match.name}`,
        output: {
          company: companyRef(match),
          company_name: named(match.name),
          status,
          other_matches: listed.value
            .filter((each) => each.id !== match.id)
            .slice(0, 5)
            .map((each) => ({ company: companyRef(each), company_name: named(each.name) })),
          total: activities.length,
          activities: activities.slice(0, MAX_ACTIVITIES).map((each) => ({
            date: each.occurredAt.toISOString().slice(0, 10),
            kind: each.kind,
            by: fullName(each.author),
            with: each.contact && named(each.contact.name),
            deal: each.deal && ref({ type: "deal", id: each.deal.id, name: each.deal.title }),
            text: cut(each.text, MAX_TEXT),
          })),
        },
      };
    },

    async lost_deals(args) {
      if (!isPeriod(args)) return problem(BAD_PERIOD);
      const read = await pipeline.closed({ today, owners: EVERYONE });
      if (!read.ok) return gone(read.error);
      const lost = read.value.filter((deal) => deal.stage === "Lost" && deal.closedOn && isWithin(deal.closedOn, args));
      const reasons: Record<string, number> = {};
      for (const { lostReason } of lost) if (lostReason) reasons[lostReason] = (reasons[lostReason] ?? 0) + 1;
      return { label: periodLabel("Deals Lost", args) ?? "Lost Deals", output: { ...rows(lost), reasons } };
    },

    async pipeline_totals() {
      const read = await pipeline.board({ today, owners: EVERYONE });
      if (!read.ok) return gone(read.error);
      const { kpis, stages } = read.value;
      return {
        label: "Pipeline totals by Stage",
        output: {
          open_deals: kpis.openDeals,
          monthly_value: kpis.openMonthlyValue,
          stages: stages.map(({ stage, count, monthlyValue }) => ({ stage, deals: count, monthly_value: monthlyValue })),
        },
      };
    },
  };

  const tools: AiTool[] = [
    {
      name: "find_deals",
      description: "Deals by Stage, Owner, kind and whether their Next step is overdue. Null means any; with no Stage, only open Deals.",
      parameters: params({
        stage: nullable("string", DEAL_STAGES),
        owner: nullable("string", team.map(fullName)),
        kind: nullable("string", DEAL_KINDS),
        overdue: nullable("boolean"),
      }),
    },
    {
      name: "retainers_ending",
      description: "Active Retainers ending in a period, first and last day included, and the open Renewal of each, if any.",
      parameters: params(PERIOD),
    },
    {
      name: "company_activities",
      description: "A Company's latest Activities, by its name or part of it.",
      parameters: params({ company: { type: "string" } }),
    },
    {
      name: "lost_deals",
      description: "Deals Lost in a period, first and last day included, each with its Lost reason, and how many for each reason.",
      parameters: params(PERIOD),
    },
    { name: "pipeline_totals", description: "How many open Deals and how much Monthly value is in each Stage.", parameters: params({}) },
  ];

  return {
    tools,
    /** What ran, in words, each once. */
    labels: () => [...new Set(labels)],
    /** The record behind a short name in the answer, if a lookup found it. */
    link: (shortName: string) => links.get(shortName),
    /** Set once a lookup found the Sandbox gone. */
    lost: () => lost,
    /** Runs one lookup. Whatever the model asks for, it gets an answer it can read. */
    async look({ name, arguments: args }: AiToolCall): Promise<unknown> {
      const lookup = Object.hasOwn(run, name) ? run[name] : undefined;
      if (!lookup) return { error: "There is no such lookup." };
      if (++calls > MAX_CALLS) return ENOUGH;
      const fields = name === "pipeline_totals" ? {} : args;
      if (typeof fields !== "object" || fields === null || Array.isArray(fields)) return { error: "The arguments must be an object." };
      const found = await lookup(fields as Record<string, unknown>);
      if (found.label) labels.push(found.label);
      const output = "error" in found ? { error: found.error } : found.output;
      const size = JSON.stringify(output).length;
      if (handedOver + size > MAX_OUTPUT) return ENOUGH;
      handedOver += size;
      return output;
    },
  };
}

type Found = { label: string; output: unknown } | { label?: string; error: string };

const ENOUGH = { error: "That is enough looked up. Answer with what you have." };

const problem = (error: string) => ({ error });

/** Fewer words for the model to read: what a row doesn't say isn't so. */
const withoutBlanks = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null && value !== undefined && value !== false));

const isOneOf = <T extends string>(value: unknown, values: readonly T[]): value is T | null | undefined =>
  value === null || value === undefined || (values as readonly unknown[]).includes(value);

const isBooleanOrNull = (value: unknown): value is boolean | null | undefined =>
  value === null || value === undefined || typeof value === "boolean";

/** A missing end means no limit. */
type Period = { from?: Day | null; to?: Day | null };

const isDayOrNull = (value: unknown): value is Day | null | undefined =>
  value === null || value === undefined || (typeof value === "string" && isDay(value));

const isPeriod = (args: Record<string, unknown>): args is Period =>
  isDayOrNull(args.from) && isDayOrNull(args.to) && !(args.from && args.to && args.from > args.to);

const isWithin = (day: Day, { from, to }: Period) => (!from || day >= from) && (!to || day <= to);

/** "Deals Lost Dec 1, 2026 to Dec 31, 2026". Null if the period has no limits. */
function periodLabel(what: string, { from, to }: Period): string | null {
  if (from && to) return `${what} ${longDay(from)} to ${longDay(to)}`;
  if (from) return `${what} from ${longDay(from)}`;
  return to ? `${what} by ${longDay(to)}` : null;
}

type DealFilter = { stage?: DealStage | null; owner?: string | null; kind?: DealKind | null; overdue?: boolean | null };

/** "Maya Brandt's Renewal Deals in New without an overdue Next step". */
function dealsLabel({ stage, owner, kind, overdue }: DealFilter): string {
  const words = [
    owner && `${owner}'s`,
    !stage && "open",
    kind,
    "Deals",
    stage && `in ${stage}`,
    overdue === true && "with an overdue Next step",
    overdue === false && "without an overdue Next step",
  ];
  const label = words.filter(Boolean).join(" ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}
