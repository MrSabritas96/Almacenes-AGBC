import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "@/styles/globals.css";
import "@/styles/experience.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Almacenes AGBC",
  description: "Plataforma institucional AGBC: Activos, Almacenes y Conciliaciones.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontFamily: "inherit", fontSize: "13px", border: "1px solid #dfe6ee", borderRadius: "10px", padding: "12px 16px", color: "#102b4a", boxShadow: "0 8px 30px #102b4a12" }, success: { iconTheme: { primary: "#287552", secondary: "#fff" } } }} />
      </body>
    </html>
  );
}
