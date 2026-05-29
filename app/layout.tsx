import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Command Center",
  description: "Kindgerechtes Familien-Dashboard für iCloud-Kalender und Aufgaben"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
