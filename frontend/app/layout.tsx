import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import Wordmark from "@/components/Wordmark";
import { btnQuiet, focusRing } from "@/components/ui";
import { dataModeLabel, getCurrentPerson } from "@/lib/data";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workflow Scout",
  description: "Finds the work a team should hand over to make.com, starting from each person's own account of their day.",
};

async function TopBar() {
  const current = await getCurrentPerson();
  const links =
    current?.person.app_role === "manager"
      ? [
          { href: "/manager/roles", label: "Roles" },
          { href: "/manager/approvals", label: "Approvals" },
          { href: "/manager/suggestions", label: "Suggestions" },
        ]
      : current
        ? [{ href: "/check-in/current", label: "My check in" }]
        : [];

  // min-h and items-center keep the tallest thing in the bar, the person's name and role,
  // off the top edge however long the name is. Long names are shortened, never cut by the edge.
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex min-h-24 max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Link href="/" className={`rounded text-accent ${focusRing}`} aria-label="Workflow Scout, home">
            <Wordmark />
          </Link>
          <NavLinks links={links} />
        </div>
        {current && (
          <div className="flex min-w-0 items-center gap-5">
            <p className="min-w-0 text-right leading-snug">
              <span className="block truncate text-lg font-semibold">{current.person.full_name}</span>
              <span className="block truncate text-base text-muted">{current.role.title}</span>
            </p>
            <form action="/signout" method="post">
              <button type="submit" className={btnQuiet}>
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

async function Footer() {
  const label = await dataModeLabel();
  return (
    <footer className="border-t border-line bg-white">
      <p className="mx-auto max-w-6xl px-8 py-3 text-base text-muted">{label}</p>
    </footer>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-10">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
