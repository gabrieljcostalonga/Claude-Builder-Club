import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finanças",
  description: "Suas finanças pessoais, sincronizadas automaticamente via Open Finance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
