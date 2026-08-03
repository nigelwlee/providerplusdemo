import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const bodyFont = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const headingFont = Fraunces({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "variable",
  style: ["normal"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: "Audit-Ready Gap Checker",
  description:
    "Upload a policy document. Get an audit-style gap analysis against the NDIS Practice Standards in under a minute.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-AU"
      className={`${bodyFont.variable} ${headingFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-pp-bg-primary text-pp-text-primary">
        {children}
      </body>
    </html>
  );
}
