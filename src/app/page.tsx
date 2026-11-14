import { JamjariApp } from "@/components/jamjari/JamjariApp";

// Vercel 배포는 결과 보기 전용 공개 시연판이다(워커·kiro-cli·파일 저장소가 없음). 빌드 시점 값이라 정적 렌더에 그대로 들어간다.
const PUBLIC_DEMO = Boolean(process.env.VERCEL);

export default function Home() {
  return (
    <main className="min-h-screen">
      {PUBLIC_DEMO && (
        <div role="note" className="border-b-4 border-black bg-yellow-300 px-4 py-3 text-sm font-bold text-black">
          공개 시연판 · 결과 보기 전용 — 2026-11-14 16:02–16:13에 개발자 PC에서 kiro-cli로 실제 실행한 결과(W1–W6)입니다. 담기·맡기기는 로컬
          워커와 kiro-cli가 있는 PC에서만 동작하며, 아래 연결 상태는 이 서버 기준입니다.{" "}
          <a className="underline" href="https://github.com/stat-yongsan/kirothon-team-030">
            소스·실행법
          </a>
        </div>
      )}
      <JamjariApp />
    </main>
  );
}
