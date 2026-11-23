import { describe, expect, it } from "vitest";
import { visitorWithSandbox } from "./support/visitors";

describe("the Companies list", () => {
  it("shows Kestrel Studio's sample Companies, by name, each with an Owner from the team", async () => {
    const { crm } = await visitorWithSandbox();

    const companies = await crm.companies.list();
    const team = await crm.team.list();

    expect(companies.ok && team.ok).toBe(true);
    if (!companies.ok || !team.ok) return;
    const names = companies.value.map((company) => company.name);
    expect(names).toEqual(expect.arrayContaining(["Harbor & Pine Coffee", "Saltmarsh Skincare"]));
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const teamIds = team.value.map((owner) => owner.id);
    for (const company of companies.value) expect(teamIds).toContain(company.owner.id);
  });

  it("has sample dates that read as current, whenever the Sandbox is opened", async () => {
    const { crm } = await visitorWithSandbox();

    const companies = await crm.companies.list();

    expect(companies.ok).toBe(true);
    if (!companies.ok) return;
    const now = Date.now();
    const addedTimes = companies.value.map((company) => company.addedAt.getTime());
    expect(Math.max(...addedTimes)).toBeLessThanOrEqual(now);
    // The Template's newest Company was added a few days before its anchor.
    expect(now - Math.max(...addedTimes)).toBeLessThan(7 * 24 * 60 * 60 * 1000);
  });
});
