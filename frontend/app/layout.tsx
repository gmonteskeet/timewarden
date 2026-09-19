import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import { getCurrentPerson } from "@/lib/data";
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

  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-8 py-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-2xl font-bold text-accent">
            Workflow Scout
          </Link>
          <NavLinks links={links} />
        </div>
        {current && (
          <div className="flex items-center gap-5">
            <p className="text-right leading-tight">
              <span className="block text-lg font-semibold">{current.person.full_name}</span>
              <span className="block text-base text-muted">{current.role.title}</span>
            </p>
            <form action="/signout" method="post">
              <button type="submit" className="rounded border border-line px-4 py-2 text-base font-medium hover:bg-track">
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-10">{children}</main>
      </body>
    </html>
  );
}
