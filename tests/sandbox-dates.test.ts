import { describe, expect, it } from "vitest";
import type { Crm } from "@/lib/crm";
import { utcDay } from "./support/days";
import { expectOk } from "./support/results";
import { visitorWithSandbox } from "./support/visitors";

// Depending on where the visitor is, their calendar can be a day ahead of UTC
// (Manila before 8am) or a day behind (Los Angeles in the evening).
const VISITOR_DAYS = [
  ["a day ahead of UTC", 1],
  ["the same day as UTC", 0],
  ["a day behind UTC", -1],
] as const;

async function springLaunch(crm: Crm, today: string) {
  const board = expectOk(await crm.pipeline.board({ today, owners: "everyone" }));
  return { board, deal: board.deals.find((deal) => deal.title === "Spring launch campaign")! };
}

describe("sample due dates follow the visitor's own calendar", () => {
  it.each(VISITOR_DAYS)("in a new Sandbox, for a visitor %s", async (_where, offset) => {
    const today = utcDay(offset);
    const { crm } = await visitorWithSandbox({ today });

    const { board, deal } = await springLaunch(crm, today);

    // The Template makes this Deal due tomorrow, and 7 Next steps overdue.
    expect(deal.nextStep?.due).toBe(utcDay(offset + 1));
    expect(board.kpis.overdueNextSteps).toBe(7);
  });

  it.each(VISITOR_DAYS)("after Start over, for a visitor %s", async (_where, offset) => {
    const today = utcDay(offset);
    const { crm } = await visitorWithSandbox();

    expectOk(await crm.sandbox.startOver({ today }));

    const { board, deal } = await springLaunch(crm, today);
    expect(deal.nextStep?.due).toBe(utcDay(offset + 1));
    expect(board.kpis.overdueNextSteps).toBe(7);
  });

  it("never drift more than a day from UTC, whatever day is claimed", async () => {
    const early = await visitorWithSandbox({ today: "1999-01-01" });
    const late = await visitorWithSandbox({ today: "2999-01-01" });

    expect((await springLaunch(early.crm, utcDay())).deal.nextStep?.due).toBe(utcDay(0));
    expect((await springLaunch(late.crm, utcDay())).deal.nextStep?.due).toBe(utcDay(2));
  });
});
