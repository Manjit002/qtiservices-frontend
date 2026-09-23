import type { Metadata } from 'next';
import { ThemeProvider } from '@/hooks/useTheme';
import './tokens.css';
import './base.css';

/**
 * Runs before first paint, so the correct theme is on <html> by the time
 * anything renders. Without this the page paints dark, then snaps to light on
 * hydration — the flash-of-wrong-theme. It reads the same key the provider
 * writes, and falls back to the OS preference.
 */
const NO_FLASH = `(function(){try{var k=localStorage.getItem('qti_theme');var m=window.matchMedia('(prefers-color-scheme: light)').matches;var t=(k==='light'||k==='dark')?k:(m?'light':'dark');document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export const metadata: Metadata = {
  title: 'QTIServices — Academic operations platform',
  description:
    'Assign work to the right expert, track every deadline and payment, and keep students informed — in one operations platform.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
        {/*
          Loaded via <link> rather than next/font because next/font fetches from
          Google at BUILD time — a build machine without egress to
          fonts.googleapis.com fails the whole build. A stylesheet link resolves
          in the browser instead, so the build never depends on the network.
          preconnect keeps the runtime cost of that choice near zero.

          Inter carries the entire UI: it is the most legible neutral at the
          12–14px sizes a dense dashboard lives at. Bebas is the wordmark only.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font --
            The rule targets the pages/ router. This is the App Router root
            layout, so the stylesheet loads once for every route. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Open+Sans:wght@300;400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
