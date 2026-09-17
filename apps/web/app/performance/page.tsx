"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { cachedApiFetch } from "../../lib/client-api-cache";
import { messages, type Locale } from "../../lib/i18n";
import { DonutChart, LineChart, type ChartPoint } from "../ui/charts";
import { Icon } from "../ui/icons";
import { EmptyState, LoadingState } from "../ui/states";
import "./performance.css";

type DashboardData = {
  range: { from: string; to: string };
  summary: {
    productivityScore: number;
    focusScore: number;
    trackedSeconds: number;
    activeSeconds: number;
    idleSeconds: number;
  };
  ranking: Array<{
    employeeId: string;
    displayName: string;
    productivityScore: number;
    focusScore: number;
    trackedSeconds: number;
    activeSeconds: number;
    idleSeconds: number;
  }>;
  trend: Array<{
    date: string;
    employeeId: string;
    displayName: string;
    productivityScore: number;
    focusScore: number;
    activeSeconds: number;
    idleSeconds: number;
  }>;
  applications: Array<{ name: string; seconds: number }>;
  websites: Array<{ name: string; seconds: number }>;
  sessions: { count: number; completed: number };
};
type Task = {
  id: string;
  status: string;
  assigneeId: string;
  assignee: { id: string; displayName: string };
};
type Recommendation = {
  code: string;
  severity: string;
  evidence?: Record<string, unknown>;
};
type Insight = {
  code?: string;
  direction?: string;
  slope?: number;
  categorySeconds?: Record<string, number>;
  totalSeconds?: number;
};
type AiJob = {
  id: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  fromDate: string;
  toDate: string;
  modelKey: string;
  modelVersion: string;
  createdAt: string;
  completedAt?: string;
  summary?: { direction?: string; slope?: number; analyzedDays?: number };
  insights?: Insight[];
  recommendations?: Recommendation[];
  errorMessage?: string;
};
type Tab = "overview" | "comparison" | "usage" | "ai";

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};
const duration = (seconds: number, ar: boolean) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return ar ? `${h}س ${m}د` : `${h}h ${m}m`;
};
const change = (current: number, previous: number) =>
  previous
    ? Math.round(((current - previous) / previous) * 100)
    : current
      ? 100
      : 0;
const recommendationLabels = {
  ar: {
    REDUCE_IDLE_TIME: "تقليل فترات الخمول عبر تنظيم فترات عمل مركزة.",
    LIMIT_ENTERTAINMENT: "تقليل نشاط الترفيه أثناء جلسات العمل.",
    REVIEW_DECLINING_TREND: "مراجعة أسباب تراجع اتجاه الإنتاجية.",
    MAINTAIN_CURRENT_PATTERN: "المحافظة على نمط العمل المنتج الحالي.",
  },
  en: {
    REDUCE_IDLE_TIME: "Reduce long idle periods with focused work blocks.",
    LIMIT_ENTERTAINMENT: "Limit entertainment activity during work sessions.",
    REVIEW_DECLINING_TREND: "Review the causes of declining productivity.",
    MAINTAIN_CURRENT_PATTERN: "Maintain the current productive work pattern.",
  },
} as const;

function CorrelationChart({
  rows,
  taskCounts,
  locale,
}: {
  rows: DashboardData["ranking"];
  taskCounts: Map<string, number>;
  locale: Locale;
}) {
  const width = 620,
    height = 260,
    left = 42,
    bottom = 34,
    top = 16,
    right = 18;
  const maxTasks = Math.max(1, ...taskCounts.values());
  const x = (value: number) =>
    left + (value / maxTasks) * (width - left - right);
  const y = (value: number) =>
    top + ((100 - value) / 100) * (height - top - bottom);
  return (
    <div className="correlation-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          locale === "ar"
            ? "العلاقة بين الإنتاجية والمهام"
            : "Productivity and tasks correlation"
        }
      >
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={width - right}
              y1={y(value)}
              y2={y(value)}
              className="chart-grid-line"
            />
            <text
              x={left - 7}
              y={y(value) + 3}
              textAnchor="end"
              className="chart-axis-label"
            >
              {value}
            </text>
          </g>
        ))}
        <line
          x1={left}
          x2={width - right}
          y1={height - bottom}
          y2={height - bottom}
          className="chart-grid-line"
        />
        {rows.map((row) => {
          const count = taskCounts.get(row.employeeId) ?? 0;
          return (
            <g key={row.employeeId}>
              <circle
                cx={x(count)}
                cy={y(row.productivityScore)}
                r="8"
                fill="var(--primary)"
                opacity=".78"
              >
                <title>
                  {row.displayName}: {count} tasks, {row.productivityScore}%
                </title>
              </circle>
            </g>
          );
        })}
        {Array.from({ length: maxTasks + 1 }, (_, value) => (
          <text
            key={value}
            x={x(value)}
            y={height - 10}
            textAnchor="middle"
            className="chart-axis-label"
          >
            {value}
          </text>
        ))}
      </svg>
      <small>
        {locale === "ar"
          ? "المحور الأفقي: المهام المكتملة · العمودي: الإنتاجية"
          : "Horizontal: completed tasks · Vertical: productivity"}
      </small>
    </div>
  );
}

export default function PerformancePage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [tab, setTab] = useState<Tab>("overview");
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [previous, setPrevious] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const ar = locale === "ar";
  const t = messages[locale];
  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/ai/analyses", { cache: "no-store" });
    if (response.status === 401) return window.location.assign("/login");
    if (!response.ok) throw new Error();
    setJobs(await response.json());
  }, []);
  const load = useCallback(
    async (from?: string, to?: string) => {
      setLoading(true);
      setFailed(false);
      try {
        const end = to ?? iso(new Date());
        const start = from ?? shift(end, -(days - 1));
        const length =
          Math.round(
            (new Date(`${end}T00:00:00Z`).valueOf() -
              new Date(`${start}T00:00:00Z`).valueOf()) /
              86400000,
          ) + 1;
        const previousTo = shift(start, -1);
        const previousFrom = shift(previousTo, -(length - 1));
        const [currentResponse, previousResponse, tasksResponse] =
          await Promise.all([
            cachedApiFetch(`/api/analytics/dashboard?from=${start}&to=${end}`),
            cachedApiFetch(
              `/api/analytics/dashboard?from=${previousFrom}&to=${previousTo}`,
            ),
            cachedApiFetch("/api/tasks"),
          ]);
        if (
          [currentResponse, previousResponse, tasksResponse].some(
            (response) => response.status === 401,
          )
        )
          return window.location.assign("/login");
        if (!currentResponse.ok || !previousResponse.ok || !tasksResponse.ok)
          throw new Error();
        const [currentData, previousData, taskData] = await Promise.all([
          currentResponse.json(),
          previousResponse.json(),
          tasksResponse.json(),
        ]);
        setData(currentData);
        setPrevious(previousData);
        setTasks(taskData);
        await loadJobs();
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [days, loadJobs],
  );
  useEffect(() => {
    setLocale(localStorage.getItem("locale") === "en" ? "en" : "ar");
    void load();
  }, [load]);
  useEffect(() => {
    if (
      !jobs.some((job) => job.status === "PENDING" || job.status === "RUNNING")
    )
      return;
    const timer = window.setInterval(
      () => void loadJobs().catch(() => undefined),
      5000,
    );
    return () => clearInterval(timer);
  }, [jobs, loadJobs]);
  const daily = useMemo(() => {
    const groups = new Map<
      string,
      { p: number[]; f: number[]; a: number; i: number }
    >();
    for (const row of data?.trend ?? []) {
      const value = groups.get(row.date) ?? { p: [], f: [], a: 0, i: 0 };
      value.p.push(row.productivityScore);
      value.f.push(row.focusScore);
      value.a += row.activeSeconds;
      value.i += row.idleSeconds;
      groups.set(row.date, value);
    }
    return [...groups].map(([date, value]) => ({
      date,
      productivity: Math.round(
        value.p.reduce((a, b) => a + b, 0) / value.p.length,
      ),
      focus: Math.round(value.f.reduce((a, b) => a + b, 0) / value.f.length),
      active: value.a,
      idle: value.i,
    }));
  }, [data]);
  const chartData: ChartPoint[] = daily.map((row) => ({
    label: row.date.slice(5),
    productivity: row.productivity,
    focus: row.focus,
  }));
  const latest = jobs.find((job) => job.status === "COMPLETED");
  const distribution =
    latest?.insights?.find((item) => item.code === "BEHAVIOR_DISTRIBUTION")
      ?.categorySeconds ?? {};
  const distributionTotal = Object.values(distribution).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  const completedByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks)
      if (task.status === "COMPLETED")
        map.set(task.assigneeId, (map.get(task.assigneeId) ?? 0) + 1);
    return map;
  }, [tasks]);
  async function createAnalysis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch("/api/ai/analyses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    if (!response.ok) {
      setFailed(true);
      return;
    }
    await loadJobs();
  }
  const tabs: Array<{ key: Tab; ar: string; en: string }> = [
    { key: "overview", ar: "نظرة عامة", en: "Overview" },
    { key: "comparison", ar: "المقارنات", en: "Comparisons" },
    { key: "usage", ar: "الوقت والاستخدام", en: "Time & usage" },
    { key: "ai", ar: "الرؤى الذكية", en: "AI insights" },
  ];
  if (failed && !data)
    return (
      <main className="page-shell">
        <section className="wide-content">
          <EmptyState
            title={t.error}
            action={
              <button className="primary-action" onClick={() => void load()}>
                {ar ? "إعادة المحاولة" : "Try again"}
              </button>
            }
          />
        </section>
      </main>
    );
  return (
    <main className="page-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="wide-content performance-page">
        <div className="performance-hero">
          <div>
            <span className="eyebrow">PERFORMANCE INTELLIGENCE</span>
            <h1>{ar ? "مركز الأداء والتحليلات" : "Performance & analytics"}</h1>
            <p>
              {ar
                ? "حوّل نشاط الفريق والمهام إلى صورة واضحة قابلة للتنفيذ."
                : "Turn team activity and task outcomes into an actionable picture."}
            </p>
          </div>
          <div className="performance-controls">
            <div className="period-switch">
              <button
                className={days === 7 ? "active" : ""}
                onClick={() => setDays(7)}
              >
                {ar ? "أسبوع" : "Week"}
              </button>
              <button
                className={days === 30 ? "active" : ""}
                onClick={() => setDays(30)}
              >
                {ar ? "شهر" : "Month"}
              </button>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void load(String(form.get("from")), String(form.get("to")));
              }}
            >
              <input name="from" type="date" defaultValue={data?.range.from} />
              <input name="to" type="date" defaultValue={data?.range.to} />
              <button>
                <Icon name="arrow" size={17} />
              </button>
            </form>
          </div>
        </div>
        <div className="performance-tabs">
          {tabs.map((item) => (
            <button
              className={tab === item.key ? "active" : ""}
              onClick={() => setTab(item.key)}
              key={item.key}
            >
              {ar ? item.ar : item.en}
            </button>
          ))}
        </div>
        {loading || !data ? (
          <LoadingState cards={6} />
        ) : (
          <>
            {tab === "overview" && (
              <div className="performance-layout">
                <div className="performance-kpis">
                  <article>
                    <span>{t.productivity}</span>
                    <strong>{data.summary.productivityScore}%</strong>
                    <small
                      className={
                        change(
                          data.summary.productivityScore,
                          previous?.summary.productivityScore ?? 0,
                        ) >= 0
                          ? "up"
                          : "down"
                      }
                    >
                      {change(
                        data.summary.productivityScore,
                        previous?.summary.productivityScore ?? 0,
                      )}
                      % {ar ? "عن الفترة السابقة" : "vs previous"}
                    </small>
                  </article>
                  <article>
                    <span>{t.focus}</span>
                    <strong>{data.summary.focusScore}%</strong>
                    <small
                      className={
                        change(
                          data.summary.focusScore,
                          previous?.summary.focusScore ?? 0,
                        ) >= 0
                          ? "up"
                          : "down"
                      }
                    >
                      {change(
                        data.summary.focusScore,
                        previous?.summary.focusScore ?? 0,
                      )}
                      % {ar ? "عن الفترة السابقة" : "vs previous"}
                    </small>
                  </article>
                  <article>
                    <span>{t.activeTime}</span>
                    <strong>{duration(data.summary.activeSeconds, ar)}</strong>
                    <small>
                      {data.sessions.completed}{" "}
                      {ar ? "جلسة مكتملة" : "completed sessions"}
                    </small>
                  </article>
                  <article>
                    <span>{t.idleTime}</span>
                    <strong>{duration(data.summary.idleSeconds, ar)}</strong>
                    <small>
                      {data.summary.trackedSeconds
                        ? Math.round(
                            (data.summary.idleSeconds /
                              data.summary.trackedSeconds) *
                              100,
                          )
                        : 0}
                      % {ar ? "من الوقت المسجل" : "of tracked time"}
                    </small>
                  </article>
                </div>
                <article className="panel-card performance-main-chart">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">TREND ANALYSIS</span>
                      <h2>
                        {ar
                          ? "اتجاه الإنتاجية والتركيز"
                          : "Productivity and focus trend"}
                      </h2>
                      <p>
                        {ar
                          ? "النتيجة اليومية للفريق ضمن الفترة المحددة."
                          : "Daily team score across the selected range."}
                      </p>
                    </div>
                  </div>
                  {chartData.length ? (
                    <LineChart
                      data={chartData}
                      series={[
                        {
                          key: "productivity",
                          label: t.productivity,
                          color: "#7564e8",
                        },
                        { key: "focus", label: t.focus, color: "#27a4d7" },
                      ]}
                    />
                  ) : (
                    <EmptyState title={t.noAnalytics} />
                  )}
                </article>
                <article className="panel-card time-distribution">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">TIME DISTRIBUTION</span>
                      <h2>
                        {ar ? "النشاط مقابل الخمول" : "Active versus idle"}
                      </h2>
                    </div>
                  </div>
                  <DonutChart
                    value={data.summary.activeSeconds}
                    total={data.summary.trackedSeconds}
                    label={t.activeTime}
                    secondaryLabel={t.idleTime}
                    primary="var(--primary)"
                    secondary="var(--surface-soft)"
                    format={(value) => duration(value, ar)}
                  />
                </article>
                <article className="panel-card daily-time-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">DAILY LOAD</span>
                      <h2>
                        {ar ? "توزيع الوقت اليومي" : "Daily time distribution"}
                      </h2>
                    </div>
                  </div>
                  <div className="stacked-time-chart">
                    {daily.map((row) => {
                      const total = row.active + row.idle;
                      return (
                        <div key={row.date}>
                          <span>{row.date.slice(5)}</span>
                          <div
                            title={`${duration(row.active, ar)} / ${duration(row.idle, ar)}`}
                          >
                            <i
                              style={{
                                width: `${total ? (row.active / total) * 100 : 0}%`,
                              }}
                            />
                            <b
                              style={{
                                width: `${total ? (row.idle / total) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <small>{duration(total, ar)}</small>
                        </div>
                      );
                    })}
                  </div>
                  <div className="time-legend">
                    <span>
                      <i /> {t.activeTime}
                    </span>
                    <span>
                      <i /> {t.idleTime}
                    </span>
                  </div>
                </article>
              </div>
            )}
            {tab === "comparison" && (
              <div className="comparison-layout">
                <article className="panel-card employee-comparison">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">EMPLOYEE COMPARISON</span>
                      <h2>
                        {ar
                          ? "مقارنة أداء الموظفين"
                          : "Employee performance comparison"}
                      </h2>
                    </div>
                  </div>
                  {data.ranking.map((row) => (
                    <div className="comparison-row" key={row.employeeId}>
                      <Link href={`/users/${row.employeeId}`}>
                        {row.displayName}
                      </Link>
                      <div>
                        <span style={{ width: `${row.productivityScore}%` }} />
                        <i style={{ width: `${row.focusScore}%` }} />
                      </div>
                      <b>{row.productivityScore}%</b>
                      <small>{row.focusScore}%</small>
                    </div>
                  ))}
                </article>
                <article className="panel-card correlation-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">TASK CORRELATION</span>
                      <h2>
                        {ar
                          ? "الإنتاجية والمهام المكتملة"
                          : "Productivity & completed tasks"}
                      </h2>
                      <p>
                        {ar
                          ? "مؤشر بصري للمقارنة وليس إثباتًا للسببية."
                          : "A visual relationship, not proof of causation."}
                      </p>
                    </div>
                  </div>
                  <CorrelationChart
                    rows={data.ranking}
                    taskCounts={completedByEmployee}
                    locale={locale}
                  />
                </article>
                <article className="panel-card comparison-table-panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">DETAILED VIEW</span>
                      <h2>{ar ? "جدول المقارنة" : "Comparison table"}</h2>
                    </div>
                  </div>
                  <div className="performance-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{ar ? "الموظف" : "Employee"}</th>
                          <th>{t.productivity}</th>
                          <th>{t.focus}</th>
                          <th>{t.activeTime}</th>
                          <th>{t.idleTime}</th>
                          <th>{ar ? "المهام المكتملة" : "Completed tasks"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ranking.map((row) => (
                          <tr key={row.employeeId}>
                            <td>
                              <Link href={`/users/${row.employeeId}`}>
                                {row.displayName}
                              </Link>
                            </td>
                            <td>
                              <strong>{row.productivityScore}%</strong>
                            </td>
                            <td>{row.focusScore}%</td>
                            <td>{duration(row.activeSeconds, ar)}</td>
                            <td>{duration(row.idleSeconds, ar)}</td>
                            <td>
                              {completedByEmployee.get(row.employeeId) ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              </div>
            )}
            {tab === "usage" && (
              <div className="usage-layout">
                <article className="panel-card usage-visual">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">APPLICATIONS</span>
                      <h2>{t.appUsage}</h2>
                    </div>
                  </div>
                  <div className="visual-usage-list">
                    {data.applications.length ? (
                      data.applications.slice(0, 12).map((item, index) => (
                        <div key={item.name}>
                          <span>
                            <b>{index + 1}</b>
                            <strong>{item.name}</strong>
                            <small>{duration(item.seconds, ar)}</small>
                          </span>
                          <i>
                            <b
                              style={{
                                width: `${(item.seconds / (data.applications[0]?.seconds || 1)) * 100}%`,
                              }}
                            />
                          </i>
                        </div>
                      ))
                    ) : (
                      <EmptyState title={t.noAnalytics} />
                    )}
                  </div>
                </article>
                <article className="panel-card usage-visual">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">WEBSITES</span>
                      <h2>{t.websiteUsage}</h2>
                    </div>
                  </div>
                  <div className="visual-usage-list websites">
                    {data.websites.length ? (
                      data.websites.slice(0, 12).map((item, index) => (
                        <div key={item.name}>
                          <span>
                            <b>{index + 1}</b>
                            <strong>{item.name}</strong>
                            <small>{duration(item.seconds, ar)}</small>
                          </span>
                          <i>
                            <b
                              style={{
                                width: `${(item.seconds / (data.websites[0]?.seconds || 1)) * 100}%`,
                              }}
                            />
                          </i>
                        </div>
                      ))
                    ) : (
                      <EmptyState title={t.noAnalytics} />
                    )}
                  </div>
                </article>
                {distributionTotal > 0 && (
                  <article className="panel-card behavior-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">AI CLASSIFICATION</span>
                        <h2>
                          {ar
                            ? "توزيع سلوك النشاط"
                            : "Activity behavior distribution"}
                        </h2>
                        <p>
                          {ar
                            ? "من أحدث تحليل ذكي مكتمل."
                            : "From the latest completed smart analysis."}
                        </p>
                      </div>
                    </div>
                    <div className="behavior-grid">
                      {Object.entries(distribution)
                        .sort((a, b) => b[1] - a[1])
                        .map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}</strong>
                            <span>
                              {Math.round((value / distributionTotal) * 100)}%
                            </span>
                            <i>
                              <b
                                style={{
                                  width: `${(value / distributionTotal) * 100}%`,
                                }}
                              />
                            </i>
                            <small>{duration(value, ar)}</small>
                          </div>
                        ))}
                    </div>
                  </article>
                )}
              </div>
            )}
            {tab === "ai" && (
              <div className="ai-workspace">
                <form
                  className="panel-card analysis-launcher"
                  onSubmit={createAnalysis}
                >
                  <span className="analysis-orb">
                    <Icon name="sparkles" size={28} />
                  </span>
                  <div>
                    <span className="eyebrow">AI ANALYSIS</span>
                    <h2>{ar ? "شغّل تحليلًا جديدًا" : "Run a new analysis"}</h2>
                    <p>
                      {ar
                        ? "تصنيف النشاط واكتشاف اتجاه الأداء وإنتاج توصيات عملية."
                        : "Classify activity, detect trends, and generate practical recommendations."}
                    </p>
                  </div>
                  <label>
                    {t.from}
                    <input
                      name="from"
                      type="date"
                      defaultValue={data.range.from}
                      required
                    />
                  </label>
                  <label>
                    {t.to}
                    <input
                      name="to"
                      type="date"
                      defaultValue={data.range.to}
                      required
                    />
                  </label>
                  <button>
                    {ar ? "بدء التحليل" : "Start analysis"}
                    <Icon name="arrow" size={16} />
                  </button>
                </form>
                <div className="analysis-history">
                  {jobs.length ? (
                    jobs.map((job) => (
                      <article
                        className="panel-card analysis-card"
                        key={job.id}
                      >
                        <div className="analysis-card-head">
                          <div>
                            <span className="eyebrow">
                              {job.fromDate.slice(0, 10)} —{" "}
                              {job.toDate.slice(0, 10)}
                            </span>
                            <h2>
                              {ar
                                ? "تحليل أداء الفريق"
                                : "Team performance analysis"}
                            </h2>
                            <small>
                              {job.modelKey} · v{job.modelVersion}
                            </small>
                          </div>
                          <span
                            className={`analysis-status ${job.status.toLowerCase()}`}
                          >
                            {job.status === "PENDING"
                              ? ar
                                ? "بانتظار المعالجة"
                                : "Pending"
                              : job.status === "RUNNING"
                                ? ar
                                  ? "جارٍ التحليل"
                                  : "Processing"
                                : job.status === "COMPLETED"
                                  ? ar
                                    ? "مكتمل"
                                    : "Completed"
                                  : ar
                                    ? "فشل"
                                    : "Failed"}
                          </span>
                        </div>
                        {job.summary && (
                          <div className="analysis-summary">
                            <div>
                              <span>{ar ? "الاتجاه" : "Direction"}</span>
                              <strong>{job.summary.direction ?? "—"}</strong>
                            </div>
                            <div>
                              <span>{ar ? "الأيام" : "Days"}</span>
                              <strong>{job.summary.analyzedDays ?? 0}</strong>
                            </div>
                            <div>
                              <span>{ar ? "معدل التغير" : "Slope"}</span>
                              <strong>
                                {Number(job.summary.slope ?? 0).toFixed(1)}
                              </strong>
                            </div>
                          </div>
                        )}
                        {job.recommendations?.length ? (
                          <div className="analysis-recommendations">
                            {job.recommendations.map((item, index) => (
                              <div key={`${item.code}-${index}`}>
                                <span className={item.severity.toLowerCase()}>
                                  {item.severity}
                                </span>
                                <p>
                                  {recommendationLabels[locale][
                                    item.code as keyof typeof recommendationLabels.ar
                                  ] ?? item.code}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : job.status === "COMPLETED" ? (
                          <p className="analysis-clean">
                            {ar
                              ? "لم يرصد التحليل مشكلات إضافية."
                              : "No additional issues were detected."}
                          </p>
                        ) : null}
                      </article>
                    ))
                  ) : (
                    <EmptyState
                      title={
                        ar ? "لا توجد تحليلات حتى الآن" : "No analyses yet"
                      }
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
