/** What the Pipeline is showing: whose Deals, and open ones or closed (Won and Lost) ones. */
export type PipelineChoice = { mine: boolean; closed: boolean };

/** The choice as form fields, and as the link's query, so it survives moving to a Deal and back. */
export function choiceFields({ mine, closed }: PipelineChoice): Record<string, string> {
  return { ...(mine && { mine: "1" }), ...(closed && { closed: "1" }) };
}

export function choiceQuery(choice: PipelineChoice): string {
  const query = new URLSearchParams(choiceFields(choice)).toString();
  return query && `?${query}`;
}

/** The choice a link's query or a form's fields carry. */
export function readChoice(read: (name: "mine" | "closed") => unknown): PipelineChoice {
  return { mine: read("mine") === "1", closed: read("closed") === "1" };
}
