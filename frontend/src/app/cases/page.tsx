import { redirect } from "next/navigation";

// 기존 /cases는 랜딩 페이지(/)에서 모드를 선택하도록 안내.
// 모드별 페이지: /cases/video (영상 AI 휴먼), /cases/photo (텍스트·음성)
export default function CasesIndexPage() {
  redirect("/");
}
