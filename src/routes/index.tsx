import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/AppHeader";
import { REGION_TYPES } from "@/lib/regions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TLG Place Mapper — interactive maps of the UK" },
      { name: "description", content: "Plot overlapping layers of UK regions, label them, and attach your own data to every area." },
      { property: "og:title", content: "TLG Place Mapper — interactive maps of the UK" },
      { property: "og:description", content: "Plot overlapping layers of UK regions, label them, and attach your own data to every area." },
    ],
  }),
  component: Index,
});

const SWATCHES = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <BrandMark />
        <Button asChild variant="outline" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-12 px-6 py-16 md:grid-cols-[1.2fr_1fr] md:px-12">
        <section>
          <p className="text-sm font-medium text-primary">Test, Learn, Grow</p>
          <h1 className="mt-4 text-4xl leading-tight md:text-5xl">
            Map your programmes across the UK.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Build layers like "Programme area" or "Funding round", place them on any mix of
            official ONS geographies, and click any area to see the data behind it.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg">
              <Link to="/maps">Open my maps</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Create an account</Link>
            </Button>
          </div>
        </section>
        <section className="border border-border bg-card p-6">
          <h2 className="text-lg">Supported geographies</h2>
          <ul className="mt-4 space-y-3">
            {REGION_TYPES.map((r, i) => (
              <li key={r.id} className="flex items-start gap-3">
                <span className={`mt-1 size-3 shrink-0 ${SWATCHES[i % SWATCHES.length]}`} />
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-sm text-muted-foreground">{r.source}</div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            Add entries one at a time or upload a CSV. A region can appear as often as you need.
          </p>
        </section>
      </main>
      <footer className="border-t border-border px-6 py-4 text-sm text-muted-foreground md:px-12">
        Test, Learn, Grow · Boundaries: Office for National Statistics, Open Geography Portal (OGL v3)
      </footer>
    </div>
  );
}
