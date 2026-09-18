import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAnalytics } from "@/lib/adminApi.js";

// Fixed entity -> colour mapping (validated categorical palette, dark surface).
// Order is also the stacking order in the daily chart.
const SOURCES = [
  { key: "facebook", label: "Facebook", color: "#3987e5" },
  { key: "instagram", label: "Instagram", color: "#d95926" },
  { key: "tiktok", label: "TikTok", color: "#199e70" },
  { key: "other", label: "Alte link-uri", color: "#c98500" },
  { key: "direct", label: "Direct", color: "#d55181" },
  { key: "search", label: "Cautare", color: "#9085e9" },
];
const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((source) => [source.key, source]));
const RANGES = [7, 30, 90];
const REFRESH_MS = 60_000;
const SHARE_SOURCES = ["facebook", "instagram", "tiktok", "other"];

const formatNumber = (value) => new Intl.NumberFormat("ro-RO").format(value ?? 0);
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const dayLabel = (iso) => {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}`;
};
const timeLabel = (iso) => new Date(iso).toLocaleString("ro-RO", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function StatTile({ label, value, hint }) {
  return (
    <div className="analytics-tile">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function ShareLink({ source }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/?utm_source=${source}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copiaza link-ul:", url);
    }
  };

  return (
    <div className="analytics-share-row">
      <i style={{ background: SOURCE_BY_KEY[source].color }} aria-hidden="true" />
      <span>{SOURCE_BY_KEY[source].label}</span>
      <code>{url}</code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        {copied ? "Copiat" : "Copiaza"}
      </Button>
    </div>
  );
}

// Stacked daily bars, one column per day, segments in fixed source order.
function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  const width = 720;
  const height = 200;
  const padding = { top: 10, right: 6, bottom: 20, left: 26 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...daily.map((day) => day.visits));
  const step = innerWidth / Math.max(1, daily.length);
  const barWidth = Math.max(3, Math.min(22, step - 3));
  const ticks = [0, 0.5, 1].map((fraction) => Math.round(max * fraction));
  const labelEvery = daily.length > 45 ? 10 : daily.length > 14 ? 5 : 1;

  return (
    <div className="analytics-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Vizite pe zi, pe surse">
        {ticks.map((tick) => {
          const y = padding.top + innerHeight - (tick / max) * innerHeight;
          return (
            <g key={tick}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} className="analytics-grid-line" />
              <text x={padding.left - 5} y={y + 2.5} className="analytics-axis" textAnchor="end">{tick}</text>
            </g>
          );
        })}
        {daily.map((day, index) => {
          const x = padding.left + index * step + (step - barWidth) / 2;
          let cursor = padding.top + innerHeight;
          return (
            <g
              key={day.date}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              tabIndex={0}
            >
              <rect x={padding.left + index * step} y={padding.top} width={step} height={innerHeight} fill="transparent" />
              {SOURCES.map((source) => {
                const count = day.sources?.[source.key] || 0;
                if (!count) return null;
                const segment = (count / max) * innerHeight;
                cursor -= segment;
                return (
                  <rect
                    key={source.key}
                    x={x}
                    y={cursor + 1}
                    width={barWidth}
                    height={Math.max(0, segment - 2)}
                    fill={source.color}
                    rx={1.5}
                  />
                );
              })}
              {index % labelEvery === 0 && (
                <text x={x + barWidth / 2} y={height - 6} className="analytics-axis" textAnchor="middle">
                  {dayLabel(day.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover !== null && daily[hover] && (
        <div className="analytics-tooltip" style={{ left: `${((hover + 0.5) / daily.length) * 100}%` }}>
          <strong>{dayLabel(daily[hover].date)} · {formatNumber(daily[hover].visits)} vizite</strong>
          {SOURCES.filter((source) => daily[hover].sources?.[source.key]).map((source) => (
            <span key={source.key}>
              <i style={{ background: source.color }} aria-hidden="true" />
              {source.label}: {formatNumber(daily[hover].sources[source.key])}
            </span>
          ))}
        </div>
      )}

      <ul className="analytics-legend" aria-label="Legenda">
        {SOURCES.map((source) => (
          <li key={source.key}><i style={{ background: source.color }} aria-hidden="true" />{source.label}</li>
        ))}
      </ul>
    </div>
  );
}

function AnalyticsDashboard({ onNotify }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await getAnalytics(days));
    } catch (error) {
      onNotify?.({ tone: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [days, onNotify]);

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const rangeTotal = data?.totals.range ?? 0;
  const deviceTotal = (data?.devices.mobile ?? 0) + (data?.devices.desktop ?? 0);
  const sourcesSorted = useMemo(() => (data?.sources ?? []).map((entry) => ({
    ...entry,
    ...SOURCE_BY_KEY[entry.source],
  })), [data]);

  return (
    <div className="admin-editor analytics">
      <header className="admin-editor-heading">
        <div>
          <p className="admin-breadcrumb">Dashboard</p>
          <div className="admin-title-line">
            <h1>Vizite pe site</h1>
          </div>
          <p>
            O vizita = o sesiune de browser. Sursa vine din <code>?utm_source=</code>
            {" "}sau, in lipsa lui, din site-ul de pe care a venit vizitatorul.
          </p>
        </div>
        <div className="admin-heading-actions analytics-actions">
          <div className="analytics-range" role="group" aria-label="Interval">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                className={days === range ? "is-active" : ""}
                onClick={() => setDays(range)}
              >
                {range} zile
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
            {loading ? <Loader2 className="admin-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Reincarca
          </Button>
        </div>
      </header>

      {!data ? (
        <div className="admin-booting"><Loader2 className="admin-spin" aria-hidden="true" /><span>Se incarca statisticile…</span></div>
      ) : (
        <>
          <div className="analytics-tiles">
            <StatTile label="Astazi" value={data.totals.today} />
            <StatTile label="Ultimele 7 zile" value={data.totals.last7} />
            <StatTile label={`Ultimele ${data.days} zile`} value={data.totals.range} />
            <StatTile label="Total" value={data.totals.allTime} hint="de la pornirea contorului" />
          </div>

          <div className="analytics-grid">
            <section className="admin-form-section analytics-panel analytics-panel-wide" aria-labelledby="analytics-daily">
              <div className="admin-form-heading">
                <div>
                  <h2 id="analytics-daily">Vizite pe zi</h2>
                  <p>Ultimele {data.days} zile, impartite pe surse.</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowTable((value) => !value)}>
                  {showTable ? "Arata graficul" : "Arata tabelul"}
                </Button>
              </div>
              {showTable ? (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr><th>Zi</th><th>Total</th>{SOURCES.map((s) => <th key={s.key}>{s.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {[...data.daily].reverse().map((day) => (
                        <tr key={day.date}>
                          <td>{dayLabel(day.date)}</td>
                          <td>{formatNumber(day.visits)}</td>
                          {SOURCES.map((s) => <td key={s.key}>{formatNumber(day.sources?.[s.key] || 0)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <DailyChart daily={data.daily} />
              )}
            </section>

            <section className="admin-form-section analytics-panel" aria-labelledby="analytics-sources">
              <div className="admin-form-heading">
                <div>
                  <h2 id="analytics-sources">De unde vin</h2>
                  <p>Surse in ultimele {data.days} zile; in paranteza, totalul.</p>
                </div>
              </div>
              <ul className="analytics-bars">
                {sourcesSorted.map((source) => (
                  <li key={source.key}>
                    <div className="analytics-bar-head">
                      <span><i style={{ background: source.color }} aria-hidden="true" />{source.label}</span>
                      <strong>{formatNumber(source.range)} <small>({formatNumber(source.allTime)})</small></strong>
                    </div>
                    <div className="analytics-bar-track">
                      <div className="analytics-bar-fill" style={{ width: `${percent(source.range, rangeTotal)}%`, background: source.color }} />
                    </div>
                    <small>{percent(source.range, rangeTotal)}%</small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="admin-form-section analytics-panel" aria-labelledby="analytics-devices">
              <div className="admin-form-heading">
                <div>
                  <h2 id="analytics-devices">Dispozitive</h2>
                  <p>Telefon / tableta mica vs. desktop.</p>
                </div>
              </div>
              <ul className="analytics-bars">
                {[["mobile", "Mobil"], ["desktop", "Desktop"]].map(([key, label]) => (
                  <li key={key}>
                    <div className="analytics-bar-head">
                      <span>{label}</span>
                      <strong>{formatNumber(data.devices[key] || 0)}</strong>
                    </div>
                    <div className="analytics-bar-track">
                      <div className="analytics-bar-fill analytics-bar-neutral" style={{ width: `${percent(data.devices[key] || 0, deviceTotal)}%` }} />
                    </div>
                    <small>{percent(data.devices[key] || 0, deviceTotal)}%</small>
                  </li>
                ))}
              </ul>
            </section>

            <section className="admin-form-section analytics-panel" aria-labelledby="analytics-campaigns">
              <div className="admin-form-heading">
                <div>
                  <h2 id="analytics-campaigns">Campanii si site-uri de origine</h2>
                  <p><code>utm_campaign</code> si domeniile din care s-a dat click.</p>
                </div>
              </div>
              <div className="analytics-columns">
                <table className="analytics-table">
                  <thead><tr><th>Campanie</th><th>Vizite</th></tr></thead>
                  <tbody>
                    {data.campaigns.length === 0 && <tr><td colSpan={2} className="analytics-empty">Nicio campanie inca — adauga <code>&amp;utm_campaign=nume</code> la link.</td></tr>}
                    {data.campaigns.map((row) => <tr key={row.key}><td>{row.key}</td><td>{formatNumber(row.count)}</td></tr>)}
                  </tbody>
                </table>
                <table className="analytics-table">
                  <thead><tr><th>Domeniu</th><th>Vizite</th></tr></thead>
                  <tbody>
                    {data.referrers.length === 0 && <tr><td colSpan={2} className="analytics-empty">Niciun referrer inregistrat.</td></tr>}
                    {data.referrers.map((row) => <tr key={row.key}><td>{row.key}</td><td>{formatNumber(row.count)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="admin-form-section analytics-panel" aria-labelledby="analytics-share">
              <div className="admin-form-heading">
                <div>
                  <h2 id="analytics-share">Link-uri de partajat</h2>
                  <p>Foloseste link-ul potrivit pe fiecare retea ca vizitele sa fie atribuite corect.</p>
                </div>
              </div>
              <div className="analytics-share">
                {SHARE_SOURCES.map((source) => <ShareLink key={source} source={source} />)}
              </div>
            </section>

            <section className="admin-form-section analytics-panel analytics-panel-wide" aria-labelledby="analytics-recent">
              <div className="admin-form-heading">
                <div>
                  <h2 id="analytics-recent">Ultimele vizite</h2>
                  <p>Cele mai recente {data.recent.length} sesiuni.</p>
                </div>
              </div>
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr><th>Cand</th><th>Sursa</th><th>Campanie</th><th>Origine</th><th>Dispozitiv</th><th>Pagina</th><th>Limba</th></tr>
                  </thead>
                  <tbody>
                    {data.recent.length === 0 && <tr><td colSpan={7} className="analytics-empty">Nicio vizita inregistrata inca.</td></tr>}
                    {data.recent.map((visit) => (
                      <tr key={`${visit.at}-${visit.path}`}>
                        <td>{timeLabel(visit.at)}</td>
                        <td><i className="analytics-dot" style={{ background: SOURCE_BY_KEY[visit.source]?.color }} aria-hidden="true" />{SOURCE_BY_KEY[visit.source]?.label ?? visit.source}{visit.tagged ? "" : " (fara utm)"}</td>
                        <td>{visit.campaign || "—"}</td>
                        <td>{visit.referrer || "—"}</td>
                        <td>{visit.device === "mobile" ? "Mobil" : "Desktop"}</td>
                        <td>{visit.path}</td>
                        <td>{visit.locale || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalyticsDashboard;
