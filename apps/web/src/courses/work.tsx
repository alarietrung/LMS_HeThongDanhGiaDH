"use client";
import React, { useState } from "react";
import {
  Plus,
  FileText,
  Clock,
  Upload,
  Download,
  CheckCircle2,
  Pencil,
  ClipboardCheck,
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
  localDate,
  iso,
  val,
  statusLabel,
  downloadCsv,
  upload,
} from "../lib";
import { Pager } from "./workspace";
export function Assignments({ sid, manage }: { sid: string; manage: boolean }) {
  const { data, loading, error } = useApi(`/courses/${sid}/assignments`),
    rubrics = useApi(manage ? `/courses/${sid}/rubrics` : null),
    { refresh, toast } = useSession();
  const [create, setCreate] = useState(false),
    [selected, setSelected] = useState<Row | null>(null);
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Bài tập & bài thực hành</h2>
          <p className="muted">Theo dõi thời hạn, nộp bài và nhận phản hồi.</p>
        </div>
        {manage && (
          <button className="button primary" onClick={() => setCreate(true)}>
            <Plus size={17} />
            Giao bài tập
          </button>
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="assignment-list">
          {(data || []).map((a: Row) => (
            <article className="assignment-card" key={a.id}>
              <span className="activity-icon">
                <FileText size={24} />
              </span>
              <div className="assignment-copy">
                <div className="section-head">
                  <Badge
                    tone={
                      a.submitted_at
                        ? "green"
                        : new Date(a.due_at) < new Date()
                          ? "wine"
                          : "gold"
                    }
                  >
                    {a.submitted_at
                      ? "Đã nộp"
                      : new Date(a.due_at) < new Date()
                        ? "Quá hạn"
                        : "Chưa nộp"}
                  </Badge>
                  <small>{a.points} điểm</small>
                </div>
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                <div className="metadata">
                  <span>
                    <Clock size={15} />
                    Hạn nộp: {date(a.due_at, true)}
                  </span>
                  <span>
                    {a.attempts}/{a.max_attempts} lần nộp
                  </span>
                  {a.rubric_title && <span>Rubric: {a.rubric_title}</span>}
                </div>
              </div>
              <button className="button primary" onClick={() => setSelected(a)}>
                {manage
                  ? "Xem bài & chấm"
                  : a.submitted_at
                    ? "Xem bài đã nộp"
                    : "Nộp bài"}{" "}
                <Upload size={16} />
              </button>
            </article>
          ))}
        </div>
      </State>
      {create && (
        <Dialog title="Giao bài tập mới" onClose={() => setCreate(false)} wide>
          <Form
            label="Tạo bài tập"
            onSubmit={async (f) => {
              await api(`/courses/${sid}/assignments`, "POST", {
                title: val(f, "title"),
                description: val(f, "description"),
                due_at: iso(f.get("due_at")),
                closes_at: val(f, "closes_at") ? iso(f.get("closes_at")) : null,
                points: Number(f.get("points")),
                max_attempts: Number(f.get("max_attempts")),
                late_allowed: f.get("late_allowed") === "on",
                rubric_id: val(f, "rubric_id") || null,
                status: val(f, "status"),
              });
              setCreate(false);
              refresh();
              toast("Đã tạo bài tập.");
            }}
          >
            <Field name="title" label="Tên bài tập" />
            <Field name="description" label="Yêu cầu bài tập" type="textarea" />
            <div className="form-grid">
              <Field
                name="due_at"
                label="Hạn nộp (giờ Việt Nam)"
                type="datetime-local"
              />
              <Field
                name="closes_at"
                label="Đóng bài tập"
                type="datetime-local"
                required={false}
              />
              <Field
                name="points"
                label="Điểm tối đa"
                type="number"
                value={10}
                min={1}
              />
              <Field
                name="max_attempts"
                label="Số lần nộp"
                type="number"
                value={3}
                min={1}
                max={20}
              />
            </div>
            <Field label="Rubric" name="rubric_id" required={false}>
              <select name="rubric_id">
                <option value="">Không dùng rubric</option>
                {(rubrics.data || []).map((r: Row) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="status" label="Trạng thái">
              <select name="status">
                <option value="PUBLISHED">Công bố ngay</option>
                <option value="DRAFT">Bản nháp</option>
              </select>
            </Field>
            <label className="check">
              <input name="late_allowed" type="checkbox" defaultChecked />
              Cho phép nộp trễ
            </label>
          </Form>
        </Dialog>
      )}
      {selected && (
        <Dialog title={selected.title} onClose={() => setSelected(null)} wide>
          <SubmissionPanel assignment={selected} sid={sid} manage={manage} />
        </Dialog>
      )}
    </section>
  );
}
function SubmissionPanel({
  assignment: a,
  sid,
  manage,
}: {
  assignment: Row;
  sid: string;
  manage: boolean;
}) {
  const { data, loading, error } = useApi(`/assignments/${a.id}/submissions`),
    { refresh, toast } = useSession();
  const [grading, setGrading] = useState<Row | null>(null);
  return (
    <>
      <p className="readable">{a.description}</p>
      <div className="info">
        Hạn nộp {date(a.due_at, true)} · Tối đa {a.max_attempts} lần ·{" "}
        {a.late_allowed ? "Cho phép nộp trễ" : "Không nhận bài trễ"}
      </div>
      {a.rubric && (
        <details className="rubric-preview">
          <summary>Tiêu chí chấm điểm</summary>
          {a.rubric.map((c: Row) => (
            <p key={c.id}>
              <strong>{c.title}</strong> — {c.max} điểm
            </p>
          ))}
        </details>
      )}
      {!manage && (
        <Form
          label="Nộp bài"
          onSubmit={async (f) => {
            const file = f.get("file") as File;
            const files = [];
            if (file?.size) files.push((await upload(sid, file)).id);
            await api(`/assignments/${a.id}/submissions`, "POST", {
              text: val(f, "text"),
              url: val(f, "url") || undefined,
              files,
            });
            refresh();
            toast("Bài nộp đã được lưu cùng thời gian và số lần nộp.");
          }}
        >
          <Field
            name="text"
            label="Nội dung bài nộp"
            type="textarea"
            required={false}
          />
          <Field
            name="url"
            label="Liên kết bài làm"
            type="url"
            required={false}
          />
          <Field
            name="file"
            label="Đính kèm tệp (tối đa 10 MB)"
            type="file"
            required={false}
            accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.txt,.md,.csv,.zip,.mp3,.mp4,.wav"
          />
          <p className="muted">
            Mỗi lần nộp tạo một phiên bản mới. Các phiên bản trước được giữ lại.
          </p>
        </Form>
      )}
      <h3>{manage ? "Bài nộp của lớp" : "Lịch sử bài nộp"}</h3>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).map((s: Row) => (
          <article className="submission" key={s.id}>
            <div className="section-head">
              <strong>
                {manage ? s.student : "Bài nộp của bạn"} · Lần {s.attempt}
              </strong>
              <Badge tone="green">{statusLabel[s.status]}</Badge>
            </div>
            <small>{date(s.created_at, true)}</small>
            <p className="readable">{s.text}</p>
            {s.url && (
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-link"
              >
                Mở liên kết bài nộp
              </a>
            )}
            <div className="actions">
              {s.files.map((f: string, i: number) => (
                <a className="button" key={f} href={`/api/v1/files/${f}`}>
                  <Download size={15} />
                  Tệp đính kèm {i + 1}
                </a>
              ))}
              {manage && (
                <button
                  className="button primary"
                  onClick={() => setGrading(s)}
                >
                  <Pencil size={16} />
                  Chấm bài
                </button>
              )}
            </div>
          </article>
        ))}
      </State>
      {grading && (
        <Dialog
          title={`Chấm bài · ${grading.student}`}
          onClose={() => setGrading(null)}
        >
          <Form
            label="Lưu điểm nháp"
            onSubmit={async (f) => {
              const rubric_scores: Row = {};
              for (const c of a.rubric || [])
                rubric_scores[c.id] = Number(f.get(`rubric_${c.id}`));
              const score = a.rubric?.length
                ? Object.values(rubric_scores).reduce(
                    (s: number, n: any) => s + Number(n),
                    0,
                  )
                : Number(f.get("score"));
              await api(`/submissions/${grading.id}/grade`, "POST", {
                score,
                feedback: val(f, "feedback"),
                rubric_scores,
              });
              setGrading(null);
              refresh();
              toast(
                "Đã lưu điểm nháp. Công bố điểm trong sổ điểm để sinh viên xem.",
              );
            }}
          >
            {a.rubric?.length ? (
              a.rubric.map((c: Row) => (
                <Field
                  key={c.id}
                  label={`${c.title} / ${c.max}`}
                  name={`rubric_${c.id}`}
                  type="number"
                  min={0}
                  max={c.max}
                  step="0.1"
                />
              ))
            ) : (
              <Field
                name="score"
                label={`Điểm / ${a.points}`}
                type="number"
                min={0}
                max={a.points}
                step="0.1"
              />
            )}
            <Field
              name="feedback"
              label="Nhận xét"
              type="textarea"
              required={false}
            />
          </Form>
        </Dialog>
      )}
    </>
  );
}
export function Grades({ sid }: { sid: string }) {
  const [page, setPage] = useState(1),
    [exporting, setExporting] = useState(false);
  const { data, loading, error } = useApi(
      `/courses/${sid}/gradebook?page=${page}`,
    ),
    { refresh, toast } = useSession();
  const [edit, setEdit] = useState<Row | null>(null),
    [weights, setWeights] = useState(false);
  const rows = data?.grades || [];
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <h2>Sổ điểm học phần</h2>
          <p className="muted">
            {data?.manage
              ? "Điểm nháp chỉ hiển thị với người chấm."
              : "Chỉ hiển thị điểm đã được giảng viên công bố."}
          </p>
        </div>
        <div className="actions">
          {data?.manage && (
            <button className="button" onClick={() => setWeights(true)}>
              Trọng số
            </button>
          )}
          <button
            className="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                const allRows = await api(`/courses/${sid}/gradebook/export`);
                downloadCsv("bang-diem.csv", [
                  [
                    "Sinh viên",
                    "Bài đánh giá",
                    "Nhóm",
                    "Điểm",
                    "Tối đa",
                    "Trạng thái",
                    "Nhận xét",
                  ],
                  ...allRows.map((g: Row) => [
                    g.student,
                    g.title,
                    g.category,
                    g.score,
                    g.max_score,
                    statusLabel[g.status],
                    g.feedback,
                  ]),
                ]);
                toast(`Đã xuất ${allRows.length} dòng điểm.`);
              } catch (e: any) {
                toast(e.message);
              } finally {
                setExporting(false);
              }
            }}
          >
            <Download size={16} />
            {exporting ? "Đang xuất…" : "Xuất toàn bộ CSV"}
          </button>
        </div>
      </div>
      <State loading={loading} error={error}>
        <div className="weight-bar">
          {(data?.categories || []).map((c: Row) => (
            <Badge key={c.name}>
              {c.name} · {c.weight}%
            </Badge>
          ))}
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {data?.manage && <th>Sinh viên</th>}
                  <th>Bài đánh giá</th>
                  <th>Điểm</th>
                  <th>Trạng thái</th>
                  <th>Nhận xét</th>
                  {data?.manage && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((g: Row) => (
                  <tr key={g.id}>
                    {data?.manage && (
                      <td>
                        {g.student}
                        <small>{g.student_code}</small>
                      </td>
                    )}
                    <td>
                      <strong>{g.title}</strong>
                      <small>{g.category}</small>
                    </td>
                    <td>
                      <strong className="score">
                        {Number(g.score).toFixed(1)}
                      </strong>{" "}
                      / {g.max_score}
                    </td>
                    <td>
                      <Badge tone={g.status === "RELEASED" ? "green" : "gold"}>
                        {statusLabel[g.status]}
                      </Badge>
                    </td>
                    <td>{g.feedback || "—"}</td>
                    {data?.manage && (
                      <td>
                        <button className="button" onClick={() => setEdit(g)}>
                          Sửa / Công bố
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            text="Chưa có điểm được công bố"
            detail="Kết quả và phản hồi sẽ xuất hiện sau khi giảng viên công bố."
          />
        )}
        <Pager page={page} setPage={setPage} next={rows.length === 30} />
        {data?.totals?.map((t: Row) => (
          <p className="grade-total" key={t.user_id}>
            <strong>{t.name}</strong>
            <span>
              Điểm tích lũy theo trọng số: <b>{t.weighted.toFixed(2)} / 10</b> ·
              Đã đánh giá {t.availableWeight}%
            </span>
          </p>
        ))}
      </State>
      {edit && (
        <Dialog title="Cập nhật điểm" onClose={() => setEdit(null)}>
          <Form
            onSubmit={async (f) => {
              await api(`/grades/${edit.id}`, "PATCH", {
                score: Number(f.get("score")),
                feedback: val(f, "feedback"),
                status: val(f, "status"),
              });
              setEdit(null);
              refresh();
              toast("Đã cập nhật điểm và lưu lịch sử thay đổi.");
            }}
          >
            <p>
              {edit.student} · {edit.title}
            </p>
            <Field
              name="score"
              label={`Điểm / ${edit.max_score}`}
              type="number"
              min={0}
              max={edit.max_score}
              step="0.1"
              value={edit.score}
            />
            <Field
              name="feedback"
              label="Nhận xét"
              type="textarea"
              value={edit.feedback}
              required={false}
            />
            <Field name="status" label="Trạng thái">
              <select name="status" defaultValue={edit.status}>
                {["DRAFT", "RELEASED", "HIDDEN", "EXCUSED"].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
            </Field>
          </Form>
        </Dialog>
      )}
      {weights && (
        <Dialog title="Trọng số sổ điểm" onClose={() => setWeights(false)}>
          <Form
            onSubmit={async (f) => {
              await api(
                `/courses/${sid}/grade-categories`,
                "POST",
                data.categories.map((c: Row) => ({
                  name: c.name,
                  weight: Number(f.get(c.name)),
                })),
              );
              setWeights(false);
              refresh();
              toast("Đã cập nhật trọng số.");
            }}
          >
            <p>Tổng các trọng số phải bằng 100%.</p>
            {data.categories.map((c: Row) => (
              <Field
                key={c.name}
                name={c.name}
                label={`${c.name} (%)`}
                type="number"
                value={c.weight}
                min={0}
                max={100}
              />
            ))}
          </Form>
        </Dialog>
      )}
    </section>
  );
}
export function Attendance({
  sid,
  manage,
  members,
}: {
  sid: string;
  manage: boolean;
  members: Row[];
}) {
  const { data, loading, error } = useApi(`/courses/${sid}/attendance`),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false),
    [active, setActive] = useState<Row | null>(null);
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Điểm danh học phần</h2>
        {manage && (
          <button className="button primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Mở điểm danh
          </button>
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.sessions?.length}>
        {(data?.sessions || []).map((a: Row) => (
          <div className="list-card" key={a.id}>
            <ClipboardCheck className="wine-text" />
            <div>
              <h3>{a.title}</h3>
              <p>
                {date(a.starts_at, true)} – {date(a.ends_at, true)}
              </p>
              {!manage && (
                <Badge tone="green">
                  {statusLabel[
                    data.records.find((x: Row) => x.session_id === a.id)?.status
                  ] || "Chưa điểm danh"}
                </Badge>
              )}
            </div>
            <button className="button" onClick={() => setActive(a)}>
              {manage ? "Danh sách" : "Nhập mã"}
            </button>
          </div>
        ))}
      </State>
      {open && (
        <Dialog title="Tạo buổi điểm danh" onClose={() => setOpen(false)}>
          <Form
            onSubmit={async (f) => {
              await api(`/courses/${sid}/attendance`, "POST", {
                title: val(f, "title"),
                starts_at: iso(f.get("starts_at")),
                ends_at: iso(f.get("ends_at")),
                code: val(f, "code"),
              });
              setOpen(false);
              refresh();
              toast("Đã mở buổi điểm danh.");
            }}
          >
            <Field name="title" label="Tên buổi học" />
            <Field
              name="starts_at"
              label="Bắt đầu"
              type="datetime-local"
              value={localDate()}
            />
            <Field
              name="ends_at"
              label="Kết thúc"
              type="datetime-local"
              value={localDate(new Date(Date.now() + 3600000))}
            />
            <Field
              name="code"
              label="Mã điểm danh 6 chữ số"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
            />
          </Form>
        </Dialog>
      )}
      {active && (
        <Dialog title={active.title} onClose={() => setActive(null)}>
          {manage ? (
            <div className="attendance-roster">
              {members
                .filter((m) => m.kind === "STUDENT")
                .map((m) => (
                  <label className="roster-row" key={m.id}>
                    <span>{m.name}</span>
                    <select
                      aria-label={`Trạng thái ${m.name}`}
                      value={
                        data.records.find(
                          (x: Row) =>
                            x.session_id === active.id && x.user_id === m.id,
                        )?.status || ""
                      }
                      onChange={async (e) => {
                        try {
                          await api(
                            `/attendance/${active.id}/records`,
                            "POST",
                            { user_id: m.id, status: e.target.value },
                          );
                          refresh();
                          toast("Đã lưu điểm danh.");
                        } catch (e: any) {
                          toast(e.message);
                        }
                      }}
                    >
                      <option value="" disabled>
                        Chưa ghi nhận
                      </option>
                      {["PRESENT", "LATE", "ABSENT", "EXCUSED"].map((s) => (
                        <option key={s} value={s}>
                          {statusLabel[s]}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
            </div>
          ) : (
            <Form
              label="Xác nhận điểm danh"
              onSubmit={async (f) => {
                await api(`/attendance/${active.id}/check-in`, "POST", {
                  code: val(f, "code"),
                });
                setActive(null);
                refresh();
                toast("Điểm danh thành công.");
              }}
            >
              <Field
                name="code"
                label="Mã do giảng viên cung cấp"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
              />
            </Form>
          )}
        </Dialog>
      )}
    </section>
  );
}
export function Rubrics({ sid }: { sid: string }) {
  const { data, loading, error } = useApi(`/courses/${sid}/rubrics`),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false);
  return (
    <section>
      <div className="section-head">
        <h2>Rubric đánh giá</h2>
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          Tạo rubric
        </button>
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).map((r: Row) => (
          <div className="panel" key={r.id}>
            <h3>{r.title}</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tiêu chí</th>
                    <th>Điểm tối đa</th>
                    <th>Mức đánh giá</th>
                  </tr>
                </thead>
                <tbody>
                  {r.criteria.map((c: Row) => (
                    <tr key={c.id}>
                      <td>{c.title}</td>
                      <td>{c.max}</td>
                      <td>
                        {c.levels
                          .map((l: Row) => `${l.label}: ${l.score}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </State>
      {open && (
        <Dialog title="Tạo rubric" onClose={() => setOpen(false)}>
          <Form
            onSubmit={async (f) => {
              const criteria = val(f, "criteria")
                .split("\n")
                .filter(Boolean)
                .map((line, i) => {
                  const [name, score] = line.split("|");
                  return {
                    id: `c${i}`,
                    title: name.trim(),
                    max: Number(score),
                    levels: [],
                  };
                });
              await api(`/courses/${sid}/rubrics`, "POST", {
                title: val(f, "title"),
                criteria,
              });
              setOpen(false);
              refresh();
              toast("Đã lưu rubric.");
            }}
          >
            <Field name="title" label="Tên rubric" />
            <Field
              name="criteria"
              label="Tiêu chí (mỗi dòng: Tên | điểm tối đa)"
              type="textarea"
              value={"Kết quả kỹ thuật | 7\nTrình bày báo cáo | 3"}
            />
          </Form>
        </Dialog>
      )}
    </section>
  );
}
