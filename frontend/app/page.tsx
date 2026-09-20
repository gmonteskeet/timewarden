import { btnDanger, card } from "@/components/ui";
import { canResetDemo, demoResetNote, listDemoSignIns } from "@/lib/data";

const STEPS = [
  "Scout interviews you about your last working day.",
  "You check the summary and send it to your manager.",
  "Scout suggests what to automate, and drafts it in make.com.",
];

export default async function Home({ searchParams }: PageProps<"/">) {
  const people = await listDemoSignIns();
  const resettable = await canResetDemo();
  const resetNote = await demoResetNote();
  const { signin } = await searchParams;

  return (
    <div className="space-y-10">
      <section className="space-y-8">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-bold leading-tight">Workflow Scout</h1>
          <p className="text-2xl leading-relaxed text-muted">
            Scout asks each person about their last working day, compares it with what their role is for, and suggests make.com workflows to take over the work that keeps landing in the wrong place.
          </p>
        </div>
        <ol aria-label="How Workflow Scout works" className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className={`${card} flex gap-4`}>
              <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-white">
                {i + 1}
              </span>
              <p className="text-lg leading-snug">
                <span className="sr-only">{`Step ${i + 1}. `}</span>
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="demo-sign-in" className={card}>
        <h2 id="demo-sign-in" className="text-2xl font-semibold">
          Demo sign in
        </h2>
        <p className="mt-2 text-lg text-muted">
          There are no passwords in this demo. In real use each person signs in from the personal link in their morning email. Choose a person to see Scout as they would.
        </p>
        {signin === "unavailable" && (
          <p role="alert" className="mt-4 rounded bg-note px-4 py-3 text-lg">
            Signing in is not available just now. Please try again in a moment.
          </p>
        )}
        {signin === "unknown" && (
          <p role="alert" className="mt-4 rounded bg-note px-4 py-3 text-lg">
            That sign in link is not valid. Choose a person below.
          </p>
        )}
        {people.length === 0 && (
          <p className="mt-4 text-lg">Demo sign in is switched off here. Please open the personal link from your morning email.</p>
        )}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.href}>
              <a
                href={p.href}
                className="block rounded-lg border border-line bg-white px-6 py-5 hover:border-accent hover:bg-track focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="block text-xl font-semibold">{p.full_name}</span>
                <span className="block text-lg text-muted">
                  {[p.role_title, p.app_role === "manager" ? "manager" : "employee"].filter(Boolean).join(", ")}
                </span>
              </a>
            </li>
          ))}
        </ul>
        {resettable && (
          <form action="/demo/reset" method="post" className="mt-6 flex flex-wrap items-center gap-4">
            <button type="submit" className={btnDanger}>
              Reset the demo
            </button>
            <span className="text-base text-muted">{resetNote}</span>
          </form>
        )}
      </section>
    </div>
  );
}
