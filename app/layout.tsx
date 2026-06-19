import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
// @ts-ignore
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scouting Hub | Command Center",
  description: "High Fidelity Scouting & LoL Analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Adicionado scroll-smooth para navegação âncora mais fluida
    <html lang="pt-BR" className="scroll-smooth">
      <body 
        className={`
          ${geistSans.variable} ${geistMono.variable} 
          antialiased 
          bg-zinc-950 text-zinc-50 
          min-h-screen flex flex-col 
          selection:bg-blue-500/30 selection:text-blue-200
        `}
      >
        {children}
      </body>
    </html>
  );
}