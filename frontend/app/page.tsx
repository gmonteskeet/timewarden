import { listDemoSignIns } from "@/lib/data";

export default async function Home({ searchParams }: PageProps<"/">) {
  const people = await listDemoSignIns();
  const { signin } = await searchParams;

  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-bold leading-tight">Workflow Scout</h1>
        <p className="mt-4 text-2xl leading-relaxed text-muted">
          Scout asks each person about their last working day, compares it with what their role is for, and suggests make.com workflows to take over the work that keeps landing in the wrong place.
        </p>
      </section>

      <section aria-labelledby="demo-sign-in" className="rounded-lg border border-line bg-white p-8">
        <h2 id="demo-sign-in" className="text-2xl font-semibold">
          Demo sign in
        </h2>
        <p className="mt-2 text-lg text-muted">
          There are no passwords in this demo. In real use each person signs in from the personal link in their morning email. Choose a person to see Scout as they would.
        </p>
        {signin === "unknown" && (
          <p role="alert" className="mt-4 rounded bg-note px-4 py-3 text-lg">
            That sign in link is not valid. Choose a person below.
          </p>
        )}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {people.map((p) => (
            <li key={p.access_token}>
              <a
                href={`/enter/${encodeURIComponent(p.access_token)}`}
                className="block rounded-lg border border-line px-6 py-5 hover:border-accent hover:bg-track"
              >
                <span className="block text-xl font-semibold">{p.full_name}</span>
                <span className="block text-lg text-muted">
                  {p.role_title}, {p.app_role === "manager" ? "manager" : "employee"}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
