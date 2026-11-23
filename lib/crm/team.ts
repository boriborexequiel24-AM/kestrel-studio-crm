import "server-only";
import { ok, toOwnerRef, unexpected, type CrmContext, type CrmDb, type OwnerRef } from "./core";

/** A member of the Kestrel Studio team: the Persona or a Teammate. */
export type Owner = OwnerRef & { role: string; isPersona: boolean };

/** The Persona first, then Teammates by first name. */
export async function listTeam(db: CrmDb): Promise<Owner[]> {
  const { data, error } = await db
    .from("teammates")
    .select("id, first_name, last_name, role, initials, is_persona")
    .order("is_persona", { ascending: false })
    .order("first_name");
  if (error) unexpected(error);
  return data.map((row) => ({ ...toOwnerRef(row), role: row.role, isPersona: row.is_persona }));
}

export function teamArea({ db, inLiveSandbox }: CrmContext) {
  return {
    list: () => inLiveSandbox(async () => ok(await listTeam(db))),
  };
}
