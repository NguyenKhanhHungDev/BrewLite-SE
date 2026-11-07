"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../AuthProvider";
import { isObject } from "@/lib/api";

export default function AdminShell({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!session) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session, path, router]);
  if (!session)
    return (
      <main className="bl-flow-wrap">
        <p role="status">Đang chuyển đến đăng nhập…</p>
      </main>
    );
  return (
    <AdminAccess key={session.userId} userId={session.userId} path={path}>
      {children}
    </AdminAccess>
  );
}
function AdminAccess({
  children,
  userId,
  path,
}: {
  children: ReactNode;
  userId: number;
  path: string;
}) {
  const { request } = useAuth();
  const [status, setStatus] = useState("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    request("/auth/me")
      .then((profile) => {
        if (
          !isObject(profile) ||
          profile.id !== userId ||
          !["ADMIN", "CUSTOMER"].includes(String(profile.role))
        )
          throw new Error();
        if (!disposed)
          setStatus(profile.role === "ADMIN" ? "ready" : "forbidden");
      })
      .catch(() => {
        if (!disposed) setStatus("error");
      });
    return () => {
      disposed = true;
    };
  }, [request, userId, retry]);
  if (status !== "ready")
    return (
      <main className="bl-flow-wrap">
        {status === "loading" ? (
          <p role="status">Đang kiểm tra quyền truy cập…</p>
        ) : status === "forbidden" ? (
          <>
            <h1>403 — Không có quyền truy cập</h1>
            <Link href="/">Về Menu</Link>
          </>
        ) : (
          <>
            <p role="alert">Chưa xác nhận được quyền truy cập.</p>
            <button
              className="bl-button"
              onClick={() => {
                setStatus("loading");
                setRetry((n) => n + 1);
              }}
            >
              Thử lại
            </button>
          </>
        )}
      </main>
    );
  return (
    <main className="bl-admin bl-flow-wrap">
      <nav className="bl-admin-nav" aria-label="Quản trị">
        {[
          ["/admin", "Tổng quan"],
          ["/admin/ingredients", "Nguyên liệu"],
          ["/admin/recipes", "Công thức"],
          ["/admin/orders", "Đơn hàng"],
          ["/admin/payments", "Đối soát GD"],
        ].map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </main>
  );
}
