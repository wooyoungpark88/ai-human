"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const session = document.cookie
      .split("; ")
      .find((c) => c.startsWith("session="))
      ?.split("=")[1];
    if (session) {
      try { setUserName(atob(session)); } catch { /* ignore */ }
    }
  }, []);

  const handleLogout = useCallback(() => {
    document.cookie = "session=; path=/; max-age=0";
    window.location.href = "/login";
  }, []);

  const isActive = (path: string) =>
    pathname === path || pathname.startsWith(path + "/");

  return (
    <header className="border-b px-6 py-3 flex items-center justify-between bg-background">
      <div className="flex items-center gap-6">
        <Link href="/cases" className="text-lg font-bold">
          AI 상담 훈련
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/cases"
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
              isActive("/cases")
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            케이스 탐색
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-sm text-muted-foreground">{userName}</span>
        )}
        <Button onClick={handleLogout} variant="ghost" size="sm">
          로그아웃
        </Button>
      </div>
    </header>
  );
}
