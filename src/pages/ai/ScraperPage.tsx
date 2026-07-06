import {useMemo, useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {AlertCircle, ArrowUpRight, BadgeCheck, Globe, Loader2, Phone, Search, ShieldCheck, Sparkles, Star, Telescope} from "lucide-react";

import {Button} from "@/components/ui/Button";
import {runApifyActor, runFirecrawlScrape, runFirecrawlSearch, searchApifyActors} from "@/services/api";
import type {ApifyRunResponse, FirecrawlBusinessRecord, FirecrawlBusinessSearchReport, FirecrawlScrapeResponse} from "@/types/frontend";

type WorkspaceMode = "search" | "scrape";

function reputationTone(source: FirecrawlBusinessRecord["reviewSources"][number]["source"]) {
  switch (source) {
    case "google":
      return "text-emerald-300 bg-emerald-500/10";
    case "trustpilot":
      return "text-cyan-300 bg-cyan-500/10";
    case "facebook":
      return "text-blue-300 bg-blue-500/10";
    default:
      return "text-[var(--color-text-muted)] bg-[var(--color-surface-2)]";
  }
}

export function ScraperPage() {
  const [mode, setMode] = useState<WorkspaceMode>("search");
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Greater Manchester");
  const [loading, setLoading] = useState(false);
  const [searchReport, setSearchReport] = useState<FirecrawlBusinessSearchReport | null>(null);
  const [scrapeReport, setScrapeReport] = useState<FirecrawlScrapeResponse | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<FirecrawlBusinessRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actorSearch, setActorSearch] = useState("google maps reviews local business");
  const [actorInputJson, setActorInputJson] = useState("{\n  \"searchTerms\": [\"restaurants Greater Manchester\"],\n  \"maxItems\": 25\n}");
  const [actorLoading, setActorLoading] = useState<string | null>(null);
  const [actorRun, setActorRun] = useState<ApifyRunResponse | null>(null);

  const apifyActorsQuery = useQuery({
    queryKey: ["apify-actors", actorSearch],
    queryFn: () => searchApifyActors({query: actorSearch, limit: 8}),
    staleTime: 300_000,
  });

  const highlightedBusiness = selectedBusiness ?? searchReport?.businesses[0] ?? null;

  const intelligenceStats = useMemo(() => {
    const businesses = searchReport?.businesses ?? [];
    return {
      resultCount: businesses.length,
      withReviews: businesses.filter((business) => business.reviewSources.length > 0).length,
      withTrustSignals: businesses.filter((business) => business.trustSignals.length >= 2).length,
    };
  }, [searchReport]);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setScrapeReport(null);
    try {
      const data = await runFirecrawlSearch({
        query: query.trim(),
        location: location.trim() || "Greater Manchester",
        limit: 8,
      });
      setSearchReport(data);
      setSelectedBusiness(data.businesses[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleScrape(targetUrl?: string) {
    const nextUrl = (targetUrl ?? url).trim();
    if (!nextUrl) return;
    setLoading(true);
    setError(null);
    try {
      const data = await runFirecrawlScrape({url: nextUrl});
      setScrapeReport(data);
      setUrl(nextUrl);
      setMode("scrape");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scrape failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleActorRun(actorId: string) {
    setActorLoading(actorId);
    setError(null);
    try {
      const parsedInput = JSON.parse(actorInputJson) as Record<string, unknown>;
      const result = await runApifyActor(actorId, {
        input: parsedInput,
        waitForFinishSeconds: 60,
        purpose: "External lead enrichment",
      });
      setActorRun(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Apify actor run failed");
    } finally {
      setActorLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-8 md:px-10 md:py-10">
      <div className="grid gap-8 xl:grid-cols-[1.1fr_1.6fr]">
        <section className="space-y-6">
          <header className="space-y-3">
            <p className="section-kicker">AI intelligence</p>
            <div className="space-y-2">
              <h1 className="display-title max-w-[12ch]">Firecrawl research cockpit</h1>
              <p className="max-w-[56ch] text-sm leading-7 text-[var(--color-text-muted)]">
                Search a market, surface review signals, and run a first-pass commercial read on any site before the
                lead ever reaches outreach.
              </p>
            </div>
          </header>

          <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/75 p-2">
            <div className="grid grid-cols-2 gap-2">
              {(["search", "scrape"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                  className={[
                    "rounded-[var(--radius-xl)] px-4 py-3 text-left transition-all duration-[var(--duration-base)]",
                    mode === item
                      ? "bg-[var(--color-surface-2)] text-[var(--color-text)] shadow-[var(--shadow-sm)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]/70 hover:text-[var(--color-text)]",
                  ].join(" ")}
                >
                  <p className="section-kicker !text-[9px]">{item === "search" ? "market scan" : "site deep dive"}</p>
                  <p className="mt-1 text-sm font-medium">{item === "search" ? "Search businesses" : "Scrape URL"}</p>
                </button>
              ))}
            </div>
          </div>

          <section className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
            {mode === "search" ? (
              <>
                <div className="space-y-2">
                  <label className="section-kicker">Search term</label>
                  <input
                    type="text"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                    placeholder="Dentists, salons, restaurants, solicitors..."
                    className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="section-kicker">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                    placeholder="Greater Manchester"
                    className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                  />
                </div>
                <Button variant="glow" onClick={handleSearch} disabled={loading || !query.trim()} className="w-full justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  <span>{loading ? "Scanning live results..." : "Run market scan"}</span>
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="section-kicker">Website URL</label>
                  <div className="relative">
                    <Globe size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                      type="url"
                      value={url}
                      onChange={(event) => setUrl(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleScrape()}
                      placeholder="https://example.co.uk"
                      className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] py-3 pl-11 pr-4 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                    />
                  </div>
                </div>
                <Button variant="glow" onClick={() => handleScrape()} disabled={loading || !url.trim()} className="w-full justify-center">
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Telescope size={15} />}
                  <span>{loading ? "Reading live site..." : "Run deep scrape"}</span>
                </Button>
              </>
            )}
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/65 p-4">
              <p className="section-kicker">Results</p>
              <p className="mt-2 font-[var(--font-mono)] text-2xl text-[var(--color-text)]">{intelligenceStats.resultCount}</p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/65 p-4">
              <p className="section-kicker">Reputation found</p>
              <p className="mt-2 font-[var(--font-mono)] text-2xl text-[var(--color-text)]">{intelligenceStats.withReviews}</p>
            </div>
            <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/65 p-4">
              <p className="section-kicker">Trust-rich</p>
              <p className="mt-2 font-[var(--font-mono)] text-2xl text-[var(--color-text)]">{intelligenceStats.withTrustSignals}</p>
            </div>
          </section>

          {error ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <section className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="section-kicker">Apify actors</p>
                <h2 className="display-title !text-[var(--text-lg)]">Heavy enrichment layer</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                  Use actors for directories, review sources, map data, and repeatable enrichment jobs when Firecrawl alone is not enough.
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                apifyActorsQuery.data?.status.configured
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "bg-amber-500/10 text-amber-300"
              }`}>
                {apifyActorsQuery.data?.status.configured ? "token ready" : "token needed"}
              </span>
            </div>

            <div className="grid gap-3">
              <div className="space-y-2">
                <label className="section-kicker">Actor search</label>
                <input
                  type="text"
                  value={actorSearch}
                  onChange={(event) => setActorSearch(event.target.value)}
                  className="w-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                />
              </div>
              <div className="space-y-2">
                <label className="section-kicker">Actor input JSON</label>
                <textarea
                  value={actorInputJson}
                  onChange={(event) => setActorInputJson(event.target.value)}
                  rows={5}
                  className="w-full resize-none rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 font-[var(--font-mono)] text-xs leading-6 text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-accent)]/60"
                />
              </div>
            </div>

            <div className="space-y-2">
              {apifyActorsQuery.isLoading ? (
                <div className="h-16 animate-pulse rounded-[var(--radius-xl)] bg-[var(--color-surface-2)]" />
              ) : (apifyActorsQuery.data?.actors ?? []).length ? (
                (apifyActorsQuery.data?.actors ?? []).slice(0, 4).map((actor) => (
                  <div key={actor.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text)]">{actor.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--color-text-muted)]">{actor.description || actor.id}</p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => handleActorRun(actor.id)}
                        disabled={actorLoading === actor.id || !apifyActorsQuery.data?.status.configured}
                        className="shrink-0"
                      >
                        {actorLoading === actor.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        <span>Run</span>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
                  {apifyActorsQuery.data?.error ?? "No actors found for this search."}
                </div>
              )}
            </div>

            {actorRun ? (
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="section-kicker">Last actor run</p>
                  <span className="font-[var(--font-mono)] text-xs text-[var(--color-accent)]">{actorRun.run.status}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text)]">{actorRun.datasetItems.length} dataset items captured.</p>
                <pre className="mt-3 max-h-44 overflow-auto rounded-[var(--radius-lg)] bg-black/30 p-3 text-xs leading-6 text-[var(--color-text-muted)]">
                  {JSON.stringify(actorRun.datasetItems.slice(0, 3), null, 2)}
                </pre>
              </div>
            ) : null}
          </section>
        </section>

        <section className="space-y-6">
          {mode === "search" ? (
            <>
              <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-5 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
                  <div className="space-y-2">
                    <p className="section-kicker">Market brief</p>
                    <h2 className="text-[clamp(1.8rem,1.2rem+1.4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--color-text)]">
                      {searchReport?.operatorBrief.headline ?? "Run a live market scan to build a richer lead intelligence set."}
                    </h2>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="section-kicker">Market view</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                        {searchReport?.operatorBrief.marketView ?? "We’ll summarise coverage, trust depth, and where the market still looks weak."}
                      </p>
                    </div>
                    <div>
                      <p className="section-kicker">Recommendation</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                        {searchReport?.operatorBrief.recommendation ?? "Use this surface to identify who should get an audit-led email first."}
                      </p>
                    </div>
                    <div>
                      <p className="section-kicker">Review coverage</p>
                      <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                        {searchReport?.operatorBrief.reviewCoverage ?? "Review discovery appears here once the scan has mapped external reputation sources."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/72 p-6">
                  <p className="section-kicker">Selected business</p>
                  {highlightedBusiness ? (
                    <>
                      <div>
                        <h3 className="text-xl font-semibold text-[var(--color-text)]">{highlightedBusiness.name}</h3>
                        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                          {highlightedBusiness.domain ?? highlightedBusiness.location ?? "No primary domain surfaced"}
                        </p>
                      </div>
                      <p className="text-sm leading-7 text-[var(--color-text-muted)]">{highlightedBusiness.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {highlightedBusiness.trustSignals.slice(0, 4).map((signal) => (
                          <span key={signal} className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
                            {signal}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        {highlightedBusiness.url ? (
                          <Button variant="secondary" onClick={() => handleScrape(highlightedBusiness.url ?? undefined)}>
                            <Sparkles size={15} />
                            <span>Analyse site</span>
                          </Button>
                        ) : null}
                        {highlightedBusiness.url ? (
                          <a
                            href={highlightedBusiness.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                          >
                            <ArrowUpRight size={15} />
                            <span>Open source</span>
                          </a>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3 text-sm leading-7 text-[var(--color-text-muted)]">
                      <p>Pick a result and this side becomes the operator’s briefing panel.</p>
                      <p>It’s where review sources, trust signals, and deep-scrape handoff live.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78">
                <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-5">
                  <div>
                    <p className="section-kicker">Lead intelligence set</p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Rich market results</h2>
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">{searchReport?.businesses.length ?? 0} surfaced</p>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {(searchReport?.businesses ?? []).map((business) => {
                    const isActive = highlightedBusiness?.url === business.url && highlightedBusiness?.name === business.name;
                    return (
                      <button
                        key={`${business.name}-${business.url ?? business.domain ?? "local"}`}
                        type="button"
                        onClick={() => setSelectedBusiness(business)}
                        className={[
                          "grid w-full gap-5 px-6 py-5 text-left transition-all duration-[var(--duration-base)] md:grid-cols-[1.2fr_0.8fr]",
                          isActive ? "bg-[var(--color-surface-2)]/75" : "hover:bg-[var(--color-surface-2)]/40",
                        ].join(" ")}
                      >
                        <div className="space-y-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-3">
                              <h3 className="text-base font-semibold text-[var(--color-text)]">{business.name}</h3>
                              {business.url ? (
                                <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-[11px] text-[var(--color-text-muted)]">
                                  {business.domain}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 max-w-[64ch] text-sm leading-7 text-[var(--color-text-muted)]">{business.description}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {business.trustSignals.slice(0, 4).map((signal) => (
                              <span key={signal} className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
                                {signal}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="space-y-2">
                            <p className="section-kicker">Reputation</p>
                            <div className="flex flex-wrap gap-2">
                              {business.reviewSources.slice(0, 3).map((source) => (
                                <span
                                  key={source.url}
                                  className={`rounded-full px-3 py-1 text-xs ${reputationTone(source.source)}`}
                                >
                                  {source.label}
                                </span>
                              ))}
                              {!business.reviewSources.length ? (
                                <span className="text-xs text-[var(--color-text-muted)]">No external review sources surfaced yet</span>
                              ) : null}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="section-kicker">Contact hints</p>
                            <div className="space-y-1 text-xs text-[var(--color-text-muted)]">
                              {business.contactSignals.phoneHints[0] ? (
                                <div className="flex items-center gap-2"><Phone size={12} /> {business.contactSignals.phoneHints[0]}</div>
                              ) : null}
                              {business.contactSignals.emailHints[0] ? (
                                <div className="flex items-center gap-2"><BadgeCheck size={12} /> {business.contactSignals.emailHints[0]}</div>
                              ) : !business.contactSignals.phoneHints[0] ? (
                                <div>No direct contact hints detected</div>
                              ) : null}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <p className="section-kicker">Next step</p>
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text)]">
                                {business.reviewSources.length ? "Review-backed" : "Needs profile check"}
                              </span>
                              <span className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text)]">
                                {business.trustSignals.length >= 2 ? "Audit ready" : "Needs deeper scrape"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                  {!searchReport?.businesses.length ? (
                    <div className="px-6 py-16 text-center">
                      <p className="section-kicker">No live set yet</p>
                      <p className="mt-3 text-sm leading-7 text-[var(--color-text-muted)]">
                        Run a market scan and the intelligence list will populate with businesses, reputation sources,
                        and contact clues.
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : (
            <section className="space-y-6">
              <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
                <p className="section-kicker">Site reading</p>
                <h2 className="mt-2 text-[clamp(1.8rem,1.2rem+1.4vw,2.8rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--color-text)]">
                  {scrapeReport?.analysis.headline ?? "A deep scrape turns raw content into a usable commercial read."}
                </h2>
                <div className="mt-6 grid gap-5 lg:grid-cols-4">
                  <div>
                    <p className="section-kicker">Design read</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                      {scrapeReport?.analysis.designRead ?? "We surface whether the page feels intentionally structured or thin on hierarchy."}
                    </p>
                  </div>
                  <div>
                    <p className="section-kicker">Trust read</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                      {scrapeReport?.analysis.trustRead ?? "Review mentions, proof, and credibility markers show up here."}
                    </p>
                  </div>
                  <div>
                    <p className="section-kicker">Conversion read</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                      {scrapeReport?.analysis.conversionRead ?? "We flag whether the booking or enquiry flow is obvious enough to convert."}
                    </p>
                  </div>
                  <div>
                    <p className="section-kicker">Content read</p>
                    <p className="mt-2 text-sm leading-7 text-[var(--color-text-muted)]">
                      {scrapeReport?.analysis.contentRead ?? "We check whether the copy is rich enough for a sharp pitch and useful redesign brief."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="space-y-5 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/78 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="section-kicker">Extracted signals</p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                        {scrapeReport?.title || scrapeReport?.domain || "No site analysed yet"}
                      </h3>
                    </div>
                    {scrapeReport?.url ? (
                      <a
                        href={scrapeReport.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 text-sm text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
                      >
                        <ArrowUpRight size={15} />
                        <span>Open site</span>
                      </a>
                    ) : null}
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-3">
                      <p className="section-kicker">Calls to action</p>
                      <div className="flex flex-wrap gap-2">
                        {(scrapeReport?.analysis.extracted.callsToAction ?? []).map((item) => (
                          <span key={item} className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text)]">{item}</span>
                        ))}
                        {!scrapeReport?.analysis.extracted.callsToAction.length ? (
                          <span className="text-xs text-[var(--color-text-muted)]">No strong CTA language surfaced</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="section-kicker">Trust signals</p>
                      <div className="flex flex-wrap gap-2">
                        {(scrapeReport?.analysis.extracted.trustSignals ?? []).map((item) => (
                          <span key={item} className="rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs text-[var(--color-text)]">{item}</span>
                        ))}
                        {!scrapeReport?.analysis.extracted.trustSignals.length ? (
                          <span className="text-xs text-[var(--color-text-muted)]">No trust signal terms detected</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="section-kicker">Emails + phones</p>
                      <div className="space-y-2 text-sm text-[var(--color-text-muted)]">
                        {(scrapeReport?.analysis.extracted.emails ?? []).map((item) => <div key={item}>{item}</div>)}
                        {(scrapeReport?.analysis.extracted.phones ?? []).map((item) => <div key={item}>{item}</div>)}
                        {!scrapeReport?.analysis.extracted.emails.length && !scrapeReport?.analysis.extracted.phones.length ? (
                          <div>No direct contact signals detected in the scrape.</div>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <p className="section-kicker">Recommended actions</p>
                      <div className="space-y-2 text-sm leading-7 text-[var(--color-text-muted)]">
                        {(scrapeReport?.analysis.recommendedActions ?? []).map((item) => (
                          <div key={item} className="flex gap-2">
                            <ShieldCheck size={15} className="mt-1 shrink-0 text-[var(--color-accent)]" />
                            <span>{item}</span>
                          </div>
                        ))}
                        {!scrapeReport?.analysis.recommendedActions.length ? (
                          <div>Run a deep scrape to surface concrete optimisation opportunities.</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--color-surface)]/72 p-6">
                  <p className="section-kicker">Raw content window</p>
                  <div className="max-h-[520px] overflow-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
                    <pre className="whitespace-pre-wrap font-[var(--font-mono)] text-xs leading-6 text-[var(--color-text-muted)]">
                      {scrapeReport?.markdown || "The first-pass markdown extract will appear here once a scrape is complete."}
                    </pre>
                  </div>
                </section>
              </div>
            </section>
          )}
        </section>
      </div>
    </div>
  );
}
