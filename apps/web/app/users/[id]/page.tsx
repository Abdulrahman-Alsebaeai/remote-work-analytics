"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cachedApiFetch, invalidateApiCache } from "../../../lib/client-api-cache";
import { messages, type Locale } from "../../../lib/i18n";
import { DonutChart, LineChart, type ChartPoint } from "../../ui/charts";
import { Icon } from "../../ui/icons";
import { EmptyState, LoadingState } from "../../ui/states";
import "./employee.css";

type User = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};
type Usage = { name: string; seconds: number };
type Analytics = {
  range: { from: string; to: string };
  summary: {
    productivityScore: number;
    focusScore: number;
    trackedSeconds: number;
    activeSeconds: number;
    idleSeconds: number;
    productiveSeconds: number;
    unproductiveSeconds: number;
    undefinedSeconds: number;
  };
  trend: Array<{
    date: string;
    productivityScore: number;
    focusScore: number;
    activeSeconds: number;
    idleSeconds: number;
  }>;
  applications: Usage[];
  websites: Usage[];
  sessions: {
    count: number;
    active: number;
    completed: number;
    durationSeconds: number;
  };
  tasks: Record<string, number>;
};
type Capture = {
  id: string;
  capturedAt: string;
  asset: { width: number; height: number; byteSize: number };
};
type Activity = {
  id: string;
  resourceType: "APPLICATION" | "WEBSITE" | "FILE" | "FOLDER" | "WORKSPACE" | "OTHER";
  applicationName: string;
  processName: string;
  windowTitle?: string | null;
  resourceName?: string | null;
  contextName?: string | null;
  url?: string | null;
  domain?: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  idleSeconds: number;
  keyboardActivity: number;
  mouseActivity: number;
  windowSwitches: number;
  classification: "PRODUCTIVE" | "UNPRODUCTIVE" | "UNDEFINED";
};
type ActivityResponse = { items: Activity[]; total: number; page: number; pageSize: number; totalPages: number };
type Task = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  progress: number;
  deadline?: string | null;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: { displayName: string };
  }>;
};
type Tab = "overview" | "performance" | "tasks" | "activities" | "screenshots";
const iso = (date: Date) => date.toISOString().slice(0, 10);
const shift = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
};
const duration = (seconds: number, locale: Locale) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return locale === "ar" ? `${h}س ${m}د` : `${h}h ${m}m`;
};
const activityDuration = (seconds: number, locale: Locale) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.max(0, Math.round(seconds % 60));
  return locale === "ar" ? [h && `${h} س`, m && `${m} د`, `${s} ث`].filter(Boolean).join(" ") : [h && `${h}h`, m && `${m}m`, `${s}s`].filter(Boolean).join(" ");
};
const taskStatus = {
  ar: {
    TODO: "لم تبدأ",
    IN_PROGRESS: "قيد التنفيذ",
    BLOCKED: "متوقفة",
    COMPLETED: "مكتملة",
    CANCELLED: "ملغاة",
  },
  en: {
    TODO: "To do",
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
  },
} as const;

export default function EmployeeDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const [locale, setLocale] = useState<Locale>("ar");
  const [user, setUser] = useState<User | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [previous, setPrevious] = useState<Analytics | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<ActivityResponse>({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  const [activityType, setActivityType] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [activityLoading, setActivityLoading] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedCapture, setSelectedCapture] = useState<number | null>(null);
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<Set<string>>(() => new Set());
  const [captureMenu, setCaptureMenu] = useState<string | null>(null);
  const [deletingCapture, setDeletingCapture] = useState<string | null>(null);
  const [deletingCaptures, setDeletingCaptures] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const t = messages[locale];
  const ar = locale === "ar";
  const loadActivities = useCallback(async (from: string, to: string, type = "", search = "", page = 1) => {
    setActivityLoading(true);
    try {
      const params = new URLSearchParams({ employeeId: id, from, to, page: String(page), pageSize: "20" });
      if (type) params.set("type", type);
      if (search.trim()) params.set("search", search.trim());
      const response = await cachedApiFetch(`/api/activities?${params}`);
      if (response.status === 401) return window.location.assign("/login");
      if (!response.ok) throw new Error();
      setActivities(await response.json());
    } finally {
      setActivityLoading(false);
    }
  }, [id]);
  const load = useCallback(
    async (from?: string, to?: string) => {
      setFailed(false);
      setLoading(true);
      setPrevious(null);
      setCaptures([]);
      setSelectedCapture(null);
      setSelectedCaptureIds(new Set());
      setCaptureMenu(null);
      try {
        const end = to ?? iso(new Date());
        const start = from ?? shift(end, -6);
        setRange({ from: start, to: end });
        const length =
          Math.round(
            (new Date(`${end}T00:00:00Z`).valueOf() -
              new Date(`${start}T00:00:00Z`).valueOf()) /
              86400000,
          ) + 1;
        const previousTo = shift(start, -1);
        const previousFrom = shift(previousTo, -(length - 1));
        const query = encodeURIComponent(id);
        const [userResponse, analyticsResponse] = await Promise.all([
          cachedApiFetch(`/api/users/${query}`),
          cachedApiFetch(
            `/api/analytics/dashboard?employeeId=${query}&from=${start}&to=${end}`,
          ),
        ]);
        if ([userResponse, analyticsResponse].some((response) => response.status === 401))
          return window.location.assign("/login");
        if (!userResponse.ok || !analyticsResponse.ok) throw new Error();
        const [userData, analyticsData] = await Promise.all([
          userResponse.json(),
          analyticsResponse.json(),
        ]);
        setUser(userData);
        setAnalytics(analyticsData);
        setLoading(false);

        const [previousResponse, capturesResponse, tasksResponse, activitiesResponse] = await Promise.all([
          cachedApiFetch(
            `/api/analytics/dashboard?employeeId=${query}&from=${previousFrom}&to=${previousTo}`,
          ),
          cachedApiFetch(
            `/api/screenshots?employeeId=${query}&from=${start}&to=${end}`,
          ),
          cachedApiFetch("/api/tasks"),
          cachedApiFetch(`/api/activities?employeeId=${query}&from=${start}&to=${end}&page=1&pageSize=20`),
        ]);
        if ([previousResponse, capturesResponse, tasksResponse, activitiesResponse].some((response) => response.status === 401))
          return window.location.assign("/login");
        if (!previousResponse.ok || !capturesResponse.ok || !tasksResponse.ok || !activitiesResponse.ok) throw new Error();
        const [previousData, captureData, taskData, activityData] = await Promise.all([
          previousResponse.json(),
          capturesResponse.json(),
          tasksResponse.json(),
          activitiesResponse.json(),
        ]);
        setPrevious(previousData);
        setCaptures(captureData);
        setTasks((taskData as Task[]).filter((task) => task.assigneeId === id));
        setActivities(activityData);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    setLocale(localStorage.getItem("locale") === "en" ? "en" : "ar");
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (
      ["overview", "performance", "tasks", "activities", "screenshots"].includes(
        requested ?? "",
      )
    )
      setTab(requested as Tab);
    void load();
  }, [load]);
  const chartData = useMemo<ChartPoint[]>(
    () =>
      (analytics?.trend ?? []).map((row) => ({
        label: row.date.slice(5),
        productivity: row.productivityScore,
        focus: row.focusScore,
      })),
    [analytics],
  );
  const maxUsage = Math.max(
    1,
    ...(analytics?.applications ?? []).map((item) => item.seconds),
    ...(analytics?.websites ?? []).map((item) => item.seconds),
  );
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;
  const overdue = tasks.filter(
    (task) =>
      task.deadline &&
      new Date(task.deadline) < new Date() &&
      !["COMPLETED", "CANCELLED"].includes(task.status),
  ).length;
  const idleRatio = analytics?.summary.trackedSeconds
    ? analytics.summary.idleSeconds / analytics.summary.trackedSeconds
    : 0;
  const needsAttention = Boolean(
    analytics &&
    (analytics.summary.productivityScore < 60 ||
      idleRatio > 0.3 ||
      overdue > 0),
  );
  const usage = (items: Usage[], tone = "purple") => (
    <div className={`profile-usage-list ${tone}`}>
      {items.length ? (
        items.slice(0, 8).map((item, index) => (
          <div key={item.name}>
            <span>
              <b>{index + 1}</b>
              <strong>{item.name}</strong>
              <small>{duration(item.seconds, locale)}</small>
            </span>
            <i>
              <b style={{ width: `${(item.seconds / maxUsage) * 100}%` }} />
            </i>
          </div>
        ))
      ) : (
        <EmptyState title={t.noAnalytics} />
      )}
    </div>
  );
  const deleteCapture = async (capture: Capture) => {
    if (deletingCapture || deletingCaptures) return;
    if (!window.confirm(ar ? "هل تريد حذف لقطة الشاشة نهائيًا؟" : "Delete this screenshot permanently?")) return;
    setDeletingCapture(capture.id);
    setCaptureMenu(null);
    try {
      const response = await fetch(`/api/screenshots/${capture.id}`, { method: "DELETE" });
      if (response.status === 401) return window.location.assign("/login");
      if (!response.ok) throw new Error();
      setCaptures(current => current.filter(item => item.id !== capture.id));
      setSelectedCaptureIds(current => {
        const next = new Set(current);
        next.delete(capture.id);
        return next;
      });
      setSelectedCapture(null);
      invalidateApiCache("/api/screenshots", "/api/analytics/dashboard");
    } catch {
      window.alert(ar ? "تعذر حذف لقطة الشاشة." : "Unable to delete the screenshot.");
    } finally {
      setDeletingCapture(null);
    }
  };
  const selectedCaptureCount = captures.reduce((count, capture) => count + (selectedCaptureIds.has(capture.id) ? 1 : 0), 0);
  const allCapturesSelected = captures.length > 0 && selectedCaptureCount === captures.length;
  const captureDeletionBusy = deletingCaptures || deletingCapture !== null;
  const toggleCaptureSelection = (captureId: string) => {
    setSelectedCaptureIds(current => {
      const next = new Set(current);
      if (next.has(captureId)) next.delete(captureId);
      else next.add(captureId);
      return next;
    });
    setCaptureMenu(null);
  };
  const toggleAllCaptures = () => {
    setSelectedCaptureIds(allCapturesSelected ? new Set() : new Set(captures.map(capture => capture.id)));
    setCaptureMenu(null);
  };
  const deleteSelectedCaptures = async () => {
    const ids = captures.filter(capture => selectedCaptureIds.has(capture.id)).map(capture => capture.id);
    if (!ids.length || captureDeletionBusy) return;
    const confirmation = ar
      ? `هل تريد حذف ${ids.length} لقطة شاشة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`
      : `Permanently delete ${ids.length} selected screenshot${ids.length === 1 ? "" : "s"}? This action cannot be undone.`;
    if (!window.confirm(confirmation)) return;
    setDeletingCaptures(true);
    setCaptureMenu(null);
    setSelectedCapture(null);
    try {
      const response = await fetch("/api/screenshots/bulk", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (response.status === 401) return window.location.assign("/login");
      if (!response.ok) throw new Error();
      const deletedIds = new Set(ids);
      setCaptures(current => current.filter(capture => !deletedIds.has(capture.id)));
      setSelectedCaptureIds(new Set());
      invalidateApiCache("/api/screenshots", "/api/analytics/dashboard");
    } catch {
      window.alert(ar ? "تعذر حذف لقطات الشاشة المحددة." : "Unable to delete the selected screenshots.");
    } finally {
      setDeletingCaptures(false);
    }
  };
  if (failed)
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
  if (loading || !user || !analytics)
    return (
      <main className="page-shell">
        <section className="wide-content">
          <LoadingState cards={6} />
        </section>
      </main>
    );
  const timeline = [
    ...tasks.map((item) => ({
      id: `t-${item.id}`,
      at: item.updatedAt,
      icon: "tasks" as const,
      title: item.title,
      detail:
        taskStatus[locale][item.status as keyof typeof taskStatus.ar] ??
        item.status,
    })),
    ...captures.map((item) => ({
      id: `c-${item.id}`,
      at: item.capturedAt,
      icon: "monitor" as const,
      title: ar ? "لقطة نشاط تمت مزامنتها" : "Activity capture synchronized",
      detail: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(
        new Date(item.capturedAt),
      ),
    })),
  ]
    .sort((a, b) => new Date(b.at).valueOf() - new Date(a.at).valueOf())
    .slice(0, 8);
  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "overview", label: t.overview },
    { key: "performance", label: ar ? "الأداء والتحليل" : "Performance" },
    { key: "tasks", label: t.tasks, count: tasks.length },
    { key: "activities", label: ar ? "الأنشطة" : "Activities", count: activities.total },
    { key: "screenshots", label: t.screenshots, count: captures.length },
  ];
  return (
    <main className="page-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="wide-content employee-profile-page">
        <Link className="back-link premium-back" href="/users">
          <Icon name="arrow" size={15} />
          {t.backToEmployees}
        </Link>
        <div className="employee-profile-hero">
          <div className="profile-avatar-large">
            <Icon name="user" size={30} />
            <i className={user.status === "ACTIVE" ? "active" : ""} />
          </div>
          <div className="profile-copy">
            <span className="eyebrow">{t.employeeProfile}</span>
            <h1>{user.displayName}</h1>
            <p>
              {user.email} · {ar ? "انضم" : "Joined"}{" "}
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(user.createdAt),
              )}
            </p>
          </div>
          <div className="profile-hero-signals">
            <span
              className={`status-chip ${user.status === "ACTIVE" ? "success" : "danger"}`}
            >
              <i />
              {user.status === "ACTIVE"
                ? ar
                  ? "الحساب مفعّل"
                  : "Account active"
                : ar
                  ? "الحساب موقوف"
                  : "Account suspended"}
            </span>
            <span
              className={`status-chip ${needsAttention ? "warning" : "success"}`}
            >
              <Icon name={needsAttention ? "alert" : "check"} size={12} />
              {needsAttention
                ? ar
                  ? "يحتاج متابعة"
                  : "Needs attention"
                : ar
                  ? "أداء طبيعي"
                  : "Healthy performance"}
            </span>
          </div>
          <form
            className="profile-date-filter"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              void load(String(form.get("from")), String(form.get("to")));
            }}
          >
            <input
              name="from"
              type="date"
              defaultValue={analytics.range.from}
            />
            <input name="to" type="date" defaultValue={analytics.range.to} />
            <button>
              <Icon name="arrow" size={16} />
            </button>
          </form>
        </div>
        <div className="profile-kpis">
          <article className="purple">
            <span>
              <Icon name="trend" />
            </span>
            <div>
              <small>{t.productivity}</small>
              <strong>{analytics.summary.productivityScore}%</strong>
              <em>
                {analytics.summary.productivityScore -
                  (previous?.summary.productivityScore ?? 0) >=
                0
                  ? "+"
                  : ""}
                {analytics.summary.productivityScore -
                  (previous?.summary.productivityScore ?? 0)}{" "}
                {ar ? "نقطة" : "pts"}
              </em>
            </div>
          </article>
          <article className="blue">
            <span>
              <Icon name="focus" />
            </span>
            <div>
              <small>{t.focus}</small>
              <strong>{analytics.summary.focusScore}%</strong>
              <em>{ar ? "استمرارية العمل" : "Work continuity"}</em>
            </div>
          </article>
          <article className="green">
            <span>
              <Icon name="clock" />
            </span>
            <div>
              <small>{t.activeTime}</small>
              <strong>
                {duration(analytics.summary.activeSeconds, locale)}
              </strong>
              <em>
                {analytics.sessions.count} {ar ? "جلسة" : "sessions"}
              </em>
            </div>
          </article>
          <article className="orange">
            <span>
              <Icon name="idle" />
            </span>
            <div>
              <small>{t.idleTime}</small>
              <strong>{duration(analytics.summary.idleSeconds, locale)}</strong>
              <em>
                {Math.round(idleRatio * 100)}% {ar ? "من الوقت" : "of time"}
              </em>
            </div>
          </article>
          <article className="pink">
            <span>
              <Icon name="tasks" />
            </span>
            <div>
              <small>{t.tasks}</small>
              <strong>
                {completed}/{tasks.length}
              </strong>
              <em>
                {overdue} {ar ? "متأخرة" : "overdue"}
              </em>
            </div>
          </article>
        </div>
        <div className="profile-tabs">
          {tabs.map((item) => (
            <button
              className={tab === item.key ? "active" : ""}
              onClick={() => setTab(item.key)}
              key={item.key}
            >
              {item.label}
              {item.count !== undefined && <span>{item.count}</span>}
            </button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="profile-overview-grid">
            <article className="panel-card profile-trend">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">PERFORMANCE TREND</span>
                  <h2>
                    {ar ? "اتجاه الأداء اليومي" : "Daily performance trend"}
                  </h2>
                </div>
                <button onClick={() => setTab("performance")}>
                  {ar ? "تحليل أعمق" : "Deep dive"}
                  <Icon name="arrow" size={14} />
                </button>
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
            <article className="panel-card profile-health">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">TIME HEALTH</span>
                  <h2>{ar ? "توازن وقت العمل" : "Work time balance"}</h2>
                </div>
              </div>
              <DonutChart
                value={analytics.summary.activeSeconds}
                total={analytics.summary.trackedSeconds}
                label={t.activeTime}
                secondaryLabel={t.idleTime}
                primary="var(--primary)"
                secondary="var(--surface-soft)"
                format={(value) => duration(value, locale)}
              />
              <div
                className={`profile-signal ${needsAttention ? "warning" : "success"}`}
              >
                <Icon name={needsAttention ? "alert" : "check"} size={17} />
                <div>
                  <strong>
                    {needsAttention
                      ? ar
                        ? "توجد إشارات تحتاج مراجعة"
                        : "Signals require review"
                      : ar
                        ? "الأداء ضمن النطاق الطبيعي"
                        : "Performance is within range"}
                  </strong>
                  <small>
                    {overdue > 0
                      ? ar
                        ? `${overdue} مهام متأخرة`
                        : `${overdue} overdue tasks`
                      : idleRatio > 0.3
                        ? ar
                          ? "نسبة الخمول مرتفعة"
                          : "Idle ratio is elevated"
                        : ar
                          ? "لا توجد مؤشرات حرجة"
                          : "No critical indicators"}
                  </small>
                </div>
              </div>
            </article>
            <article className="panel-card profile-tasks-preview">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">WORKLOAD</span>
                  <h2>{ar ? "المهام الحالية" : "Current tasks"}</h2>
                </div>
                <button onClick={() => setTab("tasks")}>
                  {ar ? "عرض الكل" : "View all"}
                </button>
              </div>
              {tasks.length ? (
                <div className="profile-task-list">
                  {tasks
                    .filter(
                      (task) =>
                        !["COMPLETED", "CANCELLED"].includes(task.status),
                    )
                    .slice(0, 5)
                    .map((task) => (
                      <div key={task.id}>
                        <span
                          className={`priority-dot ${task.priority.toLowerCase()}`}
                        />
                        <div>
                          <strong>{task.title}</strong>
                          <small>
                            {taskStatus[locale][
                              task.status as keyof typeof taskStatus.ar
                            ] ?? task.status}
                          </small>
                        </div>
                        <div>
                          <b>{task.progress}%</b>
                          <i>
                            <span style={{ width: `${task.progress}%` }} />
                          </i>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState title={t.noTasks} />
              )}
            </article>
            <article className="panel-card profile-timeline">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ACTIVITY</span>
                  <h2>{ar ? "آخر التحديثات" : "Recent timeline"}</h2>
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
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
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
            <article className="panel-card profile-capture-preview">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{captures.length} CAPTURES</span>
                  <h2>{t.recentScreenshots}</h2>
                </div>
                <button onClick={() => setTab("screenshots")}>
                  {ar ? "عرض الكل" : "View all"}
                </button>
              </div>
              {captures.length ? (
                <div className="capture-preview-grid">
                  {captures.slice(0, 4).map((capture, index) => (
                    <button
                      key={capture.id}
                      onClick={() => setSelectedCapture(index)}
                    >
                      <img
                        src={`/api/screenshots/${capture.id}/thumbnail`}
                        alt=""
                        loading="lazy"
                      />
                      <span>
                        {new Intl.DateTimeFormat(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        }).format(new Date(capture.capturedAt))}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState title={t.noScreenshots} />
              )}
            </article>
          </div>
        )}
        {tab === "performance" && (
          <div className="profile-performance-grid">
            <article className="panel-card profile-full-trend">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DETAILED TREND</span>
                  <h2>
                    {ar
                      ? "الإنتاجية والتركيز عبر الوقت"
                      : "Productivity and focus over time"}
                  </h2>
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
            <article className="panel-card profile-daily-time">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">DAILY TIME</span>
                  <h2>
                    {ar ? "النشط والخامل يوميًا" : "Daily active and idle time"}
                  </h2>
                </div>
              </div>
              <div className="employee-time-bars">
                {analytics.trend.map((row) => {
                  const total = row.activeSeconds + row.idleSeconds;
                  return (
                    <div key={row.date}>
                      <span>{row.date.slice(5)}</span>
                      <i>
                        <b
                          style={{
                            width: `${total ? (row.activeSeconds / total) * 100 : 0}%`,
                          }}
                        />
                        <em
                          style={{
                            width: `${total ? (row.idleSeconds / total) * 100 : 0}%`,
                          }}
                        />
                      </i>
                      <small>{duration(total, locale)}</small>
                    </div>
                  );
                })}
              </div>
            </article>
            <article className="panel-card profile-classification-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">ACTIVITY CLASSIFICATION</span>
                  <h2>{ar ? "توزيع الوقت حسب التصنيف" : "Time by current classification"}</h2>
                </div>
              </div>
              <div className="classification-summary">
                {([
                  ["productive", ar ? "منتج" : "Productive", analytics.summary.productiveSeconds],
                  ["unproductive", ar ? "غير منتج" : "Unproductive", analytics.summary.unproductiveSeconds],
                  ["undefined", ar ? "غير مصنف" : "Undefined", analytics.summary.undefinedSeconds],
                ] as const).map(([tone, label, seconds]) => <div key={tone} className={tone}>
                  <span><i />{label}</span>
                  <strong>{duration(seconds, locale)}</strong>
                  <small>{analytics.summary.trackedSeconds ? Math.round(seconds / analytics.summary.trackedSeconds * 100) : 0}%</small>
                </div>)}
              </div>
              <p className="classification-note">{ar ? "تُحسب المدد من بداية ونهاية كل نشاط فعلي، ويتحدث التصنيف بعد تشغيل التحليل الذكي." : "Durations come from each activity's actual start and end; classifications refresh after AI analysis."}</p>
            </article>
            <article className="panel-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">APPLICATIONS</span>
                  <h2>{t.appUsage}</h2>
                </div>
              </div>
              {usage(analytics.applications)}
            </article>
            <article className="panel-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">WEBSITES</span>
                  <h2>{t.websiteUsage}</h2>
                </div>
              </div>
              {usage(analytics.websites, "blue")}
            </article>
          </div>
        )}
        {tab === "tasks" && (
          <div className="employee-task-workspace">
            <div className="task-workspace-head">
              <div>
                <h2>{ar ? "مهام الموظف" : "Employee tasks"}</h2>
                <p>
                  {ar
                    ? "عرض شامل للتقدم والأولوية والمواعيد."
                    : "A complete view of progress, priority, and deadlines."}
                </p>
              </div>
              <span>
                {completed}/{tasks.length} {ar ? "مكتملة" : "completed"}
              </span>
            </div>
            {tasks.length ? (
              <div className="employee-task-table">
                <table>
                  <thead>
                    <tr>
                      <th>{t.taskTitle}</th>
                      <th>{t.priority}</th>
                      <th>{t.status}</th>
                      <th>{t.progress}</th>
                      <th>{t.deadline}</th>
                      <th>{ar ? "الملاحظات" : "Notes"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => (
                      <tr key={task.id}>
                        <td>
                          <strong>{task.title}</strong>
                          <small>
                            {task.description ||
                              (ar ? "بدون وصف" : "No description")}
                          </small>
                        </td>
                        <td>
                          <span
                            className={`task-priority ${task.priority.toLowerCase()}`}
                          >
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <span className="status-chip">
                            {taskStatus[locale][
                              task.status as keyof typeof taskStatus.ar
                            ] ?? task.status}
                          </span>
                        </td>
                        <td>
                          <div className="task-progress-cell">
                            <i>
                              <span style={{ width: `${task.progress}%` }} />
                            </i>
                            <b>{task.progress}%</b>
                          </div>
                        </td>
                        <td>
                          {task.deadline
                            ? new Intl.DateTimeFormat(locale, {
                                dateStyle: "medium",
                              }).format(new Date(task.deadline))
                            : "—"}
                        </td>
                        <td>{task.notes.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={t.noTasks} />
            )}
          </div>
        )}
        {tab === "activities" && (
          <div className="employee-activities-workspace">
            <div className="activity-workspace-head">
              <div>
                <h2>{ar ? "سجل نشاط الموظف" : "Employee activity log"}</h2>
                <p>{ar ? "سياقات العمل الفعلية بوقت البداية والنهاية والمدة والتصنيف الحالي." : "Real work contexts with start, end, duration, and current classification."}</p>
              </div>
              <span><Icon name="activity" size={16} />{activities.total} {ar ? "نشاط" : "activities"}</span>
            </div>
            <form className="activity-filters" onSubmit={event => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const type = String(form.get("type") ?? "");
              const search = String(form.get("search") ?? "");
              setActivityType(type);
              setActivitySearch(search);
              void loadActivities(range.from, range.to, type, search, 1);
            }}>
              <label><span>{ar ? "نوع النشاط" : "Activity type"}</span><select name="type" defaultValue={activityType}>
                <option value="">{ar ? "جميع الأنواع" : "All types"}</option>
                <option value="APPLICATION">{ar ? "تطبيق" : "Application"}</option>
                <option value="WEBSITE">{ar ? "موقع" : "Website"}</option>
                <option value="FILE">{ar ? "ملف" : "File"}</option>
                <option value="FOLDER">{ar ? "مجلد" : "Folder"}</option>
                <option value="WORKSPACE">{ar ? "مساحة عمل" : "Workspace"}</option>
                <option value="OTHER">{ar ? "أخرى" : "Other"}</option>
              </select></label>
              <label className="activity-search"><span>{ar ? "البحث" : "Search"}</span><div><Icon name="search" size={16} /><input name="search" defaultValue={activitySearch} placeholder={ar ? "تطبيق، ملف، موقع أو عنوان نافذة" : "App, file, website, or window title"} /></div></label>
              <button className="primary-action" disabled={activityLoading}>{activityLoading ? (ar ? "جارٍ التحميل…" : "Loading…") : (ar ? "تطبيق" : "Apply")}</button>
            </form>
            {activityLoading ? <LoadingState cards={4} /> : activities.items.length ? <>
              <div className="activity-table-wrap">
                <table className="activity-table">
                  <thead><tr>
                    <th>{ar ? "الوقت" : "Time"}</th>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th>{ar ? "التطبيق" : "Application"}</th>
                    <th>{ar ? "السياق" : "Context"}</th>
                    <th>{ar ? "المدة" : "Duration"}</th>
                    <th>{ar ? "التصنيف" : "Classification"}</th>
                  </tr></thead>
                  <tbody>{activities.items.map(activity => <tr key={activity.id}>
                    <td><strong>{new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(activity.startedAt))}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(activity.startedAt))}</small></td>
                    <td><span className={`activity-type ${activity.resourceType.toLowerCase()}`}>{activity.resourceType}</span></td>
                    <td><strong>{activity.applicationName}</strong><small>{activity.processName}</small></td>
                    <td><strong>{activity.resourceName || activity.domain || activity.windowTitle || "—"}</strong><small>{activity.contextName || activity.domain || activity.url || activity.windowTitle || "—"}</small></td>
                    <td><strong>{activityDuration(activity.durationSeconds, locale)}</strong><small>{ar ? `من ${new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(activity.startedAt))} إلى ${new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(activity.endedAt))}` : `${new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(activity.startedAt))} – ${new Intl.DateTimeFormat(locale, { timeStyle: "medium" }).format(new Date(activity.endedAt))}`}</small></td>
                    <td><span className={`classification-chip ${activity.classification.toLowerCase()}`}>{activity.classification === "PRODUCTIVE" ? (ar ? "منتج" : "Productive") : activity.classification === "UNPRODUCTIVE" ? (ar ? "غير منتج" : "Unproductive") : (ar ? "غير مصنف" : "Undefined")}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="activity-pagination">
                <span>{ar ? `صفحة ${activities.page} من ${activities.totalPages}` : `Page ${activities.page} of ${activities.totalPages}`}</span>
                <div><button disabled={activities.page <= 1 || activityLoading} onClick={() => void loadActivities(range.from, range.to, activityType, activitySearch, activities.page - 1)}>{ar ? "السابق" : "Previous"}</button><button disabled={activities.page >= activities.totalPages || activityLoading} onClick={() => void loadActivities(range.from, range.to, activityType, activitySearch, activities.page + 1)}>{ar ? "التالي" : "Next"}</button></div>
              </div>
            </> : <EmptyState title={ar ? "لا توجد أنشطة ضمن الفترة المحددة" : "No activities in the selected range"} description={ar ? "ستظهر الأنشطة المنظمة بعد تشغيل جلسة الموظف ومزامنة الوكيل المحدّث." : "Structured activities appear after the employee runs a session and the updated agent synchronizes."} />}
          </div>
        )}
        {tab === "screenshots" && (
          <div className="employee-captures-workspace">
            <div className="capture-workspace-head">
              <div>
                <h2>{t.screenshots}</h2>
                <p>
                  {ar
                    ? "لقطات جُمعت أثناء جلسات العمل النشطة فقط."
                    : "Captures collected only during active work sessions."}
                </p>
              </div>
              <span>
                <Icon name="monitor" size={16} />
                {captures.length} {ar ? "لقطة" : "captures"}
              </span>
            </div>
            {captures.length ? (
              <>
                <div className="capture-selection-toolbar" role="toolbar" aria-label={ar ? "إجراءات لقطات الشاشة" : "Screenshot actions"} aria-busy={captureDeletionBusy}>
                  <button
                    type="button"
                    className="capture-select-all"
                    aria-pressed={allCapturesSelected}
                    disabled={captureDeletionBusy}
                    onClick={toggleAllCaptures}
                  >
                    <span className={`capture-selection-box${allCapturesSelected ? " selected" : selectedCaptureCount ? " partial" : ""}`}>
                      {allCapturesSelected ? <Icon name="check" size={15} /> : selectedCaptureCount ? <b>−</b> : null}
                    </span>
                    {allCapturesSelected
                      ? (ar ? "إلغاء تحديد الكل" : "Clear all")
                      : (ar ? "تحديد كل اللقطات الظاهرة" : "Select all visible")}
                  </button>
                  <span className="capture-selection-summary">
                    {selectedCaptureCount
                      ? (ar ? `${selectedCaptureCount} لقطة محددة` : `${selectedCaptureCount} selected`)
                      : (ar ? "يمكنك تحديد لقطة واحدة أو أكثر" : "Select one or more screenshots")}
                  </span>
                  <button
                    type="button"
                    className="capture-delete-selected"
                    disabled={!selectedCaptureCount || captureDeletionBusy}
                    onClick={() => void deleteSelectedCaptures()}
                  >
                    <Icon name="trash" size={16} />
                    {deletingCaptures
                      ? (ar ? "جارٍ حذف اللقطات…" : "Deleting screenshots…")
                      : (ar ? `حذف المحدد (${selectedCaptureCount})` : `Delete selected (${selectedCaptureCount})`)}
                  </button>
                </div>
                <div className="premium-capture-grid">
                {captures.map((capture, index) => {
                  const captureSelected = selectedCaptureIds.has(capture.id);
                  return (
                  <article className={`capture-card${captureSelected ? " selected" : ""}`} key={capture.id}>
                    <button
                      type="button"
                      className={`capture-select-toggle${captureSelected ? " selected" : ""}`}
                      aria-pressed={captureSelected}
                      aria-label={ar ? `تحديد لقطة الشاشة رقم ${index + 1}` : `Select screenshot ${index + 1}`}
                      disabled={captureDeletionBusy}
                      onClick={() => toggleCaptureSelection(capture.id)}
                    >
                      {captureSelected && <Icon name="check" size={16} />}
                    </button>
                    <button className="capture-image-button" onClick={() => setSelectedCapture(index)}>
                    <div>
                      <img
                        src={`/api/screenshots/${capture.id}/thumbnail`}
                        alt={`${t.screenshotBy} ${user.displayName}`}
                        loading="lazy"
                      />
                      <span>
                        <Icon name="search" size={18} />
                      </span>
                    </div>
                    </button>
                    <footer>
                      <strong>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(capture.capturedAt))}
                      </strong>
                      <small>
                        {new Intl.DateTimeFormat(locale, {
                          timeStyle: "short",
                        }).format(new Date(capture.capturedAt))}{" "}
                        · {capture.asset.width}×{capture.asset.height} ·{" "}
                        {Math.ceil(capture.asset.byteSize / 1024)} KB
                      </small>
                    </footer>
                    <button className="capture-menu-trigger" disabled={captureDeletionBusy} aria-label={ar ? "خيارات اللقطة" : "Screenshot options"} aria-expanded={captureMenu === capture.id} onClick={() => setCaptureMenu(current => current === capture.id ? null : capture.id)}>•••</button>
                    {captureMenu === capture.id && <div className="capture-action-menu">
                      <button disabled={captureDeletionBusy} onClick={() => void deleteCapture(capture)}><Icon name="trash" size={15} />{deletingCapture === capture.id ? (ar ? "جارٍ الحذف…" : "Deleting…") : (ar ? "حذف اللقطة" : "Delete screenshot")}</button>
                    </div>}
                  </article>
                  );
                })}
                </div>
              </>
            ) : (
              <EmptyState
                title={t.noScreenshots}
                description={
                  ar
                    ? "ستظهر اللقطات بعد بدء جلسة الموظف ووصول موعد الالتقاط."
                    : "Captures appear after the employee starts a session and the capture interval is reached."
                }
              />
            )}
          </div>
        )}
        {selectedCapture !== null && captures[selectedCapture] && (
          <div className="capture-lightbox" role="dialog" aria-modal="true">
            <button
              className="lightbox-close"
              onClick={() => setSelectedCapture(null)}
            >
              <Icon name="close" />
            </button>
            <button
              className="lightbox-nav previous"
              onClick={() =>
                setSelectedCapture((index) =>
                  index === null
                    ? 0
                    : (index - 1 + captures.length) % captures.length,
                )
              }
            >
              <Icon name="chevron" />
            </button>
            <figure>
              <img
                src={`/api/screenshots/${captures[selectedCapture].id}/file`}
                alt=""
              />
              <figcaption>
                <strong>{user.displayName}</strong>
                <span>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "full",
                    timeStyle: "medium",
                  }).format(new Date(captures[selectedCapture].capturedAt))}
                </span>
              </figcaption>
            </figure>
            <button
              className="lightbox-nav next"
              onClick={() =>
                setSelectedCapture((index) =>
                  index === null ? 0 : (index + 1) % captures.length,
                )
              }
            >
              <Icon name="chevron" />
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
