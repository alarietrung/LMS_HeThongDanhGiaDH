"use client";
import { useState } from "react";
import { Download, Upload, CheckCircle2 } from "lucide-react";
import { api, useSession, Row, Dialog, Form, Field } from "../lib";
export function LearningPackage({ sid }: { sid: string }) {
  const [open, setOpen] = useState(false),
    [preview, setPreview] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    { me, toast, refresh } = useSession();
  if (
    !me.permissions.includes("quiz.manage") ||
    !me.permissions.includes("module.manage")
  )
    return null;
  async function download() {
    setBusy(true);
    try {
      const data = await api(`/courses/${sid}/package`),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
      const a = document.createElement("a");
      a.href = url;
      a.download = "mituni-hoc-lieu.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(
        "Đã xuất gói học liệu. Tệp chứa đáp án, chỉ chia sẻ với người có quyền.",
      );
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="package-tools">
      <p>Tái sử dụng module và ngân hàng câu hỏi giữa các học phần.</p>
      <div className="actions">
        <button className="button" disabled={busy} onClick={download}>
          <Download size={16} />
          Xuất gói học liệu
        </button>
        <button
          className="button"
          onClick={() => {
            setPreview(null);
            setOpen(true);
          }}
        >
          <Upload size={16} />
          Nhập gói học liệu
        </button>
      </div>
      {open && (
        <Dialog
          title="Nhập học liệu từ gói MITUNI"
          onClose={() => setOpen(false)}
          wide
        >
          {!preview ? (
            <Form
              label="Kiểm tra và xem trước"
              onSubmit={async (f) => {
                const file = f.get("package") as File;
                if (!file?.size || file.size > 900000)
                  throw new Error("Chọn tệp JSON nhỏ hơn 900 KB.");
                let content;
                try {
                  content = JSON.parse(await file.text());
                } catch {
                  throw new Error("Tệp không đúng định dạng JSON.");
                }
                setPreview(
                  await api(`/courses/${sid}/package/preview`, "POST", content),
                );
              }}
            >
              <p>
                Chấp nhận gói JSON do MITUNI LMS xuất. Chưa hỗ trợ SCORM, QTI
                hoặc gói sao lưu Moodle.
              </p>
              <Field
                label="Gói học liệu (.json, tối đa 900 KB)"
                name="package"
                type="file"
                accept=".json,application/json"
              />
              <p className="muted">
                Gói có thể chứa đáp án. Không nhập tệp cá nhân hoặc dữ liệu
                không liên quan.
              </p>
            </Form>
          ) : (
            <Form
              label="Xác nhận nhập thành bản nháp"
              onSubmit={async () => {
                await api(`/package-imports/${preview.id}/execute`, "POST", {});
                setOpen(false);
                refresh();
                toast(
                  "Đã nhập học liệu. Kiểm tra và công bố từng module khi sẵn sàng.",
                );
              }}
            >
              <p className="info">
                <CheckCircle2 size={19} />
                Đã kiểm tra cấu trúc và làm sạch nội dung HTML.
              </p>
              <div className="stat-grid">
                <div>{preview.summary.modules} module</div>
                <div>{preview.summary.items} học liệu</div>
                <div>{preview.summary.questions} câu hỏi</div>
              </div>
              <ul>
                {preview.summary.titles.map((t: string, i: number) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
              <p>
                Thêm nội dung mới, không ghi đè nội dung hiện có. Module và học
                liệu được nhập ở trạng thái nháp.
              </p>
              <p className="muted">
                Không sao chép tệp đính kèm, điều kiện tiên quyết, lịch mở, bài
                tập, bài kiểm tra, thành viên, bài nộp hoặc điểm số. Kiểm tra
                liên kết và cấu hình lại trước khi công bố.
              </p>
              <button
                type="button"
                className="button subtle"
                onClick={() => setPreview(null)}
              >
                Chọn tệp khác
              </button>
            </Form>
          )}
        </Dialog>
      )}
    </div>
  );
}
