// Checks the live Supabase project from the outside, the way a visitor (or
// someone poking the API) would reach it. Uses only the public key, from
// .env.live: SUPABASE_URL and SUPABASE_ANON_KEY.
//
// It opens two Sandboxes as anonymous visitors. The hourly cleanup removes them
// after 24 hours, like any other visitor's. Run: npm run live:check
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// With --env=<file> the same checks run against another project, such as the local one.
const envFile = process.argv.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) ?? ".env.live";
const fromFile = {};
try {
  const before = { ...process.env };
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  process.loadEnvFile(join(import.meta.dirname, "..", envFile));
  fromFile.url = process.env.SUPABASE_URL?.trim();
  fromFile.anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  Object.assign(process.env, before);
} catch {
  stop(`${envFile} is missing. It needs SUPABASE_URL and SUPABASE_ANON_KEY.`);
}
const { url, anonKey } = fromFile;
if (!url || !anonKey) stop(`${envFile} needs SUPABASE_URL and SUPABASE_ANON_KEY.`);
// The service key skips every rule, so checks made with it would prove nothing.
if (isServiceKey(anonKey)) stop("SUPABASE_ANON_KEY holds the service key. Use the anon (public) key.");

const TEMPLATE = "00000000-0000-4000-8000-000000000000";
const today = new Date().toISOString().slice(0, 10);
let failed = 0;

const newClient = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

function check(name, passed, detail = "") {
  if (!passed) failed++;
  console.log(`${passed ? "ok  " : "FAIL"}  ${name}${!passed && detail ? ` (${detail})` : ""}`);
}

function stop(why) {
  console.error(why);
  process.exit(1);
}

function isServiceKey(key) {
  if (key.startsWith("sb_secret_")) return true;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role";
  } catch {
    return false;
  }
}

const why = (error) => (error ? `${error.code ?? ""} ${error.message}`.trim() : "no error");

// Without a session.
const stranger = newClient().schema("crm");
const peek = await stranger.from("companies").select("id").limit(1);
check("crm is exposed to the API", peek.error?.code !== "PGRST106", "add crm to the exposed schemas");
check("the public key alone reads nothing in crm", peek.error?.code === "42501", why(peek.error));

// Two visitors, opening Sandboxes the way the app does.
async function visitor(label) {
  const client = newClient();
  const signedIn = await client.auth.signInAnonymously({ options: { data: { app: "kestrel-crm" } } });
  if (signedIn.error) stop(`FAIL  ${label} could not sign in: ${why(signedIn.error)}. Are anonymous sign-ins on?`);
  const db = client.schema("crm");
  const opened = await db.rpc("open_sandbox", { ip_hash: `live-check-${crypto.randomUUID()}`, daily_limit: 5, today });
  if (opened.error) stop(`FAIL  ${label} could not open a Sandbox: ${why(opened.error)}`);
  return { client, db, sandboxId: opened.data.id };
}
const maya = await visitor("visitor 1");
const other = await visitor("visitor 2");
check("two visitors can open a Sandbox", maya.sandboxId !== other.sandboxId);

const companies = await maya.db.from("companies").select("id, sandbox_id, name");
check("a new Sandbox holds the 40 sample Companies", companies.data?.length === 40, companies.error ? why(companies.error) : `${companies.data?.length}`);
check("a visitor sees only their own Sandbox", !!companies.data?.length && companies.data.every((row) => row.sandbox_id === maya.sandboxId));

const template = await maya.db.from("companies").select("id").eq("sandbox_id", TEMPLATE);
check("the Template is hidden", template.data?.length === 0, why(template.error));

const name = `Live check ${crypto.randomUUID().slice(0, 8)}`;
const firstId = companies.data?.[0]?.id;
const renamed = await maya.db.from("companies").update({ name }).eq("id", firstId).select("id");
check("a visitor can change their own data", renamed.data?.length === 1, why(renamed.error));
const seen = await other.db.from("companies").select("name").eq("name", name);
check("another visitor can't see the change", seen.data?.length === 0, why(seen.error));
const crossed = await other.db.from("companies").update({ city: "Elsewhere" }).eq("sandbox_id", maya.sandboxId).select("id");
check("another visitor can't change it either", !crossed.data?.length);

const reset = await maya.db.rpc("start_over", { today });
check("Start over works", !reset.error, why(reset.error));
const after = await maya.db.from("companies").select("id").eq("name", name);
check("Start over puts the sample data back", after.data?.length === 0, why(after.error));

for (const [fn, args] of [
  ["clean_up_expired_sandboxes", {}],
  ["fill_sandbox", { target: other.sandboxId, today }],
  ["sandbox_row_counts", { target: other.sandboxId }],
]) {
  const { error } = await maya.db.rpc(fn, args);
  check(`a visitor can't call ${fn}`, error?.code === "42501" || error?.code === "PGRST202", why(error));
}

// The other demos in the same project. Each may already be closed to everyone;
// a signed-in visitor must not get further than the public key does.
const beforeSignIn = newClient();
for (const [schema, table] of [
  ["public", "vendors"],
  ["public", "purchase_orders"],
  ["public", "invoices"],
  ["public", "invoice_line_items"],
  ["public", "invoice_events"],
  ["leads", "company_profile"],
  ["leads", "leads"],
  ["leads", "messages"],
  ["leads", "settings"],
  ["ops", "hist_leads"],
  ["ops", "leads_all"],
]) {
  const ask = (client) => client.schema(schema).from(table).select("*", { count: "exact" }).limit(1);
  const [asStranger, asVisitor] = [await ask(beforeSignIn), await ask(maya.client)];
  const reach = (result) => (result.error ? "nothing" : `${result.count} rows`);
  check(`${schema}.${table}: signing in gets no further than the public key`, reach(asStranger) === reach(asVisitor), `${reach(asStranger)}, then ${reach(asVisitor)}`);
}

console.log(failed ? `\n${failed} failed.` : "\nAll checks passed.");
process.exitCode = failed ? 1 : 0;
