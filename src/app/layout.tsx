import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "잠자리채 — 날아가는 생각, 잠자리에서 잡아드립니다",
  description: "생각·사진·링크를 남겨주세요. 잠든 동안 정리하고, 아침에 꺼내 쓰세요.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-[#ffd23f] text-neutral-950">{children}</body>
    </html>
  );
}
