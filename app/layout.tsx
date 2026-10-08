import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mầm · Mỗi ngày một chút ngoại ngữ",
  description: "Học tiếng Anh, tiếng Trung và tiếng Nhật từ đầu qua 90 buổi nhỏ, 360 từ vựng, trò ghép cặp và ôn tập nhẹ nhàng.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
