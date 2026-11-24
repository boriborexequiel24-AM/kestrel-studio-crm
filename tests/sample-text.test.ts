import { describe, expect, it } from "vitest";
import { utcDay } from "./support/days";
import { expectOk } from "./support/results";
import { visitorWithSandbox } from "./support/visitors";

/**
 * Anything that ties a text to one time of year. Sample dates shift to the day
 * a Sandbox is built, but the words don't.
 */
const DATED =
  /\b(Jan(uary)?|Feb(ruary)?|March|April|June|July|Aug(ust)?|Sept?(ember)?|Oct(ober)?|Nov(ember)?|Dec(ember)?|Q[1-4]|20\d\d|holidays?|Christmas|Thanksgiving|Black Friday|gift season|back-to-school|(this|next|last) (spring|summer|fall|autumn|winter))\b/i;

describe("the sample text", () => {
  it("reads as current whenever a Sandbox is built: no months, quarters or holidays", async () => {
    const { crm } = await visitorWithSandbox();
    const today = utcDay();

    const companies = expectOk(await crm.companies.list({ today }));
    const pages = await Promise.all(companies.map(async ({ id }) => expectOk(await crm.companies.get(id, { today }))));
    const deals = await Promise.all(
      pages.flatMap((page) => page.deals).map(async ({ id }) => expectOk(await crm.deals.get(id, { today }))),
    );
    const texts = [
      ...pages.flatMap((page) => page.activities.map((activity) => activity.text)),
      ...deals.flatMap((deal) => [
        deal.title,
        deal.nextStep?.text ?? "",
        ...deal.proposals.flatMap((proposal) => [proposal.scopeSummary, ...proposal.lineItems.map((item) => item.service)]),
      ]),
    ];

    expect(texts.length).toBeGreaterThan(200);
    expect(texts.filter((text) => DATED.test(text))).toEqual([]);
  });
});
