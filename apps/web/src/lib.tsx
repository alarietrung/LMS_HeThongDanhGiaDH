"use client";
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { X, LoaderCircle, Inbox, AlertCircle } from "lucide-react";
export type Row = Record<string, any>;
let csrf = "";
export const setCsrf = (value: string) => {
  csrf = value;
};
export async function api(
  path: string,
  method = "GET",
  body?: any,
): Promise<any> {
  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    headers["X-CSRF-Token"] = csrf;
    headers["Idempotency-Key"] = body?.idempotency_key || crypto.randomUUID();
  }
  const response = await fetch(
    path.startsWith("/auth") ? path : `/api/v1${path}`,
    {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(
      payload.error?.message || payload.message || "Không thể kết nối máy chủ.",
    );
  return payload.data;
}
export const Session = createContext<{
  me: Row;
  version: number;
  refresh: () => void;
  toast: (message: string) => void;
  logout: () => void;
}>({
  me: {},
  version: 0,
  refresh: () => {},
  toast: () => {},
  logout: () => {},
});
export const useSession = () => useContext(Session);
export function useApi(path: string | null) {
  const { version } = useSession();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    api(path)
      .then((v) => {
        if (active) setData(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version]);
  return { data, error, loading };
}
export function State({
  loading,
  error,
  empty,
  children,
}: {
  loading?: boolean;
  error?: string;
  empty?: boolean;
  children: React.ReactNode;
}) {
  if (loading)
    return (
      <div className="skeleton-stack" aria-label="Đang tải" role="status">
        <div />
        <div />
        <div />
      </div>
    );
  if (error)
    return (
      <div className="state error" role="alert">
        <AlertCircle />
        <h3>Chưa thể tải nội dung</h3>
        <p>{error}</p>
        <button onClick={() => location.reload()}>Thử lại</button>
      </div>
    );
  if (empty) return <Empty />;
  return <>{children}</>;
}
export function Empty({
  text = "Chưa có nội dung ở đây",
  detail = "Nội dung mới sẽ xuất hiện khi được cập nhật.",
}: {
  text?: string;
  detail?: string;
}) {
  return (
    <div className="state">
      <Inbox size={36} />
      <h3>{text}</h3>
      <p>{detail}</p>
    </div>
  );
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide" : ""}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Đóng" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Form({
  onSubmit,
  children,
  label = "Lưu thay đổi",
  resetOnSuccess = false,
}: {
  onSubmit: (data: FormData) => Promise<void>;
  children: React.ReactNode;
  label?: string;
  resetOnSuccess?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        setBusy(true);
        setError("");
        try {
          await onSubmit(data);
          if (resetOnSuccess) form.reset();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        {children}
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button className="button primary" type="submit">
            {busy && <LoaderCircle className="spin" size={16} />}{" "}
            {busy ? "Đang lưu…" : label}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export function Field({
  label,
  name,
  type = "text",
  required = true,
  value,
  children,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value?: any;
  children?: React.ReactNode;
  [key: string]: any;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <i> *</i>}
      </span>
      {children ||
        (type === "textarea" ? (
          <textarea
            name={name}
            required={required}
            defaultValue={value}
            rows={5}
            {...props}
          />
        ) : (
          <input
            name={name}
            type={type}
            required={required}
            defaultValue={value}
            {...props}
          />
        ))}
    </label>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Progress({ value = 0 }: { value: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
export const date = (v: any, withTime = false) =>
  v
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(withTime
          ? { hour: "2-digit", minute: "2-digit", hour12: false }
          : {}),
      }).format(new Date(v))
    : "—";
export const time = (v: any) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(v));
export const localDate = (v = new Date()) =>
  new Date(new Date(v).getTime() + 7 * 3600000).toISOString().slice(0, 16);
export const iso = (v: FormDataEntryValue | null) =>
  new Date(String(v) + "+07:00").toISOString();
export const val = (f: FormData, k: string) => String(f.get(k) || "");
export const initials = (name = "") =>
  name
    .split(" ")
    .slice(-2)
    .map((x) => x[0])
    .join("");
export const statusLabel: Record<string, string> = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã công bố",
  SCHEDULED: "Đã lên lịch",
  SUBMITTED: "Đã nộp",
  LATE: "Nộp trễ",
  RESUBMITTED: "Đã nộp lại",
  GRADED: "Đã chấm",
  RELEASED: "Đã công bố điểm",
  HIDDEN: "Đã ẩn",
  ACTIVE: "Đang học",
  READ_ONLY: "Chỉ xem",
  ARCHIVED: "Lưu trữ",
  PRESENT: "Có mặt",
  ABSENT: "Vắng",
  EXCUSED: "Có phép",
  IN_PROGRESS: "Đang làm",
  PENDING_REVIEW: "Chờ chấm",
  SYNCED: "Đã đồng bộ",
  ERROR: "Cần thử lại",
  PENDING: "Đang chờ",
  OPEN: "Đang mở",
};
export function downloadCsv(name: string, rows: any[][]) {
  const escape = (v: any) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  const blob = new Blob(
    ["\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function upload(sid: string, file: File) {
  const sign = await api(`/courses/${sid}/files/sign`, "POST", {
    name: file.name,
    size: file.size,
  });
  if (sign.mode === "azure") {
    const res = await fetch(sign.uploadUrl, {
      method: "PUT",
      headers: { "x-ms-blob-type": "BlockBlob" },
      body: file,
    });
    if (!res.ok) throw new Error("Không tải được tệp lên kho lưu trữ.");
    return api(`/files/${sign.id}/complete`, "POST", {});
  }
  const f = new FormData();
  f.set("file", file);
  return api(`/courses/${sid}/files`, "POST", f);
}
