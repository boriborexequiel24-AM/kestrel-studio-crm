import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabaseConfig } from "./config";

/** A Supabase client acting as the visitor, with their session in cookies. */
export async function createVisitorClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseConfig();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies. Server Actions can, and
          // proxy.ts refreshes the session on every request.
        }
      },
    },
  });
}
