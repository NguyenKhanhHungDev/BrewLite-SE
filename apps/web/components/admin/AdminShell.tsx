"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../AuthProvider";
import { isObject } from "@/lib/api";
import BrewLiteMark from "../BrewLiteMark";
import { CoffeeIcon, ShoppingBagIcon, QrCodeIcon, TeaIcon, BadgeAwardIcon, ArrowRightIcon } from "../Icons";

const navigation = [
  { href: "/admin", label: "Tổng quan", icon: BadgeAwardIcon, description: "Theo dõi hoạt động cửa hàng" },
  { href: "/admin/ingredients", label: "Nguyên liệu", icon: TeaIcon, description: "Theo dõi tồn kho và nhập nguyên liệu" },
  { href: "/admin/recipes", label: "Công thức & món", icon: CoffeeIcon, description: "Quản lý món và định lượng nguyên liệu" },
  { href: "/admin/orders", label: "Đơn hàng", icon: ShoppingBagIcon, description: "Theo dõi đơn hàng và tiến độ pha chế" },
  { href: "/admin/payments", label: "Đối soát", icon: QrCodeIcon, description: "Kiểm tra các giao dịch cần đối soát" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !session) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [session, loading, path, router]);
  if (loading) return <main className="bl-flow-wrap"><p role="status">Đang khôi phục phiên đăng nhập…</p></main>;
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
  const { request, logout } = useAuth();
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
    <div className="bl-admin bl-admin-workspace">
      <a className="bl-admin-skip" href="#admin-content">Đến nội dung quản trị</a>
      <aside className="bl-admin-sidebar">
        <Link className="bl-admin-brand" href="/admin"><BrewLiteMark /><span>BrewLite<small>Không gian quản trị</small></span></Link>
        <div className="bl-admin-identity"><span>AD</span><div><strong>Quản trị viên</strong><small>Vận hành cửa hàng</small></div></div>
        <nav className="bl-admin-nav" aria-label="Quản trị">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
              <Icon size={20} /><span>{label}</span>{path === href && <ArrowRightIcon size={16} />}
            </Link>
          ))}
        </nav>
        <div className="bl-admin-sidebar-footer">
          <Link href="/"><ArrowRightIcon size={18} />Xem trang khách hàng</Link>
          <button type="button" onClick={logout}>Đăng xuất mọi thiết bị</button>
        </div>
      </aside>
      <div className="bl-admin-main">
        <header className="bl-admin-topbar"><div><strong>{navigation.find((item) => item.href === path)?.label ?? "Quản trị"}</strong><p>{navigation.find((item) => item.href === path)?.description}</p></div><span className="bl-admin-role">Admin</span></header>
        <main id="admin-content" className="bl-admin-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
