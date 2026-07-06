import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Bitcoin, CandlestickChart, CircleDollarSign, ExternalLink, Gauge, RefreshCw } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { fetchMarketWatchlist } from "@/services/api";
import type { MarketQuote } from "@/types/frontend";

interface TradingViewWidgetProps {
  symbol: string;
  height?: number;
}

function TradingViewAdvancedChart({symbol, height = 520}: TradingViewWidgetProps) {
  const frameId = `hamid-os-tv-${symbol.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
  const params = new URLSearchParams({
    frameElementId: frameId,
    symbol,
    interval: "60",
    hidesidetoolbar: "0",
    symboledit: "1",
    saveimage: "1",
    toolbarbg: "0b0f19",
    theme: "dark",
    style: "1",
    timezone: "Etc/UTC",
    withdateranges: "1",
    hideideas: "1",
    locale: "en",
  });

  return (
    <div className="markets-chart-frame" style={{height}}>
      <iframe
        id={frameId}
        title={`${symbol} TradingView chart`}
        src={`https://s.tradingview.com/widgetembed/?${params.toString()}`}
        allowFullScreen
      />
    </div>
  );
}

function marketTone(market: MarketQuote["market"]) {
  if (market === "crypto") return "var(--color-accent-2)";
  if (market === "fx") return "var(--color-gold)";
  if (market === "index") return "var(--color-success)";
  return "var(--color-accent)";
}

function formatPrice(quote: MarketQuote) {
  if (quote.price === null) return "Unavailable";
  const digits = quote.market === "fx" ? 4 : quote.price > 1000 ? 0 : 2;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: quote.currency || "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: quote.market === "fx" ? 4 : 0,
  }).format(quote.price);
}

function formatPercent(value: number | null) {
  if (value === null) return "No change data";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function MiniSparkline({points, tone}: {points: MarketQuote["points"]; tone: string}) {
  const values = points
    .map((point) => point.value)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .slice(-28);
  if (values.length < 2) {
    return <span className="markets-sparkline-empty">live</span>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const path = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 30 - ((value - min) / range) * 28;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return (
    <svg className="markets-sparkline" viewBox="0 0 100 32" aria-hidden="true">
      <path d={path} fill="none" stroke={tone} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarketQuoteCard({quote, active, onSelect}: {quote: MarketQuote; active: boolean; onSelect: () => void}) {
  const tone = marketTone(quote.market);
  const positive = (quote.changePercent ?? 0) >= 0;

  return (
    <button type="button" className="markets-quote-card" data-active={active} onClick={onSelect}>
      <span className="markets-symbol-icon" style={{color: tone}}>
        {quote.market === "crypto" ? <Bitcoin size={16} /> : quote.market === "fx" ? <CircleDollarSign size={16} /> : <CandlestickChart size={16} />}
      </span>
      <span className="markets-quote-main">
        <strong>{quote.label}</strong>
        <small>{quote.symbol}</small>
      </span>
      <span className="markets-quote-price">
        <strong>{formatPrice(quote)}</strong>
        <small data-positive={positive}>{formatPercent(quote.changePercent)}</small>
      </span>
      <MiniSparkline points={quote.points} tone={tone} />
    </button>
  );
}

export function MarketsPage() {
  const [selectedSymbol, setSelectedSymbol] = useState("NASDAQ:NVDA");
  const [chartVersion, setChartVersion] = useState(0);
  const marketQuery = useQuery({
    queryKey: ["market-watchlist"],
    queryFn: fetchMarketWatchlist,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });
  const quotes = marketQuery.data?.quotes ?? [];
  const selected = useMemo(
    () => quotes.find((item) => item.symbol === selectedSymbol) ?? quotes[0] ?? null,
    [quotes, selectedSymbol],
  );
  const selectedTradingViewSymbol = selected?.symbol ?? selectedSymbol;

  return (
    <PageWrapper
      eyebrow="HAMID.OS · LIVE MARKETS"
      title="Markets command"
      description="Live market cards plus TradingView charts for stocks, crypto, FX, and macro signals. No mocked prices."
      actions={
        <a
          className="hos-create-action"
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(selectedTradingViewSymbol)}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={13} />
          Open TradingView
        </a>
      }
    >
      <div className="markets-command">
        <section className="markets-hero executive-panel">
          <div className="markets-hero-copy">
            <p className="section-kicker">Capital radar</p>
            <h2>Founder-grade market awareness without fake numbers.</h2>
            <p>
              AI infrastructure, platform stocks, crypto risk appetite, and GBP/USD now sit beside the operating system so
              finance and strategy decisions are grounded in live external context.
            </p>
          </div>
          <div className="markets-hero-stack">
            <div>
              <span>Selected</span>
              <strong>{selected?.label ?? "Loading market"}</strong>
              <small>{selectedTradingViewSymbol}</small>
            </div>
            <div>
              <span>Signal</span>
              <strong>{selected?.note ?? "Fetching live data"}</strong>
              <small>{selected?.source ?? "Live source pending"}</small>
            </div>
          </div>
        </section>

        <section className="markets-ticker executive-panel">
          <div className="markets-panel-head">
            <div>
              <p className="section-kicker">Live tape</p>
              <h3>Watchlist prices</h3>
            </div>
            <Badge variant={marketQuery.isError ? "warning" : "success"}>
              {marketQuery.isError ? "SOURCE ISSUE" : "LIVE DATA"}
            </Badge>
          </div>
          <div className="markets-live-grid">
            {quotes.length ? quotes.map((quote) => (
              <MarketQuoteCard
                key={quote.symbol}
                quote={quote}
                active={quote.symbol === selectedTradingViewSymbol}
                onSelect={() => setSelectedSymbol(quote.symbol)}
              />
            )) : Array.from({length: 6}).map((_, index) => (
              <div key={index} className="markets-quote-card markets-quote-card--loading" />
            ))}
          </div>
        </section>

        <div className="markets-grid">
          <section className="markets-watchlist executive-panel">
            <div className="markets-panel-head">
              <div>
                <p className="section-kicker">Operator notes</p>
                <h3>Why this tape matters</h3>
              </div>
              <Gauge size={18} />
            </div>
            <div className="markets-symbol-list">
              {(quotes.length ? quotes : []).map((item) => (
                <button
                  type="button"
                  key={item.symbol}
                  className="markets-symbol-card"
                  data-active={item.symbol === selectedTradingViewSymbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                >
                  <span className="markets-symbol-icon" style={{color: marketTone(item.market)}}>
                    {item.market === "crypto" ? <Bitcoin size={16} /> : item.market === "fx" ? <CircleDollarSign size={16} /> : <CandlestickChart size={16} />}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.note}</small>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              {!quotes.length ? <p className="markets-empty">Fetching the live watchlist from the market data proxy.</p> : null}
            </div>
          </section>

          <section className="markets-chart executive-panel">
            <div className="markets-panel-head">
              <div>
                <p className="section-kicker">TradingView</p>
                <h3>{selected?.label ?? "Selected"} live chart</h3>
              </div>
              <Button variant="secondary" onClick={() => setChartVersion((current) => current + 1)}>
                <RefreshCw size={14} />
                Reload
              </Button>
            </div>
            <TradingViewAdvancedChart key={`${selectedTradingViewSymbol}-${chartVersion}`} symbol={selectedTradingViewSymbol} />
          </section>
        </div>
      </div>
    </PageWrapper>
  );
}
