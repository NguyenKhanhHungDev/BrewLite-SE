"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useCheckout } from "./CheckoutProvider";
import { parsePaymentStatus, paymentView } from "@/lib/payments";

/** Keep checkout open while paying on another device or browser tab. */
export default function CheckoutPaymentWatcher({
  orderId,
  total,
}: {
  orderId: number;
  total: number;
}) {
  const { request } = useAuth();
  const { syncPayment } = useCheckout();
  const router = useRouter();

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = setTimeout(() => controller.abort(), 15 * 60_000);

    async function check() {
      if (controller.signal.aborted) return;
      try {
        const value = await request(`/payments/${orderId}/status`, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(10_000),
          ]),
        });
        if (controller.signal.aborted) return;
        const status = parsePaymentStatus(value, orderId);
        if (status.latestPayment && status.latestPayment.amount !== total) return;
        syncPayment(status);
        const view = paymentView(status);
        if (view === "success") {
          clearTimeout(deadline);
          router.replace(`/payment/result?orderId=${orderId}`);
          return;
        }
        if (view !== "pending") {
          clearTimeout(deadline);
          return;
        }
      } catch {
        // Transient network failures do not imply payment failure. The existing
        // status/details screen remains available for manual verification.
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void check(), 3_000);
    }

    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
      clearTimeout(deadline);
    };
  }, [orderId, total, request, syncPayment, router]);

  return null;
}
