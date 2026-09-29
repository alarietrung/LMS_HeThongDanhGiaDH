"use client";
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  CheckCircle2,
  LockKeyhole,
  Plus,
  GripVertical,
  Pencil,
  ArrowUpRight,
  Users,
  Flag,
  Megaphone,
  Video,
  Trash2,
} from "lucide-react";
import {
  api,
  useApi,
  useSession,
  Row,
  State,
  Empty,
  Badge,
  Progress,
  Dialog,
  Form,
  Field,
  date,
  localDate,
  iso,
  val,
  statusLabel,
  initials,
} from "../lib";
import { FileLibrary, GroupWorkspace, OutcomeManager } from "./workspace";
import { ItemEditor, RichContent } from "./editor";
import { LearningPackage } from "./package";
import { Assignments, Grades, Attendance, Rubrics } from "./work";
import { Quizzes, QuestionBank } from "./quiz";
const tabs = [
  ["overview", "Tổng quan"],
  ["modules", "Nội dung"],
  ["files", "Thư viện"],
  ["assignments", "Bài tập"],
  ["quizzes", "Kiểm tra"],
  ["discussions", "Thảo luận"],
  ["announcements", "Thông báo"],
  ["teams", "Microsoft Teams"],
  ["attendance", "Điểm danh"],
  ["grades", "Điểm"],
  ["outcomes", "CLO / PLO"],
  ["groups", "Nhóm"],
  ["people", "Thành viên"],
];
export function CoursePage({ sid }: { sid: string }) {
  const { data, loading, error } = useApi(`/courses/${sid}`);
  return (
    <State loading={loading} error={error}>
      {data && <CourseContent course={data} sid={sid} />}
    </State>
  );
}
function CourseContent({ course: c, sid }: { course: Row; sid: string }) {
  const params = useSearchParams(),
    tab = params.get("tab") || "overview";
  const { me } = useSession();
  const manage = c.manage;
  return (
    <>
      <div className="breadcrumbs">
        <Link href="/courses">Học phần của tôi</Link>
        <ChevronRight size={14} />
        <span>{c.code}</span>
      </div>
      <section
        className={`course-hero ${c.image ? "" : "abstract"}`}
        style={
          c.image
            ? {
                backgroundImage: `linear-gradient(0deg,rgba(14,20,32,.94),rgba(14,20,32,.05)),url(${c.image})`,
              }
            : undefined
        }
      >
        <div>
          <Badge tone="gold">
            {c.term} · {c.academic_year}
          </Badge>
          <h1>{c.name}</h1>
          <p>
            {c.code} <span>•</span> Lớp {c.section}
          </p>
          <div className="hero-teacher">
            <span className="avatar small">
              {initials(
                c.members.find((m: Row) => m.kind === "LECTURER")?.name,
              )}
            </span>
            {c.members.find((m: Row) => m.kind === "LECTURER")?.name ||
              "Chưa phân công"}
            <Badge>{statusLabel[c.status]}</Badge>
          </div>
        </div>
      </section>
      <div className="course-tabs">
        {tabs.map(([key, label]) => (
          <Link
            href={`/courses/${sid}?tab=${key}`}
            key={key}
            className={tab === key ? "active" : ""}
          >
            {label}
          </Link>
        ))}
        {manage &&
          [
            ["builder", "Xây dựng học phần"],
            ["questions", "Ngân hàng câu hỏi"],
            ["rubrics", "Rubric"],
            ["analytics", "Phân tích"],
          ].map(([key, label]) => (
            <Link
              href={`/courses/${sid}?tab=${key}`}
              key={key}
              className={tab === key ? "active" : ""}
            >
              {label}
            </Link>
          ))}
      </div>
      <div className="course-content">
        {tab === "overview" && (
          <div className="overview-grid">
            <section>
              <div className="panel">
                <p className="eyebrow">I. THÔNG TIN CHUNG VỀ HỌC PHẦN</p>
                <h2>Chào mừng đến với {c.name}</h2>
                <p className="readable">{c.description}</p>
                <div className="quick-tiles">
                  {[
                    ["modules", "Học liệu", BookOpen],
                    ["assignments", "Bài tập", FileText],
                    ["discussions", "Hỏi đáp", Users],
                    ["grades", "Kết quả", Flag],
                  ].map(([key, label, Icon]: any) => (
                    <Link key={key} href={`/courses/${sid}?tab=${key}`}>
                      <Icon />
                      <strong>{label}</strong>
                      <ChevronRight size={17} />
                    </Link>
                  ))}
                </div>
              </div>
              <Modules sid={sid} compact />
            </section>
            <Announcements sid={sid} manage={false} compact />
          </div>
        )}
        {(tab === "modules" || tab === "builder") && (
          <Modules sid={sid} edit={tab === "builder" && manage} />
        )}
        {tab === "assignments" && <Assignments sid={sid} manage={manage} />}
        {tab === "files" && <FileLibrary sid={sid} manage={manage} />}
        {tab === "grades" && <Grades sid={sid} />}
        {tab === "attendance" && (
          <Attendance sid={sid} manage={manage} members={c.members} />
        )}
        {tab === "quizzes" && <Quizzes sid={sid} manage={manage} />}
        {tab === "questions" && manage && <QuestionBank sid={sid} />}
        {tab === "rubrics" && manage && <Rubrics sid={sid} />}
        {tab === "announcements" && <Announcements sid={sid} manage={manage} />}
        {tab === "discussions" && <Discussions sid={sid} manage={manage} />}
        {tab === "teams" && <Teams sid={sid} manage={manage} />}
        {tab === "people" && (
          <div className="panel">
            <h2>Thành viên học phần</h2>
            <div className="people-grid">
              {c.members.map((m: Row) => (
                <div className="person" key={m.id}>
                  <span className="avatar">{initials(m.name)}</span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>
                      {(
                        {
                          STUDENT: "Sinh viên",
                          LECTURER: "Giảng viên",
                          ASSISTANT: "Trợ giảng",
                          GRADER: "Người chấm",
                        } as any
                      )[m.kind] || m.kind}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "groups" && (
          <Groups sid={sid} manage={manage} members={c.members} />
        )}
        {tab === "outcomes" &&
          (manage && me.permissions.includes("analytics.view") ? (
            <OutcomeManager sid={sid} />
          ) : (
            <Outcomes sid={sid} />
          ))}
        {tab === "analytics" && manage && <Analytics sid={sid} />}
      </div>
    </>
  );
}
function Modules({
  sid,
  edit = false,
  compact = false,
}: {
  sid: string;
  edit?: boolean;
  compact?: boolean;
}) {
  const { data, loading, error } = useApi(`/courses/${sid}/modules`),
    { refresh, toast } = useSession();
  const [selected, setSelected] = useState<Row | null>(null),
    [create, setCreate] = useState<string | null>(null),
    [drag, setDrag] = useState<number | null>(null);
  async function complete(item: Row) {
    try {
      await api(`/items/${item.id}/complete`, "POST", {});
      toast("Đã ghi nhận hoàn thành nội dung.");
      setSelected({ ...item, completed_at: new Date().toISOString() });
      refresh();
    } catch (e: any) {
      toast(e.message);
    }
  }
  return (
    <section className="module-section">
      {edit && <LearningPackage sid={sid} />}
      <div className="section-head">
        <div>
          <h2>{edit ? "Xây dựng học phần" : "Nội dung học tập"}</h2>
          {edit && (
            <p className="muted">
              Kéo thả để sắp xếp module. Nội dung chỉ hiển thị khi đã công bố.
            </p>
          )}
        </div>
        {edit && (
          <button
            className="button primary"
            onClick={() => setCreate("module")}
          >
            <Plus size={17} />
            Thêm module
          </button>
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {(compact ? (data || []).slice(0, 2) : data || []).map(
          (m: Row, index: number) => (
            <details
              key={m.id}
              className="module-card"
              open={index === 0 || edit}
              draggable={edit}
              onDragStart={() => setDrag(index)}
              onDragOver={(e) => {
                if (edit) e.preventDefault();
              }}
              onDrop={async (e) => {
                e.preventDefault();
                if (drag === null || drag === index) return;
                const ordered = [...data];
                const [moved] = ordered.splice(drag, 1);
                ordered.splice(index, 0, moved);
                try {
                  for (const [position, item] of ordered.entries())
                    await api(`/modules/${item.id}`, "PATCH", { position });
                  refresh();
                  toast("Đã cập nhật thứ tự module.");
                } catch (e: any) {
                  toast(e.message);
                }
                setDrag(null);
              }}
            >
              <summary>
                {edit ? (
                  <GripVertical size={19} />
                ) : (
                  <span className="module-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                )}
                <span>
                  <strong>{m.title}</strong>
                  <small>
                    {m.items.length} hoạt động ·{" "}
                    {m.items.filter((i: Row) => i.completed_at).length} hoàn
                    thành
                  </small>
                </span>
                {edit && <Badge>{statusLabel[m.status]}</Badge>}
                <ChevronDown size={18} />
              </summary>
              <div className="module-items">
                {m.items.map((item: Row) => (
                  <button
                    key={item.id}
                    className={`module-item ${item.locked ? "locked" : ""}`}
                    onClick={() =>
                      item.locked
                        ? toast(
                            "Hoàn thành nội dung trước hoặc chờ thời gian mở học liệu.",
                          )
                        : setSelected(item)
                    }
                  >
                    {item.completed_at ? (
                      <CheckCircle2 className="success-text" size={20} />
                    ) : item.locked ? (
                      <LockKeyhole size={20} />
                    ) : (
                      <FileText size={20} />
                    )}
                    <span>
                      <strong>{item.title}</strong>
                      <small>
                        {edit
                          ? statusLabel[item.status]
                          : item.completed_at
                            ? "Đã hoàn thành"
                            : item.locked
                              ? "Chưa mở khóa"
                              : (
                                  {
                                    PAGE: "Bài đọc",
                                    URL: "Liên kết",
                                    VIDEO: "Video",
                                    PDF: "Tài liệu PDF",
                                    AUDIO: "Âm thanh",
                                    FILE: "Tệp học liệu",
                                  } as any
                                )[item.type]}
                      </small>
                    </span>
                    {edit ? <Pencil size={16} /> : <ChevronRight size={16} />}
                  </button>
                ))}
                {edit && (
                  <div className="module-actions">
                    <button className="button" onClick={() => setCreate(m.id)}>
                      <Plus size={16} />
                      Thêm nội dung
                    </button>
                    <button
                      className="button subtle"
                      onClick={async () => {
                        try {
                          await api(`/modules/${m.id}`, "PATCH", {
                            status:
                              m.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED",
                          });
                          refresh();
                        } catch (e: any) {
                          toast(e.message);
                        }
                      }}
                    >
                      {m.status === "PUBLISHED"
                        ? "Chuyển về nháp"
                        : "Công bố module"}
                    </button>
                  </div>
                )}
              </div>
            </details>
          ),
        )}
      </State>
      {create && (
        <Dialog
          title={create === "module" ? "Thêm module" : "Thêm nội dung học tập"}
          onClose={() => setCreate(null)}
        >
          <Form
            onSubmit={async (f) => {
              if (create === "module")
                await api(`/courses/${sid}/modules`, "POST", {
                  title: val(f, "title"),
                  status: val(f, "status"),
                });
              else
                await api(`/modules/${create}/items`, "POST", {
                  title: val(f, "title"),
                  type: val(f, "type"),
                  content: val(f, "content"),
                  url: val(f, "url") || undefined,
                  status: val(f, "status"),
                  available_at: val(f, "available_at")
                    ? iso(f.get("available_at"))
                    : null,
                  prerequisite_id: val(f, "prerequisite_id") || null,
                });
              setCreate(null);
              refresh();
              toast("Đã lưu nội dung.");
            }}
          >
            <Field label="Tiêu đề" name="title" />
            {create !== "module" && (
              <>
                <Field label="Loại nội dung" name="type">
                  <select name="type">
                    <option value="PAGE">Bài đọc</option>
                    <option value="URL">Liên kết</option>
                    <option value="VIDEO">Video</option>
                    <option value="PDF">PDF</option>
                    <option value="AUDIO">Âm thanh</option>
                  </select>
                </Field>
                <Field
                  label="Nội dung"
                  name="content"
                  type="textarea"
                  required={false}
                />
                <Field
                  label="Liên kết học liệu"
                  name="url"
                  type="url"
                  required={false}
                />
                <Field
                  label="Mở từ"
                  name="available_at"
                  type="datetime-local"
                  required={false}
                />
                <Field
                  label="Yêu cầu hoàn thành trước"
                  name="prerequisite_id"
                  required={false}
                >
                  <select name="prerequisite_id">
                    <option value="">Không có</option>
                    {(data || [])
                      .flatMap((m: Row) => m.items)
                      .map((i: Row) => (
                        <option value={i.id} key={i.id}>
                          {i.title}
                        </option>
                      ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Trạng thái" name="status">
              <select name="status">
                <option value="DRAFT">Bản nháp</option>
                <option value="PUBLISHED">Công bố</option>
                {create !== "module" && (
                  <option value="SCHEDULED">Hẹn giờ công bố</option>
                )}
              </select>
            </Field>
          </Form>
        </Dialog>
      )}
      {selected && (
        <Dialog
          title={selected.title}
          onClose={() => {
            setSelected(null);
            if (edit) refresh();
          }}
          wide
        >
          {edit ? (
            <ItemEditor
              item={selected}
              onDone={() => {
                setSelected(null);
                refresh();
              }}
            />
          ) : (
            <>
              <RichContent
                content={selected.content}
                format={selected.content_format}
              />
              {selected.url && (
                <a
                  className="button"
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Mở học liệu <ArrowUpRight size={16} />
                </a>
              )}
              <div className="dialog-bottom">
                <p className="muted">
                  Xác nhận khi bạn đã hoàn thành nội dung này.
                </p>
                <button
                  className="button primary"
                  disabled={!!selected.completed_at}
                  onClick={() => complete(selected)}
                >
                  <CheckCircle2 size={18} />
                  {selected.completed_at
                    ? "Đã hoàn thành"
                    : "Đánh dấu hoàn thành"}
                </button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </section>
  );
}
function Announcements({
  sid,
  manage,
  compact = false,
}: {
  sid: string;
  manage: boolean;
  compact?: boolean;
}) {
  const { data, loading, error } = useApi(`/courses/${sid}/announcements`),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Thông báo học phần</h2>
        {manage ? (
          <button className="button primary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            Thông báo mới
          </button>
        ) : (
          <Megaphone size={20} />
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).slice(0, compact ? 3 : 100).map((a: Row) => (
          <article className="announcement" key={a.id}>
            <div className="section-head">
              <Badge tone="wine">{a.pinned ? "Đã ghim" : "Thông báo"}</Badge>
              <small>{date(a.publish_at, true)}</small>
            </div>
            <h3>{a.title}</h3>
            <p className="readable">{a.content}</p>
            <small>{a.author}</small>
          </article>
        ))}
      </State>
      {open && (
        <Dialog title="Đăng thông báo" onClose={() => setOpen(false)}>
          <Form
            onSubmit={async (f) => {
              await api(`/courses/${sid}/announcements`, "POST", {
                title: val(f, "title"),
                content: val(f, "content"),
                pinned: f.get("pinned") === "on",
                publish_at: val(f, "publish_at")
                  ? iso(f.get("publish_at"))
                  : undefined,
              });
              setOpen(false);
              refresh();
              toast("Đã lưu thông báo.");
            }}
          >
            <Field label="Tiêu đề" name="title" />
            <Field label="Nội dung" name="content" type="textarea" />
            <Field
              label="Hẹn giờ đăng"
              name="publish_at"
              type="datetime-local"
              required={false}
            />
            <label className="check">
              <input type="checkbox" name="pinned" />
              Ghim thông báo
            </label>
          </Form>
        </Dialog>
      )}
    </section>
  );
}
function Discussions({ sid, manage }: { sid: string; manage: boolean }) {
  const { data, loading, error } = useApi(`/courses/${sid}/discussions`),
    { refresh, toast } = useSession();
  const [create, setCreate] = useState(false),
    [active, setActive] = useState<string | null>(null);
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Thảo luận & hỏi đáp</h2>
          <p className="muted">Cùng trao đổi để hiểu bài sâu hơn.</p>
        </div>
        <button className="button primary" onClick={() => setCreate(true)}>
          <Plus size={17} />
          Chủ đề mới
        </button>
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).map((d: Row) => (
          <button
            className="discussion-row"
            key={d.id}
            onClick={() => setActive(d.id)}
          >
            <span className="avatar">{initials(d.author)}</span>
            <span>
              <strong>
                {d.title}
                {d.locked && " · Đã khóa"}
              </strong>
              <small>
                {d.author} · {date(d.created_at, true)}
              </small>
            </span>
            <Badge>{d.replies} bài viết</Badge>
            <ChevronRight size={18} />
          </button>
        ))}
      </State>
      {create && (
        <Dialog title="Tạo chủ đề thảo luận" onClose={() => setCreate(false)}>
          <Form
            onSubmit={async (f) => {
              await api(`/courses/${sid}/discussions`, "POST", {
                title: val(f, "title"),
                content: val(f, "content"),
              });
              setCreate(false);
              refresh();
              toast("Đã đăng chủ đề.");
            }}
          >
            <Field label="Tiêu đề" name="title" />
            <Field label="Nội dung" name="content" type="textarea" />
          </Form>
        </Dialog>
      )}
      {active && (
        <Dialog title="Thảo luận học phần" onClose={() => setActive(null)} wide>
          <Thread id={active} manage={manage} />
        </Dialog>
      )}
    </section>
  );
}
function Thread({ id, manage }: { id: string; manage: boolean }) {
  const { data, loading, error } = useApi(`/discussions/${id}/posts`),
    { refresh, toast } = useSession();
  return (
    <State loading={loading} error={error}>
      {data && (
        <>
          <div className="section-head">
            <h2>{data.discussion.title}</h2>
            {manage && (
              <button
                className="button"
                onClick={async () => {
                  try {
                    await api(`/discussions/${id}`, "PATCH", {
                      locked: !data.discussion.locked,
                      pinned: data.discussion.pinned,
                    });
                    refresh();
                  } catch (e: any) {
                    toast(e.message);
                  }
                }}
              >
                {data.discussion.locked ? "Mở lại" : "Khóa chủ đề"}
              </button>
            )}
          </div>
          {data.posts.map((p: Row) => (
            <article className="post" key={p.id}>
              <span className="avatar small">{initials(p.author)}</span>
              <div>
                <strong>{p.author}</strong>
                <small>{date(p.created_at, true)}</small>
                <p className="readable">{p.content}</p>
              </div>
            </article>
          ))}
          {!data.discussion.locked && (
            <Form
              label="Gửi phản hồi"
              onSubmit={async (f) => {
                await api(`/discussions/${id}/posts`, "POST", {
                  content: val(f, "content"),
                });
                refresh();
                toast("Đã gửi phản hồi.");
              }}
            >
              <Field label="Phản hồi của bạn" name="content" type="textarea" />
            </Form>
          )}
        </>
      )}
    </State>
  );
}
function Teams({ sid, manage }: { sid: string; manage: boolean }) {
  const { data, loading, error } = useApi(`/courses/${sid}/teams`),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Microsoft Teams</h2>
        {manage && (
          <button
            className="button primary"
            disabled={!data?.connected}
            onClick={() => setOpen(true)}
          >
            <Plus size={17} />
            Tạo buổi học
          </button>
        )}
      </div>
      <State loading={loading} error={error}>
        {!data?.configured && (
          <div className="integration-notice">
            <Video size={30} />
            <div>
              <h3>Chưa kết nối Microsoft 365 của trường</h3>
              <p>
                Quản trị cần cấu hình Entra ID. Buổi học trực tuyến sẽ đồng bộ
                với lịch Outlook sau khi kết nối.
              </p>
            </div>
          </div>
        )}
        {data?.configured && !data?.connected && (
          <p className="info">
            Đăng nhập lại bằng Microsoft 365 để sử dụng Teams.
          </p>
        )}
        {data?.meetings?.length ? (
          data.meetings.map((m: Row) => (
            <div className="list-card" key={m.id}>
              <Video />
              <div>
                <h3>{m.title}</h3>
                <p>
                  {date(m.starts_at, true)} – {date(m.ends_at, true)}
                </p>
                <Badge>{statusLabel[m.sync_status]}</Badge>
                {m.error && <p className="inline-error">{m.error}</p>}
              </div>
              {m.join_url && (
                <a
                  className="button primary"
                  href={m.join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tham gia <ArrowUpRight size={16} />
                </a>
              )}
            </div>
          ))
        ) : (
          <Empty
            text="Chưa có buổi học trực tuyến"
            detail="Buổi học Teams mới sẽ xuất hiện tại đây và trong lịch học."
          />
        )}
      </State>
      {open && (
        <Dialog
          title="Tạo buổi học Microsoft Teams"
          onClose={() => setOpen(false)}
        >
          <Form
            onSubmit={async (f) => {
              await api(`/courses/${sid}/teams`, "POST", {
                title: val(f, "title"),
                starts_at: iso(f.get("starts_at")),
                ends_at: iso(f.get("ends_at")),
              });
              setOpen(false);
              refresh();
              toast("Đã tạo lịch Outlook và buổi học Teams.");
            }}
          >
            <Field name="title" label="Tên buổi học" />
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
    </section>
  );
}
function Groups({
  sid,
  manage,
  members,
}: {
  sid: string;
  manage: boolean;
  members: Row[];
}) {
  const { data, loading, error } = useApi(`/courses/${sid}/groups`),
    { refresh, me } = useSession();
  const [open, setOpen] = useState(false),
    [workspace, setWorkspace] = useState<string | null>(null);
  return (
    <section>
      <div className="section-head">
        <h2>Nhóm học tập</h2>
        {manage && (
          <button className="button primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Tạo nhóm
          </button>
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="course-grid">
          {(data || []).map((g: Row) => (
            <div className="panel" key={g.id}>
              <Users className="wine-text" />
              <h3>{g.name}</h3>
              <p>{g.description}</p>
              {g.members.map((m: Row) => (
                <div className="person" key={m.id}>
                  <span className="avatar small">{initials(m.name)}</span>
                  {m.name}
                  {g.leader_id === m.id && <Badge>Nhóm trưởng</Badge>}
                </div>
              ))}
              <button
                className="button"
                disabled={
                  !manage && !g.members.some((m: Row) => m.id === me.id)
                }
                onClick={() => setWorkspace(g.id)}
              >
                Mở không gian nhóm <ChevronRight size={16} />
              </button>
            </div>
          ))}
        </div>
      </State>
      {workspace && (
        <Dialog title="Không gian nhóm" onClose={() => setWorkspace(null)} wide>
          <GroupWorkspace groupId={workspace} sid={sid} />
        </Dialog>
      )}
      {open && (
        <Dialog title="Tạo nhóm học tập" onClose={() => setOpen(false)}>
          <Form
            onSubmit={async (f) => {
              await api(`/courses/${sid}/groups`, "POST", {
                name: val(f, "name"),
                description: val(f, "description"),
                members: f.getAll("members"),
              });
              setOpen(false);
              refresh();
            }}
          >
            <Field label="Tên nhóm" name="name" />
            <Field
              label="Mô tả"
              name="description"
              type="textarea"
              required={false}
            />
            <p>Chọn thành viên (người đầu tiên là nhóm trưởng):</p>
            {members
              .filter((m) => m.kind === "STUDENT")
              .map((m) => (
                <label className="check" key={m.id}>
                  <input type="checkbox" name="members" value={m.id} />
                  {m.name}
                </label>
              ))}
          </Form>
        </Dialog>
      )}
    </section>
  );
}
function Outcomes({ sid }: { sid: string }) {
  const { data, loading, error } = useApi(`/courses/${sid}/outcomes`);
  return (
    <section className="panel">
      <h2>Chuẩn đầu ra học phần</h2>
      <p className="muted">
        Mức đạt được tính từ các điểm đánh giá đã công bố.
      </p>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).map((o: Row) => (
          <div className="outcome" key={o.id}>
            <Badge tone="wine">{o.code}</Badge>
            <div>
              <h3>{o.description}</h3>
              <p>
                Liên kết {o.plo} · Ngưỡng đạt {o.threshold}%
              </p>
              <Progress value={Number(o.attainment) || 0} />
            </div>
            <strong>
              {o.attainment === null
                ? "Chưa đánh giá"
                : `${Math.round(o.attainment)}%`}
            </strong>
          </div>
        ))}
      </State>
    </section>
  );
}
function Analytics({ sid }: { sid: string }) {
  const { data, loading, error } = useApi(`/courses/${sid}/analytics`);
  return (
    <section className="panel">
      <h2>Phân tích học tập</h2>
      <p className="muted">
        Chỉ báo hỗ trợ giảng viên xem xét: từ 3 bài thiếu, điểm dưới 50% hoặc tỷ
        lệ có mặt dưới 70%.
      </p>
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Sinh viên</th>
                <th>Điểm trung bình</th>
                <th>Điểm danh</th>
                <th>Bài thiếu</th>
                <th>Đã hoàn thành</th>
                <th>Chỉ báo</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((r: Row) => (
                <tr key={r.id}>
                  <td>
                    {r.name}
                    <small>{r.student_code}</small>
                  </td>
                  <td>{r.average ?? "—"}%</td>
                  <td>{r.attendance ?? "—"}%</td>
                  <td>{r.missing}</td>
                  <td>{r.completed}</td>
                  <td>
                    {Number(r.missing) >= 3 ||
                    (r.average !== null && r.average < 50) ||
                    (r.attendance !== null && r.attendance < 70) ? (
                      <Badge tone="gold">Cần chú ý</Badge>
                    ) : (
                      <Badge tone="green">Theo dõi định kỳ</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
    </section>
  );
}
