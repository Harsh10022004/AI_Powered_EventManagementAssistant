"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, clearToken } from "./api";

// Minimal client-side guard: redirect to /login if there's no token.
// Real authorization still happens server-side on every API call (the
// backend verifies the JWT independently) - this hook only protects the UI.
export function useRequireAuth() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  return ready;
}

export function useLogout() {
  const router = useRouter();
  return () => {
    clearToken();
    router.replace("/login");
  };
}
