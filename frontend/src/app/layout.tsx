import type { Metadata } from "next";
import { Noto_Serif_KR, Gowun_Batang } from "next/font/google";
import "./globals.css";

// Pretendard는 CDN 변수 폰트로 globals.css에서 로드.
// 한국어 세리프 + 디스플레이 세리프만 next/font로 최적화.
const notoSerifKr = Noto_Serif_KR({
  variable: "--font-noto-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  display: "swap",
});

const gowunBatang = Gowun_Batang({
  variable: "--font-gowun",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "테라코 — AI 상담 훈련",
  description: "AI 내담자와 상담 실습을 통해 상담 역량을 키우세요",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body
        className={`${notoSerifKr.variable} ${gowunBatang.variable} antialiased`}
        style={{ ['--font-pretendard' as string]: "'Pretendard Variable', 'Pretendard'" }}
      >
        {children}
      </body>
    </html>
  );
}
