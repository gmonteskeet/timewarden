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
    <div className="scout-home space-y-10">
      <section className="space-y-8">
        <div className="max-w-5xl space-y-5">
          <h1 className="flex items-center gap-4 text-4xl font-bold leading-tight">
            <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className="h-14 w-14 shrink-0 rounded-2xl bg-accent-soft p-2.5 text-accent">
              <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="43 8" transform="rotate(-55 12 12)" />
            </svg>
            Workflow Scout
          </h1>
          <p className="scout-hero-sentence text-2xl font-medium leading-snug text-ink">
            Scout asks each person about their last working day, compares it with what their role is for, and suggests make.com workflows to take over the work that keeps landing in the wrong place.
          </p>
        </div>
        <ol aria-label="How Workflow Scout works" className="scout-home-steps grid gap-5 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step} className={`${card} relative flex flex-col gap-5`}>
              <div aria-hidden="true" className="flex items-center justify-between">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xl font-semibold text-accent">{i + 1}</span>
                <svg viewBox="0 0 24 24" focusable="false" className="h-7 w-7 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {i === 0 ? <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4H3V6a2 2 0 0 1 2-2Zm2 5h10M7 12h6" /> : i === 1 ? <path d="M9 6h11M9 12h11M9 18h11M3 5l1 1 2-2M3 11l1 1 2-2M3 17l1 1 2-2" /> : <path d="M4 3h6v6H4zM14 15h6v6h-6zM7 9v8h7M14 5h7m-3-3 3 3-3 3" />}
                </svg>
              </div>
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
                className="scout-person flex items-start gap-4 rounded-xl border border-line bg-white px-5 py-5 hover:border-accent/50 hover:bg-accent-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#8391de]"
              >
                <span aria-hidden="true" className="scout-avatar flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent">{p.full_name.split(" ").map((part) => part[0]).join("")}</span>
                <span className="min-w-0">
                  <span className="block text-xl font-semibold">{p.full_name}</span>
                  <span className="mt-1 block text-lg text-muted">
                    {p.role_title}{p.role_title ? ", " : ""}<span className="scout-person-role inline-block rounded-full border border-line bg-track px-2 py-0.5 text-base font-medium">{p.app_role === "manager" ? "manager" : "employee"}</span>
                  </span>
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
