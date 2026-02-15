"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (username === "wooyoung" && password === "1234") {
      document.cookie = `session=${btoa(username)}; path=/; max-age=${60 * 60 * 24 * 7}`;
      router.push("/");
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">AI Avatar</CardTitle>
          <p className="text-sm text-muted-foreground">
            로그인하여 AI 아바타와 대화를 시작하세요
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <Input
              placeholder="아이디"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
            />
            <Input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}
            <Button type="submit" disabled={isLoading} className="w-full">
              로그인
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
