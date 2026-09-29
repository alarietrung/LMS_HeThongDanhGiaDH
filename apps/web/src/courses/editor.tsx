"use client";
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import DOMPurify from "dompurify";
import {
  api,
  useApi,
  useSession,
  Row,
  Form,
  Field,
  iso,
  val,
  date,
  localDate,
  statusLabel,
} from "../lib";

export const textHtml = (value: string) =>
  value
    .split("\n")
    .map(
      (line) =>
        `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;") || "<br>"}</p>`,
    )
    .join("");
export function RichContent({
  content,
  format = "TEXT",
}: {
  content: string;
  format?: string;
}) {
  const [clean, setClean] = useState("");
  useEffect(() => {
    if (format === "HTML")
      setClean(
        DOMPurify.sanitize(content, {
          USE_PROFILES: { html: true },
          ADD_ATTR: ["target"],
          FORBID_TAGS: ["style", "iframe", "form", "input", "button"],
        }),
      );
  }, [content, format]);
  return format === "HTML" ? (
    <div className="rich-content" dangerouslySetInnerHTML={{ __html: clean }} />
  ) : (
    <div className="lesson-content">{content}</div>
  );
}
export function RichEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const [version, setVersion] = useState(0),
    [insert, setInsert] = useState<"link" | "image" | null>(null),
    [url, setUrl] = useState(""),
    [alt, setAlt] = useState(""),
    [error, setError] = useState("");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false, underline: false }),
      Link.configure({ openOnClick: false, protocols: ["http", "https"] }),
      Underline,
      Image.configure({ allowBase64: false }),
      TableKit,
    ],
    content: value,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Nội dung học liệu có định dạng",
        "aria-multiline": "true",
        class: "rich-content",
      },
    },
    onUpdate: ({ editor }) => callback.current(editor.getHTML()),
    onSelectionUpdate: () => setVersion((x) => x + 1),
  });
  if (!editor) return <p role="status">Đang mở trình soạn thảo…</p>;
  const actions: [string, () => void, boolean?][] = [
    [
      "Đậm",
      () => editor.chain().focus().toggleBold().run(),
      editor.isActive("bold"),
    ],
    [
      "Nghiêng",
      () => editor.chain().focus().toggleItalic().run(),
      editor.isActive("italic"),
    ],
    [
      "Gạch chân",
      () => editor.chain().focus().toggleUnderline().run(),
      editor.isActive("underline"),
    ],
    [
      "Tiêu đề",
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      editor.isActive("heading"),
    ],
    [
      "Danh sách",
      () => editor.chain().focus().toggleBulletList().run(),
      editor.isActive("bulletList"),
    ],
    [
      "Đánh số",
      () => editor.chain().focus().toggleOrderedList().run(),
      editor.isActive("orderedList"),
    ],
    [
      "Trích dẫn",
      () => editor.chain().focus().toggleBlockquote().run(),
      editor.isActive("blockquote"),
    ],
    [
      "Mã",
      () => editor.chain().focus().toggleCodeBlock().run(),
      editor.isActive("codeBlock"),
    ],
    [
      "Liên kết",
      () => {
        setInsert("link");
        setUrl(editor.getAttributes("link").href || "");
      },
      editor.isActive("link"),
    ],
    [
      "Ảnh",
      () => {
        setInsert("image");
        setUrl("");
        setAlt("");
      },
    ],
    [
      "Bảng",
      () =>
        editor
          .chain()
          .focus()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    ],
    ["Hoàn tác", () => editor.chain().focus().undo().run()],
    ["Làm lại", () => editor.chain().focus().redo().run()],
  ];
  return (
    <div className="rich-editor" data-selection-version={version}>
      <div
        className="editor-toolbar"
        role="toolbar"
        aria-label="Định dạng học liệu"
      >
        {actions.map(([label, action, active]) => (
          <button
            key={label}
            type="button"
            aria-pressed={!!active}
            onClick={action}
          >
            {label}
          </button>
        ))}
        {editor.isActive("table") && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              Thêm dòng
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              Thêm cột
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().deleteTable().run()}
            >
              Bỏ bảng
            </button>
          </>
        )}
      </div>
      {insert && (
        <div className="editor-insert">
          <label>
            Địa chỉ HTTPS
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          {insert === "image" && (
            <label>
              Mô tả ảnh (cho trình đọc màn hình)
              <input value={alt} onChange={(e) => setAlt(e.target.value)} />
            </label>
          )}
          <button
            type="button"
            className="button"
            onClick={() => {
              if (!/^https?:\/\//i.test(url)) {
                setError("Nhập một địa chỉ HTTP/HTTPS hợp lệ.");
                return;
              }
              if (insert === "image" && !alt.trim()) {
                setError("Vui lòng mô tả nội dung ảnh.");
                return;
              }
              insert === "link"
                ? editor
                    .chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: url })
                    .run()
                : editor.chain().focus().setImage({ src: url, alt }).run();
              setError("");
              setInsert(null);
            }}
          >
            Chèn
          </button>
          <button
            type="button"
            className="button subtle"
            onClick={() => setInsert(null)}
          >
            Hủy
          </button>
          {error && <p role="alert">{error}</p>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
export function ItemEditor({
  item,
  onDone,
}: {
  item: Row;
  onDone: () => void;
}) {
  const initial =
    item.content_format === "HTML" ? item.content : textHtml(item.content);
  const [content, setContent] = useState(initial),
    [saved, setSaved] = useState(""),
    [history, setHistory] = useState(false);
  const { toast, refresh } = useSession();
  const revision = useRef(Number(item.revision || 1)),
    latest = useRef(initial),
    dirty = useRef(false),
    blocked = useRef(false),
    queue = useRef<Promise<any>>(Promise.resolve()),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function enqueue(extra: Row = {}) {
    const html = latest.current;
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        if (blocked.current)
          throw new Error(
            "Lần lưu trước không thành công. Tải bản nháp về máy trước khi đóng và mở lại học liệu.",
          );
        try {
          const result = await api(`/items/${item.id}`, "PATCH", {
            content: html,
            content_format: "HTML",
            base_revision: revision.current,
            ...extra,
          });
          revision.current = result.revision;
          if (latest.current === html) dirty.current = false;
          setSaved("Đã lưu trên máy chủ");
          return result;
        } catch (e: any) {
          blocked.current = true;
          setSaved(e.message);
          throw e;
        }
      });
    return queue.current;
  }
  function change(html: string) {
    latest.current = html;
    setContent(html);
    dirty.current = true;
    setSaved("Đang chờ lưu…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      enqueue().catch((e: any) => toast(e.message));
    }, 800);
  }
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      if (timer.current) clearTimeout(timer.current);
      if (dirty.current && !blocked.current)
        enqueue()
          .then(() => refresh())
          .catch((e: any) => toast(e.message));
    };
  }, []);
  return (
    <>
      <Form
        onSubmit={async (f) => {
          if (timer.current) clearTimeout(timer.current);
          await enqueue({
            title: val(f, "title"),
            status: val(f, "status"),
            url: val(f, "url") || null,
            available_at: val(f, "available_at")
              ? iso(f.get("available_at"))
              : null,
          });
          onDone();
          toast("Đã lưu học liệu.");
        }}
      >
        <Field label="Tiêu đề" name="title" value={item.title} />
        <div className="field">
          <span>Nội dung học tập</span>
          <RichEditor value={initial} onChange={change} />
          <small aria-live="polite">
            {saved ||
              "Tự động lưu sau khi sửa. Có kiểm tra xung đột phiên bản."}
          </small>
        </div>
        <Field
          label="Liên kết học liệu"
          name="url"
          type="url"
          required={false}
          value={item.url}
        />
        <Field
          label="Mở từ"
          name="available_at"
          type="datetime-local"
          required={false}
          value={
            item.available_at ? localDate(new Date(item.available_at)) : ""
          }
        />
        <Field label="Trạng thái" name="status">
          <select name="status" defaultValue={item.status}>
            {["DRAFT", "PUBLISHED", "HIDDEN", "SCHEDULED"].map((s) => (
              <option key={s} value={s}>
                {statusLabel[s]}
              </option>
            ))}
          </select>
        </Field>
      </Form>
      <div className="actions">
        <button
          className="button"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([latest.current], { type: "text/plain;charset=utf-8" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "hoc-lieu-ban-nhap.html.txt";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Tải bản nháp về máy
        </button>
        <button className="button" onClick={() => setHistory(!history)}>
          Lịch sử phiên bản
        </button>
        <button
          className="button"
          onClick={async () => {
            try {
              await enqueue();
              await api(`/items/${item.id}/duplicate`, "POST", {});
              toast("Đã tạo bản sao ở trạng thái nháp.");
              refresh();
            } catch (e: any) {
              toast(e.message);
            }
          }}
        >
          Tạo bản sao
        </button>
      </div>
      {history && (
        <Revisions
          key={revision.current}
          itemId={item.id}
          onRestore={async (rev) => {
            if (timer.current) clearTimeout(timer.current);
            await enqueue();
            const result = await api(
              `/items/${item.id}/revisions/${rev}/restore`,
              "POST",
              { base_revision: revision.current },
            );
            dirty.current = false;
            revision.current = result.revision;
            onDone();
            toast("Đã khôi phục thành một phiên bản mới.");
          }}
        />
      )}
    </>
  );
}
function Revisions({
  itemId,
  onRestore,
}: {
  itemId: string;
  onRestore: (n: number) => Promise<void>;
}) {
  const { data, error, loading } = useApi(`/items/${itemId}/revisions`),
    { toast } = useSession();
  return (
    <section className="revision-list">
      <h3>Phiên bản trước</h3>
      {loading ? (
        <p>Đang tải…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !data?.length ? (
        <p>Chưa có phiên bản trước.</p>
      ) : (
        data.map((v: Row) => (
          <details key={v.id}>
            <summary>
              Phiên bản {v.revision} · {date(v.created_at, true)} · {v.author}
            </summary>
            <RichContent
              content={v.snapshot.content}
              format={v.snapshot.content_format}
            />
            <button
              className="button"
              onClick={() =>
                onRestore(v.revision).catch((e: any) => toast(e.message))
              }
            >
              Khôi phục nội dung phiên bản này
            </button>
          </details>
        ))
      )}
    </section>
  );
}
