import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="bl-auth-container">
          <div className="bl-auth-card-wrap">
            <div className="bl-auth-banner">
              <div className="shimmer" style={{ height: 28, width: 140, borderRadius: 9999, marginBottom: 24 }} />
              <div className="shimmer" style={{ height: 48, width: "80%", borderRadius: 12, marginBottom: 16 }} />
              <div className="shimmer" style={{ height: 20, width: "60%", borderRadius: 8 }} />
            </div>
            <div className="bl-auth-form-card">
              <div className="shimmer" style={{ height: 36, width: "100%", borderRadius: 12, marginBottom: 24 }} />
              <div className="shimmer" style={{ height: 48, width: "100%", borderRadius: 12, marginBottom: 16 }} />
              <div className="shimmer" style={{ height: 48, width: "100%", borderRadius: 12, marginBottom: 24 }} />
              <div className="shimmer" style={{ height: 48, width: "100%", borderRadius: 12 }} />
            </div>
          </div>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
