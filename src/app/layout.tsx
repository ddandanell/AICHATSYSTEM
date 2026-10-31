import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
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
  title: {
    default: "Inbox mychef",
    template: "%s · Inbox mychef",
  },
  description:
    "Review drafted replies, record why they were right or wrong, and keep provider keys on the server.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Suspense
          fallback={
            <p className="px-6 py-8 text-sm text-muted-foreground">Loading…</p>
          }
        >
          {children}
        </Suspense>
      </body>
    </html>
  );
}
