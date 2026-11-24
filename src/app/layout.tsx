import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getLocale, serverMessages } from "@/lib/i18n/server";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export function generateMetadata(): Metadata {
  return {
    title: { default: "Let's meet!", template: "%s · Let's meet!" },
    description: serverMessages()("siteDescription"),
    applicationName: "Let's meet!",
    appleWebApp: { capable: true, title: "Let's meet!", statusBarStyle: "default" },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#F3EEFF",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Unbounded:wght@500;700;800&display=swap"
        />
      </head>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
