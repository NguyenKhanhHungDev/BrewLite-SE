"use client";

import { useEffect, useState } from "react";
import { parseProfile } from "@/lib/profile";
import { useAuth } from "./AuthProvider";

type BalanceState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; points: number };

export default function LoyaltyBalance({
  refreshKey = "",
  estimatedPoints,
  estimateIsPreview = false,
}: {
  refreshKey?: string | number;
  estimatedPoints?: number;
  estimateIsPreview?: boolean;
}) {
  const { session } = useAuth();
  if (!session) return null;
  return (
    <section className="bl-panel bl-loyalty" aria-label="Điểm thưởng">
      <Balance
        key={`${session.userId}:${refreshKey}`}
        userId={session.userId}
      />
      {estimatedPoints !== undefined && (
        <p className="bl-muted">
          Dự kiến nhận {estimatedPoints} điểm khi thanh toán thành công
          {estimateIsPreview ? " (tạm tính)." : "."}
        </p>
      )}
    </section>
  );
}

function Balance({ userId }: { userId: number }) {
  const { request } = useAuth();
  const [state, setState] = useState<BalanceState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    request("/auth/me")
      .then((data) => {
        const profile = parseProfile(data);
        if (profile.id !== userId) throw new Error("Sai tài khoản.");
        if (!disposed)
          setState({ status: "ready", points: profile.loyaltyPoints });
      })
      .catch(() => {
        if (!disposed) setState({ status: "error" });
      });
    return () => {
      disposed = true;
    };
  }, [request, userId, attempt]);

  if (state.status === "loading")
    return <p role="status">Đang tải điểm thưởng…</p>;
  if (state.status === "error") {
    return (
      <>
        <p role="status">Chưa tải được điểm thưởng</p>
        <button
          type="button"
          className="bl-text-button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Thử lại
        </button>
      </>
    );
  }
  return (
    <p>
      Điểm tích lũy: <strong>{state.points}</strong>
    </p>
  );
}
