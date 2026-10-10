// The frame around every page: sets the title and puts the header on top.
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import AuthSync from "@/components/AuthSync";

export const metadata: Metadata = {
  title: "SwasthSetu",
  description: "Triage and referral assistant for health facilities",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <AuthSync />
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">{children}</main>
      </body>
    </html>
  );
}
