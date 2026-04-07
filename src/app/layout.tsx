import type { Metadata } from "next";
import { Abyssinica_SIL, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/app/providers";
import { Header } from "@/components/header";
import { PwaRegister } from "@/components/pwa-register";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const abyssinica = Abyssinica_SIL({
  weight: "400",
  subsets: ["latin", "ethiopic"],
  variable: "--font-abyssinica",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mahibere Kidusan - ማህበረ ቅዱሳን",
  description: "Classroom presentation and quiz tool for substitute teachers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${abyssinica.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50">
        <AppProviders>
          <PwaRegister />
          <Header />
          <main className="flex-1">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
