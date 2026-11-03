"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthProvider";
import { ApiError } from "@/lib/api";
export function useAdminList<T>(path: string, parse: (value: unknown) => T) {
  const { request } = useAuth();
  const [result, setResult] = useState<{ path: string; data: T } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let disposed = false;
    request(path)
      .then(parse)
      .then((rows) => {
        if (!disposed) {
          setResult({ path, data: rows });
          setError("");
        }
      })
      .catch((cause) => {
        if (!disposed)
          setError(
            cause instanceof ApiError && cause.status === 404
              ? "Chức năng này chưa sẵn sàng."
              : cause instanceof Error
                ? cause.message
                : "Không tải được dữ liệu.",
          );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
    };
  }, [path, parse, request, version]);
  return {
    data: result?.path === path ? result.data : null,
    error,
    loading: loading || (!error && result?.path !== path),
    reload: () => {
      setError("");
      setLoading(true);
      setVersion((n) => n + 1);
    },
  };
}
