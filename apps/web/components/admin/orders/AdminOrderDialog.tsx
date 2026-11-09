"use client";

import { useEffect, useRef, type ReactNode } from "react";

export default function AdminOrderDialog({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="bl-admin-order-dialog"
      aria-labelledby="admin-order-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="bl-admin-order-dialog-header">
        <h2 id="admin-order-dialog-title">Chi tiết đơn hàng</h2>
        <button type="button" onClick={onClose}>
          Đóng chi tiết đơn
        </button>
      </header>
      <div className="bl-admin-order-dialog-body">{children}</div>
    </dialog>
  );
}
