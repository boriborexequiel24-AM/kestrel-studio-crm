"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TIME_ZONE_COOKIE as COOKIE } from "@/lib/time-zone";

/**
 * Tells the server the visitor's time zone, so due dates are judged by their
 * calendar. Refreshes once when the zone is first learned or has changed.
 */
export function TimeZoneSync() {
  const router = useRouter();
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const saved = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${COOKIE}=`))
      ?.slice(COOKIE.length + 1);
    if (!zone || (saved && decodeURIComponent(saved) === zone)) return;
    document.cookie = `${COOKIE}=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);
  return null;
}
