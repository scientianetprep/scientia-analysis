"use client";

import { useEffect } from "react";

export function ActivityPing() {
  useEffect(() => {
    // Ping only once per session/mount
    const ping = async () => {
      try {
        await fetch("/api/user/activity/ping", { method: "POST" });
      } catch (err) {}
    };
    ping();
  }, []);

  return null;
}
