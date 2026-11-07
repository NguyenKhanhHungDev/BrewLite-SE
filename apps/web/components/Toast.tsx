"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircleIcon, ExclamationIcon, UndoIcon, CloseIcon } from "./Icons";

export type ToastMessage = {
  id: string;
  type: "success" | "error" | "info" | "undo";
  title?: string;
  message: string;
  actionText?: string;
  onAction?: () => void;
  duration?: number;
};

type ToastContextType = {
  showToast: (toast: Omit<ToastMessage, "id">) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  undo: (message: string, onUndo: () => void, actionText?: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ duration = 5000, ...rest }: Omit<ToastMessage, "id">) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastMessage = { id, duration, ...rest };

      setToasts((prev) => [...prev.slice(-3), newToast]); // keep at most 4 toasts

      if (duration > 0) {
        window.setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => {
      showToast({ type: "success", message, title });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string) => {
      showToast({ type: "error", message, title });
    },
    [showToast]
  );

  const undo = useCallback(
    (message: string, onUndo: () => void, actionText = "Hoàn tác") => {
      showToast({
        type: "undo",
        message,
        onAction: onUndo,
        actionText,
        duration: 6000,
      });
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, undo }}>
      {children}
      <div
        className="bl-toast-container"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bl-toast bl-toast-${t.type}`}
            role={t.type === "error" ? "alert" : "status"}
          >
            <div className="bl-toast-icon">
              {t.type === "success" && <CheckCircleIcon size={20} />}
              {t.type === "error" && <ExclamationIcon size={20} />}
              {t.type === "undo" && <UndoIcon size={20} />}
              {t.type === "info" && <CheckCircleIcon size={20} />}
            </div>
            <div className="bl-toast-content">
              {t.title && <strong className="bl-toast-title">{t.title}</strong>}
              <p className="bl-toast-message">{t.message}</p>
            </div>
            {t.onAction && (
              <button
                type="button"
                className="bl-toast-action"
                onClick={() => {
                  t.onAction?.();
                  removeToast(t.id);
                }}
              >
                {t.actionText || "Hoàn tác"}
              </button>
            )}
            <button
              type="button"
              className="bl-toast-close"
              aria-label="Đóng thông báo"
              onClick={() => removeToast(t.id)}
            >
              <CloseIcon size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
