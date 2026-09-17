import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import { Icon } from "./icons";
import { elapsedSeconds, formatDuration } from "./utils";
import "./styles.css";
import "../../../packages/design-tokens/typography.css";

type SessionState = {
  sessionId: string | null;
  status: "IDLE" | "ACTIVE" | "PAUSED";
  startedAt: string | null;
  pendingEvents: number;
};
type SyncStatus = {
  online: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  error: string | null;
};
type Profile = { displayName: string; email: string; role: string };
type Task = {
  id: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  progress: number;
  deadline?: string | null;
};
type Dashboard = {
  summary: {
    productivityScore: number;
    focusScore: number;
    trackedSeconds: number;
    activeSeconds: number;
    idleSeconds: number;
  };
  trend: Array<{
    date: string;
    productivityScore: number;
    focusScore: number;
    activeSeconds: number;
    idleSeconds: number;
  }>;
  tasks: Record<string, number>;
};
type Notification = {
  id: string;
  type: string;
  data?: { title?: string };
  readAt?: string | null;
  createdAt: string;
};
type OrganizationPreferences = {
  fontKey: string;
  typographyScale: "compact" | "standard" | "comfortable" | "large";
  screenshotIntervalSeconds: number;
};
type Theme = "light" | "dark";
const emptySession: SessionState = {
  sessionId: null,
  status: "IDLE",
  startedAt: null,
  pendingEvents: 0,
};
const emptySync: SyncStatus = {
  online: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  error: null,
};
const duration = (seconds: number, _ar: boolean) => formatDuration(seconds);

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<SessionState>(emptySession);
  const [sync, setSync] = useState<SyncStatus>(emptySync);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [ar, setAr] = useState(localStorage.getItem("locale") !== "en");
  const [theme, setTheme] = useState<Theme>(
    (localStorage.getItem("theme") as Theme) || "light",
  );
  const [now, setNow] = useState(Date.now());
  const restoreStarted = useRef(false);
  const t = ar
    ? {
        product: "وكيل الموظف",
        workspace: "مساحة العمل",
        subtitle: "متابعة واضحة وآمنة لجلسة عملك",
        restoring: "جارٍ استعادة جلستك الآمنة…",
        login: "تسجيل الدخول",
        api: "عنوان الخادم",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        start: "بدء جلسة العمل",
        pause: "إيقاف مؤقت",
        resume: "استئناف",
        end: "إنهاء الجلسة",
        ready: "جاهز للبدء",
        active: "الجلسة نشطة",
        paused: "الجلسة متوقفة",
        pending: "بانتظار المزامنة",
        lastSync: "آخر مزامنة",
        connection: "الاتصال",
        online: "متصل",
        offline: "دون اتصال",
        productivity: "إنتاجية اليوم",
        activeTime: "الوقت النشط",
        tasks: "المهام المسندة",
        notifications: "الإشعارات",
        summary: "ملخصك اليومي",
        settings: "الإعدادات",
        signout: "تسجيل الخروج",
        privacy:
          "يتم جمع مستوى النشاط واللقطات أثناء الجلسة النشطة فقط. لا يتم تسجيل محتوى لوحة المفاتيح.",
        noTasks: "لا توجد مهام مسندة حاليًا.",
        noNotifications: "لا توجد إشعارات جديدة.",
        saved: "سيبقى تسجيل الدخول محفوظًا بأمان لمدة 30 يومًا.",
        refresh: "تحديث البيانات",
      }
    : {
        product: "Employee Agent",
        workspace: "Your workspace",
        subtitle: "A clear and secure view of your work session",
        restoring: "Restoring your secure session…",
        login: "Sign in",
        api: "Server address",
        email: "Email address",
        password: "Password",
        start: "Start work session",
        pause: "Pause",
        resume: "Resume",
        end: "End session",
        ready: "Ready to start",
        active: "Session active",
        paused: "Session paused",
        pending: "Pending synchronization",
        lastSync: "Last synchronization",
        connection: "Connection",
        online: "Online",
        offline: "Offline",
        productivity: "Today productivity",
        activeTime: "Active time",
        tasks: "Assigned tasks",
        notifications: "Notifications",
        summary: "Today summary",
        settings: "Settings",
        signout: "Sign out",
        privacy:
          "Activity level and screenshots are collected only during an active session. Keyboard content is never recorded.",
        noTasks: "No tasks are currently assigned.",
        noNotifications: "No new notifications.",
        saved: "Your sign-in stays securely saved for 30 days.",
        refresh: "Refresh data",
      };
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const refreshLocal = useCallback(async () => {
    const [state, status] = await Promise.all([
      invoke<SessionState>("session_state"),
      invoke<SyncStatus>("sync_status"),
    ]);
    setSession(state);
    setSync(status);
  }, []);
  const applyOrganizationPreferences = useCallback(async () => {
    try {
      const preferences = await invoke<OrganizationPreferences>(
        "organization_preferences",
      );
      document.documentElement.dataset.font = preferences.fontKey;
      document.documentElement.dataset.typographyScale =
        preferences.typographyScale;
      localStorage.setItem("organizationFont", preferences.fontKey);
      localStorage.setItem("typographyScale", preferences.typographyScale);
    } catch {
      const cachedFont = localStorage.getItem("organizationFont");
      const cachedScale = localStorage.getItem("typographyScale");
      if (cachedFont) document.documentElement.dataset.font = cachedFont;
      if (cachedScale)
        document.documentElement.dataset.typographyScale = cachedScale;
    }
  }, []);
  const refreshRemote = useCallback(async () => {
    setRemoteLoading(true);
    try {
      const [user, assigned, analytics, alerts] = await Promise.all([
        invoke<Profile>("employee_profile"),
        invoke<Task[]>("employee_tasks"),
        invoke<Dashboard>("employee_dashboard"),
        invoke<Notification[]>("employee_notifications"),
      ]);
      setProfile(user);
      setTasks(assigned);
      setDashboard(analytics);
      setNotifications(alerts);
      setError("");
    } catch {
      await refreshLocal().catch(() => undefined);
    } finally {
      setRemoteLoading(false);
    }
  }, [refreshLocal]);
  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    const cachedFont = localStorage.getItem("organizationFont");
    const cachedScale = localStorage.getItem("typographyScale");
    if (cachedFont) document.documentElement.dataset.font = cachedFont;
    document.documentElement.dataset.typographyScale =
      cachedScale || "standard";
    invoke<boolean>("restore_session")
      .then(async (restored) => {
        setAuthenticated(restored);
        if (restored) {
          await refreshLocal();
          try {
            await invoke("sync_now");
          } catch {}
          await Promise.all([
            refreshRemote(),
            applyOrganizationPreferences(),
            refreshLocal(),
          ]);
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, [applyOrganizationPreferences, refreshLocal, refreshRemote]);
  useEffect(() => {
    if (!authenticated) return;
    const stateTimer = window.setInterval(
      () => void refreshLocal().catch(() => undefined),
      5000,
    );
    const remoteTimer = window.setInterval(() => void refreshRemote(), 60000);
    const typographyTimer = window.setInterval(
      () => void applyOrganizationPreferences(),
      60000,
    );
    return () => {
      clearInterval(stateTimer);
      clearInterval(remoteTimer);
      clearInterval(typographyTimer);
    };
  }, [
    authenticated,
    refreshLocal,
    refreshRemote,
    applyOrganizationPreferences,
  ]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await invoke("login", {
        apiUrl: form.get("apiUrl"),
        email: form.get("email"),
        password: form.get("password"),
      });
      setAuthenticated(true);
      await refreshLocal();
      try {
        await invoke("sync_now");
      } catch {}
      await Promise.all([
        refreshRemote(),
        applyOrganizationPreferences(),
        refreshLocal(),
      ]);
    } catch (error) {
      setError(String(error));
    }
  }
  async function action(command: string) {
    setError("");
    try {
      await invoke(command);
      try {
        await invoke("sync_now");
      } catch {}
      await refreshLocal();
      void refreshRemote();
    } catch (error) {
      const message = String(error);
      setError(message);
      if (message.includes("sign in") || message.includes("expired"))
        setAuthenticated(false);
    }
  }
  async function updateProgress(taskId: string, progress: number) {
    try {
      await invoke("update_task_progress", { taskId, progress });
      await refreshRemote();
    } catch (error) {
      setError(String(error));
    }
  }
  async function readNotification(item: Notification) {
    if (!item.readAt) {
      try {
        await invoke("mark_notification_read", { notificationId: item.id });
        setNotifications((current) =>
          current.map((value) =>
            value.id === item.id
              ? { ...value, readAt: new Date().toISOString() }
              : value,
          ),
        );
      } catch {}
    }
  }
  async function logout() {
    try {
      await invoke("logout");
      setAuthenticated(false);
      setProfile(null);
      setTasks([]);
      setDashboard(null);
      setSettingsOpen(false);
    } catch (error) {
      setError(String(error));
    }
  }
  const toggleLanguage = () => {
    const next = !ar;
    setAr(next);
    localStorage.setItem("locale", next ? "ar" : "en");
  };
  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("theme", next);
  };
  const elapsed =
    session.status !== "IDLE" ? elapsedSeconds(session.startedAt, now) : 0;
  const unread = notifications.filter((item) => !item.readAt).length;
  const openTasks = tasks.filter(
    (task) => !["COMPLETED", "CANCELLED"].includes(task.status),
  );
  const syncTime = sync.lastSuccessAt
    ? new Intl.DateTimeFormat(ar ? "ar-SA" : "en", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(sync.lastSuccessAt))
    : "—";
  const notificationTitle = (item: Notification) =>
    item.type === "TASK_ASSIGNED"
      ? ar
        ? `مهمة جديدة: ${item.data?.title ?? ""}`
        : `New task: ${item.data?.title ?? ""}`
      : item.type === "TASK_UPDATED"
        ? ar
          ? `تحديث مهمة: ${item.data?.title ?? ""}`
          : `Task updated: ${item.data?.title ?? ""}`
        : item.type === "AI_ANALYSIS_COMPLETED"
          ? ar
            ? "اكتمل التحليل الذكي"
            : "AI analysis completed"
          : item.type.replaceAll("_", " ");
  const trend = useMemo(() => dashboard?.trend.slice(-7) ?? [], [dashboard]);
  if (checking)
    return (
      <main className="agent-loading" dir={ar ? "rtl" : "ltr"}>
        <div className="agent-logo">
          <i />R
        </div>
        <span className="loader" />
        <p>{t.restoring}</p>
      </main>
    );
  if (!authenticated)
    return (
      <main className="agent-login" dir={ar ? "rtl" : "ltr"}>
        <section className="agent-login-brand">
          <div className="agent-brand">
            <span>
              <i />R
            </span>
            <div>
              <strong>Remote Work</strong>
              <small>{t.product}</small>
            </div>
          </div>
          <div>
            <span className="eyebrow">SECURE EMPLOYEE WORKSPACE</span>
            <h1>{t.workspace}</h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="agent-security">
            <span>
              <Icon name="cloud" />
              {ar ? "طابور محلي مشفّر" : "Encrypted local queue"}
            </span>
            <span>
              <Icon name="wifi" />
              {ar ? "مزامنة تلقائية" : "Automatic synchronization"}
            </span>
          </div>
        </section>
        <section className="agent-login-access">
          <div className="login-tools">
            <button onClick={toggleTheme}>
              <Icon name={theme === "dark" ? "sun" : "moon"} />
            </button>
            <button onClick={toggleLanguage}>
              <Icon name="globe" />
              {ar ? "AR" : "EN"}
            </button>
          </div>
          <form className="agent-login-card" onSubmit={login}>
            <span className="eyebrow">EMPLOYEE ACCESS</span>
            <h2>{t.login}</h2>
            <p>{t.saved}</p>
            <label>
              {t.api}
              <input
                name="apiUrl"
                defaultValue="http://localhost:4000/api/v1"
                required
              />
            </label>
            <label>
              {t.email}
              <input
                name="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="username"
                required
              />
            </label>
            <label>
              {t.password}
              <input
                name="password"
                type="password"
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <div className="agent-error">
                <Icon name="alert" />
                {error}
              </div>
            )}
            <button className="agent-login-submit">
              {t.login}
              <Icon name="play" size={16} />
            </button>
          </form>
        </section>
      </main>
    );
  return (
    <main className="agent-app" dir={ar ? "rtl" : "ltr"}>
      <header className="agent-topbar">
        <div className="agent-brand">
          <span>
            <i />R
          </span>
          <div>
            <strong>Remote Work</strong>
            <small>{t.product}</small>
          </div>
        </div>
        <div className="agent-user">
          <div>
            <strong>
              {profile?.displayName ?? (ar ? "الموظف" : "Employee")}
            </strong>
            <small>{profile?.email ?? ""}</small>
          </div>
          <span><Icon name="user" size={19} /></span>
        </div>
        <div className="agent-tools">
          <div
            className={`connection-pill ${sync.online ? "online" : "offline"}`}
          >
            <Icon name={sync.online ? "wifi" : "offline"} size={14} />
            {sync.online ? t.online : t.offline}
          </div>
          <button onClick={() => setNotificationsOpen((value) => !value)}>
            <Icon name="bell" />
            {unread > 0 && <b>{Math.min(unread, 9)}</b>}
          </button>
          <button onClick={() => setSettingsOpen(true)}>
            <Icon name="settings" />
          </button>
        </div>
        {notificationsOpen && (
          <div className="agent-notification-popover">
            <div>
              <strong>{t.notifications}</strong>
              <button onClick={() => setNotificationsOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            {notifications.length ? (
              notifications.slice(0, 6).map((item) => (
                <button
                  className={item.readAt ? "" : "unread"}
                  onClick={() => void readNotification(item)}
                  key={item.id}
                >
                  <i />
                  <span>
                    <strong>{notificationTitle(item)}</strong>
                    <small>
                      {new Intl.DateTimeFormat(ar ? "ar-SA" : "en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(item.createdAt))}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <p>{t.noNotifications}</p>
            )}
          </div>
        )}
      </header>
      {!sync.online && (
        <div className="offline-banner">
          <Icon name="cloud" />
          <span>
            <strong>
              {ar ? "أنت تعمل دون اتصال" : "You are working offline"}
            </strong>
            <small>
              {ar
                ? "سيستمر الجمع بأمان وتتم المزامنة تلقائيًا عند عودة الاتصال."
                : "Collection continues securely and synchronizes automatically when connection returns."}
            </small>
          </span>
          <b>{session.pendingEvents}</b>
        </div>
      )}
      <section className="agent-dashboard">
        <article
          className={`session-control-card ${session.status.toLowerCase()}`}
        >
          <div className="session-state-copy">
            <span className="session-status-dot">
              <i />
            </span>
            <div>
              <small>
                {session.status === "ACTIVE"
                  ? t.active
                  : session.status === "PAUSED"
                    ? t.paused
                    : t.ready}
              </small>
              <strong>{duration(elapsed, ar)}</strong>
              <span>
                {session.startedAt
                  ? new Intl.DateTimeFormat(ar ? "ar-SA" : "en", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(session.startedAt))
                  : ar
                    ? "ابدأ عندما تكون جاهزًا"
                    : "Start when you are ready"}
              </span>
            </div>
          </div>
          <div className="session-actions">
            {session.status === "IDLE" && (
              <button
                className="start"
                onClick={() => void action("start_session")}
              >
                <Icon name="play" />
                {t.start}
              </button>
            )}
            {session.status === "ACTIVE" && (
              <>
                <button
                  className="pause"
                  onClick={() => void action("pause_session")}
                >
                  <Icon name="pause" />
                  {t.pause}
                </button>
                <button
                  className="end"
                  onClick={() => void action("end_session")}
                >
                  <Icon name="stop" />
                  {t.end}
                </button>
              </>
            )}
            {session.status === "PAUSED" && (
              <>
                <button
                  className="start"
                  onClick={() => void action("resume_session")}
                >
                  <Icon name="play" />
                  {t.resume}
                </button>
                <button
                  className="end"
                  onClick={() => void action("end_session")}
                >
                  <Icon name="stop" />
                  {t.end}
                </button>
              </>
            )}
          </div>
          <div className="session-wave">
            {[
              30, 42, 34, 65, 54, 76, 48, 82, 62, 90, 72, 58, 84, 66, 44, 36,
            ].map((height, index) => (
              <i
                style={{
                  height: session.status === "ACTIVE" ? `${height}%` : "12%",
                }}
                key={index}
              />
            ))}
          </div>
        </article>
        <div className="agent-stats">
          <article>
            <span className="purple">
              <Icon name="trend" />
            </span>
            <div>
              <small>{t.productivity}</small>
              <strong>{dashboard?.summary.productivityScore ?? 0}%</strong>
            </div>
          </article>
          <article>
            <span className="green">
              <Icon name="clock" />
            </span>
            <div>
              <small>{t.activeTime}</small>
              <strong>
                {duration(dashboard?.summary.activeSeconds ?? 0, ar)}
              </strong>
            </div>
          </article>
          <article>
            <span className="blue">
              <Icon name="sync" />
            </span>
            <div>
              <small>{t.lastSync}</small>
              <strong>{syncTime}</strong>
            </div>
          </article>
          <article>
            <span className={session.pendingEvents ? "orange" : "green"}>
              <Icon name="cloud" />
            </span>
            <div>
              <small>{t.pending}</small>
              <strong>{session.pendingEvents}</strong>
            </div>
          </article>
        </div>
        {error && (
          <div className="agent-error dashboard-error">
            <Icon name="alert" />
            <span>{error}</span>
            <button onClick={() => setError("")}>
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="agent-content-grid">
          <article className="agent-panel tasks-panel">
            <div className="agent-panel-head">
              <div>
                <span className="eyebrow">WORK ITEMS</span>
                <h2>{t.tasks}</h2>
              </div>
              <button
                className={remoteLoading ? "loading" : ""}
                onClick={() => void refreshRemote()}
                title={t.refresh}
              >
                <Icon name="sync" />
              </button>
            </div>
            {openTasks.length ? (
              <div className="agent-task-list">
                {openTasks.slice(0, 5).map((task) => (
                  <div key={task.id}>
                    <span
                      className={`task-priority-dot ${task.priority.toLowerCase()}`}
                    />
                    <div>
                      <strong>{task.title}</strong>
                      <small>
                        {task.deadline
                          ? new Intl.DateTimeFormat(ar ? "ar-SA" : "en", {
                              dateStyle: "medium",
                            }).format(new Date(task.deadline))
                          : ar
                            ? "بدون موعد"
                            : "No deadline"}{" "}
                        · {task.priority}
                      </small>
                      <div>
                        <i>
                          <b style={{ width: `${task.progress}%` }} />
                        </i>
                        <em>{task.progress}%</em>
                      </div>
                    </div>
                    <select
                      value={task.progress}
                      onChange={(event) =>
                        void updateProgress(task.id, Number(event.target.value))
                      }
                      aria-label={ar ? "تحديث التقدم" : "Update progress"}
                    >
                      {[0, 25, 50, 75, 100].map((value) => (
                        <option value={value} key={value}>
                          {value}%
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ) : (
              <div className="agent-empty">
                <Icon name="task" />
                <p>{t.noTasks}</p>
              </div>
            )}
          </article>
          <article className="agent-panel summary-panel">
            <div className="agent-panel-head">
              <div>
                <span className="eyebrow">PERSONAL ACTIVITY</span>
                <h2>{t.summary}</h2>
              </div>
            </div>
            <div className="summary-score">
              <div
                style={
                  {
                    "--score": `${(dashboard?.summary.productivityScore ?? 0) * 3.6}deg`,
                  } as React.CSSProperties
                }
              >
                <span>
                  <strong>{dashboard?.summary.productivityScore ?? 0}%</strong>
                  <small>{ar ? "إنتاجية" : "Productivity"}</small>
                </span>
              </div>
              <section>
                <span>
                  <i className="active" />
                  {ar ? "نشط" : "Active"}
                  <b>{duration(dashboard?.summary.activeSeconds ?? 0, ar)}</b>
                </span>
                <span>
                  <i className="idle" />
                  {ar ? "خامل" : "Idle"}
                  <b>{duration(dashboard?.summary.idleSeconds ?? 0, ar)}</b>
                </span>
                <span>
                  <i className="focus" />
                  {ar ? "تركيز" : "Focus"}
                  <b>{dashboard?.summary.focusScore ?? 0}%</b>
                </span>
              </section>
            </div>
            <div className="mini-trend">
              {trend.map((row, index) => (
                <div
                  key={`${row.date}-${index}`}
                  title={`${row.date}: ${row.productivityScore}%`}
                >
                  <i
                    style={{ height: `${Math.max(8, row.productivityScore)}%` }}
                  />
                  <span>{row.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </article>
        </div>
        <div className="privacy-strip">
          <Icon name="check" />
          <span>{t.privacy}</span>
        </div>
      </section>
      {settingsOpen && (
        <div className="agent-settings-layer">
          <button
            className="settings-scrim"
            onClick={() => setSettingsOpen(false)}
          />
          <aside>
            <div className="settings-head">
              <div>
                <span className="eyebrow">PREFERENCES</span>
                <h2>{t.settings}</h2>
              </div>
              <button onClick={() => setSettingsOpen(false)}>
                <Icon name="close" />
              </button>
            </div>
            <div className="agent-setting-row">
              <div>
                <strong>{ar ? "اللغة" : "Language"}</strong>
                <small>
                  {ar
                    ? "لغة واجهة هذا الجهاز"
                    : "Interface language for this device"}
                </small>
              </div>
              <button onClick={toggleLanguage}>
                <Icon name="globe" />
                {ar ? "العربية" : "English"}
              </button>
            </div>
            <div className="agent-setting-row">
              <div>
                <strong>{ar ? "المظهر" : "Theme"}</strong>
                <small>
                  {ar ? "فاتح أو داكن" : "Light or dark appearance"}
                </small>
              </div>
              <button onClick={toggleTheme}>
                <Icon name={theme === "dark" ? "sun" : "moon"} />
                {theme === "dark"
                  ? ar
                    ? "داكن"
                    : "Dark"
                  : ar
                    ? "فاتح"
                    : "Light"}
              </button>
            </div>
            <div className="agent-setting-row">
              <div>
                <strong>{t.connection}</strong>
                <small>
                  {sync.lastSuccessAt
                    ? new Intl.DateTimeFormat(ar ? "ar-SA" : "en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(sync.lastSuccessAt))
                    : "—"}
                </small>
              </div>
              <span
                className={`connection-pill ${sync.online ? "online" : "offline"}`}
              >
                <Icon name={sync.online ? "wifi" : "offline"} />
                {sync.online ? t.online : t.offline}
              </span>
            </div>
            <div className="settings-privacy">
              <Icon name="cloud" />
              <p>
                {ar
                  ? "البيانات غير المرسلة محفوظة محليًا بتشفير AES-256 حتى تنجح المزامنة."
                  : "Unsent data is stored locally with AES-256 encryption until synchronization succeeds."}
              </p>
            </div>
            <button className="agent-logout" onClick={() => void logout()}>
              <Icon name="logout" />
              {t.signout}
            </button>
            {session.status !== "IDLE" && (
              <small className="logout-hint">
                {ar
                  ? "أنهِ جلسة العمل قبل تسجيل الخروج."
                  : "End the work session before signing out."}
              </small>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
