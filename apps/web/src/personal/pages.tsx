"use client";
import React, { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Search,
  Send,
  ShieldCheck,
  Monitor,
  HelpCircle,
  BookOpen,
  ExternalLink,
  Download,
} from "lucide-react";
import { SupportThread, ticketStatus } from "../admin/operations";
import { PageHead } from "../app";
import {
  api,
  useApi,
  useSession,
  Row,
  State,
  Empty,
  Badge,
  Dialog,
  Form,
  Field,
  Progress,
  date,
  time,
  localDate,
  iso,
  val,
  statusLabel,
  initials,
} from "../lib";
export function GlobalPage({ page }: { page: string }) {
  switch (page) {
    case "calendar":
      return <Calendar />;
    case "tasks":
      return <Tasks />;
    case "notifications":
      return <Notifications />;
    case "messages":
      return <Messages />;
    case "progress":
      return <LearningProgress />;
    case "profile":
      return <Profile />;
    case "search":
      return <SearchPage />;
    case "help":
      return <Help />;
    default:
      return (
        <Empty
          text="Không tìm thấy trang"
          detail="Chọn một mục trong menu để tiếp tục."
        />
      );
  }
}
function Tasks() {
  const { data, loading, error } = useApi("/tasks");
  const [filter, setFilter] = useState("pending");
  const list = (data || []).filter(
    (t: Row) =>
      filter === "all" ||
      (filter === "pending" ? !t.submitted_at : !!t.submitted_at),
  );
  return (
    <>
      <PageHead
        title="Công việc của bạn"
        subtitle="Tập trung vào điều cần làm tiếp theo."
      />
      <div className="toolbar">
        <div className="tab-pills">
          {[
            ["pending", "Cần hoàn thành"],
            ["done", "Đã nộp"],
            ["all", "Tất cả"],
          ].map(([key, label]) => (
            <button
              className={filter === key ? "active" : ""}
              key={key}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <State loading={loading} error={error} empty={!list.length}>
        <div className="panel">
          {list.map((t: Row) => (
            <Link
              key={t.id}
              className="deadline-row"
              href={`/courses/${t.section_id}?tab=assignments`}
            >
              <span className="activity-icon">
                <BookOpen size={22} />
              </span>
              <span>
                <strong>{t.title}</strong>
                <small>
                  {t.course} · {t.section}
                </small>
              </span>
              <Badge
                tone={
                  t.submitted_at
                    ? "green"
                    : new Date(t.due_at) < new Date()
                      ? "wine"
                      : "gold"
                }
              >
                {t.submitted_at ? "Đã nộp" : date(t.due_at, true)}
              </Badge>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      </State>
    </>
  );
}
function Notifications() {
  const { data, loading, error } = useApi("/notifications"),
    { refresh, toast } = useSession();
  return (
    <>
      <PageHead
        title="Thông báo"
        subtitle="Những cập nhật quan trọng trong hành trình học tập."
        action={
          <button
            className="button"
            onClick={async () => {
              try {
                await api("/notifications/read", "POST", {});
                refresh();
                toast("Đã đánh dấu tất cả là đã đọc.");
              } catch (e: any) {
                toast(e.message);
              }
            }}
          >
            <CheckCheck size={17} />
            Đọc tất cả
          </button>
        }
      />
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="panel notification-list">
          {(data || []).map((n: Row) => (
            <Link
              key={n.id}
              className={`notification ${n.read_at ? "read" : ""}`}
              href={n.href}
              onClick={() =>
                api("/notifications/read", "POST", { id: n.id })
                  .then(refresh)
                  .catch(() => {})
              }
            >
              <span className="stat-icon wine">
                <Bell size={19} />
              </span>
              <span>
                <strong>{n.title}</strong>
                <p>{n.content}</p>
                <small>{date(n.created_at, true)}</small>
              </span>
              {!n.read_at && <span className="notice-dot" />}
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      </State>
    </>
  );
}
function Calendar() {
  const [view, setView] = useState("month"),
    [cursor, setCursor] = useState(new Date()),
    [open, setOpen] = useState(false),
    { refresh, toast } = useSession();
  const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1),
    to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 7, 23, 59);
  const { data, loading, error } = useApi(
    `/calendar?from=${encodeURIComponent(new Date(from.getTime() - 7 * 86400000).toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
  );
  const days = Array.from(
    { length: 42 },
    (_, i) =>
      new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        1 - ((from.getDay() + 6) % 7) + i,
      ),
  );
  const dayKey = (v: any) => localDate(new Date(v)).slice(0, 10);
  const selectedKey = dayKey(cursor);
  const events = (data || []).filter((e: Row) =>
    view === "day"
      ? dayKey(e.starts_at) === selectedKey
      : view === "week"
        ? (() => {
            const start = new Date(cursor);
            start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            return (
              new Date(e.starts_at) >= start && new Date(e.starts_at) < end
            );
          })()
        : true,
  );
  return (
    <>
      <PageHead
        title="Lịch học"
        subtitle="Thời khóa biểu, thời hạn và các buổi học trực tuyến."
        action={
          <button className="button primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Nhắc việc cá nhân
          </button>
        }
      />
      <section className="panel calendar-panel">
        <div className="toolbar">
          <div className="actions">
            <button
              className="icon-button"
              aria-label="Tháng trước"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
                )
              }
            >
              <ChevronLeft />
            </button>
            <h2>
              Tháng {cursor.getMonth() + 1}, {cursor.getFullYear()}
            </h2>
            <button
              className="icon-button"
              aria-label="Tháng sau"
              onClick={() =>
                setCursor(
                  new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
                )
              }
            >
              <ChevronRight />
            </button>
            <button className="button" onClick={() => setCursor(new Date())}>
              Hôm nay
            </button>
          </div>
          <div className="tab-pills">
            {[
              ["month", "Tháng"],
              ["week", "Tuần"],
              ["day", "Ngày"],
              ["agenda", "Lịch biểu"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={view === key ? "active" : ""}
                onClick={() => setView(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <State loading={loading} error={error}>
          {view === "month" ? (
            <div className="calendar-grid">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                <strong className="calendar-weekday" key={d}>
                  {d}
                </strong>
              ))}
              {days.map((d) => (
                <div
                  key={d.toISOString()}
                  className={`calendar-cell ${d.getMonth() !== cursor.getMonth() ? "other-month" : ""} ${dayKey(d) === dayKey(new Date()) ? "today" : ""}`}
                >
                  <button
                    aria-label={`Xem ngày ${date(d)}`}
                    onClick={() => {
                      setCursor(d);
                      setView("day");
                    }}
                  >
                    {d.getDate()}
                  </button>
                  {(data || [])
                    .filter((e: Row) => dayKey(e.starts_at) === dayKey(d))
                    .map((e: Row) => (
                      <Link
                        href={
                          e.section_id
                            ? `/courses/${e.section_id}?tab=${e.kind === "TEAMS" ? "teams" : e.kind === "ASSIGNMENT" ? "assignments" : "overview"}`
                            : "#"
                        }
                        key={e.id}
                        className={`calendar-event ${e.kind === "ASSIGNMENT" ? "gold" : ""}`}
                        title={e.title}
                      >
                        {time(e.starts_at)} {e.title}
                      </Link>
                    ))}
                </div>
              ))}
            </div>
          ) : events.length ? (
            <div className="agenda">
              {events.map((e: Row) => (
                <div className="agenda-row" key={e.id}>
                  <span className="date-block">
                    <strong>{new Date(e.starts_at).getDate()}</strong>
                    <small>{time(e.starts_at)}</small>
                  </span>
                  <div>
                    <Badge>
                      {(
                        {
                          ASSIGNMENT: "Hạn nộp bài",
                          TIMETABLE: "Lịch học",
                          TEAMS: "Teams",
                          REMINDER: "Nhắc việc",
                        } as any
                      )[e.kind] || e.kind}
                    </Badge>
                    <h3>{e.title}</h3>
                    <p>
                      {date(e.starts_at, true)} ·{" "}
                      {e.location || e.section || "Cá nhân"}
                    </p>
                  </div>
                  {e.join_url && (
                    <a
                      className="button"
                      href={e.join_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Tham gia Teams
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Empty
              text="Không có sự kiện trong khoảng thời gian này"
              detail="Bạn có thể thêm lời nhắc cá nhân."
            />
          )}
        </State>
      </section>
      {open && (
        <Dialog title="Thêm nhắc việc cá nhân" onClose={() => setOpen(false)}>
          <Form
            onSubmit={async (f) => {
              await api("/calendar", "POST", {
                title: val(f, "title"),
                starts_at: iso(f.get("starts_at")),
                ends_at: iso(f.get("ends_at")),
              });
              setOpen(false);
              refresh();
              toast("Đã lưu nhắc việc.");
            }}
          >
            <Field name="title" label="Nội dung nhắc việc" />
            <Field
              name="starts_at"
              label="Bắt đầu (giờ Việt Nam)"
              type="datetime-local"
            />
            <Field
              name="ends_at"
              label="Kết thúc (giờ Việt Nam)"
              type="datetime-local"
            />
          </Form>
        </Dialog>
      )}
    </>
  );
}
function Messages() {
  const contacts = useApi("/contacts"),
    messages = useApi("/messages"),
    { me, refresh, toast } = useSession();
  const [selected, setSelected] = useState("");
  const id = selected || contacts.data?.[0]?.id;
  const thread = (messages.data || [])
    .filter((m: Row) => m.sender_id === id || m.recipient_id === id)
    .reverse();
  return (
    <>
      <PageHead
        title="Tin nhắn"
        subtitle="Kết nối với giảng viên và bạn học trong lớp."
      />
      <div className="messages-layout panel">
        <aside>
          <h3>Liên hệ</h3>
          <State
            loading={contacts.loading}
            error={contacts.error}
            empty={!contacts.data?.length}
          >
            {(contacts.data || []).map((c: Row) => (
              <button
                className={`contact ${id === c.id ? "active" : ""}`}
                key={c.id}
                onClick={() => setSelected(c.id)}
              >
                <span className="avatar">{initials(c.name)}</span>
                {c.name}
              </button>
            ))}
          </State>
        </aside>
        <section>
          <div className="chat-title">
            <h3>
              {contacts.data?.find((c: Row) => c.id === id)?.name ||
                "Chọn một liên hệ"}
            </h3>
            <Badge tone="green">Nội bộ học phần</Badge>
          </div>
          <div className="chat-history">
            <State
              loading={messages.loading}
              error={messages.error}
              empty={!thread.length}
            >
              {thread.map((m: Row) => (
                <div
                  className={`chat-message ${m.sender_id === me.id ? "mine" : ""}`}
                  key={m.id}
                >
                  <p>{m.content}</p>
                  <small>{date(m.created_at, true)}</small>
                </div>
              ))}
            </State>
          </div>
          {id && (
            <Form
              label="Gửi tin nhắn"
              onSubmit={async (f) => {
                await api("/messages", "POST", {
                  recipient_id: id,
                  content: val(f, "content"),
                });
                refresh();
                toast("Đã gửi tin nhắn.");
              }}
            >
              <Field name="content" label="Tin nhắn" type="textarea" rows={3} />
            </Form>
          )}
        </section>
      </div>
    </>
  );
}
function LearningProgress() {
  const { data, loading, error } = useApi("/courses");
  return (
    <>
      <PageHead
        title="Tiến độ học tập"
        subtitle="Mỗi hoạt động hoàn thành là một bước tiến."
      />
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="course-grid">
          {(data || []).map((c: Row) => {
            const pct = Number(c.items)
              ? (Number(c.completed) / Number(c.items)) * 100
              : 0;
            return (
              <div className="panel" key={c.id}>
                <Badge tone="wine">{c.code}</Badge>
                <h2>{c.name}</h2>
                <div className="progress-big">
                  <strong>
                    {Math.round(pct)}
                    <small>%</small>
                  </strong>
                  <span>
                    {c.completed}/{c.items} hoạt động hoàn thành
                  </span>
                </div>
                <Progress value={pct} />
                <p>{c.pending} bài tập đang chờ nộp</p>
                <div className="actions">
                  <Link
                    className="button primary"
                    href={`/courses/${c.id}?tab=modules`}
                  >
                    Tiếp tục học
                  </Link>
                  <Link
                    className="button"
                    href={`/courses/${c.id}?tab=outcomes`}
                  >
                    Chuẩn đầu ra
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </State>
    </>
  );
}
function Profile() {
  const { me, refresh, toast, logout } = useSession(),
    sessions = useApi("/sessions"),
    prefs = useApi("/notification-preferences");
  return (
    <>
      <PageHead
        title="Hồ sơ cá nhân"
        subtitle="Thông tin học vụ được quản lý bởi nhà trường."
      />
      <div className="profile-grid">
        <section className="panel">
          <div className="profile-banner">
            <span className="avatar large">{initials(me.name)}</span>
            <h2>{me.name}</h2>
            <p>{me.roles.map((r: Row) => r.name).join(" · ")}</p>
            <Badge tone="wine">{me.student_code}</Badge>
          </div>
          <dl className="profile-details">
            <dt>Email trường</dt>
            <dd>{me.email}</dd>
            <dt>Mã định danh học vụ</dt>
            <dd>{me.student_code || "—"}</dd>
            <dt>Trạng thái</dt>
            <dd>
              <Badge tone="green">Đang hoạt động</Badge>
            </dd>
            <dt>Nguồn thông tin</dt>
            <dd>{me.demo ? "Dữ liệu dùng thử" : "Hệ thống SIS của trường"}</dd>
          </dl>
          <div className="info">
            <ShieldCheck size={20} />
            Thông tin học vụ được đồng bộ từ nhà trường.
          </div>
        </section>
        <section>
          <div className="panel">
            <h2>Thông báo qua email</h2>
            <p className="muted">
              Tùy chọn được lưu cho tài khoản. Kênh email cần được quản trị kết
              nối.
            </p>
            <Form
              onSubmit={async (f) => {
                await api("/notification-preferences", "POST", {
                  assignment_email: f.get("assignment") === "on",
                  announcement_email: f.get("announcement") === "on",
                  grade_email: f.get("grade") === "on",
                });
                refresh();
                toast("Đã lưu tùy chọn.");
              }}
            >
              {[
                ["assignment", "Hạn nộp bài tập", "assignment_email"],
                ["announcement", "Thông báo học phần", "announcement_email"],
                ["grade", "Điểm và phản hồi", "grade_email"],
              ].map(([key, label, pref]) => (
                <label className="check" key={key}>
                  <input
                    name={key}
                    type="checkbox"
                    defaultChecked={prefs.data?.[pref] ?? true}
                  />
                  {label}
                </label>
              ))}
            </Form>
          </div>
          <div className="panel">
            <h2>Thiết bị và phiên đăng nhập</h2>
            <State loading={sessions.loading} error={sessions.error}>
              {(sessions.data || []).map((s: Row) => (
                <div className="session-row" key={s.id}>
                  <Monitor size={20} />
                  <div>
                    <strong>
                      {s.device.includes("Mobile")
                        ? "Điện thoại"
                        : "Trình duyệt web"}
                    </strong>
                    <small>Đăng nhập {date(s.created_at, true)}</small>
                    <small>Hết hạn {date(s.expires_at, true)}</small>
                  </div>
                  <button
                    className="button"
                    onClick={async () => {
                      try {
                        await api(`/sessions/${s.id}`, "DELETE");
                        toast("Đã thu hồi phiên đăng nhập.");
                        location.reload();
                      } catch (e: any) {
                        toast(e.message);
                      }
                    }}
                  >
                    Thu hồi
                  </button>
                </div>
              ))}
            </State>
          </div>
        </section>
      </div>
    </>
  );
}
function SearchPage() {
  const [q, setQ] = useState(""),
    [query, setQuery] = useState("");
  const { data, loading, error } = useApi(
    query ? `/search?q=${encodeURIComponent(query)}` : null,
  );
  return (
    <>
      <PageHead
        title="Tìm kiếm"
        subtitle="Tìm nhanh học liệu và bài tập trong học phần của bạn."
      />
      <form
        className="global-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim().length >= 2) setQuery(q.trim());
        }}
      >
        <Search />
        <input
          aria-label="Từ khóa tìm kiếm"
          placeholder="Nhập ít nhất 2 ký tự…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="button primary">Tìm kiếm</button>
      </form>
      {query ? (
        <State loading={loading} error={error} empty={!data?.length}>
          <div className="panel">
            {(data || []).map((r: Row) => (
              <Link
                className="search-result"
                href={`/courses/${r.section_id}?tab=${r.type === "Bài tập" ? "assignments" : "modules"}`}
                key={r.id}
              >
                <Badge>{r.type}</Badge>
                <h3>{r.title}</h3>
                <p>{r.course}</p>
              </Link>
            ))}
          </div>
        </State>
      ) : (
        <Empty
          text="Bạn đang muốn tìm gì?"
          detail="Thử tên bài giảng, nội dung học hoặc tên bài tập."
        />
      )}
    </>
  );
}
function Help() {
  const { data, loading, error } = useApi("/support"),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false),
    [ticket, setTicket] = useState<string | null>(null);
  return (
    <>
      <PageHead
        title="Trung tâm hỗ trợ"
        subtitle="Giải đáp để việc học luôn liền mạch."
        action={
          <button className="button primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Gửi yêu cầu hỗ trợ
          </button>
        }
      />
      <div className="help-grid">
        {[
          [
            "Đăng nhập Microsoft 365",
            "Sử dụng tài khoản do trường cấp. Nếu chưa được cấp quyền vào LMS, liên hệ phòng đào tạo để kiểm tra danh sách SIS.",
          ],
          [
            "Nộp bài và xem phản hồi",
            "Mở Học phần → Bài tập → Nộp bài. Bạn có thể nộp văn bản, liên kết hoặc tệp; lịch sử các lần nộp luôn được giữ lại.",
          ],
          [
            "Làm bài kiểm tra",
            "Chọn Làm bài để bắt đầu tính giờ. Câu trả lời được tự động lưu. Khi hết giờ, hệ thống nộp các câu đã lưu trên máy chủ.",
          ],
          [
            "Cài ứng dụng trên điện thoại",
            "Android: mở bằng Chrome, chọn Cài ứng dụng. iPhone: mở bằng Safari → Chia sẻ → Thêm vào màn hình chính. Cần truy cập ứng dụng qua HTTPS để cài PWA.",
          ],
          [
            "Tham gia Microsoft Teams",
            "Vào học phần → Microsoft Teams, chọn Tham gia. Nhà trường cần kết nối Microsoft 365 và giảng viên tạo buổi học trước.",
          ],
          [
            "Điểm và tiến độ",
            "Điểm xuất hiện khi được công bố. Tiến độ nội dung tăng khi bạn xác nhận hoàn thành, không chỉ khi mở trang.",
          ],
        ].map(([q, a]) => (
          <details className="panel faq" key={q}>
            <summary>
              <HelpCircle size={18} />
              {q}
              <ChevronRight size={17} />
            </summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      <section className="panel">
        <h2>Yêu cầu của bạn</h2>
        <State loading={loading} error={error} empty={!data?.length}>
          {(data || []).map((t: Row) => (
            <div className="list-card" key={t.id}>
              <div>
                <h3>{t.title}</h3>
                <p>{t.content}</p>
                <small>{date(t.created_at, true)}</small>
              </div>
              <Badge tone="gold">{ticketStatus(t.status)}</Badge>
              <button className="button" onClick={() => setTicket(t.id)}>
                Xem phản hồi
              </button>
            </div>
          ))}
        </State>
      </section>
      {ticket && (
        <Dialog
          title="Yêu cầu hỗ trợ của bạn"
          onClose={() => setTicket(null)}
          wide
        >
          <SupportThread ticketId={ticket} />
        </Dialog>
      )}
      {open && (
        <Dialog title="Gửi yêu cầu hỗ trợ" onClose={() => setOpen(false)}>
          <Form
            onSubmit={async (f) => {
              await api("/support", "POST", {
                title: val(f, "title"),
                content: val(f, "content"),
              });
              setOpen(false);
              refresh();
              toast("Đã ghi nhận yêu cầu hỗ trợ.");
            }}
          >
            <Field name="title" label="Vấn đề cần hỗ trợ" />
            <Field name="content" label="Mô tả chi tiết" type="textarea" />
          </Form>
        </Dialog>
      )}
    </>
  );
}
