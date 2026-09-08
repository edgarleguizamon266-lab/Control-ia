import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CONTROL IA — Tu dinero. Bajo control.",
  description: "Registrá, organizá y entendé tus finanzas hablando, escribiendo o enviando comprobantes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
