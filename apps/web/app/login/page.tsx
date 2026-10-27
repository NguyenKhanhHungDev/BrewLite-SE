import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="bl-flow-wrap">
          <p role="status">Đang tải đăng nhập...</p>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
