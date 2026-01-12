import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moodle Actions",
  description: "Application d'orchestration des Web Services Moodle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
