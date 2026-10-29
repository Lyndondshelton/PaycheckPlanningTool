import type { Metadata } from "next";
import "./globals.css";
import "@/components/planner/forecast.css";

export const metadata: Metadata = {
  title: "Paycheck Planner — See what’s ahead",
  description: "Plan your paychecks and recurring bills to see your projected balance, one transaction day at a time.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
