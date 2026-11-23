"use client";

import { useEffect, useState } from "react";
import { agoLabel, longDate } from "@/lib/format";

/**
 * "3 days ago", counted in the visitor's own time zone. The server can't know
 * that zone, so the first render shows the plain date (the same on server and
 * browser), and the browser swaps in the relative label once it runs, then
 * keeps it current every minute.
 */
export function RelativeTime({ iso }: { iso: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, []);

  const date = new Date(iso);
  const plainDate = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return (
    <time dateTime={iso} title={now ? longDate(date) : plainDate}>
      {now ? agoLabel(date, now) : plainDate}
    </time>
  );
}
