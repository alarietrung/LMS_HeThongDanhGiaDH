"use client";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Row } from "../lib";
export function SequenceAnswer({
  question: q,
  value,
  onChange,
}: {
  question: Row;
  value?: string[];
  onChange: (v: string[]) => void;
}) {
  const labels: string[] = q.options || [];
  if (!labels.length)
    return (
      <label className="field">
        <span>Nhập các đáp án theo thứ tự, ngăn cách bằng dấu |</span>
        <input
          value={(value || []).join(" | ")}
          onChange={(e) =>
            onChange(e.target.value.split("|").map((s) => s.trim()))
          }
        />
      </label>
    );
  if (q.type === "ORDERING") {
    const order = value?.length === labels.length ? value : labels;
    function move(index: number, to: number) {
      const next = [...order];
      [next[index], next[to]] = [next[to], next[index]];
      onChange(next);
    }
    return (
      <div className="sequence-answer">
        <p className="muted">
          Dùng nút lên / xuống để sắp xếp. Mỗi thay đổi được tự động lưu.
        </p>
        <ol>
          {order.map((item, i) => (
            <li key={`${i}-${item}`}>
              <span>{item}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Chuyển mục ${i + 1} lên`}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Chuyển mục ${i + 1} xuống`}
                disabled={i === order.length - 1}
                onClick={() => move(i, i + 1)}
              >
                <ArrowDown size={17} />
              </button>
            </li>
          ))}
        </ol>
        {!value && (
          <button
            type="button"
            className="button"
            onClick={() => onChange([...order])}
          >
            Dùng thứ tự hiện tại
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="sequence-answer">
      <p className="muted">
        {q.type === "MATCHING"
          ? "Nhập nội dung tương ứng với từng mục."
          : "Điền đáp án cho từng chỗ trống."}
      </p>
      {labels.map((label, i) => (
        <label className="field" key={i}>
          <span>
            {i + 1}. {label}
          </span>
          <input
            autoComplete="off"
            value={value?.[i] || ""}
            onChange={(e) => {
              const next = labels.map((_, j) => value?.[j] || "");
              next[i] = e.target.value;
              onChange(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}
