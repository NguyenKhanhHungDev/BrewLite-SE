"use client";

import { useEffect, useState } from "react";
import { parseProfile } from "@/lib/profile";
import { useAuth } from "./AuthProvider";
import { BadgeAwardIcon, SparklesIcon, RefreshIcon } from "./Icons";

type BalanceState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; points: number };

function getTier(points: number): {
  name: string;
  nextTier: string | null;
  targetPoints: number;
  prevPoints: number;
  badgeClass: string;
} {
  if (points >= 300) {
    return {
      name: "Thành viên Vàng",
      nextTier: null,
      targetPoints: 300,
      prevPoints: 300,
      badgeClass: "bl-tier-gold",
    };
  }
  if (points >= 100) {
    return {
      name: "Thành viên Bạc",
      nextTier: "Thành viên Vàng",
      targetPoints: 300,
      prevPoints: 100,
      badgeClass: "bl-tier-silver",
    };
  }
  return {
    name: "Thành viên Đồng",
    nextTier: "Thành viên Bạc",
    targetPoints: 100,
    prevPoints: 0,
    badgeClass: "bl-tier-bronze",
  };
}

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
    <section className="bl-panel bl-loyalty-panel" aria-label="Điểm thưởng thành viên">
      <Balance
        key={`${session.userId}:${refreshKey}`}
        userId={session.userId}
        estimatedPoints={estimatedPoints}
        estimateIsPreview={estimateIsPreview}
      />
    </section>
  );
}

function Balance({
  userId,
  estimatedPoints,
  estimateIsPreview,
}: {
  userId: number;
  estimatedPoints?: number;
  estimateIsPreview?: boolean;
}) {
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

  if (state.status === "loading") {
    return (
      <div className="bl-loyalty-loading" role="status">
        <span className="bl-spinner-dot" />
        <span>Đang kiểm tra hạng thành viên...</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="bl-loyalty-error">
        <p>Chưa tải được thông tin điểm thưởng.</p>
        <button
          type="button"
          className="bl-text-button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((v) => v + 1);
          }}
        >
          <RefreshIcon size={14} /> Thử lại
        </button>
      </div>
    );
  }

  const { points } = state;
  const tier = getTier(points);
  const progressPercent = tier.nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((points - tier.prevPoints) / (tier.targetPoints - tier.prevPoints)) * 100
          )
        )
      )
    : 100;

  return (
    <div className="bl-loyalty-card">
      <div className="bl-loyalty-header">
        <div className="bl-loyalty-title-wrap">
          <BadgeAwardIcon size={20} className="bl-loyalty-icon" />
          <span className="bl-loyalty-title">BrewLite Rewards</span>
        </div>
        <span className={`bl-tier-badge ${tier.badgeClass}`}>{tier.name}</span>
      </div>

      <div className="bl-loyalty-body">
        <div className="bl-loyalty-score">
          <span className="bl-points-number">{points}</span>
          <span className="bl-points-label">điểm tích lũy</span>
        </div>

        {tier.nextTier && (
          <div className="bl-tier-progress-box">
            <div className="bl-progress-labels">
              <span>Tiến độ lên {tier.nextTier}</span>
              <span>
                {points} / {tier.targetPoints} điểm
              </span>
            </div>
            <div
              className="bl-progress-track"
              role="progressbar"
              aria-valuenow={points}
              aria-valuemin={tier.prevPoints}
              aria-valuemax={tier.targetPoints}
              aria-label="Tiến độ thăng hạng"
            >
              <div
                className="bl-progress-bar"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <small className="bl-tier-hint">
              Cần thêm <strong>{tier.targetPoints - points} điểm</strong> để lên hạng {tier.nextTier}.
            </small>
          </div>
        )}

        {estimatedPoints !== undefined && estimatedPoints > 0 && (
          <div className="bl-loyalty-estimate">
            <SparklesIcon size={16} />
            <span>
              +{estimatedPoints} điểm dự kiến cho đơn này
              {estimateIsPreview ? " (tạm tính)" : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
