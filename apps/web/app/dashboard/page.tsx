"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { cachedApiFetch } from "../../lib/client-api-cache";
import { messages, type Locale } from "../../lib/i18n";
import {
  ActivityHeatmap,
  DonutChart,
  LineChart,
  SparkBars,
  type ChartPoint,
} from "../ui/charts";
import { Icon, type IconName } from "../ui/icons";
import { EmptyState, LoadingState } from "../ui/states";
import "./dashboard.css";

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
  sessions: {
    count: number;
    active: number;
    completed: number;
    durationSeconds: number;
  };
  tasks: Record<string, number>;
};
type Task = {
  id: string;
  title: string;
  status: string;
  progress: number;
  priority: string;
  deadline?: string | null;
  updatedAt: string;
  assignee: { id: string; displayName: string };
};
type Capture = {
  id: string;
  capturedAt: string;
  employee: { id: string; displayName: string };
};
type Insight = {
  code?: string;
  categorySeconds?: Record<string, number>;
  direction?: string;
};
type Recommendation = {
  code: string;
  severity: string;
  evidence?: Record<string, unknown>;
};
type AiJob = {
  id: string;
  status: string;
  fromDate: string;
  toDate: string;
  completedAt?: string;
  summary?: { direction?: string; slope?: number };
  insights?: Insight[];
  recommendations?: Recommendation[];
};
type Notification = {
  id: string;
  type: string;
  createdAt: string;
  readAt?: string | null;
  data?: { title?: string };
};
type Profile = { displayName: string };

const iso = (date: Date) => date.toISOString().slice(0, 10);
const shiftDate = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};
const duration = (seconds: number, ar: boolean) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return ar ? `${hours}س ${minutes}د` : `${hours}h ${minutes}m`;
};
const delta = (current: number, previous: number) =>
  previous
    ? Math.round(((current - previous) / previous) * 100)
    : current
      ? 100
      : 0;

const recommendationLabels = {
  ar: {
    REDUCE_IDLE_TIME: "تقليل فترات الخمول عبر كتل عمل أكثر تركيزًا.",
    LIMIT_ENTERTAINMENT: "مراجعة استخدام تطبيقات الترفيه أثناء جلسات العمل.",
    REVIEW_DECLINING_TREND: "مراجعة أسباب تراجع اتجاه إنتاجية الفريق.",
    MAINTAIN_CURRENT_PATTERN: "نمط الفريق مستقر؛ حافظ على آلية العمل الحالية.",
  },
  en: {
    REDUCE_IDLE_TIME: "Reduce idle periods with more focused work blocks.",
    LIMIT_ENTERTAINMENT: "Review entertainment usage during work sessions.",
    REVIEW_DECLINING_TREND:
      "Review the reasons behind the declining team trend.",
    MAINTAIN_CURRENT_PATTERN:
      "The team pattern is stable; maintain the current workflow.",
  },
} as const;

export default function DashboardPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [data, setData] = useState<DashboardData | null>(null);
  const [previous, setPrevious] = useState<DashboardData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<"daily" | "weekly">("daily");
  const [period, setPeriod] = useState<7 | 30>(7);
  const ar = locale === "ar";
  const t = messages[locale];

  const load = useCallback(
    async (from?: string, to?: string) => {
      setLoading(true);
      setFailed(false);
      try {
        const end = to ?? iso(new Date());
        const start = from ?? shiftDate(end, -(period - 1));
        const length =
          Math.round(
            (new Date(`${end}T00:00:00Z`).valueOf() -
              new Date(`${start}T00:00:00Z`).valueOf()) /
              86400000,
          ) + 1;
        const previousTo = shiftDate(start, -1);
        const previousFrom = shiftDate(previousTo, -(length - 1));
        const query = (startDate: string, endDate: string) =>
          `?from=${startDate}&to=${endDate}`;
        const responses = await Promise.all([
          cachedApiFetch(`/api/analytics/dashboard${query(start, end)}`),
          cachedApiFetch(`/api/analytics/dashboard${query(previousFrom, previousTo)}`),
          cachedApiFetch("/api/tasks"),
          cachedApiFetch("/api/screenshots"),
          cachedApiFetch("/api/ai/analyses"),
          cachedApiFetch("/api/notifications"),
          cachedApiFetch("/api/auth/session"),
        ]);
        if (responses.some((response) => response.status === 401)) {
          window.location.assign("/login");
          return;
        }
        if (
          !responses[0].ok ||
          !responses[1].ok ||
          !responses[2].ok ||
          !responses[3].ok
        )
          throw new Error("dashboard load failed");
        const [
          currentData,
          previousData,
          taskData,
          captureData,
          jobData,
          notificationData,
          sessionData,
        ] = await Promise.all(
          responses.map((response) => (response.ok ? response.json() : null)),
        );
        setData(currentData);
        setPrevious(previousData);
        setTasks(taskData ?? []);
        setCaptures(captureData ?? []);
        setJobs(jobData ?? []);
        setNotifications(notificationData ?? []);
        setProfile(sessionData?.profile ?? null);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    setLocale(localStorage.getItem("locale") === "en" ? "en" : "ar");
    void load();
  }, [load]);

  const daily = useMemo(() => {
    const grouped = new Map<
      string,
      { productivity: number[]; focus: number[]; active: number; idle: number }
    >();
    for (const row of data?.trend ?? []) {
      const current = grouped.get(row.date) ?? {
        productivity: [],
        focus: [],
        active: 0,
        idle: 0,
      };
      current.productivity.push(row.productivityScore);
      current.focus.push(row.focusScore);
      current.active += row.activeSeconds;
      current.idle += row.idleSeconds;
      grouped.set(row.date, current);
    }
    return [...grouped].map(([date, value]) => ({
      date,
      productivity: Math.round(
        value.productivity.reduce((sum, item) => sum + item, 0) /
          value.productivity.length,
      ),
      focus: Math.round(
        value.focus.reduce((sum, item) => sum + item, 0) / value.focus.length,
      ),
      active: value.active,
      idle: value.idle,
    }));
  }, [data]);
  const chartData = useMemo<ChartPoint[]>(() => {
    if (granularity === "daily")
      return daily.map((row) => ({
        label: row.date.slice(5),
        productivity: row.productivity,
        focus: row.focus,
      }));
    const weeks: Array<{ productivity: number[]; focus: number[] }> = [];
    daily.forEach((row, index) => {
      const group = weeks[Math.floor(index / 7)] ?? {
        productivity: [],
        focus: [],
      };
      group.productivity.push(row.productivity);
      group.focus.push(row.focus);
      weeks[Math.floor(index / 7)] = group;
    });
    return weeks.map((week, index) => ({
      label: ar ? `أسبوع ${index + 1}` : `Week ${index + 1}`,
      productivity: Math.round(
        week.productivity.reduce((a, b) => a + b, 0) / week.productivity.length,
      ),
      focus: Math.round(
        week.focus.reduce((a, b) => a + b, 0) / week.focus.length,
      ),
    }));
  }, [daily, granularity, ar]);

  if (failed)
    return (
      <main className="page-shell">
        <section className="wide-content">
          <EmptyState
            title={t.error}
            description={
              ar
                ? "تحقق من اتصال الخدمات ثم أعد المحاولة."
                : "Check service connectivity and try again."
            }
            action={
              <button className="primary-action" onClick={() => void load()}>
                {ar ? "إعادة المحاولة" : "Try again"}
              </button>
            }
          />
        </section>
      </main>
    );

  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED",
  ).length;
  const pendingTasks = tasks.filter(
    (task) => !["COMPLETED", "CANCELLED"].includes(task.status),
  ).length;
  const overdueTasks = tasks.filter(
    (task) =>
      task.deadline &&
      new Date(task.deadline) < new Date() &&
      !["COMPLETED", "CANCELLED"].includes(task.status),
  );
  const attention = (data?.ranking ?? []).filter(
    (row) =>
      row.productivityScore < 60 ||
      (row.trackedSeconds > 0 && row.idleSeconds / row.trackedSeconds > 0.3),
  );
  const latestAnalysis = jobs.find((job) => job.status === "COMPLETED");
  const behavior =
    latestAnalysis?.insights?.find(
      (item) => item.code === "BEHAVIOR_DISTRIBUTION",
    )?.categorySeconds ?? {};
  const productiveSeconds =
    Number(behavior.WORK ?? 0) + Number(behavior.COMMUNICATION ?? 0);
  const classifiedSeconds = Object.values(behavior).reduce(
    (sum, value) => sum + Number(value),
    0,
  );
  const alertsCount =
    overdueTasks.length +
    attention.length +
    notifications.filter((item) => !item.readAt).length +
    jobs.filter((job) => job.status === "FAILED").length;
  const metrics: Array<{
    label: string;
    value: string;
    change: number;
    icon: IconName;
    tone: string;
    values: number[];
    description: string;
  }> = data
    ? [
        {
          label: t.productivity,
          value: `${data.summary.productivityScore}%`,
          change: delta(
            data.summary.productivityScore,
            previous?.summary.productivityScore ?? 0,
          ),
          icon: "trend",
          tone: "purple",
          values: daily.map((row) => row.productivity),
          description: ar ? "متوسط الفريق" : "Team average",
        },
        {
          label: t.focus,
          value: `${data.summary.focusScore}%`,
          change: delta(
            data.summary.focusScore,
            previous?.summary.focusScore ?? 0,
          ),
          icon: "focus",
          tone: "blue",
          values: daily.map((row) => row.focus),
          description: ar ? "استمرارية العمل" : "Work continuity",
        },
        {
          label: t.activeTime,
          value: duration(data.summary.activeSeconds, ar),
          change: delta(
            data.summary.activeSeconds,
            previous?.summary.activeSeconds ?? 0,
          ),
          icon: "clock",
          tone: "green",
          values: daily.map((row) => row.active),
          description: ar ? "وقت فعلي" : "Effective time",
        },
        {
          label: t.idleTime,
          value: duration(data.summary.idleSeconds, ar),
          change: delta(
            data.summary.idleSeconds,
            previous?.summary.idleSeconds ?? 0,
          ),
          icon: "idle",
          tone: "orange",
          values: daily.map((row) => row.idle),
          description: ar ? "بدون إدخال" : "No input",
        },
        {
          label: ar ? "الموظفون النشطون" : "Active employees",
          value: String(data.sessions.active),
          change: 0,
          icon: "users",
          tone: "cyan",
          values: data.ranking.map((row) => row.activeSeconds),
          description: `${data.ranking.length} ${ar ? "مسجلًا" : "tracked"}`,
        },
        {
          label: ar ? "إنجاز المهام" : "Task completion",
          value: tasks.length
            ? `${Math.round((completedTasks / tasks.length) * 100)}%`
            : "0%",
          change: 0,
          icon: "check",
          tone: "pink",
          values: [completedTasks, pendingTasks],
          description: `${completedTasks} ${ar ? "مكتملة" : "completed"}`,
        },
      ]
    : [];
  const timeline = [
    ...tasks.map((item) => ({
      id: `task-${item.id}`,
      at: item.updatedAt,
      icon: "tasks" as IconName,
      title: ar ? `تحديث مهمة: ${item.title}` : `Task updated: ${item.title}`,
      detail: item.assignee.displayName,
    })),
    ...captures
      .slice(0, 20)
      .map((item) => ({
        id: `capture-${item.id}`,
        at: item.capturedAt,
        icon: "monitor" as IconName,
        title: ar ? "تمت مزامنة لقطة نشاط" : "Activity capture synchronized",
        detail: item.employee.displayName,
      })),
    ...jobs
      .filter((item) => item.completedAt)
      .map((item) => ({
        id: `job-${item.id}`,
        at: item.completedAt!,
        icon: "sparkles" as IconName,
        title: ar ? "اكتمل تحليل ذكي" : "AI analysis completed",
        detail: `${item.fromDate.slice(0, 10)} — ${item.toDate.slice(0, 10)}`,
      })),
  ]
    .sort((a, b) => new Date(b.at).valueOf() - new Date(a.at).valueOf())
    .slice(0, 7);

  return (
    <main className="page-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="wide-content dashboard-page">
        <div className="dashboard-hero">
          <div>
            <span className="eyebrow">
              {ar ? "مركز قيادة الفريق" : "TEAM COMMAND CENTER"}
            </span>
            <h1>
              {ar
                ? `مرحبًا ${profile?.displayName?.split(" ")[0] ?? ""}`
                : `Welcome, ${profile?.displayName?.split(" ")[0] ?? ""}`}
            </h1>
            <p>
              {ar
                ? "كل ما تحتاجه لفهم أداء فريقك واتخاذ قرار أسرع."
                : "Everything you need to understand performance and act faster."}
            </p>
          </div>
          <div className="dashboard-controls">
            <div className="period-switch">
              <button
                className={period === 7 ? "active" : ""}
                onClick={() => setPeriod(7)}
              >
                {ar ? "7 أيام" : "7 days"}
              </button>
              <button
                className={period === 30 ? "active" : ""}
                onClick={() => setPeriod(30)}
              >
                {ar ? "30 يومًا" : "30 days"}
              </button>
            </div>
            <form
              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                void load(String(form.get("from")), String(form.get("to")));
              }}
            >
              <input name="from" type="date" defaultValue={data?.range.from} />
              <span>—</span>
              <input name="to" type="date" defaultValue={data?.range.to} />
              <button aria-label={ar ? "تطبيق" : "Apply"}>
                <Icon name="arrow" size={17} />
              </button>
            </form>
          </div>
        </div>
        {loading || !data ? (
          <LoadingState cards={6} />
        ) : (
          <>
            <div className="executive-metrics">
              {metrics.map((metric) => (
                <article
                  className={`executive-card ${metric.tone}`}
                  key={metric.label}
                >
                  <div className="metric-head">
                    <span>
                      <Icon name={metric.icon} />
                    </span>
                    <b
                      className={
                        metric.change > 0
                          ? "positive"
                          : metric.change < 0
                            ? "negative"
                            : ""
                      }
                    >
                      {metric.change === 0
                        ? "—"
                        : `${metric.change > 0 ? "+" : ""}${metric.change}%`}
                    </b>
                  </div>
                  <strong>{metric.value}</strong>
                  <div>
                    <span>
                      {metric.label}
                      <small>{metric.description}</small>
                    </span>
                    <SparkBars values={metric.values} />
                  </div>
                </article>
              ))}
            </div>
            <div className="dashboard-main-grid">
              <article className="panel-card performance-chart-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "اتجاه الأداء" : "PERFORMANCE TREND"}
                    </span>
                    <h2>
                      {ar ? "الإنتاجية والتركيز" : "Productivity & focus"}
                    </h2>
                    <p>
                      {ar
                        ? "مقارنة مرئية مع تفاصيل كل يوم."
                        : "Visual trend with daily details."}
                    </p>
                  </div>
                  <div className="chart-tabs">
                    <button
                      className={granularity === "daily" ? "active" : ""}
                      onClick={() => setGranularity("daily")}
                    >
                      {ar ? "يومي" : "Daily"}
                    </button>
                    <button
                      className={granularity === "weekly" ? "active" : ""}
                      onClick={() => setGranularity("weekly")}
                    >
                      {ar ? "أسبوعي" : "Weekly"}
                    </button>
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
                      { key: "focus", label: t.focus, color: "#2da9dc" },
                    ]}
                  />
                ) : (
                  <EmptyState title={t.noAnalytics} />
                )}
              </article>
              <article className="panel-card team-health-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "صحة الفريق" : "TEAM HEALTH"}
                    </span>
                    <h2>{ar ? "توزيع وقت العمل" : "Time distribution"}</h2>
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
                <div className="health-foot">
                  <span>
                    <Icon name="activity" size={16} />
                    {data.sessions.count} {ar ? "جلسة" : "sessions"}
                  </span>
                  <span>
                    <Icon name="clock" size={16} />
                    {duration(data.summary.trackedSeconds, ar)}
                  </span>
                </div>
              </article>
              <article className="panel-card ranking-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "ترتيب الفريق" : "TEAM RANKING"}
                    </span>
                    <h2>{t.employeeRanking}</h2>
                  </div>
                  <Link href="/users">{ar ? "عرض الفريق" : "View team"}</Link>
                </div>
                {data.ranking.length ? (
                  data.ranking.slice(0, 6).map((row, index) => (
                    <Link
                      className="premium-rank-row"
                      href={`/users/${row.employeeId}`}
                      key={row.employeeId}
                    >
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <span className="rank-avatar">
                        <Icon name="user" size={17} />
                      </span>
                      <span>
                        <strong>{row.displayName}</strong>
                        <small>
                          {duration(row.activeSeconds, ar)} · {t.focus}{" "}
                          {row.focusScore}%
                        </small>
                      </span>
                      <div>
                        <strong>{row.productivityScore}%</strong>
                        <i>
                          <span
                            style={{ width: `${row.productivityScore}%` }}
                          />
                        </i>
                      </div>
                    </Link>
                  ))
                ) : (
                  <EmptyState title={t.noAnalytics} />
                )}
              </article>
              <article className="panel-card attention-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "تحتاج إجراء" : "NEEDS ATTENTION"}
                    </span>
                    <h2>{ar ? "تنبيهات اليوم" : "Today’s alerts"}</h2>
                  </div>
                  <span
                    className={`alert-count ${alertsCount ? "has-alerts" : ""}`}
                  >
                    {alertsCount}
                  </span>
                </div>
                <div className="alert-list">
                  {overdueTasks.slice(0, 3).map((task) => (
                    <Link href="/tasks" key={task.id}>
                      <span className="alert-icon danger">
                        <Icon name="calendar" />
                      </span>
                      <span>
                        <strong>{ar ? "مهمة متأخرة" : "Overdue task"}</strong>
                        <small>
                          {task.title} · {task.assignee.displayName}
                        </small>
                      </span>
                      <Icon name="chevron" size={15} />
                    </Link>
                  ))}
                  {attention.slice(0, 3).map((row) => (
                    <Link
                      href={`/users/${row.employeeId}`}
                      key={row.employeeId}
                    >
                      <span className="alert-icon warning">
                        <Icon name="alert" />
                      </span>
                      <span>
                        <strong>
                          {ar
                            ? "أداء يحتاج مراجعة"
                            : "Performance needs review"}
                        </strong>
                        <small>
                          {row.displayName} · {row.productivityScore}%
                        </small>
                      </span>
                      <Icon name="chevron" size={15} />
                    </Link>
                  ))}
                  {!overdueTasks.length && !attention.length && (
                    <EmptyState
                      title={ar ? "لا توجد حالات حرجة" : "No critical issues"}
                      description={
                        ar
                          ? "الفريق ضمن النطاق الطبيعي حاليًا."
                          : "The team is currently within the normal range."
                      }
                    />
                  )}
                </div>
              </article>
              <article className="panel-card heatmap-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "نشاط مرصود" : "OBSERVED ACTIVITY"}
                    </span>
                    <h2>
                      {ar ? "خريطة ساعات العمل" : "Working hours heatmap"}
                    </h2>
                    <p>
                      {ar
                        ? "مبنية على أوقات لقطات النشاط المتاحة وليست سجل حضور."
                        : "Based on available activity captures, not attendance records."}
                    </p>
                  </div>
                </div>
                <div className="heatmap-scroll">
                  <ActivityHeatmap
                    timestamps={captures.map((item) => item.capturedAt)}
                    locale={locale}
                  />
                </div>
                <div className="heatmap-scale">
                  <span>{ar ? "أقل" : "Less"}</span>
                  {[0, 1, 2, 3, 4].map((level) => (
                    <i data-level={level} key={level} />
                  ))}
                  <span>{ar ? "أكثر" : "More"}</span>
                </div>
              </article>
              <article className="panel-card ai-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">AI INTELLIGENCE</span>
                    <h2>
                      {ar ? "الرؤية الذكية الأخيرة" : "Latest smart insight"}
                    </h2>
                  </div>
                  <Link href="/performance">
                    {ar ? "كل الرؤى" : "All insights"}
                  </Link>
                </div>
                {latestAnalysis ? (
                  <>
                    <div className="ai-direction">
                      <span>
                        <Icon name="sparkles" />
                      </span>
                      <div>
                        <small>
                          {ar ? "اتجاه الأداء" : "Performance direction"}
                        </small>
                        <strong>
                          {latestAnalysis.summary?.direction === "IMPROVING"
                            ? ar
                              ? "يتحسن"
                              : "Improving"
                            : latestAnalysis.summary?.direction === "DECLINING"
                              ? ar
                                ? "يتراجع"
                                : "Declining"
                              : ar
                                ? "مستقر"
                                : "Stable"}
                        </strong>
                      </div>
                      <b>
                        {Number(latestAnalysis.summary?.slope ?? 0).toFixed(1)}
                      </b>
                    </div>
                    {classifiedSeconds > 0 && (
                      <DonutChart
                        value={productiveSeconds}
                        total={classifiedSeconds}
                        label={ar ? "وقت منتج" : "Productive"}
                        secondaryLabel={ar ? "غير منتج" : "Non-productive"}
                        primary="var(--success)"
                        secondary="var(--danger-soft)"
                        format={(value) => duration(value, ar)}
                      />
                    )}
                    <div className="ai-recommendations">
                      {latestAnalysis.recommendations
                        ?.slice(0, 2)
                        .map((item, index) => (
                          <div key={`${item.code}-${index}`}>
                            <span>{index + 1}</span>
                            <p>
                              {recommendationLabels[locale][
                                item.code as keyof typeof recommendationLabels.ar
                              ] ?? item.code}
                            </p>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title={ar ? "لا يوجد تحليل مكتمل" : "No completed analysis"}
                    description={
                      ar
                        ? "شغّل تحليلًا من صفحة الأداء للحصول على توصيات."
                        : "Run an analysis from Performance to receive recommendations."
                    }
                  />
                )}
              </article>
              <article className="panel-card timeline-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "آخر التحديثات" : "RECENT UPDATES"}
                    </span>
                    <h2>{ar ? "النشاط الأخير" : "Recent activity"}</h2>
                  </div>
                </div>
                {timeline.length ? (
                  <div className="activity-timeline">
                    {timeline.map((item) => (
                      <div key={item.id}>
                        <span>
                          <Icon name={item.icon} />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </div>
                        <time>
                          {new Intl.DateTimeFormat(locale, {
                            hour: "2-digit",
                            minute: "2-digit",
                            day: "numeric",
                            month: "short",
                          }).format(new Date(item.at))}
                        </time>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title={ar ? "لا يوجد نشاط حديث" : "No recent activity"}
                  />
                )}
              </article>
              <article className="panel-card quick-stats-panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {ar ? "نظرة سريعة" : "QUICK STATS"}
                    </span>
                    <h2>{ar ? "ملخص العمليات" : "Operations summary"}</h2>
                  </div>
                </div>
                <div className="quick-stat-grid">
                  <div>
                    <span>{completedTasks}</span>
                    <small>{ar ? "مهام مكتملة" : "Completed tasks"}</small>
                  </div>
                  <div>
                    <span>{pendingTasks}</span>
                    <small>{ar ? "مهام مفتوحة" : "Open tasks"}</small>
                  </div>
                  <div>
                    <span>{data.sessions.completed}</span>
                    <small>{ar ? "جلسات مكتملة" : "Ended sessions"}</small>
                  </div>
                  <div>
                    <span>{captures.length}</span>
                    <small>{ar ? "لقطات حديثة" : "Recent captures"}</small>
                  </div>
                </div>
                <div className="export-actions">
                  <span>{ar ? "تصدير التقرير" : "Export report"}</span>
                  {(["pdf", "xlsx", "csv"] as const).map((format) => (
                    <a
                      href={`/api/reports/export?format=${format}&from=${data.range.from}&to=${data.range.to}`}
                      key={format}
                    >
                      <Icon name="download" size={14} />
                      {format.toUpperCase()}
                    </a>
                  ))}
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
