"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client-api";

export function useAdminData<T>(url: string | null, version: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!url) return;
    let active = true;
    setLoading(true);
    apiFetch<T>(url)
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setError("");
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url, version, nonce]);

  return { data, error, loading, reload };
}
