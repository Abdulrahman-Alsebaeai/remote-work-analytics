"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { cachedApiFetch, invalidateApiCache } from "../../lib/client-api-cache";
import { messages, type Locale } from "../../lib/i18n";
import { Icon } from "../ui/icons";
import { ModalDialog } from "../ui/modal-dialog";
import { EmptyState, LoadingState } from "../ui/states";
import "./users.css";

type User = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};
type Ranking = {
  employeeId: string;
  productivityScore: number;
  focusScore: number;
  trackedSeconds: number;
  activeSeconds: number;
  idleSeconds: number;
};
type Analytics = {
  summary: { productivityScore: number; focusScore: number };
  ranking: Ranking[];
};
type Task = {
  id: string;
  status: string;
  deadline?: string | null;
  assigneeId: string;
};
type Filter = "all" | "attention" | "active" | "suspended";
type UserEditor = { mode: "create" } | { mode: "edit"; user: User };
type UserActionMenu = {
  user: User;
  top: number;
  left: number;
};
const duration = (seconds: number, ar: boolean) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return ar ? `${h}س ${m}د` : `${h}h ${m}m`;
};

export default function UsersPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [users, setUsers] = useState<User[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [failed, setFailed] = useState(false);
  const [editor, setEditor] = useState<UserEditor | null>(null);
  const [actionMenu, setActionMenu] = useState<UserActionMenu | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [saving, setSaving] = useState(false);
  const t = messages[locale];
  const ar = locale === "ar";
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [userResponse, analyticsResponse, tasksResponse] =
        await Promise.all([
          cachedApiFetch("/api/users"),
          cachedApiFetch("/api/analytics/dashboard"),
          cachedApiFetch("/api/tasks"),
        ]);
      if (
        [userResponse, analyticsResponse, tasksResponse].some(
          (response) => response.status === 401,
        )
      )
        return window.location.assign("/login");
      if (!userResponse.ok || !analyticsResponse.ok || !tasksResponse.ok)
        throw new Error();
      const [userData, analyticsData, taskData] = await Promise.all([
        userResponse.json(),
        analyticsResponse.json(),
        tasksResponse.json(),
      ]);
      setUsers(userData);
      setAnalytics(analyticsData);
      setTasks(taskData);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    setLocale(localStorage.getItem("locale") === "en" ? "en" : "ar");
    void load();
  }, [load]);
  useEffect(() => {
    if (!actionMenu) return;
    const closeMenu = () => setActionMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionMenu]);
  const rows = useMemo(() => {
    const ranking = new Map(
      (analytics?.ranking ?? []).map((item) => [item.employeeId, item]),
    );
    return (users ?? [])
      .filter((user) => user.role === "EMPLOYEE")
      .map((user) => {
        const stats = ranking.get(user.id);
        const employeeTasks = tasks.filter(
          (task) => task.assigneeId === user.id,
        );
        const overdue = employeeTasks.filter(
          (task) =>
            task.deadline &&
            new Date(task.deadline) < new Date() &&
            !["COMPLETED", "CANCELLED"].includes(task.status),
        ).length;
        const attention =
          Boolean(
            stats &&
            (stats.productivityScore < 60 ||
              (stats.trackedSeconds > 0 &&
                stats.idleSeconds / stats.trackedSeconds > 0.3)),
          ) || overdue > 0;
        return {
          user,
          stats,
          totalTasks: employeeTasks.length,
          completed: employeeTasks.filter((task) => task.status === "COMPLETED")
            .length,
          overdue,
          attention,
        };
      })
      .filter((row) =>
        `${row.user.displayName} ${row.user.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
      .filter(
        (row) =>
          filter === "all" ||
          (filter === "attention" && row.attention) ||
          (filter === "active" && row.user.status === "ACTIVE") ||
          (filter === "suspended" && row.user.status !== "ACTIVE"),
      );
  }, [users, analytics, tasks, query, filter]);
  const employees = (users ?? []).filter((user) => user.role === "EMPLOYEE");
  const attentionCount = rows.filter((row) => row.attention).length;
  const activeCount = employees.filter(
    (user) => user.status === "ACTIVE",
  ).length;
  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFailed(false);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const editingUser = editor.mode === "edit" ? editor.user : null;
    const body = editingUser
      ? {
          displayName: values.displayName,
          role: values.role,
          status: values.status,
        }
      : values;
    try {
      const response = await fetch(
        editingUser ? `/api/users/${editingUser.id}` : "/api/users",
        {
        method: editingUser ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error();
      invalidateApiCache("/api/users", "/api/analytics/dashboard");
      form.reset();
      setEditor(null);
      await load();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  async function toggleStatus(user: User) {
    setActionMenu(null);
    setFailed(false);
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
        }),
      });
      if (!response.ok) throw new Error();
      invalidateApiCache("/api/users", "/api/analytics/dashboard");
      await load();
    } catch {
      setFailed(true);
    }
  }
  function openActionMenu(
    event: React.MouseEvent<HTMLButtonElement>,
    user: User,
  ) {
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const preferredLeft = ar ? rect.left : rect.right - menuWidth;
    setActionMenu({
      user,
      top: Math.min(rect.bottom + 7, window.innerHeight - 180),
      left: Math.min(
        Math.max(12, preferredLeft),
        window.innerWidth - menuWidth - 12,
      ),
    });
  }
  return (
    <main className="page-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="wide-content employees-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">PEOPLE INTELLIGENCE</span>
            <h1>{t.users}</h1>
            <p>
              {ar
                ? "فريقك في مكان واحد مع مؤشرات الأداء والمهام التي تحتاج تدخلًا."
                : "Your team in one place, enriched with performance and task signals."}
            </p>
          </div>
          <button
            className="primary-action"
            onClick={() => {
              setFailed(false);
              setEditor({ mode: "create" });
            }}
          >
            <Icon name="plus" size={17} />
            {t.add}
          </button>
        </div>
        {!users ? (
          <LoadingState cards={4} />
        ) : (
          <>
            <div className="people-summary">
              <article>
                <span>
                  <Icon name="users" />
                </span>
                <div>
                  <strong>{employees.length}</strong>
                  <small>{ar ? "إجمالي الموظفين" : "Total employees"}</small>
                </div>
              </article>
              <article>
                <span className="green">
                  <Icon name="check" />
                </span>
                <div>
                  <strong>{activeCount}</strong>
                  <small>{ar ? "حسابات مفعلة" : "Active accounts"}</small>
                </div>
              </article>
              <article>
                <span className="purple">
                  <Icon name="trend" />
                </span>
                <div>
                  <strong>{analytics?.summary.productivityScore ?? 0}%</strong>
                  <small>
                    {ar ? "متوسط الإنتاجية" : "Average productivity"}
                  </small>
                </div>
              </article>
              <article>
                <span className="orange">
                  <Icon name="alert" />
                </span>
                <div>
                  <strong>{attentionCount}</strong>
                  <small>{ar ? "تحتاج متابعة" : "Need attention"}</small>
                </div>
              </article>
            </div>
            <div className="people-toolbar">
              <div className="people-search">
                <Icon name="search" size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    ar
                      ? "ابحث باسم الموظف أو البريد…"
                      : "Search employee or email…"
                  }
                />
              </div>
              <div className="people-filters">
                {(
                  [
                    ["all", ar ? "الكل" : "All"],
                    ["active", ar ? "مفعّل" : "Active"],
                    ["attention", ar ? "يحتاج متابعة" : "Attention"],
                    ["suspended", ar ? "موقوف" : "Suspended"],
                  ] as Array<[Filter, string]>
                ).map(([key, label]) => (
                  <button
                    className={filter === key ? "active" : ""}
                    onClick={() => setFilter(key)}
                    key={key}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span>
                {rows.length} {ar ? "موظف" : "employees"}
              </span>
            </div>
            {failed && (
              <div className="inline-error">
                <Icon name="alert" />
                {t.error}
              </div>
            )}
            {rows.length ? (
              <div className="people-table-wrap">
                <table className="people-table">
                  <thead>
                    <tr>
                      <th>{ar ? "الموظف" : "Employee"}</th>
                      <th>{t.status}</th>
                      <th>{t.productivity}</th>
                      <th>{t.focus}</th>
                      <th>{t.activeTime}</th>
                      <th>{t.tasks}</th>
                      <th>{ar ? "الإشارة" : "Signal"}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(
                      ({
                        user,
                        stats,
                        totalTasks,
                        completed,
                        overdue,
                        attention,
                      }) => (
                        <tr key={user.id}>
                          <td>
                            <Link
                              className="employee-identity"
                              href={`/users/${user.id}`}
                            >
                              <span><Icon name="user" size={19} /></span>
                              <span>
                                <strong>{user.displayName}</strong>
                                <small>{user.email}</small>
                              </span>
                            </Link>
                          </td>
                          <td>
                            <span
                              className={`status-chip ${user.status === "ACTIVE" ? "success" : "danger"}`}
                            >
                              <i />
                              {user.status === "ACTIVE"
                                ? ar
                                  ? "مفعّل"
                                  : "Active"
                                : ar
                                  ? "موقوف"
                                  : "Suspended"}
                            </span>
                          </td>
                          <td>
                            <div className="score-cell">
                              <strong>{stats?.productivityScore ?? 0}%</strong>
                              <i>
                                <span
                                  style={{
                                    width: `${stats?.productivityScore ?? 0}%`,
                                  }}
                                />
                              </i>
                            </div>
                          </td>
                          <td>
                            <div className="score-cell blue">
                              <strong>{stats?.focusScore ?? 0}%</strong>
                              <i>
                                <span
                                  style={{
                                    width: `${stats?.focusScore ?? 0}%`,
                                  }}
                                />
                              </i>
                            </div>
                          </td>
                          <td>
                            <strong className="time-value">
                              {duration(stats?.activeSeconds ?? 0, ar)}
                            </strong>
                          </td>
                          <td>
                            <div className="task-cell">
                              <strong>
                                {completed}/{totalTasks}
                              </strong>
                              {overdue > 0 && (
                                <small>
                                  {overdue} {ar ? "متأخرة" : "overdue"}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            {attention ? (
                              <span className="status-chip warning">
                                <Icon name="alert" size={12} />
                                {ar ? "مراجعة" : "Review"}
                              </span>
                            ) : (
                              <span className="status-chip success">
                                <Icon name="check" size={12} />
                                {ar ? "طبيعي" : "Healthy"}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="employee-menu-trigger"
                                onClick={(event) => openActionMenu(event, user)}
                                aria-label={
                                  ar ? "إجراءات الموظف" : "Employee actions"
                                }
                                aria-haspopup="menu"
                                aria-expanded={actionMenu?.user.id === user.id}
                              >
                                <span aria-hidden="true">•••</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title={ar ? "لا توجد نتائج مطابقة" : "No matching employees"}
                description={
                  ar
                    ? "جرّب تغيير البحث أو الفلتر الحالي."
                    : "Try changing the current search or filter."
                }
              />
            )}
          </>
        )}
        {actionMenu && (
          <>
            <button
              type="button"
              className="employee-menu-scrim"
              onClick={() => setActionMenu(null)}
              aria-label={ar ? "إغلاق قائمة الإجراءات" : "Close actions menu"}
            />
            <div
              className="employee-actions-popover"
              role="menu"
              style={{ top: actionMenu.top, left: actionMenu.left }}
            >
              <Link
                href={`/users/${actionMenu.user.id}`}
                role="menuitem"
                onClick={() => setActionMenu(null)}
              >
                <Icon name="eye" size={17} />
                {t.details}
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => void toggleStatus(actionMenu.user)}
              >
                <Icon
                  name={actionMenu.user.status === "ACTIVE" ? "close" : "check"}
                  size={17}
                />
                {actionMenu.user.status === "ACTIVE" ? t.suspend : t.activate}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setEditor({ mode: "edit", user: actionMenu.user });
                  setActionMenu(null);
                  setFailed(false);
                }}
              >
                <Icon name="settings" size={17} />
                {ar ? "تعديل" : "Edit"}
              </button>
            </div>
          </>
        )}
        <ModalDialog
          open={Boolean(editor)}
          onClose={() => {
            if (!saving) setEditor(null);
          }}
          eyebrow={editor?.mode === "edit" ? "TEAM MEMBER" : "NEW TEAM MEMBER"}
          title={editor?.mode === "edit" ? (ar ? "تعديل الموظف" : "Edit employee") : t.add}
          description={
            editor?.mode === "edit"
              ? ar
                ? "حدّث بيانات الموظف وحالة وصوله إلى النظام."
                : "Update employee details and access status."
              : ar
                ? "أنشئ حساب الموظف وأرسل له بيانات الدخول بشكل آمن."
                : "Create the employee account and share credentials securely."
          }
          closeLabel={ar ? "إغلاق" : "Close"}
        >
          {editor && (
            <form
              className="app-dialog-form"
              key={editor.mode === "edit" ? editor.user.id : "new-user"}
              onSubmit={saveUser}
            >
              <div className="app-dialog-form-grid">
                <label>
                  {t.name}
                  <input
                    name="displayName"
                    minLength={2}
                    required
                    autoFocus
                    defaultValue={editor.mode === "edit" ? editor.user.displayName : ""}
                    placeholder={ar ? "مثال: عبدالله ناصر" : "e.g. Abdullah Nasser"}
                  />
                </label>
                <label>
                  {t.email}
                  <input
                    name="email"
                    type="email"
                    required={editor.mode === "create"}
                    disabled={editor.mode === "edit"}
                    defaultValue={editor.mode === "edit" ? editor.user.email : ""}
                    placeholder="name@company.com"
                  />
                </label>
              </div>
              {editor.mode === "create" && (
                <label>
                  {t.password}
                  <input
                    name="password"
                    type="password"
                    minLength={12}
                    required
                    placeholder="••••••••••••"
                  />
                  <small>{ar ? "12 حرفًا على الأقل." : "At least 12 characters."}</small>
                </label>
              )}
              <div className="app-dialog-form-grid">
                <label>
                  {t.role}
                  <select
                    name="role"
                    defaultValue={editor.mode === "edit" ? editor.user.role : "EMPLOYEE"}
                  >
                    <option value="EMPLOYEE">EMPLOYEE</option>
                    <option value="MANAGER">MANAGER</option>
                  </select>
                </label>
                {editor.mode === "edit" && (
                  <label>
                    {t.status}
                    <select name="status" defaultValue={editor.user.status}>
                      <option value="ACTIVE">{ar ? "مفعّل" : "Active"}</option>
                      <option value="SUSPENDED">{ar ? "موقوف" : "Suspended"}</option>
                    </select>
                  </label>
                )}
              </div>
              {failed && <p className="error">{t.error}</p>}
              <div className="app-dialog-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setEditor(null)}
                  disabled={saving}
                >
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button type="submit" className="primary-action" disabled={saving}>
                  {saving ? (ar ? "جارٍ الحفظ…" : "Saving…") : t.save}
                </button>
              </div>
            </form>
          )}
        </ModalDialog>
      </section>
    </main>
  );
}
