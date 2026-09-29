"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
  Upload,
  FileText,
  ArrowUpRight,
  ShieldCheck,
  MessageSquare,
} from "lucide-react";
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
  upload,
  downloadCsv,
} from "../lib";
export function Pager({
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
        Trang sau
      </button>
    </div>
  );
}
export function FileLibrary({ sid, manage }: { sid: string; manage: boolean }) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [open, setOpen] = useState(false);
  const { data, error, loading } = useApi(
      `/courses/${sid}/files?q=${encodeURIComponent(q)}&page=${page}`,
    ),
    { me, refresh, toast } = useSession();
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Thư viện học liệu</h2>
          <p>Tệp dùng chung của lớp và tệp riêng của bạn.</p>
        </div>
        <button className="button primary" onClick={() => setOpen(true)}>
          <Upload size={17} />
          Tải tệp lên
        </button>
      </div>
      <input
        aria-label="Tìm tên tệp"
        placeholder="Tìm theo tên tệp…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="file-grid">
          {data?.map((f: Row) => (
            <article className="file-tile" key={f.id}>
              <FileText size={27} />
              <h3>{f.name}</h3>
              <small>
                {(f.size / 1024).toFixed(1)} KB · {date(f.created_at)}
              </small>
              <Badge tone={f.visibility === "PRIVATE" ? "gold" : "green"}>
                {
                  {
                    PRIVATE: "Riêng tư",
                    COURSE: "Cả học phần",
                    GROUP: "Trong nhóm",
                  }[f.visibility as "PRIVATE" | "COURSE" | "GROUP"]
                }
              </Badge>
              <p>{f.owner}</p>
              <div className="actions">
                <a className="button" href={`/api/v1/files/${f.id}`}>
                  Tải xuống
                </a>
                {/^(image\/|audio\/|video\/|application\/pdf$)/.test(
                  f.mime,
                ) && (
                  <a
                    className="button"
                    href={`/api/v1/files/${f.id}?inline=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xem
                    <ArrowUpRight size={14} />
                  </a>
                )}
              </div>
              {f.owner_id === me.id && manage && (
                <button
                  className="text-link file-share"
                  onClick={async () => {
                    try {
                      await api(`/files/${f.id}/sharing`, "PATCH", {
                        visibility:
                          f.visibility === "COURSE" ? "PRIVATE" : "COURSE",
                      });
                      refresh();
                      toast("Đã cập nhật chia sẻ tệp.");
                    } catch (e: any) {
                      toast(e.message);
                    }
                  }}
                >
                  {f.visibility === "COURSE"
                    ? "Chuyển về riêng tư"
                    : "Chia sẻ với học phần"}
                </button>
              )}
            </article>
          ))}
        </div>
      </State>
      <Pager page={page} setPage={setPage} next={data?.length === 30} />
      {open && (
        <Dialog title="Tải tệp lên thư viện" onClose={() => setOpen(false)}>
          <Form
            label="Tải lên và lưu"
            onSubmit={async (f) => {
              const file = f.get("file") as File;
              if (!file?.size) throw new Error("Chưa chọn tệp.");
              const result = await upload(sid, file);
              if (f.get("share") === "on")
                await api(`/files/${result.id}/sharing`, "PATCH", {
                  visibility: "COURSE",
                });
              setOpen(false);
              refresh();
              toast("Đã tải tệp lên máy chủ.");
            }}
          >
            <Field label="Chọn tệp (tối đa 10 MB)" name="file" type="file" />
            {manage && (
              <label className="check">
                <input type="checkbox" name="share" />
                Cho phép các thành viên học phần xem tệp
              </label>
            )}
            <p className="muted">
              Mặc định tệp chỉ dành cho bạn và người có quyền quản lý học phần.
              Bài nộp không tự động chia sẻ với sinh viên khác.
            </p>
          </Form>
        </Dialog>
      )}
    </section>
  );
}
export function GroupWorkspace({
  groupId,
  sid,
}: {
  groupId: string;
  sid: string;
}) {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi(
      `/groups/${groupId}/workspace?page=${page}`,
    ),
    { refresh, toast } = useSession();
  return (
    <State loading={loading} error={error}>
      {data && (
        <>
          <h3>{data.group.name}</h3>
          <p className="info">
            <ShieldCheck size={18} />
            Chỉ thành viên nhóm và người quản lý học phần truy cập được nội dung
            này.
          </p>
          <Form
            resetOnSuccess
            label="Đăng vào nhóm"
            onSubmit={async (f) => {
              const file = f.get("file") as File;
              const file_ids = [];
              if (file?.size) {
                const uploaded = await upload(sid, file);
                await api(`/files/${uploaded.id}/sharing`, "PATCH", {
                  visibility: "GROUP",
                  group_id: groupId,
                });
                file_ids.push(uploaded.id);
              }
              await api(`/groups/${groupId}/posts`, "POST", {
                content: val(f, "content"),
                file_ids,
              });
              refresh();
              toast("Đã đăng vào không gian nhóm.");
            }}
          >
            <Field label="Trao đổi với nhóm" name="content" type="textarea" />
            <Field
              label="Tệp đính kèm (không bắt buộc)"
              name="file"
              type="file"
              required={false}
            />
          </Form>
          <h3>Trao đổi gần đây</h3>
          {data.posts.length ? (
            data.posts.map((p: Row) => (
              <article className="panel" key={p.id}>
                <strong>{p.author}</strong>
                <small> · {date(p.created_at, true)}</small>
                <p className="readable">{p.content}</p>
                {p.file_ids.map((id: string) => (
                  <a
                    key={id}
                    className="text-link"
                    href={`/api/v1/files/${id}`}
                  >
                    <FileText size={16} />
                    Tải tệp đính kèm
                  </a>
                ))}
              </article>
            ))
          ) : (
            <Empty
              text="Bắt đầu cuộc trao đổi đầu tiên"
              detail="Ghi chú và tệp của nhóm sẽ xuất hiện tại đây."
            />
          )}
          <Pager
            page={page}
            setPage={setPage}
            next={data.posts.length === 30}
          />
          <h3>Tệp của nhóm</h3>
          {data.files.map((f: Row) => (
            <a key={f.id} className="list-card" href={`/api/v1/files/${f.id}`}>
              <FileText size={18} />
              {f.name}
              <small>{(f.size / 1024).toFixed(1)} KB</small>
            </a>
          ))}
        </>
      )}
    </State>
  );
}
export function TeacherQueue({ compact = false }: { compact?: boolean }) {
  const [page, setPage] = useState(1),
    { data, loading, error } = useApi(
      `/teaching/queue?page=${page}&limit=${compact ? 5 : 30}`,
    );
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Bài cần chấm</h2>
          <p className="muted">
            Bài nộp mới nhất và bài kiểm tra đang chờ đánh giá.
          </p>
        </div>
        {compact && (
          <Link className="text-link" href="/teaching">
            Xem tất cả
            <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {data?.map((a: Row) => (
          <Link
            className="grading-queue-row"
            key={a.id}
            href={`/courses/${a.section_id}?tab=${a.kind === "QUIZ" ? "quizzes" : "assignments"}`}
          >
            <span className="activity-icon">
              <FileText size={21} />
            </span>
            <div>
              <strong>{a.title}</strong>
              <p>
                {a.student} · {a.course}
              </p>
              <small>Nộp lúc {date(a.created_at, true)}</small>
            </div>
            <Badge tone="gold">
              {a.kind === "QUIZ" ? "Kiểm tra" : "Bài tập"}
            </Badge>
            <ArrowUpRight size={17} />
          </Link>
        ))}
      </State>
      {!compact && (
        <Pager page={page} setPage={setPage} next={data?.length === 30} />
      )}
    </section>
  );
}
export function OutcomeManager({ sid }: { sid: string }) {
  const outcomes = useApi(`/courses/${sid}/outcomes`),
    assignments = useApi(`/courses/${sid}/assignments`),
    report = useApi(`/courses/${sid}/outcome-report`),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="section-head">
        <h2>Quản lý chuẩn đầu ra</h2>
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          Thêm CLO
        </button>
      </div>
      <State
        loading={outcomes.loading}
        error={outcomes.error}
        empty={!outcomes.data?.length}
      >
        {outcomes.data?.map((o: Row) => (
          <div className="panel" key={o.id}>
            <Badge tone="wine">{o.code}</Badge>
            <h3>{o.description}</h3>
            <p>
              Liên kết {o.plo} · Ngưỡng đạt {o.threshold}%
            </p>
          </div>
        ))}
      </State>
      <section className="panel">
        <div className="section-head">
          <h2>Kết quả theo sinh viên</h2>
          <button
            className="button"
            disabled={!report.data?.length}
            onClick={() =>
              downloadCsv("ket-qua-clo.csv", [
                ["CLO", "Sinh viên", "Mức đạt (%)", "Trọng số đã đánh giá (%)"],
                ...report.data.map((r: Row) => [
                  r.code,
                  r.student,
                  r.attainment,
                  r.assessed_weight,
                ]),
              ])
            }
          >
            Xuất CSV
          </button>
        </div>
        <State
          loading={report.loading}
          error={report.error}
          empty={!report.data?.length}
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>CLO</th>
                  <th>Sinh viên</th>
                  <th>Đã đánh giá</th>
                  <th>Mức đạt</th>
                </tr>
              </thead>
              <tbody>
                {report.data?.map((r: Row) => (
                  <tr key={`${r.id}-${r.user_id}`}>
                    <td>{r.code}</td>
                    <td>{r.student}</td>
                    <td>{Number(r.assessed_weight)}%</td>
                    <td>
                      <Badge
                        tone={
                          Number(r.assessed_weight) === 0
                            ? "neutral"
                            : Number(r.attainment) >= r.threshold
                              ? "green"
                              : "gold"
                        }
                      >
                        {Number(r.assessed_weight) === 0
                          ? "Chưa đánh giá"
                          : `${Number(r.attainment).toFixed(1)}%`}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </State>
      </section>
      {open && (
        <Dialog
          title="Tạo chuẩn đầu ra và liên kết đánh giá"
          onClose={() => setOpen(false)}
          wide
        >
          <Form
            onSubmit={async (f) => {
              const mappings = (assignments.data || [])
                .map((a: Row) => ({
                  assignment_id: a.id,
                  weight: Number(f.get(a.id) || 0),
                }))
                .filter((a: Row) => a.weight > 0);
              await api(`/courses/${sid}/outcomes`, "POST", {
                code: val(f, "code"),
                description: val(f, "description"),
                plo: val(f, "plo"),
                mappings,
              });
              setOpen(false);
              refresh();
              toast("Đã tạo chuẩn đầu ra học phần.");
            }}
          >
            <Field label="Mã chuẩn đầu ra" name="code" placeholder="CLO1" />
            <Field label="Mô tả" name="description" type="textarea" />
            <Field label="Liên kết PLO" name="plo" />
            <h3>Trọng số đánh giá (tổng 100%)</h3>
            {assignments.data?.map((a: Row) => (
              <Field
                key={a.id}
                name={a.id}
                label={a.title}
                type="number"
                min={0}
                max={100}
                value={0}
              />
            ))}
            {!assignments.data?.length && (
              <p>Cần tạo bài tập trước khi liên kết đánh giá.</p>
            )}
          </Form>
        </Dialog>
      )}
    </>
  );
}
