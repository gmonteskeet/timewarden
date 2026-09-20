import Link from "next/link";
import { btnPrimary } from "@/components/ui";

export default function NotAllowed() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">You do not have access to that page</h1>
      <p className="text-xl text-muted">
        Employees can see only their own check ins. Managers can see their own team. If you followed a link from an email, open it again, or choose a person on the home page.
      </p>
      <Link href="/" className={btnPrimary}>
        Back to the home page
      </Link>
    </div>
  );
}
