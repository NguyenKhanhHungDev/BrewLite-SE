"use client";

import { useId, useState, type FormEvent } from "react";
import { useCheckout } from "./CheckoutProvider";

export default function PromotionField({
  locked,
  code,
}: {
  locked: boolean;
  code: string;
}) {
  const checkout = useCheckout();
  const [error, setError] = useState("");
  const messageId = useId();

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      checkout.applyPromo();
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không áp dụng được mã.",
      );
    }
  }

  return (
    <form className="bl-promo-form" onSubmit={apply}>
      <fieldset disabled={locked || checkout.busy}>
        <label className="bl-field">
          Mã giảm giá
          <input
            value={locked ? code : checkout.inputCode}
            placeholder={locked && !code ? "Không dùng mã" : "BREW10"}
            maxLength={64}
            aria-describedby={messageId}
            onChange={(event) => {
              try {
                checkout.setPromoInput(event.target.value);
                setError("");
              } catch (cause) {
                setError(
                  cause instanceof Error ? cause.message : "Không đổi được mã.",
                );
              }
            }}
          />
        </label>
        <div className="bl-promo-actions">
          <button type="submit" className="bl-button bl-button-secondary">
            Áp dụng
          </button>
          {code && (
            <button
              type="button"
              className="bl-text-button"
              onClick={() => {
                try {
                  checkout.removePromo();
                  setError("");
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Không bỏ được mã.",
                  );
                }
              }}
            >
              Bỏ mã
            </button>
          )}
        </div>
      </fieldset>
      <div id={messageId}>
        {error && !locked ? (
          <p className="bl-alert bl-alert-error" role="alert">
            {error}
          </p>
        ) : code ? (
          <p className="bl-muted" role="status">
            {locked ? `Mã đã dùng: ${code}` : `Đã áp dụng ${code} (tạm tính).`}
          </p>
        ) : null}
      </div>
    </form>
  );
}
