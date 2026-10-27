"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import OrdersView from "@/components/OrdersView";

function Confirmation() {
  const { id } = useParams<{ id: string }>();
  return <OrdersView orderId={id} />;
}

export default function ConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="bl-flow-wrap">
          <p role="status">Đang tải đơn hàng...</p>
        </main>
      }
    >
      <Confirmation />
    </Suspense>
  );
}
