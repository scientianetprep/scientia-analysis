"use client";

import { useEffect, useState } from "react";

function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}h ${m.toString().padStart(2, "0")}m ${s
      .toString()
      .padStart(2, "0")}s`;
  }
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

/**
 * Admin-observer timer. When `live` is true (session in_progress), ticks
 * every second so the proctor sees a honest elapsed read. When the
 * session has closed, renders a static interval between start and end.
 */
export function SessionElapsed({
  startedAt,
  endedAt,
  live,
}: {
  startedAt: string;
  endedAt: string | null;
  live: boolean;
}) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : null;
  const [now, setNow] = useState(() =>
    live ? Date.now() : end ?? Date.now()
  );

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  const reference = live ? now : end ?? now;
  return <span className="tabular-nums">{fmt(reference - start)}</span>;
}
