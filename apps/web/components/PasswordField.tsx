"use client";
import { useState } from "react";
export default function PasswordField({
  label,
  value,
  onChange,
  disabled,
  minLength = 8,
  autoComplete = "new-password",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minLength?: number;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="bl-field">
      <label>
        {label}
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          disabled={disabled}
        />
      </label>
      <button
        type="button"
        className="bl-text-button"
        disabled={disabled}
        aria-pressed={visible}
        aria-label={`${visible ? "Ẩn" : "Hiện"} ${label.toLowerCase()}`}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
      </button>
    </div>
  );
}
