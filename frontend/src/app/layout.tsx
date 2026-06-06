import React from "react";
import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import { ToastContainer } from "@/components/ToastContainer";
import { GuideModal } from "@/components/GuideModal";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: "NULL_POINTER | Simulation Dashboard",
  description: "Agentic Simulation and Real-time Heat Monitoring",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${orbitron.variable} font-sans bg-[#050505] text-slate-200 antialiased min-h-screen`}
      >
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(17,24,39,1)_0%,rgba(5,5,5,1)_100%)] grid-bg-overlay pointer-events-none -z-10" />
        <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none -z-10 brightness-50" />
        <ToastContainer />
        <GuideModal />
        {children}
      </body>
    </html>
  );
}
