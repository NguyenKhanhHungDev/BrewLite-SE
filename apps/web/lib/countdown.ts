"use client";

import { useEffect, useState } from "react";

export function useCountdown(
  expiresAt: string | null | undefined,
  onExpire?: () => void,
) {
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    if (!expiresAt) return 0;
    const target = Date.parse(expiresAt);
    if (!Number.isFinite(target)) return 0;
    return Math.max(0, Math.floor((target - Date.now()) / 1000));
  });

  const hasDeadline = Boolean(
    expiresAt && Number.isFinite(Date.parse(expiresAt)),
  );

  useEffect(() => {
    if (!hasDeadline || !expiresAt) return;

    function calculate() {
      const target = Date.parse(expiresAt!);
      const rem = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setRemainingSeconds(rem);
      if (rem === 0) {
        onExpire?.();
      }
    }

    calculate();
    const interval = window.setInterval(calculate, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt, hasDeadline, onExpire]);

  const isExpired = hasDeadline && remainingSeconds <= 0;
  const minutes = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  return {
    remainingSeconds,
    minutes,
    seconds,
    isExpired,
    hasDeadline,
  };
}
