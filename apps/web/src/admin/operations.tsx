"use client";
import { useState } from "react";
import {
  api,
  useApi,
  useSession,
  Row,
  State,
  Badge,
  Dialog,
  Form,
  Field,
  date,
  val,
  statusLabel,
} from "../lib";
import { Pager } from "../courses/workspace";
export function SectionsAdmin() {
  const [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [edit, setEdit] = useState<Row | null>(null),
    { data, error, loading } = useApi(
      `/admin/sections?page=${page}&q=${encodeURIComponent(q)}`,
    ),
    { refresh, toast } = useSession();
  return (
    <section className="panel">
      <h2>Quản lý lớp học phần</h2>
      <p className="muted">
        Danh sách lớp và thành viên do SIS quản lý. LMS quản lý trạng thái học
        tập và lưu trữ.
      </p>
      <input
        aria-label="Tìm lớp học phần"
        placeholder="Tên lớp hoặc học phần…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
      />
      <State loading={loading} error={error} empty={!data?.length}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lớp / Môn học</th>
                <th>Học kỳ</th>
                <th>Thành viên</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((s: Row) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <small>{s.course}</small>
                  </td>
                  <td>
                    {s.term} · {s.academic_year}
                  </td>
                  <td>{s.members}</td>
                  <td>
                    <Badge>{statusLabel[s.status]}</Badge>
                  </td>
                  <td>
                    <button className="button" onClick={() => setEdit(s)}>
                      Đổi trạng thái
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
          title={`Trạng thái · ${edit.name}`}
          onClose={() => setEdit(null)}
        >
          <Form
            onSubmit={async (f) => {
              await api(`/admin/sections/${edit.id}`, "PATCH", {
                status: val(f, "status"),
              });
              setEdit(null);
              refresh();
              toast("Đã cập nhật trạng thái học phần.");
            }}
          >
            <p>
              Chỉ xem / Lưu trữ sẽ chặn nộp bài và các thao tác ghi mới. Không
              xóa nội dung hoặc điểm số.
            </p>
            <Field name="status" label="Trạng thái">
              <select name="status" defaultValue={edit.status}>
                {["ACTIVE", "READ_ONLY", "ARCHIVED"].map((s) => (
                  <option key={s} value={s}>
                    {statusLabel[s]}
                  </option>
                ))}
              </select>
            </Field>
          </Form>
        </Dialog>
      )}
    </section>
  );
}
export function SupportAdmin() {
  const [page, setPage] = useState(1),
    [status, setStatus] = useState("OPEN"),
    [active, setActive] = useState<string | null>(null),
    { data, error, loading } = useApi(
      `/admin/support?page=${page}&status=${status}`,
    );
  return (
    <section className="panel">
      <div className="section-head">
        <h2>Yêu cầu hỗ trợ</h2>
        <select
          aria-label="Lọc trạng thái yêu cầu"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          {[
            ["ALL", "Tất cả"],
            ["OPEN", "Mới gửi"],
            ["IN_PROGRESS", "Đang xử lý"],
            ["RESOLVED", "Đã giải quyết"],
          ].map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {data?.map((t: Row) => (
          <button
            className="support-row"
            onClick={() => setActive(t.id)}
            key={t.id}
          >
            <span>
              <strong>{t.title}</strong>
              <small>
                {t.student} · {date(t.updated_at, true)}
              </small>
            </span>
            <Badge>{ticketStatus(t.status)}</Badge>
          </button>
        ))}
      </State>
      <Pager page={page} setPage={setPage} next={data?.length === 30} />
      {active && (
        <Dialog
          title="Xử lý yêu cầu hỗ trợ"
          onClose={() => setActive(null)}
          wide
        >
          <SupportThread ticketId={active} staff />
        </Dialog>
      )}
    </section>
  );
}
export const ticketStatus = (s: string) =>
  ({ OPEN: "Mới gửi", IN_PROGRESS: "Đang xử lý", RESOLVED: "Đã giải quyết" })[
    s
  ] || s;
export function SupportThread({
  ticketId,
  staff = false,
}: {
  ticketId: string;
  staff?: boolean;
}) {
  const { data, error, loading } = useApi(`/support/${ticketId}`),
    { refresh, toast } = useSession();
  return (
    <State loading={loading} error={error}>
      {data && (
        <>
          <Badge>{ticketStatus(data.ticket.status)}</Badge>
          <h3>{data.ticket.title}</h3>
          <p className="readable">{data.ticket.content}</p>
          {data.replies.map((r: Row) => (
            <article className="support-reply" key={r.id}>
              <strong>{r.author}</strong>
              <small>{date(r.created_at, true)}</small>
              <p className="readable">{r.content}</p>
            </article>
          ))}
          <Form
            resetOnSuccess
            label="Gửi phản hồi"
            onSubmit={async (f) => {
              await api(`/support/${ticketId}/replies`, "POST", {
                content: val(f, "content"),
                ...(staff ? { status: val(f, "status") } : {}),
              });
              refresh();
              toast("Đã lưu phản hồi.");
            }}
          >
            <Field label="Nội dung phản hồi" name="content" type="textarea" />
            {staff && (
              <Field label="Trạng thái sau phản hồi" name="status">
                <select name="status" defaultValue={data.ticket.status}>
                  {["OPEN", "IN_PROGRESS", "RESOLVED"].map((s) => (
                    <option key={s} value={s}>
                      {ticketStatus(s)}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </Form>
        </>
      )}
    </State>
  );
}
