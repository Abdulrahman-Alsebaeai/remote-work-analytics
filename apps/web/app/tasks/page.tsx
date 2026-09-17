"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { cachedApiFetch, invalidateApiCache } from "../../lib/client-api-cache";
import { messages, type Locale } from "../../lib/i18n";
import { Icon } from "../ui/icons";
import { ModalDialog } from "../ui/modal-dialog";
import { EmptyState, LoadingState } from "../ui/states";
import "./tasks.css";

type Employee = {
  id: string;
  displayName: string;
  email: string;
  role: string;
  status: string;
};
type Note = {
  id: string;
  content: string;
  createdAt: string;
  author: { displayName: string };
};
type Task = {
  id: string;
  title: string;
  description?: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED" | "CANCELLED";
  progress: number;
  deadline?: string | null;
  assigneeId: string;
  assignee: { id: string; displayName: string; email: string };
  notes: Note[];
  createdAt: string;
  updatedAt: string;
};
type StatusFilter = "ALL" | Task["status"];
type TaskEditor = { mode: "create" } | { mode: "edit"; task: Task };
const labels = {
  ar: {
    LOW: "منخفضة",
    MEDIUM: "متوسطة",
    HIGH: "عالية",
    URGENT: "عاجلة",
    TODO: "لم تبدأ",
    IN_PROGRESS: "قيد التنفيذ",
    BLOCKED: "متوقفة",
    COMPLETED: "مكتملة",
    CANCELLED: "ملغاة",
    ALL: "الكل",
  },
  en: {
    LOW: "Low",
    MEDIUM: "Medium",
    HIGH: "High",
    URGENT: "Urgent",
    TODO: "To do",
    IN_PROGRESS: "In progress",
    BLOCKED: "Blocked",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    ALL: "All",
  },
} as const;

export default function TasksPage() {
  const [locale, setLocale] = useState<Locale>("ar");
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [editor, setEditor] = useState<TaskEditor | null>(null);
  const [selected, setSelected] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const t = messages[locale];
  const ar = locale === "ar";
  const text = labels[locale];
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [tasksResponse, usersResponse] = await Promise.all([
        cachedApiFetch("/api/tasks"),
        cachedApiFetch("/api/users"),
      ]);
      if (tasksResponse.status === 401) return window.location.assign("/login");
      if (!tasksResponse.ok || !usersResponse.ok) throw new Error();
      const taskData = (await tasksResponse.json()) as Task[];
      setTasks(taskData);
      setEmployees(
        ((await usersResponse.json()) as Employee[]).filter(
          (user) => user.role === "EMPLOYEE" && user.status === "ACTIVE",
        ),
      );
      setSelected((current) =>
        current
          ? (taskData.find((task) => task.id === current.id) ?? null)
          : null,
      );
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    setLocale(localStorage.getItem("locale") === "en" ? "en" : "ar");
    void load();
  }, [load]);
  const filtered = useMemo(
    () =>
      (tasks ?? [])
        .filter((task) =>
          `${task.title} ${task.assignee.displayName}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .filter(
          (task) => statusFilter === "ALL" || task.status === statusFilter,
        )
        .filter(
          (task) =>
            priorityFilter === "ALL" || task.priority === priorityFilter,
        ),
    [tasks, query, statusFilter, priorityFilter],
  );
  const overdue = (tasks ?? []).filter(
    (task) =>
      task.deadline &&
      new Date(task.deadline) < new Date() &&
      !["COMPLETED", "CANCELLED"].includes(task.status),
  ).length;
  const completed = (tasks ?? []).filter(
    (task) => task.status === "COMPLETED",
  ).length;
  const inProgress = (tasks ?? []).filter(
    (task) => task.status === "IN_PROGRESS",
  ).length;
  const blocked = (tasks ?? []).filter(
    (task) => task.status === "BLOCKED",
  ).length;
  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setFailed(false);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (!values.deadline) delete values.deadline;
    const editingTask = editor.mode === "edit" ? editor.task : null;
    const body: Record<string, unknown> = editingTask
      ? {
          title: values.title,
          description: values.description,
          priority: values.priority,
          assigneeId: values.assigneeId,
          status: values.status,
          progress: Number(values.progress),
          ...(values.deadline ? { deadline: values.deadline } : {}),
        }
      : values;
    if (body.status === "COMPLETED") body.progress = 100;
    if (body.progress === 100) body.status = "COMPLETED";
    try {
      const response = await fetch(
        editingTask ? `/api/tasks/${editingTask.id}` : "/api/tasks",
        {
          method: editingTask ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error();
      invalidateApiCache("/api/tasks", "/api/analytics/dashboard");
      form.reset();
      setEditor(null);
      await load();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }
  function dateTimeLocal(value?: string | null) {
    if (!value) return "";
    const date = new Date(value);
    const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  }
  async function update(id: string, changes: Record<string, unknown>) {
    setFailed(false);
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error();
      invalidateApiCache("/api/tasks", "/api/analytics/dashboard");
      await load();
    } catch {
      setFailed(true);
    }
  }
  async function remove(id: string) {
    if (!window.confirm(ar ? "هل تريد حذف هذه المهمة؟" : "Delete this task?"))
      return;
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setFailed(true);
      return;
    }
    invalidateApiCache("/api/tasks", "/api/analytics/dashboard");
    setSelected(null);
    await load();
  }
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = event.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();
    if (!content) return;
    const response = await fetch(`/api/tasks/${selected.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) {
      setFailed(true);
      return;
    }
    invalidateApiCache("/api/tasks");
    form.reset();
    await load();
  }
  const statuses: StatusFilter[] = [
    "ALL",
    "TODO",
    "IN_PROGRESS",
    "BLOCKED",
    "COMPLETED",
    "CANCELLED",
  ];
  return (
    <main className="page-shell" dir={ar ? "rtl" : "ltr"}>
      <section className="wide-content tasks-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">WORKFLOW OPERATIONS</span>
            <h1>{t.tasks}</h1>
            <p>
              {ar
                ? "تابع عبء الفريق والتقدم والمواعيد من مساحة عمل واحدة."
                : "Track workload, progress, and deadlines from one workspace."}
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
            {t.addTask}
          </button>
        </div>
        {!tasks ? (
          <LoadingState cards={4} />
        ) : (
          <>
            <div className="task-summary">
              <article>
                <span className="purple">
                  <Icon name="briefcase" />
                </span>
                <div>
                  <strong>{tasks.length}</strong>
                  <small>{ar ? "إجمالي المهام" : "Total tasks"}</small>
                </div>
              </article>
              <article>
                <span className="blue">
                  <Icon name="activity" />
                </span>
                <div>
                  <strong>{inProgress}</strong>
                  <small>{ar ? "قيد التنفيذ" : "In progress"}</small>
                </div>
              </article>
              <article>
                <span className="green">
                  <Icon name="check" />
                </span>
                <div>
                  <strong>{completed}</strong>
                  <small>{ar ? "مكتملة" : "Completed"}</small>
                </div>
              </article>
              <article>
                <span className="orange">
                  <Icon name="calendar" />
                </span>
                <div>
                  <strong>{overdue}</strong>
                  <small>{ar ? "متأخرة" : "Overdue"}</small>
                </div>
              </article>
              <article>
                <span className="red">
                  <Icon name="alert" />
                </span>
                <div>
                  <strong>{blocked}</strong>
                  <small>{ar ? "متوقفة" : "Blocked"}</small>
                </div>
              </article>
            </div>
            <div className="task-filter-bar">
              <div className="task-search">
                <Icon name="search" size={17} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={
                    ar
                      ? "بحث في المهام أو الموظفين…"
                      : "Search tasks or employees…"
                  }
                />
              </div>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="ALL">
                  {ar ? "كل الأولويات" : "All priorities"}
                </option>
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map((value) => (
                  <option value={value} key={value}>
                    {text[value]}
                  </option>
                ))}
              </select>
              <span>
                {filtered.length} {ar ? "مهمة" : "tasks"}
              </span>
            </div>
            <div className="task-status-tabs">
              {statuses.map((value) => (
                <button
                  className={statusFilter === value ? "active" : ""}
                  onClick={() => setStatusFilter(value)}
                  key={value}
                >
                  {text[value]}
                  <span>
                    {value === "ALL"
                      ? tasks.length
                      : tasks.filter((task) => task.status === value).length}
                  </span>
                </button>
              ))}
            </div>
            {failed && (
              <div className="inline-error">
                <Icon name="alert" />
                {t.error}
              </div>
            )}
            {filtered.length ? (
              <div className="task-table-wrap">
                <table className="premium-task-table">
                  <thead>
                    <tr>
                      <th>{t.taskTitle}</th>
                      <th>{t.assignee}</th>
                      <th>{t.priority}</th>
                      <th>{t.status}</th>
                      <th>{t.progress}</th>
                      <th>{t.deadline}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((task) => {
                      const isOverdue =
                        task.deadline &&
                        new Date(task.deadline) < new Date() &&
                        !["COMPLETED", "CANCELLED"].includes(task.status);
                      return (
                        <tr key={task.id}>
                          <td>
                            <button
                              className="task-title-button"
                              onClick={() => setSelected(task)}
                            >
                              <span
                                className={`priority-mark ${task.priority.toLowerCase()}`}
                              />
                              <span>
                                <strong>{task.title}</strong>
                                <small>
                                  {task.description ||
                                    (ar ? "بدون وصف" : "No description")}
                                </small>
                              </span>
                            </button>
                          </td>
                          <td>
                            <div className="assignee-cell">
                              <span><Icon name="user" size={17} /></span>
                              <select
                                value={task.assigneeId}
                                onChange={(event) =>
                                  void update(task.id, {
                                    assigneeId: event.target.value,
                                  })
                                }
                              >
                                {employees.map((employee) => (
                                  <option value={employee.id} key={employee.id}>
                                    {employee.displayName}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td>
                            <select
                              className={`table-select priority-${task.priority.toLowerCase()}`}
                              value={task.priority}
                              onChange={(event) =>
                                void update(task.id, {
                                  priority: event.target.value,
                                })
                              }
                            >
                              {(
                                ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
                              ).map((value) => (
                                <option value={value} key={value}>
                                  {text[value]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="table-select"
                              value={task.status}
                              onChange={(event) =>
                                void update(task.id, {
                                  status: event.target.value,
                                  ...(event.target.value === "COMPLETED"
                                    ? { progress: 100 }
                                    : {}),
                                })
                              }
                            >
                              {(
                                [
                                  "TODO",
                                  "IN_PROGRESS",
                                  "BLOCKED",
                                  "COMPLETED",
                                  "CANCELLED",
                                ] as const
                              ).map((value) => (
                                <option value={value} key={value}>
                                  {text[value]}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <div className="premium-progress">
                              <div>
                                <span style={{ width: `${task.progress}%` }} />
                              </div>
                              <b>{task.progress}%</b>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`deadline-value ${isOverdue ? "overdue" : ""}`}
                            >
                              {task.deadline
                                ? new Intl.DateTimeFormat(locale, {
                                    dateStyle: "medium",
                                  }).format(new Date(task.deadline))
                                : "—"}
                              {isOverdue && (
                                <small>{ar ? "متأخرة" : "Overdue"}</small>
                              )}
                            </span>
                          </td>
                          <td>
                            <button
                              className="row-menu"
                              onClick={() => setSelected(task)}
                            >
                              <Icon name="chevron" size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title={t.noTasks}
                description={
                  ar
                    ? "لا توجد مهام مطابقة للفلاتر الحالية."
                    : "No tasks match the current filters."
                }
              />
            )}
          </>
        )}
        <ModalDialog
          open={Boolean(editor)}
          onClose={() => {
            if (!saving) setEditor(null);
          }}
          eyebrow={editor?.mode === "edit" ? "WORK ITEM" : "NEW WORK ITEM"}
          title={
            editor?.mode === "edit"
              ? ar
                ? "تعديل المهمة"
                : "Edit task"
              : t.addTask
          }
          description={
            editor?.mode === "edit"
              ? ar
                ? "حدّث تفاصيل المهمة والتقدم والمسؤول عنها."
                : "Update task details, progress, and ownership."
              : ar
                ? "حدّد المطلوب والموظف والأولوية والموعد بوضوح."
                : "Define the outcome, owner, priority, and deadline."
          }
          closeLabel={ar ? "إغلاق" : "Close"}
          className="task-editor-dialog"
        >
          {editor && (
            <form
              className="app-dialog-form"
              key={editor.mode === "edit" ? editor.task.id : "new-task"}
              onSubmit={saveTask}
            >
              <label>
                {t.taskTitle}
                <input
                  name="title"
                  minLength={2}
                  required
                  autoFocus
                  defaultValue={editor.mode === "edit" ? editor.task.title : ""}
                />
              </label>
              <label>
                {ar ? "الوصف" : "Description"}
                <textarea
                  name="description"
                  rows={4}
                  defaultValue={
                    editor.mode === "edit" ? editor.task.description ?? "" : ""
                  }
                  placeholder={
                    ar
                      ? "تفاصيل المهمة والنتيجة المتوقعة…"
                      : "Task details and expected outcome…"
                  }
                />
              </label>
              <div className="app-dialog-form-grid">
                <label>
                  {t.assignee}
                  <select
                    name="assigneeId"
                    required
                    defaultValue={
                      editor.mode === "edit" ? editor.task.assigneeId : ""
                    }
                  >
                    <option value="">—</option>
                    {editor.mode === "edit" &&
                      !employees.some(
                        (employee) => employee.id === editor.task.assigneeId,
                      ) && (
                        <option value={editor.task.assigneeId}>
                          {editor.task.assignee.displayName}
                        </option>
                      )}
                    {employees.map((employee) => (
                      <option value={employee.id} key={employee.id}>
                        {employee.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.priority}
                  <select
                    name="priority"
                    defaultValue={
                      editor.mode === "edit" ? editor.task.priority : "MEDIUM"
                    }
                  >
                    {(["LOW", "MEDIUM", "HIGH", "URGENT"] as const).map(
                      (value) => (
                        <option value={value} key={value}>
                          {text[value]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div className="app-dialog-form-grid">
                <label>
                  {t.deadline}
                  <input
                    name="deadline"
                    type="datetime-local"
                    defaultValue={
                      editor.mode === "edit"
                        ? dateTimeLocal(editor.task.deadline)
                        : ""
                    }
                  />
                </label>
                {editor.mode === "edit" && (
                  <label>
                    {t.status}
                    <select name="status" defaultValue={editor.task.status}>
                      {(
                        [
                          "TODO",
                          "IN_PROGRESS",
                          "BLOCKED",
                          "COMPLETED",
                          "CANCELLED",
                        ] as const
                      ).map((value) => (
                        <option value={value} key={value}>
                          {text[value]}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {editor.mode === "edit" && (
                <label>
                  {t.progress}
                  <div className="task-progress-field">
                    <input
                      name="progress"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      defaultValue={editor.task.progress}
                      required
                    />
                    <span>%</span>
                  </div>
                </label>
              )}
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
        {selected && (
          <div className="drawer-layer">
            <button
              className="drawer-scrim"
              onClick={() => setSelected(null)}
              aria-label="Close"
            />
            <aside className="form-drawer task-detail-drawer">
              <div className="drawer-head">
                <div>
                  <span
                    className={`task-priority ${selected.priority.toLowerCase()}`}
                  >
                    {text[selected.priority]}
                  </span>
                  <h2>{selected.title}</h2>
                  <p>
                    {selected.description ||
                      (ar
                        ? "لا يوجد وصف لهذه المهمة."
                        : "No description for this task.")}
                  </p>
                </div>
                <button onClick={() => setSelected(null)}>
                  <Icon name="close" />
                </button>
              </div>
              <div className="task-detail-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setEditor({ mode: "edit", task: selected });
                    setSelected(null);
                    setFailed(false);
                  }}
                >
                  <Icon name="settings" size={16} />
                  {ar ? "تعديل المهمة" : "Edit task"}
                </button>
              </div>
              <div className="task-detail-meta">
                <div>
                  <small>{t.assignee}</small>
                  <strong>{selected.assignee.displayName}</strong>
                </div>
                <div>
                  <small>{t.status}</small>
                  <strong>{text[selected.status]}</strong>
                </div>
                <div>
                  <small>{t.deadline}</small>
                  <strong>
                    {selected.deadline
                      ? new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                        }).format(new Date(selected.deadline))
                      : "—"}
                  </strong>
                </div>
                <div>
                  <small>{t.progress}</small>
                  <strong>{selected.progress}%</strong>
                </div>
              </div>
              <div className="detail-progress-editor">
                <label>
                  {t.progress}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    defaultValue={selected.progress}
                    onMouseUp={(event) =>
                      void update(selected.id, {
                        progress: Number(event.currentTarget.value),
                      })
                    }
                    onTouchEnd={(event) =>
                      void update(selected.id, {
                        progress: Number(event.currentTarget.value),
                      })
                    }
                  />
                </label>
                <div>
                  <span style={{ width: `${selected.progress}%` }} />
                </div>
              </div>
              <section className="task-notes">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">COLLABORATION</span>
                    <h3>{ar ? "الملاحظات" : "Notes"}</h3>
                  </div>
                  <span>{selected.notes.length}</span>
                </div>
                <div className="notes-list">
                  {selected.notes.length ? (
                    selected.notes.map((note) => (
                      <article key={note.id}>
                        <span>
                          {note.author.displayName.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <strong>{note.author.displayName}</strong>
                          <p>{note.content}</p>
                          <small>
                            {new Intl.DateTimeFormat(locale, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(note.createdAt))}
                          </small>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="no-notes">
                      {ar ? "لا توجد ملاحظات حتى الآن." : "No notes yet."}
                    </p>
                  )}
                </div>
                <form onSubmit={addNote}>
                  <textarea
                    name="content"
                    rows={3}
                    required
                    placeholder={ar ? "اكتب ملاحظة…" : "Write a note…"}
                  />
                  <button>{ar ? "إضافة ملاحظة" : "Add note"}</button>
                </form>
              </section>
              <button
                className="delete-task-button"
                onClick={() => void remove(selected.id)}
              >
                <Icon name="close" size={15} />
                {t.remove}
              </button>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
