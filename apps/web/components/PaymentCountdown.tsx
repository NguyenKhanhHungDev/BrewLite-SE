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

  const isUrgent = !isExpired && totalSeconds < 180; // under 3 minutes

  return (
    <div
      className={`bl-countdown-box ${isExpired ? "bl-countdown-expired" : isUrgent ? "bl-countdown-urgent" : ""}`}
      role="timer"
      aria-live="polite"
      aria-label={
        isExpired
          ? "Thời gian giữ đơn đã hết hạn"
          : `Hạn thanh toán còn ${formattedTime}`
      }
    >
      <div className="bl-countdown-icon-wrap" aria-hidden="true">
        {isExpired ? <ExclamationIcon size={18} /> : <ClockIcon size={18} />}
      </div>
      <div className="bl-countdown-content">
        <span className="bl-countdown-label">
          {isExpired ? "Đơn hàng đã hết hạn thanh toán" : "Thời gian giữ đơn tại quầy:"}
        </span>
        <strong className="bl-countdown-digits">
          {isExpired ? "00:00" : formattedTime}
        </strong>
      </div>
      {!isExpired && (
        <span className="bl-countdown-hint">
          {isUrgent ? "Sắp hết hạn! Vui lòng thanh toán sớm." : "Được giữ trong 15 phút"}
        </span>
      )}
    </div>
  );
}
