import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import AppShellWrapper from "@/components/AppShell";

export const metadata: Metadata = {
  title: "GenAI Personalized Wellness Kitchen",
  description: "AI-powered personalized nutrition, recipes, and wellness tracking tailored to your health goals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '10px', fontSize: '14px' } }} />
        <AppShellWrapper>{children}</AppShellWrapper>
      </body>
    </html>
  );
}
