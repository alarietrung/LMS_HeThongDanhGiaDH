"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  FileText as FileTextIcon,
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ListTodo,
  Bell,
  MessageSquare,
  ChartNoAxesCombined,
  UserRound,
  Search,
  LifeBuoy,
  Shield,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  ChevronRight,
  ArrowUpRight,
  GraduationCap,
  Clock,
  CheckCheck,
  WifiOff,
  Download,
  MonitorSmartphone,
} from "lucide-react";
import {
  api,
  setCsrf,
  Session,
  Row,
  useApi,
  useSession,
  State,
  Empty,
  Badge,
  Progress,
  date,
  time,
  initials,
} from "./lib";
import { vi as t } from "./copy";
import { CoursePage } from "./courses/course";
import { QuizAttempt } from "./courses/quiz";
import { GlobalPage } from "./personal/pages";
import { AdminPage } from "./admin/pages";
import { TeacherQueue } from "./courses/workspace";
import { Landing } from "./landing";
const nav = [
  {
    label: t.learning,
    items: [
      ["dashboard", t.dashboard, LayoutDashboard],
      ["courses", t.courses, BookOpen],
      ["calendar", t.calendar, CalendarDays],
      ["tasks", t.tasks, ListTodo],
      ["progress", t.progress, ChartNoAxesCombined],
    ],
  },
  {
    label: t.connect,
    items: [
      ["notifications", t.notifications, Bell],
      ["messages", t.messages, MessageSquare],
    ],
  },
  {
    label: t.account,
    items: [
      ["profile", t.profile, UserRound],
      ["help", t.help, LifeBuoy],
    ],
  },
];
export function LmsApp() {
  const router = useRouter(),
    pathname = usePathname();
  const [me, setMe] = useState<Row | null>(null),
    [boot, setBoot] = useState(true),
    [authBusy, setAuthBusy] = useState(false),
    [config, setConfig] = useState<Row>({}),
    [version, setVersion] = useState(0),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [dark, setDark] = useState(false),
    [offline, setOffline] = useState(false),
    [install, setInstall] = useState<any>(null);
  useEffect(() => {
    api("/auth/config")
      .then(setConfig)
      .catch(() => {});
    api("/me")
      .then((v) => {
        setMe(v);
        setCsrf(v.csrf);
      })
      .catch(() => {})
      .finally(() => setBoot(false));
    const theme = localStorage.getItem("mituni-app-theme") === "dark";
    setDark(theme);
    document.documentElement.dataset.theme = theme ? "dark" : "light";
    const on = () => setOffline(!navigator.onLine),
      ins = (e: any) => {
        e.preventDefault();
        setInstall(e);
      };
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    window.addEventListener("beforeinstallprompt", ins);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
      window.removeEventListener("beforeinstallprompt", ins);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
  }, [pathname]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = document.getElementById("app-sidebar");
    const focusable = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          "a[href],button:not([disabled])",
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const resized = () => {
      if (window.innerWidth > 1000) setMenu(false);
    };
    window.addEventListener("keydown", keys);
    window.addEventListener("resize", resized);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", keys);
      window.removeEventListener("resize", resized);
      previous?.focus();
    };
  }, [menu]);
  useEffect(() => {
    if (me && pathname === "/login") router.replace("/dashboard");
  }, [me, pathname, router]);
  useEffect(() => {
    if (toast) {
      const tm = setTimeout(() => setToast(""), 5000);
      return () => clearTimeout(tm);
    }
  }, [toast]);
  async function login(persona: string) {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await api("/auth/demo", "POST", { persona });
      const m = await api("/me");
      setCsrf(m.csrf);
      setMe(m);
    } catch (e: any) {
      setToast(e.message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function logout() {
    try {
      await api("/logout", "POST", {});
      setMe(null);
      setCsrf("");
      router.push("/login");
    } catch (e: any) {
      setToast(e.message);
    }
  }
  function toggleTheme() {
    const value = !dark;
    setDark(value);
    localStorage.setItem("mituni-app-theme", value ? "dark" : "light");
    document.documentElement.dataset.theme = value ? "dark" : "light";
  }
  if (pathname === "/") return <Landing signedIn={!!me} />;
  if (boot || (me && pathname === "/login"))
    return (
      <div className="boot">
        <img src="/assets/mituni-logo.png" alt="MIT University" />
        <p>Đang mở không gian học tập…</p>
      </div>
    );
  if (!me)
    return (
      <div className="login-page">
        <div className="login-art">
          <img src="/assets/mituni-logo.png" alt="MIT University" />
          <div>
            <span className="eyebrow">
              MIEN DONG INNOVATIVE TECHNOLOGY UNIVERSITY
            </span>
            <h1>
              Học hôm nay.
              <br />
              Kiến tạo ngày mai.
            </h1>
            <p>
              Một không gian cho kiến thức, kết nối và những bước tiến của bạn.
            </p>
            <div className="login-chips">
              <span>
                <BookOpen size={18} /> Học tập
              </span>
              <span>
                <MessageSquare size={18} /> Kết nối
              </span>
              <span>
                <ChartNoAxesCombined size={18} /> Phát triển
              </span>
            </div>
          </div>
          <small>MIT UNIVERSITY · HỌC TẬP SỐ</small>
        </div>
        <main className="login-panel">
          <Link href="/" className="text-link">
            ← Về trang giới thiệu
          </Link>
          <Badge tone="wine">UNIVERSITY LMS</Badge>
          <h2>Chào mừng bạn trở lại</h2>
          <p>Đăng nhập vào không gian học tập của trường.</p>
          {pathname === "/login" &&
            typeof window !== "undefined" &&
            window.location.search.includes("not-enrolled") && (
              <p className="inline-error">
                Tài khoản Microsoft chưa có trong danh sách LMS. Vui lòng liên
                hệ phòng đào tạo.
              </p>
            )}
          <a
            className="microsoft-button"
            href={config.microsoft ? "/auth/microsoft" : "#microsoft-setup"}
            onClick={(e) => {
              if (!config.microsoft) {
                e.preventDefault();
                setToast(
                  "Microsoft 365 chưa được cấu hình. Quản trị cần kết nối tenant của trường.",
                );
              }
            }}
          >
            <span className="ms-logo">
              <i />
              <i />
              <i />
              <i />
            </span>
            Đăng nhập bằng Microsoft 365
          </a>
          <small>Sử dụng tài khoản Microsoft do nhà trường cấp.</small>
          {config.demo && (
            <div className="demo-entry">
              <div className="divider" />
              <strong>Khám phá bản dùng thử</strong>
              <p>Dữ liệu mẫu riêng, không kết nối hệ thống của trường.</p>
              <div className="persona-buttons">
                <button disabled={authBusy} onClick={() => login("student")}>
                  <GraduationCap />
                  Sinh viên
                </button>
                <button disabled={authBusy} onClick={() => login("lecturer")}>
                  <BookOpen />
                  Giảng viên
                </button>
                <button disabled={authBusy} onClick={() => login("admin")}>
                  <Shield />
                  Quản trị
                </button>
              </div>
              {authBusy && <p role="status">Đang đăng nhập…</p>}
            </div>
          )}
          <div className="login-foot">
            <MonitorSmartphone size={17} /> Sử dụng trên máy tính, Android và
            iPhone
          </div>
        </main>
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    );
  const current = pathname.split("/")[1] || "dashboard";
  const title = (t as any)[current] || "Không gian học tập";
  const isAdmin = me.permissions.includes("system.manage");
  const body =
    current === "courses" && pathname.split("/")[2] ? (
      <CoursePage sid={pathname.split("/")[2]} />
    ) : current === "courses" ? (
      <CoursesPage />
    ) : current === "quiz" ? (
      <QuizAttempt attemptId={pathname.split("/")[2]} />
    ) : current === "admin" ? (
      <AdminPage />
    ) : current === "teaching" ? (
      <>
        <PageHead
          title="Không gian giảng dạy"
          subtitle="Theo dõi công việc đánh giá và phản hồi cho người học."
        />
        <TeacherQueue />
      </>
    ) : current === "dashboard" || pathname === "/" ? (
      isAdmin ? (
        <AdminPage />
      ) : (
        <Dashboard />
      )
    ) : (
      <GlobalPage page={current} />
    );
  return (
    <Session.Provider
      value={{
        me,
        version,
        refresh: () => setVersion((x) => x + 1),
        toast: setToast,
        logout,
      }}
    >
      <a className="skip-link" href="#main">
        Chuyển đến nội dung
      </a>
      <header className="topbar">
        <button
          className="icon-button mobile-toggle"
          aria-label="Mở menu"
          aria-expanded={menu}
          aria-controls="app-sidebar"
          onClick={() => setMenu(true)}
        >
          <Menu />
        </button>
        <Link href="/dashboard" className="brand">
          <img src="/assets/mituni-logo.png" alt="MIT University" />
          <span>HỌC TẬP SỐ</span>
        </Link>
        <div className="top-context">
          Cổng học tập <span>/</span> {title}
        </div>
        <div className="top-actions">
          <Link className="icon-button" href="/search" aria-label="Tìm kiếm">
            <Search />
          </Link>
          <button
            className="icon-button"
            onClick={toggleTheme}
            aria-label="Đổi giao diện sáng tối"
          >
            {dark ? <Sun /> : <Moon />}
          </button>
          <Link
            className="icon-button"
            href="/notifications"
            aria-label="Thông báo"
          >
            <Bell />
          </Link>
          <Link href="/profile" className="user-chip">
            <span className="avatar">{initials(me.name)}</span>
            <span>
              <strong>{me.name}</strong>
              <small>{me.roles[0]?.name}</small>
            </span>
          </Link>
        </div>
      </header>
      {menu && (
        <button
          className="nav-backdrop"
          aria-label="Đóng menu"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        id="app-sidebar"
        aria-label="Điều hướng chính"
        className={`sidebar ${menu ? "open" : ""}`}
      >
        <div className="sidebar-heading">
          <span>Không gian của bạn</span>
          <button
            className="icon-button mobile-toggle"
            onClick={() => setMenu(false)}
            aria-label="Đóng menu"
          >
            <X />
          </button>
        </div>
        {nav.map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <small className="nav-label">{group.label}</small>
            {group.items.map(([path, label, Icon]: any) => (
              <Link
                key={path}
                href={`/${path}`}
                className={`nav-item ${current === path ? "active" : ""}`}
              >
                <Icon size={19} />
                <span>{label}</span>
                {current === path && <span className="nav-dot" />}
              </Link>
            ))}
          </nav>
        ))}
        {me.permissions.includes("assignment.grade") && (
          <Link
            href="/teaching"
            className={`nav-item ${current === "teaching" ? "active" : ""}`}
          >
            <FileTextIcon />
            Bài cần chấm
          </Link>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className={`nav-item ${current === "admin" ? "active" : ""}`}
          >
            <Shield size={19} />
            {t.admin}
          </Link>
        )}
        <div className="sidebar-bottom">
          {me.demo && <Badge tone="gold">Môi trường dùng thử</Badge>}
          {install && (
            <button
              className="nav-item"
              onClick={async () => {
                await install.prompt();
                setInstall(null);
              }}
            >
              <Download size={18} />
              Cài ứng dụng
            </button>
          )}
          <button className="nav-item" onClick={logout}>
            <LogOut size={18} />
            {t.logout}
          </button>
          <small>© 2026 MIT University</small>
        </div>
      </aside>
      <main id="main" className="main-content">
        {offline && (
          <div className="offline-banner" role="alert">
            <WifiOff size={18} />
            Bạn đang ngoại tuyến. Nội dung đã mở vẫn hiển thị; kết nối lại để
            lưu thay đổi.
          </div>
        )}
        {body}
        <footer className="page-footer">
          <span>MIT UNIVERSITY</span>
          <span>Học tập · Kết nối · Phát triển</span>
          <Link href="/help">
            Trung tâm hỗ trợ <ArrowUpRight size={14} />
          </Link>
        </footer>
      </main>
      <nav className="bottom-nav" aria-label="Điều hướng điện thoại">
        {[
          ["dashboard", "Trang chủ", LayoutDashboard],
          ["courses", "Học phần", BookOpen],
          ["calendar", "Lịch", CalendarDays],
          ["tasks", "Công việc", ListTodo],
          ["notifications", "Thông báo", Bell],
        ].map(([path, label, Icon]: any) => (
          <Link
            key={path}
            href={`/${path}`}
            className={current === path ? "active" : ""}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </Session.Provider>
  );
}
export function PageHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <p className="eyebrow">MITUNI · KHÔNG GIAN HỌC TẬP</p>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function CourseCard({ course: c }: { course: Row }) {
  const { me } = useSession();
  const teaching = me.permissions.includes("assignment.grade");
  const pct = Number(c.items)
    ? (Number(c.completed) / Number(c.items)) * 100
    : 0;
  return (
    <Link href={`/courses/${c.id}`} className="course-card">
      <div
        className={`course-cover ${c.image ? "" : "abstract"}`}
        style={c.image ? { backgroundImage: `url(${c.image})` } : undefined}
      >
        {!c.image && (
          <span>
            ĐỔI MỚI
            <br />
            SÁNG TẠO
          </span>
        )}
        <Badge tone="gold">
          {c.term} · {c.academic_year}
        </Badge>
        <span className="cover-link">
          <ArrowUpRight size={20} />
        </span>
      </div>
      <div className="course-card-body">
        <small>
          {c.code} · {c.section}
        </small>
        <h3>{c.name}</h3>
        <p className="teacher">
          <span className="mini-avatar">{initials(c.lecturer)}</span>
          {c.lecturer || "Chưa phân công"}
        </p>
        <div className="progress-label">
          <span>{teaching ? "Học liệu đã công bố" : "Tiến độ học tập"}</span>
          <strong>
            {teaching ? `${c.items} hoạt động` : `${Math.round(pct)}%`}
          </strong>
        </div>
        {!teaching && <Progress value={pct} />}
        <div className="course-card-bottom">
          <span>
            <ListTodo size={15} />
            {c.pending} {teaching ? "bài tập đang mở" : "bài tập cần nộp"}
          </span>
          <ChevronRight size={17} />
        </div>
      </div>
    </Link>
  );
}
export function CoursesPage() {
  const { data, loading, error } = useApi("/courses");
  const [q, setQ] = useState("");
  const courses = (data || []).filter((c: Row) =>
    `${c.name} ${c.code}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <PageHead
        title="Học phần của tôi"
        subtitle="Tiếp tục hành trình học tập của bạn."
      />
      <div className="toolbar">
        <div className="tab-pills">
          <span className="active">Học kỳ hiện tại</span>
          <span>{data?.length || 0} học phần</span>
        </div>
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Tìm học phần"
            placeholder="Tìm tên hoặc mã học phần"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      <State loading={loading} error={error} empty={!courses.length}>
        <div className="course-grid">
          {courses.map((c: Row) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      </State>
    </>
  );
}
function Dashboard() {
  const { me } = useSession(),
    courses = useApi("/courses"),
    tasks = useApi("/tasks"),
    calendar = useApi("/calendar"),
    notices = useApi("/notifications");
  const list = courses.data || [],
    pending = (tasks.data || []).filter((t: Row) => !t.submitted_at),
    schedule = (calendar.data || [])
      .filter((e: Row) => new Date(e.ends_at) > new Date())
      .slice(0, 3);
  const complete = list.reduce(
      (s: number, c: Row) => s + Number(c.completed),
      0,
    ),
    items = list.reduce((s: number, c: Row) => s + Number(c.items), 0);
  const teaching = me.permissions.includes("assignment.grade");
  return (
    <>
      <PageHead
        title={`Xin chào, ${me.name.split(" ").slice(-2).join(" ")}!`}
        subtitle="Một ngày mới, một bước tiến mới."
        action={
          <div className="today-chip">
            <CalendarDays size={18} />
            {date(new Date())}
          </div>
        }
      />
      <section className="welcome-banner">
        <div>
          <Badge tone="gold">
            {list[0]
              ? `${list[0].term} · ${list[0].academic_year}`
              : "KHÔNG GIAN HỌC TẬP MITUNI"}
          </Badge>
          <h2>
            {teaching
              ? "Truyền cảm hứng. Kết nối tri thức."
              : "Sẵn sàng cho bài học tiếp theo?"}
          </h2>
          <p>
            {teaching
              ? "Quản lý học phần, theo dõi bài nộp và đồng hành cùng sinh viên."
              : "Theo dõi lịch học, hoàn thành mục tiêu và giữ nhịp học tập mỗi ngày."}
          </p>
          <Link className="button white" href="/courses">
            {teaching ? "Mở lớp đang dạy" : "Tiếp tục học tập"}{" "}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="welcome-graphic" aria-hidden="true">
          <GraduationCap size={102} strokeWidth={1} />
          <span className="orbit o1" />
          <span className="orbit o2" />
          <span className="graphic-star">✦</span>
        </div>
      </section>
      <div className="stats-grid">
        {(teaching
          ? [
              [BookOpen, list.length, "Lớp đang giảng dạy", "wine"],
              [ListTodo, pending.length, "Bài tập đang mở", "gold"],
              [CheckCheck, items, "Học liệu đã công bố", "green"],
              [
                CalendarDays,
                (calendar.data || []).filter(
                  (e: Row) => new Date(e.ends_at) > new Date(),
                ).length,
                "Sự kiện sắp tới",
                "blue",
              ],
            ]
          : [
              [BookOpen, list.length, "Học phần đang học", "wine"],
              [ListTodo, pending.length, "Bài tập cần hoàn thành", "gold"],
              [CheckCheck, complete, "Hoạt động hoàn thành", "green"],
              [
                ChartNoAxesCombined,
                `${items ? Math.round((complete / items) * 100) : 0}%`,
                "Tiến độ tổng quan",
                "blue",
              ],
            ]
        ).map(([Icon, n, label, tone]: any) => (
          <div className="stat-card" key={label}>
            <span className={`stat-icon ${tone}`}>
              <Icon size={23} />
            </span>
            <div>
              <strong>{n}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>
      {teaching && <TeacherQueue compact />}
      <div className="dashboard-grid">
        <section>
          <div className="section-head">
            <h2>{teaching ? "Lớp đang giảng dạy" : "Học phần của tôi"}</h2>
            <Link href="/courses">
              Xem tất cả <ChevronRight size={16} />
            </Link>
          </div>
          <State
            loading={courses.loading}
            error={courses.error}
            empty={!list.length}
          >
            <div className="course-grid">
              {list.slice(0, 2).map((c: Row) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          </State>
          <section className="panel deadlines">
            <div className="section-head">
              <h2>Sắp đến hạn</h2>
              <Link href="/tasks">
                Xem công việc <ChevronRight size={16} />
              </Link>
            </div>
            {pending.length ? (
              pending.slice(0, 4).map((a: Row) => (
                <Link
                  className="deadline-row"
                  key={a.id}
                  href={`/courses/${a.section_id}?tab=assignments`}
                >
                  <span className="date-block">
                    <strong>{new Date(a.due_at).getDate()}</strong>
                    <small>THÁNG {new Date(a.due_at).getMonth() + 1}</small>
                  </span>
                  <span>
                    <strong>{a.title}</strong>
                    <small>{a.course}</small>
                  </span>
                  <Badge
                    tone={new Date(a.due_at) < new Date() ? "wine" : "gold"}
                  >
                    {new Date(a.due_at) < new Date()
                      ? "Quá hạn"
                      : date(a.due_at)}
                  </Badge>
                </Link>
              ))
            ) : (
              <Empty
                text="Bạn đã xử lý hết công việc"
                detail="Kiểm tra lại khi có bài tập mới."
              />
            )}
          </section>
        </section>
        <aside className="dashboard-aside">
          <section className="panel">
            <div className="section-head">
              <h2>Lịch sắp tới</h2>
              <CalendarDays size={19} />
            </div>
            {schedule.length ? (
              schedule.map((e: Row) => (
                <Link href="/calendar" key={e.id} className="schedule-card">
                  <small>
                    {date(e.starts_at)} · {time(e.starts_at)}
                  </small>
                  <strong>{e.title}</strong>
                  <span>{e.location || "Xem trong lịch học"}</span>
                </Link>
              ))
            ) : (
              <Empty
                text="Chưa có lịch sắp tới"
                detail="Lịch mới sẽ được cập nhật tại đây."
              />
            )}
            <Link href="/calendar" className="text-link">
              Mở lịch học <ArrowUpRight size={16} />
            </Link>
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>Thông báo mới</h2>
              <Bell size={18} />
            </div>
            {(notices.data || []).slice(0, 3).map((n: Row) => (
              <Link href={n.href} key={n.id} className="notice-preview">
                <span className="notice-dot" />
                <span>
                  <strong>{n.title}</strong>
                  <p>{n.content}</p>
                  <small>{date(n.created_at, true)}</small>
                </span>
              </Link>
            ))}
          </section>
          <div className="help-card">
            <LifeBuoy size={26} />
            <h3>Cần một chút hỗ trợ?</h3>
            <p>Hướng dẫn sử dụng và giải đáp luôn ở đây.</p>
            <Link href="/help">
              Đến trung tâm hỗ trợ <ArrowUpRight size={16} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
