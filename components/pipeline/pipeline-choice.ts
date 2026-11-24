import { OPEN_STAGES, isOpenStage, type DealStage, type OpenStage } from "@/lib/crm/terms";

/**
 * What the Pipeline is showing: whose Deals, open ones or closed (Won and Lost)
 * ones, and on a narrow screen which Stage (null until one is picked).
 */
export type PipelineChoice = { mine: boolean; closed: boolean; stage: OpenStage | null };

/** The choice as form fields, and as the link's query, so it survives moving to a Deal and back. */
export function choiceFields({ mine, closed, stage }: PipelineChoice): Record<string, string> {
  return { ...(mine && { mine: "1" }), ...(closed && { closed: "1" }), ...(stage && { stage }) };
}

export function choiceQuery(choice: PipelineChoice): string {
  const query = new URLSearchParams(choiceFields(choice)).toString();
  return query && `?${query}`;
}

/** The choice a link's query or a form's fields carry. */
export function readChoice(read: (name: keyof PipelineChoice) => unknown): PipelineChoice {
  return {
    mine: read("mine") === "1",
    closed: read("closed") === "1",
    stage: OPEN_STAGES.find((stage) => stage === read("stage")) ?? null,
  };
}

/** The Stage a Deal shows under on a narrow screen; none once it's closed. */
export function openStageOf(deal: { stage: DealStage } | undefined): OpenStage | null {
  return deal && isOpenStage(deal.stage) ? deal.stage : null;
}
