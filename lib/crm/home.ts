import "server-only";
import { ok } from "./core";
import { inScope, type DealCard, type PipelineBoard, type PipelineScope, type pipelineArea } from "./deals";
import type { Retainer, retainersArea } from "./retainers";

/** What Maya should look at first, and how the agency's Pipeline is doing. */
export type HomeOverview = {
  /** Open Deals whose Next step is overdue (the longest first), then ones without a Next step. */
  attention: DealCard[];
  /** Active Retainers ending within 60 days, the first to end first. */
  endingSoon: Retainer[];
  /** Always the whole agency's. */
  pipeline: { stages: PipelineBoard["stages"]; openDeals: number; monthlyValue: number };
};

type Areas = { pipeline: ReturnType<typeof pipelineArea>; retainers: ReturnType<typeof retainersArea> };

/** Built on the other areas rather than the database, so Home always agrees with their screens. */
export function homeArea({ pipeline, retainers }: Areas) {
  return {
    /** "mine" keeps only the Persona's Deals and Retainers; the pipeline value is agency-wide either way. */
    overview: async (scope: PipelineScope) => {
      const [board, listed] = await Promise.all([
        pipeline.board({ today: scope.today, owners: "everyone" }),
        retainers.list({ today: scope.today }),
      ]);
      if (!board.ok) return board;
      if (!listed.ok) return listed;

      const { deals, owners, stages, kpis } = board.value;
      const ownerIds = new Set(inScope(owners.map(({ owner }) => owner), scope).map((owner) => owner.id));
      const shown = deals.filter((deal) => ownerIds.has(deal.owner.id));
      return ok<HomeOverview>({
        // The board lists Deals by due day, so the longest overdue come first.
        attention: [...shown.filter((deal) => deal.nextStep?.overdue), ...shown.filter((deal) => !deal.nextStep)],
        endingSoon: listed.value.filter((retainer) => retainer.state === "Ends soon" && ownerIds.has(retainer.owner.id)),
        pipeline: { stages, openDeals: kpis.openDeals, monthlyValue: kpis.openMonthlyValue },
      });
    },
  };
}
