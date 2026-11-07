"use client";

import { useEffect, useRef, useState } from "react";

export type CountdownResult = {
  remainingSeconds: number;
  minutes: string;
  seconds: string;
  isExpired: boolean;
  hasDeadline: boolean;
};

export function useCountdown(
  expiresAt: string | null | undefined,
  onExpire?: () => void,
): CountdownResult {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!expiresAt) return 0;
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });

  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;
  const expiredHandledRef = useRef(false);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }

    const targetTime = new Date(expiresAt).getTime();
    if (!Number.isFinite(targetTime)) {
      setRemaining(0);
      return;
    }

    expiredHandledRef.current = false;

    function update() {
      const diffSec = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
      setRemaining(diffSec);

      if (diffSec <= 0) {
        if (!expiredHandledRef.current) {
          expiredHandledRef.current = true;
          onExpireRef.current?.();
        }
      }
    }

    update();
    const interval = setInterval(update, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [expiresAt]);

  const hasDeadline = Boolean(
    expiresAt && Number.isFinite(new Date(expiresAt).getTime()),
  );
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return {
    remainingSeconds: remaining,
    minutes,
    seconds,
    isExpired: hasDeadline && remaining <= 0,
    hasDeadline,
  };
}
