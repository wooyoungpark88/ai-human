import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith("/login");

  // 로그인 안 된 상태에서 보호된 경로 접근 시 -> 로그인 페이지로 리디렉트
  if (!session && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // 로그인된 상태에서 로그인 페이지 접근 시 -> 케이스 목록으로 리디렉트
  if (session && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/cases";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
