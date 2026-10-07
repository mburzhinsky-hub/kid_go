import type { Metadata, Viewport } from "next";
import "@fontsource/nunito/latin-900.css";
import "@fontsource-variable/inter/index.css";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { BottomNavigation } from "@/components/layout/BottomNavigation";

const B = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kids-go.fun";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Kids Go — куда пойти с детьми сегодня", template: "%s · Kids Go" },
  description:
    "Выберите настроение — мы соберём ваш день: готовые семейные приключения, лучшие места для детей в Москве, маршрут, время и бюджет.",
  applicationName: "Kids Go",
  appleWebApp: { capable: true, title: "Kids Go", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: "Kids Go",
    title: "Kids Go — куда пойти с детьми сегодня",
    description: "Выберите настроение — мы соберём ваш день.",
  },
  icons: { icon: [{ url: `${B}/icons/favicon-48.png`, sizes: "48x48" }, { url: `${B}/icons/icon-192.png`, sizes: "192x192" }], apple: `${B}/icons/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Providers>
          <DesktopBackdrop />
          <div className="relative mx-auto min-h-dvh w-full max-w-[480px] bg-bg sm:shadow-[0_0_0_1px_rgba(17,18,26,0.04),0_30px_80px_rgba(17,18,26,0.08)]">
            {children}
          </div>
          <BottomNavigation />
        </Providers>
      </body>
    </html>
  );
}

/** На десктопе приложение живёт в «телефонной» колонке на тёплом фоне с конфетти. */
function DesktopBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-0 hidden overflow-hidden sm:block">
      <div className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-[#ffd1e5] opacity-60 blur-3xl" />
      <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-[#d6e6ff] opacity-70 blur-3xl" />
      <div className="absolute bottom-10 left-1/4 h-64 w-64 rounded-full bg-[#fff0b3] opacity-70 blur-3xl" />
    </div>
  );
}
