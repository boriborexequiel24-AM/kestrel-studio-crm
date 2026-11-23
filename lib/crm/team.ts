import "server-only";
import { ok, toOwnerRef, unexpected, type CrmContext, type OwnerRef } from "./core";

/** A member of the Kestrel Studio team: the Persona or a Teammate. */
export type Owner = OwnerRef & { role: string; isPersona: boolean };

export function teamArea({ db, inLiveSandbox }: CrmContext) {
  return {
    /** The Persona first, then Teammates by first name. */
    list: () =>
      inLiveSandbox(async () => {
        const { data, error } = await db
          .from("teammates")
          .select("id, first_name, last_name, role, initials, is_persona")
          .order("is_persona", { ascending: false })
          .order("first_name");
        if (error) unexpected(error);
        return ok(data.map((row): Owner => ({ ...toOwnerRef(row), role: row.role, isPersona: row.is_persona })));
      }),
  };
}
