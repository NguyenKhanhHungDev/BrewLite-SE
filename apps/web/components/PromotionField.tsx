"use client";

import { useId, useState, type FormEvent } from "react";
import { useCheckout } from "./CheckoutProvider";
import { TicketIcon, CheckCircleIcon, ExclamationIcon, CloseIcon } from "./Icons";

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

  function remove() {
    try {
      checkout.removePromo();
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không bỏ được mã.",
      );
    }
  }

  return (
    <div className="bl-promo-card">
      <div className="bl-promo-header">
        <div className="bl-promo-title-wrap">
          <TicketIcon size={18} className="bl-promo-icon" />
          <span className="bl-promo-title">Mã ưu đãi & Giảm giá</span>
        </div>
      </div>

      {code ? (
        <div className="bl-promo-applied-box">
          <div className="bl-promo-badge-info">
            <CheckCircleIcon size={18} className="bl-promo-success-icon" />
            <div>
              <div className="bl-promo-code-tag">{code}</div>
              <p className="bl-promo-status-text">
                {locked
                  ? "Mã ưu đãi đã chốt theo hóa đơn"
                  : "Đã áp dụng mã giảm giá thành công (tạm tính)"}
              </p>
            </div>
          </div>
          {!locked && (
            <button
              type="button"
              className="bl-promo-remove-btn"
              onClick={remove}
              disabled={checkout.busy}
              title="Gỡ mã giảm giá"
              aria-label="Gỡ mã giảm giá"
            >
              <CloseIcon size={14} />
              <span>Gỡ mã</span>
            </button>
          )}
        </div>
      ) : (
        <form className="bl-promo-form" onSubmit={apply}>
          <fieldset
            className="bl-promo-fieldset"
            disabled={locked || checkout.busy}
          >
            <div className="bl-promo-input-group">
              <span className="bl-promo-input-icon-wrap" aria-hidden="true">
                <TicketIcon size={17} />
              </span>
              <input
                type="text"
                className="bl-promo-input"
                value={locked ? code : checkout.inputCode}
                placeholder={locked ? "Không dùng mã" : "Nhập mã ưu đãi (VD: BREW10)"}
                maxLength={64}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck="false"
                aria-describedby={messageId}
                onChange={(event) => {
                  try {
                    checkout.setPromoInput(event.target.value.toUpperCase());
                    setError("");
                  } catch (cause) {
                    setError(
                      cause instanceof Error ? cause.message : "Không đổi được mã.",
                    );
                  }
                }}
              />
              <button
                type="submit"
                className="bl-promo-apply-btn"
                disabled={locked || checkout.busy || !checkout.inputCode.trim()}
              >
                Áp dụng
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {error && !locked && (
        <div id={messageId} className="bl-promo-error-msg" role="alert">
          <ExclamationIcon size={15} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
