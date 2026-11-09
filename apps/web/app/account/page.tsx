"use client";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import ChangePassword from "@/components/ChangePassword";
import AccountProfile from "@/components/AccountProfile";
export default function AccountPage() {
  const { session, loading } = useAuth();
  return (
    <main className="bl-flow-wrap">
      <h1>Tài khoản</h1>
      {loading ? <p role="status">Đang khôi phục phiên đăng nhập…</p> : session ? (
        <div key={session.userId}>
          <AccountProfile />
          <ChangePassword />
        </div>
      ) : (
        <Link href="/login?next=/account">Đăng nhập để xem tài khoản</Link>
      )}
    </main>
  );
}
