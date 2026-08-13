import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { db } from "@/lib/db";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Learning Inventory",
  description: "A private study library kept past graduation.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const topicCount = await db.topic.count();

  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-bg text-text">
        <div className="flex min-h-screen">
          <Nav topicCount={topicCount} />
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
