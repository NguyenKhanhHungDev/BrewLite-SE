"use client";

import React from "react";
import { useCountdown } from "@/lib/countdown";
import { ClockIcon, ExclamationIcon } from "./Icons";

export default function PaymentCountdown({
  expiresAt,
  isPending = true,
  onExpire,
}: {
  expiresAt: string | null | undefined;
  isPending?: boolean;
  onExpire?: () => void;
}) {
  const { isExpired, minutes, seconds, remainingSeconds, hasDeadline } = useCountdown(expiresAt, onExpire);
  const formattedTime = `${minutes}:${seconds}`;
  const totalSeconds = remainingSeconds;

  if (!isPending || !hasDeadline) return null;

  return (
    <div
      className="bl-invoice-deadline-bar"
      role="timer"
      aria-live="polite"
      aria-label={
        isExpired
          ? "Thời gian giữ đơn đã hết hạn"
          : `Hạn thanh toán còn ${formattedTime}`
      }
    >
      <div className="bl-deadline-info-wrap">
        <div className="bl-deadline-icon-box" aria-hidden="true">
          {isExpired ? <ExclamationIcon size={20} /> : <ClockIcon size={20} />}
        </div>
        <div>
          <span className="bl-deadline-label">
            {isExpired ? "Đơn hàng đã hết hạn thanh toán" : "Hạn thanh toán hóa đơn"}
          </span>
          <p className="bl-deadline-sublabel">
            {isExpired
              ? "Thời gian giữ nguyên liệu cho đơn đã kết thúc"
              : totalSeconds < 180
                ? "Sắp hết hạn! Vui lòng thanh toán sớm"
                : "Được giữ trong 15 phút tại quầy"}
          </p>
        </div>
      </div>
      <div
        className="bl-neon-timer"
        aria-label={`Thời gian còn lại ${formattedTime}`}
      >
        {isExpired ? "00:00" : formattedTime}
      </div>
    </div>
  );
}
