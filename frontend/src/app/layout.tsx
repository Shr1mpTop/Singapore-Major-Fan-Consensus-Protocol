import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/lib/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CS2 Major Betting DApp",
  description: "Predict the winner of CS2 Singapore Major 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {process.env.NODE_ENV !== "production" && (
            <script
              dangerouslySetInnerHTML={{
                __html: `(() => {
  const orig = console.error;
  console.error = function(...args) {
    try {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('The final argument passed to useEffect changed size between renders')) {
        const stack = new Error('useEffect size-change detected').stack;
        orig('[DevUseEffectWatcher] useEffect size-change warning detected:', ...args);
        orig('Captured stack:', stack);
        window.__DEV_USE_EFFECT_STACKS__ = window.__DEV_USE_EFFECT_STACKS__ || [];
        window.__DEV_USE_EFFECT_STACKS__.push({ msg, stack, time: Date.now() });
      } else {
        orig(...args);
      }
    } catch (e) {
      orig(...args);
    }
  }
})()`,
              }}
            />
          )}
          {children}
        </Providers>
      </body>
    </html>
  );
}
