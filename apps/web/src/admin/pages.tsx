"use client";
import React, { useState } from "react";
import {
  Shield,
  Users,
  BookOpen,
  Database,
  Activity,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileJson,
  Eye,
} from "lucide-react";
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
  date,
  val,
  statusLabel,
} from "../lib";
import { SectionsAdmin, SupportAdmin } from "./operations";
export function AdminPage() {
  const { me } = useSession(),
    [tab, setTab] = useState("overview");
  if (!me.permissions.includes("system.manage"))
    return (
      <Empty
        text="Bạn không có quyền truy cập khu vực này"
        detail="Liên hệ quản trị nếu bạn cho rằng đây là nhầm lẫn."
      />
    );
  return (
    <>
      <PageHead
        title="Quản trị hệ thống"
        subtitle="Quản lý quyền truy cập, cấu trúc học vụ và các kết nối."
      />
      <div className="admin-tabs">
        {[
          ["overview", "Tổng quan", Activity],
          ["users", "Người dùng", Users],
          ["roles", "Vai trò", Shield],
          ["structure", "Cấu trúc học vụ", BookOpen],
          ["sections", "Lớp học phần", BookOpen],
          ["support", "Hỗ trợ", Users],
          ["sis", "Đồng bộ SIS", Database],
          ["integrations", "Kết nối", Settings],
          ["audit", "Nhật ký", FileJson],
        ].map(([key, label, Icon]: any) => (
          <button
            className={tab === key ? "active" : ""}
            key={key}
            onClick={() => setTab(key)}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" || tab === "integrations" ? (
        <Overview integrationsOnly={tab === "integrations"} />
      ) : tab === "users" ? (
        <UsersAdmin />
      ) : tab === "roles" ? (
        <Roles />
      ) : tab === "structure" ? (
        <Structure />
      ) : tab === "sections" ? (
        <SectionsAdmin />
      ) : tab === "support" ? (
        <SupportAdmin />
      ) : tab === "sis" ? (
        <Sis />
      ) : (
        <Audit />
      )}
    </>
  );
}
function Overview({ integrationsOnly }: { integrationsOnly: boolean }) {
  const { data, loading, error } = useApi("/admin/overview");
  return (
    <State loading={loading} error={error}>
      {data && (
        <>
          {!integrationsOnly && (
            <div className="stats-grid">
              {[
                [Users, data.counts.users, "Người dùng hoạt động"],
                [BookOpen, data.counts.courses, "Lớp học phần"],
                [FileJson, data.counts.submissions, "Bài nộp"],
                [
                  Database,
                  `${(Number(data.counts.storage) / 1048576).toFixed(1)} MB`,
                  "Dung lượng học liệu",
                ],
              ].map(([Icon, n, label]: any) => (
                <div className="stat-card" key={label}>
                  <span className="stat-icon wine">
                    <Icon size={23} />
                  </span>
                  <div>
                    <strong>{n}</strong>
                    <span>{label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="panel">
            <h2>Kết nối và hạ tầng</h2>
            <div className="integration-grid">
              {[
                [
                  "Microsoft Entra ID & Graph",
                  data.integrations.microsoft,
                  "Đăng nhập trường, Outlook và Microsoft Teams.",
                ],
                [
                  "Student Information System",
                  data.integrations.sis,
                  "Nguồn dữ liệu chuẩn về người học và lớp học phần.",
                ],
                [
                  "Azure Blob Storage",
                  data.integrations.storage,
                  "Kho tệp riêng tư với URL tải lên có thời hạn.",
                ],
                [
                  "Redis",
                  data.integrations.redis,
                  "Hạ tầng hàng đợi và bộ nhớ đệm.",
                ],
              ].map(([name, ready, desc]: any) => (
                <div className="integration-card" key={name}>
                  <div className="section-head">
                    <Settings size={23} />
                    <Badge tone={ready ? "green" : "gold"}>
                      {ready ? "Đã có cấu hình" : "Chưa cấu hình"}
                    </Badge>
                  </div>
                  <h3>{name}</h3>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
            <div className="info">
              <Database size={20} /> Cơ sở dữ liệu: {data.integrations.database}
              {data.integrations.demo && " · Môi trường dùng thử"}
            </div>
          </div>
          {integrationsOnly && (
            <div className="panel">
              <h2>Thiết lập kết nối trường</h2>
              <p>
                Cấu hình máy chủ qua tệp .env hoặc kho secrets của môi trường
                triển khai.
              </p>
              <ol className="setup-list">
                <li>
                  <strong>Microsoft Entra ID</strong>
                  <p>
                    Đăng ký ứng dụng trong tenant của trường, thiết lập redirect
                    URI và quyền Microsoft Graph. Khớp microsoft_id từ SIS với
                    Object ID của tài khoản.
                  </p>
                </li>
                <li>
                  <strong>Microsoft Teams</strong>
                  <p>
                    Giảng viên đăng nhập Microsoft để cấp quyền
                    Calendars.ReadWrite. Buổi học được tạo dưới dạng Outlook
                    Event có Teams.
                  </p>
                </li>
                <li>
                  <strong>SIS</strong>
                  <p>
                    Dùng màn hình đồng bộ để kiểm tra dữ liệu JSON, xem trước và
                    xác nhận nhập. Lịch đồng bộ tự động cần adapter của SIS thực
                    tế.
                  </p>
                </li>
                <li>
                  <strong>Triển khai HTTPS</strong>
                  <p>
                    Kết nối tên miền và HTTPS để sử dụng cookie an toàn và cài
                    ứng dụng trên Android/iPhone.
                  </p>
                </li>
              </ol>
            </div>
          )}
        </>
      )}
    </State>
  );
}
function UsersAdmin() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [edit, setEdit] = useState<Row | null>(null);
  const { data, loading, error } = useApi(
      `/admin/users?page=${page}&q=${encodeURIComponent(q)}`,
    ),
    roles = useApi("/admin/roles"),
    { refresh, toast } = useSession();
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Người dùng</h2>
        <input
          className="compact-search"
          aria-label="Tìm người dùng"
          placeholder="Tên hoặc email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Họ tên</th>
                <th>Mã / Email</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data || []).map((u: Row) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                  </td>
                  <td>
                    {u.student_code}
                    <small>{u.email}</small>
                  </td>
                  <td>{u.roles?.join(", ")}</td>
                  <td>
                    <Badge tone={u.active ? "green" : "wine"}>
                      {u.active ? "Hoạt động" : "Tạm khóa"}
                    </Badge>
                  </td>
                  <td>
                    <button className="button" onClick={() => setEdit(u)}>
                      Quản lý quyền
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
      <Pager page={page} setPage={setPage} next={data?.length === 30} />
      {edit && (
        <Dialog
          title={`Quyền truy cập · ${edit.name}`}
          onClose={() => setEdit(null)}
        >
          <Form
            onSubmit={async (f) => {
              await api(`/admin/users/${edit.id}`, "PATCH", {
                active: f.get("active") === "on",
                role: val(f, "role") || undefined,
                revoke: f.get("revoke") === "on",
              });
              setEdit(null);
              refresh();
              toast("Đã cập nhật quyền và ghi nhật ký.");
            }}
          >
            <p className="muted">
              Thông tin học vụ do SIS quản lý. Thay đổi vai trò sẽ thu hồi các
              phiên đăng nhập hiện tại.
            </p>
            <Field name="role" label="Vai trò mới" required={false}>
              <select name="role">
                <option value="">Giữ nguyên vai trò hiện tại</option>
                {(roles.data || []).map((r: Row) => (
                  <option value={r.id} key={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input
                type="checkbox"
                name="active"
                defaultChecked={edit.active}
              />
              Cho phép truy cập LMS
            </label>
            <label className="check">
              <input type="checkbox" name="revoke" />
              Thu hồi tất cả phiên đăng nhập
            </label>
          </Form>
        </Dialog>
      )}
    </section>
  );
}
function Roles() {
  const { data, loading, error } = useApi("/admin/roles"),
    { me, refresh, toast } = useSession();
  const [edit, setEdit] = useState<Row | null>(null);
  return (
    <section className="panel">
      <h2>Vai trò và quyền</h2>
      <p className="muted">
        Quyền được lưu độc lập với vai trò. Quyền học phần còn phụ thuộc phân
        công trong lớp.
      </p>
      <State loading={loading} error={error}>
        {(data || []).map((r: Row) => (
          <details className="role-card" key={r.id}>
            <summary>
              <strong>{r.name}</strong>
              <Badge>{r.permissions.length} quyền</Badge>
            </summary>
            <div className="permission-list">
              {r.permissions.map((p: string) => (
                <code key={p}>{p}</code>
              ))}
              {!r.permissions.length && (
                <p>Vai trò đã được khai báo, chưa được cấp quyền vận hành.</p>
              )}
            </div>
            {r.id !== "super_admin" &&
              !me.roles.some((x: Row) => x.id === r.id) && (
                <button className="button" onClick={() => setEdit(r)}>
                  Điều chỉnh quyền
                </button>
              )}
          </details>
        ))}
      </State>
      {edit && (
        <Dialog title={`Quyền · ${edit.name}`} onClose={() => setEdit(null)}>
          <Form
            onSubmit={async (f) => {
              await api(`/admin/roles/${edit.id}`, "PATCH", {
                permissions: f.getAll("permissions"),
              });
              setEdit(null);
              refresh();
              toast("Đã cập nhật quyền và ghi nhật ký.");
            }}
          >
            <p>
              Áp dụng cho toàn bộ người dùng đang có vai trò này. Phân công học
              phần vẫn được kiểm tra riêng.
            </p>
            {data
              .find((r: Row) => r.id === "super_admin")
              ?.permissions.map((p: string) => (
                <label className="check" key={p}>
                  <input
                    type="checkbox"
                    name="permissions"
                    value={p}
                    defaultChecked={edit.permissions.includes(p)}
                  />
                  {p}
                </label>
              ))}
          </Form>
        </Dialog>
      )}
    </section>
  );
}
function Structure() {
  const { data, loading, error } = useApi("/admin/structure");
  return (
    <State loading={loading} error={error}>
      {data && (
        <>
          <div className="info">
            <Shield size={20} />
            Dữ liệu học vụ chỉ đọc tại LMS. Cập nhật thông qua đồng bộ SIS.
          </div>
          <div className="structure-grid">
            {[
              ["faculties", "Khoa"],
              ["departments", "Bộ môn"],
              ["programs", "Chương trình đào tạo"],
              ["terms", "Học kỳ"],
            ].map(([key, label]) => (
              <section className="panel" key={key}>
                <h2>{label}</h2>
                {data[key].map((r: Row) => (
                  <div className="structure-item" key={r.id}>
                    <BookOpen size={18} />
                    <span>
                      <strong>{r.name}</strong>
                      {r.academic_year && (
                        <small>
                          {r.academic_year} · {date(r.starts_at)} –{" "}
                          {date(r.ends_at)}
                        </small>
                      )}
                    </span>
                  </div>
                ))}
              </section>
            ))}
          </div>
          <section className="panel">
            <h2>Danh mục môn học</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Mã môn</th>
                    <th>Tên môn</th>
                    <th>Tín chỉ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.courses.map((c: Row) => (
                    <tr key={c.id}>
                      <td>{c.code}</td>
                      <td>{c.name}</td>
                      <td>{c.credits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </State>
  );
}
const sample = {
  users: [
    {
      external_id: "SIS-SV-003",
      name: "Sinh viên thử nghiệm",
      email: "sv003@example.edu.vn",
      student_code: "SV003",
    },
  ],
  courses: [
    {
      external_id: "SIS-CS101",
      code: "CS101",
      name: "Nhập môn công nghệ thông tin",
      credits: 3,
    },
  ],
  terms: [
    {
      external_id: "SIS-2026-HK1",
      name: "Học kỳ 1",
      academic_year: "2026-2027",
      starts_at: "2026-08-01T00:00:00Z",
      ends_at: "2027-01-31T23:59:00Z",
    },
  ],
  sections: [
    {
      external_id: "SIS-CS101-01",
      name: "CS101-01",
      course_external_id: "SIS-CS101",
      term_external_id: "SIS-2026-HK1",
    },
  ],
  enrollments: [
    {
      section_external_id: "SIS-CS101-01",
      user_external_id: "SIS-SV-003",
      kind: "STUDENT",
      active: true,
    },
  ],
};
function Sis() {
  const { data, loading, error } = useApi("/admin/sis"),
    { refresh, toast } = useSession();
  const [preview, setPreview] = useState<Row | null>(null),
    [payload, setPayload] = useState(JSON.stringify(sample, null, 2));
  return (
    <>
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Đồng bộ dữ liệu SIS</h2>
            <p className="muted">
              Kiểm tra → Xem trước → Xác nhận → Thực hiện → Báo cáo.
            </p>
          </div>
          <Badge tone="blue">JSON Adapter</Badge>
        </div>
        <Form
          label="Kiểm tra & xem trước"
          onSubmit={async () => {
            let input;
            try {
              input = JSON.parse(payload);
            } catch {
              throw new Error("JSON không đúng định dạng.");
            }
            setPreview(await api("/admin/sis/preview", "POST", input));
            refresh();
          }}
        >
          <label className="field">
            <span>Dữ liệu từ SIS</span>
            <textarea
              className="code-input"
              rows={15}
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
            />
          </label>
          <p className="muted">
            Nạp theo mã nguồn bên ngoài. Lặp lại dữ liệu không tạo thêm lớp hoặc
            enrollment trùng.
          </p>
        </Form>
      </section>
      <section className="panel">
        <h2>Lịch sử đồng bộ</h2>
        <State loading={loading} error={error} empty={!data?.length}>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Trạng thái</th>
                  <th>Số bản ghi</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((j: Row) => (
                  <tr key={j.id}>
                    <td>{date(j.created_at, true)}</td>
                    <td>
                      <Badge tone={j.status === "COMPLETED" ? "green" : "gold"}>
                        {j.status === "COMPLETED" ? "Hoàn tất" : "Chờ xác nhận"}
                      </Badge>
                    </td>
                    <td>
                      {Object.entries(j.summary)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
      {preview && (
        <Dialog title="Xác nhận đồng bộ SIS" onClose={() => setPreview(null)}>
          <p>
            Các nhóm dữ liệu đã vượt qua kiểm tra cấu trúc. Kiểm tra tham chiếu
            và cập nhật sẽ chạy trong một giao dịch.
          </p>
          <dl className="profile-details">
            {Object.entries(preview.summary).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{String(v)}</dd>
              </React.Fragment>
            ))}
          </dl>
          <Form
            label="Thực hiện đồng bộ"
            onSubmit={async () => {
              await api(`/admin/sis/${preview.id}/execute`, "POST", {});
              setPreview(null);
              refresh();
              toast("Đã đồng bộ dữ liệu SIS.");
            }}
          >
            <div className="info">
              Người dùng và lớp hiện có sẽ được cập nhật theo mã SIS.
            </div>
          </Form>
        </Dialog>
      )}
    </>
  );
}
function Audit() {
  const [page, setPage] = useState(1);
  const { data, loading, error } = useApi(`/admin/audit?page=${page}`);
  return (
    <section className="panel">
      <h2>Nhật ký kiểm toán</h2>
      <p className="muted">
        Theo dõi người thực hiện và những thay đổi quan trọng của hệ thống.
      </p>
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
              </tr>
            </thead>
            <tbody>
              {(data || []).map((a: Row) => (
                <tr key={a.id}>
                  <td>{date(a.created_at, true)}</td>
                  <td>{a.actor || "Hệ thống"}</td>
                  <td>
                    <code>{a.action}</code>
                  </td>
                  <td>
                    {a.resource}
                    <small>{a.resource_id?.slice(0, 8)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </State>
      <Pager page={page} setPage={setPage} next={data?.length === 30} />
    </section>
  );
}
function Pager({
  page,
  setPage,
  next,
}: {
  page: number;
  setPage: (n: number) => void;
  next: boolean;
}) {
  return (
    <div className="pager">
      <button
        className="button"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Trang trước
      </button>
      <span>Trang {page}</span>
      <button
        className="button"
        disabled={!next}
        onClick={() => setPage(page + 1)}
      >
        Trang tiếp
      </button>
    </div>
  );
}
