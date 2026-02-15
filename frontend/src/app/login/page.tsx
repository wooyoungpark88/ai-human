"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleKakaoLogin = async () => {
    setIsLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
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
        <CardContent className="flex flex-col gap-3">
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            Google로 로그인
          </Button>
          <Button
            onClick={handleKakaoLogin}
            disabled={isLoading}
            variant="outline"
            className="w-full"
          >
            Kakao로 로그인
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
