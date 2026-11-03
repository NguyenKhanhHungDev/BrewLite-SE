import { Suspense, type ReactNode } from "react";
import AdminShell from "@/components/admin/AdminShell";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p role="status">Đang tải…</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
