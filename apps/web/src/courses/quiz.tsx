"use client";
import { SequenceAnswer } from "./sequence-answer";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Timer,
  Play,
  CheckCircle2,
  ShieldCheck,
  Flag,
} from "lucide-react";
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
  iso,
  val,
  statusLabel,
  Empty,
  upload,
} from "../lib";
const types: Record<string, string> = {
  SINGLE_CHOICE: "Một lựa chọn",
  MULTIPLE_CHOICE: "Nhiều lựa chọn",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  ESSAY: "Tự luận",
  NUMERIC: "Đáp án số",
  MATCHING: "Ghép cặp",
  ORDERING: "Sắp xếp",
  FILL_BLANK: "Điền vào chỗ trống",
  FILE_UPLOAD: "Tệp bài làm",
};
export function Quizzes({ sid, manage }: { sid: string; manage: boolean }) {
  const { data, loading, error } = useApi(`/courses/${sid}/quizzes`),
    questions = useApi(manage ? `/courses/${sid}/questions?limit=100` : null),
    { refresh, toast } = useSession();
  const router = useRouter(),
    [open, setOpen] = useState(false),
    [reviewQuiz, setReviewQuiz] = useState<Row | null>(null),
    [busy, setBusy] = useState("");
  async function start(id: string) {
    setBusy(id);
    try {
      const a = await api(`/quizzes/${id}/attempts`, "POST", {});
      router.push(`/quiz/${a.id}`);
    } catch (e: any) {
      toast(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <div className="section-head">
        <div>
          <h2>Bài kiểm tra</h2>
          <p className="muted">
            Câu trả lời được lưu tự động trong quá trình làm bài.
          </p>
        </div>
        {manage && (
          <button className="button primary" onClick={() => setOpen(true)}>
            <Plus size={17} />
            Tạo bài kiểm tra
          </button>
        )}
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).map((q: Row) => (
          <article className="assignment-card" key={q.id}>
            <span className="activity-icon blue">
              <Timer size={24} />
            </span>
            <div className="assignment-copy">
              <Badge tone="blue">
                {q.question_count} câu hỏi · {q.duration_minutes} phút
              </Badge>
              <h3>{q.title}</h3>
              <p>{q.description}</p>
              <div className="metadata">
                <span>Mở: {date(q.opens_at, true)}</span>
                <span>Đóng: {date(q.closes_at, true)}</span>
                <span>
                  {q.attempts}/{q.max_attempts} lần làm
                </span>
              </div>
            </div>
            <div className="stack-actions">
              {!manage && (
                <button
                  disabled={
                    busy === q.id ||
                    Number(q.attempts) >= q.max_attempts ||
                    new Date(q.closes_at) < new Date()
                  }
                  className="button primary"
                  onClick={() => start(q.id)}
                >
                  <Play size={15} />
                  {busy === q.id ? "Đang mở…" : "Làm bài"}
                </button>
              )}
              {q.latest_attempt && (
                <Link className="button" href={`/quiz/${q.latest_attempt}`}>
                  Lần làm gần nhất
                </Link>
              )}
              {manage && (
                <>
                  <Badge>{statusLabel[q.status]}</Badge>
                  <button className="button" onClick={() => setReviewQuiz(q)}>
                    Xem và chấm bài
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </State>
      {reviewQuiz && (
        <Dialog
          title={`Chấm bài · ${reviewQuiz.title}`}
          onClose={() => setReviewQuiz(null)}
          wide
        >
          <QuizReview quizId={reviewQuiz.id} />
        </Dialog>
      )}
      {open && (
        <Dialog title="Tạo bài kiểm tra" onClose={() => setOpen(false)} wide>
          <Form
            label="Tạo bài kiểm tra"
            onSubmit={async (f) => {
              await api(`/courses/${sid}/quizzes`, "POST", {
                title: val(f, "title"),
                description: val(f, "description"),
                duration_minutes: Number(f.get("duration")),
                opens_at: iso(f.get("opens_at")),
                closes_at: iso(f.get("closes_at")),
                max_attempts: Number(f.get("attempts")),
                question_ids: f.getAll("question_ids"),
                review_policy: val(f, "review_policy"),
                shuffle: true,
              });
              setOpen(false);
              refresh();
              toast("Đã tạo bài kiểm tra.");
            }}
          >
            <Field name="title" label="Tên bài kiểm tra" />
            <Field
              name="description"
              label="Hướng dẫn"
              type="textarea"
              required={false}
            />
            <div className="form-grid">
              <Field
                name="duration"
                label="Thời gian (phút)"
                type="number"
                value={15}
                min={1}
                max={300}
              />
              <Field
                name="attempts"
                label="Số lần làm bài"
                type="number"
                value={2}
                min={1}
              />
              <Field name="opens_at" label="Mở từ" type="datetime-local" />
              <Field name="closes_at" label="Đóng lúc" type="datetime-local" />
            </div>
            <Field label="Xem đáp án" name="review_policy">
              <select name="review_policy">
                <option value="AFTER_CLOSE">Sau khi bài kiểm tra đóng</option>
                <option value="IMMEDIATE">Ngay sau khi nộp</option>
              </select>
            </Field>
            <h3>Chọn câu hỏi</h3>
            {questions.data?.length ? (
              questions.data.map((q: Row) => (
                <label className="check question-check" key={q.id}>
                  <input type="checkbox" name="question_ids" value={q.id} />
                  <span>
                    {q.prompt}
                    <small>
                      {types[q.type]} · {q.points} điểm
                    </small>
                  </span>
                </label>
              ))
            ) : (
              <p>Tạo câu hỏi trong ngân hàng trước khi tạo bài kiểm tra.</p>
            )}
          </Form>
        </Dialog>
      )}
    </section>
  );
}
export function QuestionBank({ sid }: { sid: string }) {
  const { data, loading, error } = useApi(
      `/courses/${sid}/questions?limit=100`,
    ),
    { refresh, toast } = useSession();
  const [open, setOpen] = useState(false),
    [type, setType] = useState("SINGLE_CHOICE");
  return (
    <section>
      <div className="section-head">
        <h2>Ngân hàng câu hỏi</h2>
        <button className="button primary" onClick={() => setOpen(true)}>
          <Plus size={17} />
          Thêm câu hỏi
        </button>
      </div>
      <State loading={loading} error={error} empty={!data?.length}>
        {(data || []).map((q: Row, i: number) => (
          <article className="panel question-bank" key={q.id}>
            <div className="section-head">
              <Badge tone="blue">{types[q.type]}</Badge>
              <small>
                {q.points} điểm · Phiên bản {q.version}
              </small>
            </div>
            <h3>
              {i + 1}. {q.prompt}
            </h3>
            {q.options?.map((o: string, j: number) => (
              <p className={q.answer === j ? "correct-option" : ""} key={j}>
                {j + 1}. {o}
              </p>
            ))}
            <details>
              <summary>Đáp án và giải thích</summary>
              <p>{JSON.stringify(q.answer)}</p>
              <p>{q.explanation}</p>
            </details>
          </article>
        ))}
      </State>
      {open && (
        <Dialog title="Thêm câu hỏi" onClose={() => setOpen(false)} wide>
          <Form
            onSubmit={async (f) => {
              const options = val(f, "options").split("\n").filter(Boolean);
              let answer: any = val(f, "answer");
              if (["SINGLE_CHOICE", "TRUE_FALSE"].includes(type))
                answer = Number(answer) - 1;
              else if (type === "MULTIPLE_CHOICE")
                answer = answer
                  .split(",")
                  .map((x: string) => Number(x.trim()) - 1);
              else if (["MATCHING", "ORDERING", "FILL_BLANK"].includes(type))
                answer = answer.split("|").map((x: string) => x.trim());
              else if (type === "NUMERIC")
                answer = {
                  value: Number(answer),
                  tolerance: Number(f.get("tolerance") || 0),
                };
              else if (["ESSAY", "FILE_UPLOAD"].includes(type)) answer = null;
              await api(`/courses/${sid}/questions`, "POST", {
                type,
                prompt: val(f, "prompt"),
                options,
                answer,
                points: Number(f.get("points")),
                explanation: val(f, "explanation"),
              });
              setOpen(false);
              refresh();
              toast("Đã thêm câu hỏi.");
            }}
          >
            <Field label="Loại câu hỏi" name="type">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(types).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nội dung câu hỏi" name="prompt" type="textarea" />
            <Field
              label={
                ["MATCHING", "FILL_BLANK"].includes(type)
                  ? "Các mục / chỗ trống (mỗi dòng một mục)"
                  : "Các phương án (mỗi dòng một phương án)"
              }
              name="options"
              type="textarea"
              required={false}
            />
            <Field
              label={
                ["SINGLE_CHOICE", "TRUE_FALSE"].includes(type)
                  ? "Số thứ tự phương án đúng (bắt đầu từ 1)"
                  : type === "MULTIPLE_CHOICE"
                    ? "Số thứ tự đáp án, ngăn cách bằng dấu phẩy"
                    : ["MATCHING", "ORDERING", "FILL_BLANK"].includes(type)
                      ? "Các đáp án đúng theo thứ tự, ngăn cách bằng |"
                      : "Đáp án"
              }
              name="answer"
              required={!["ESSAY", "FILE_UPLOAD"].includes(type)}
            />
            {type === "NUMERIC" && (
              <Field
                name="tolerance"
                label="Sai số cho phép"
                type="number"
                value={0}
                step="any"
                min={0}
              />
            )}
            <Field
              name="points"
              label="Điểm"
              type="number"
              value={1}
              min={0.1}
              step="0.1"
            />
            <Field
              name="explanation"
              label="Giải thích"
              type="textarea"
              required={false}
            />
          </Form>
        </Dialog>
      )}
    </section>
  );
}
export function QuizAttempt({ attemptId }: { attemptId: string }) {
  const [a, setA] = useState<Row | null>(null),
    [answers, setAnswers] = useState<Row>({}),
    [error, setError] = useState(""),
    [saving, setSaving] = useState("Đã lưu"),
    [remaining, setRemaining] = useState(0),
    [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false);
  const latest = useRef<Row>({}),
    queue = useRef<Promise<any>>(Promise.resolve()),
    ready = useRef(false),
    finished = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useSession();
  useEffect(() => {
    api(`/attempts/${attemptId}`)
      .then((v) => {
        setA(v);
        setAnswers(v.answers);
        latest.current = v.answers;
        ready.current = true;
      })
      .catch((e) => setError(e.message));
  }, [attemptId]);
  async function finish() {
    if (finished.current) return;
    finished.current = true;
    setBusy(true);
    if (timer.current) clearTimeout(timer.current);
    try {
      await queue.current.catch(() => {});
      const result = await api(`/attempts/${attemptId}/submit`, "POST", {
        answers: latest.current,
      });
      setA(result);
      setConfirm(false);
      setSaving("Đã nộp bài");
      toast("Bài kiểm tra đã được nộp.");
    } catch (e: any) {
      finished.current = false;
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!a || a.status !== "IN_PROGRESS") return;
    const tick = () => {
      const seconds = Math.max(
        0,
        Math.ceil((new Date(a.expires_at).getTime() - Date.now()) / 1000),
      );
      setRemaining(seconds);
      if (seconds === 0) void finish();
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [a?.status, a?.expires_at]);
  function change(qid: string, value: any) {
    const next = { ...latest.current, [qid]: value };
    latest.current = next;
    setAnswers(next);
    setSaving("Đang lưu…");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          const result = await api(`/attempts/${attemptId}/answers`, "PUT", {
            answers: next,
          });
          if (result.status !== "IN_PROGRESS") setA(result);
          setSaving("Đã lưu trên máy chủ");
        })
        .catch((e) => {
          setSaving("Chưa lưu được — kiểm tra kết nối");
          setError(e.message);
        });
    }, 650);
  }
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (a?.status === "IN_PROGRESS") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [a?.status]);
  const active = a?.status === "IN_PROGRESS";
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">BÀI KIỂM TRA</p>
          <h1>
            {active
              ? "Tập trung và tự tin"
              : a
                ? "Đã hoàn thành bài làm"
                : "Đang mở bài kiểm tra"}
          </h1>
        </div>
        {active && (
          <div className={`quiz-timer ${remaining < 120 ? "urgent" : ""}`}>
            <Timer size={20} />
            {Math.floor(remaining / 60)
              .toString()
              .padStart(2, "0")}
            :{(remaining % 60).toString().padStart(2, "0")}
          </div>
        )}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <State loading={!a && !error}>
        {a && (
          <>
            <div className="quiz-layout">
              <section>
                {!active && (
                  <div className="quiz-result panel">
                    <CheckCircle2 size={36} />
                    <h2>Bài làm đã được lưu</h2>
                    <p>
                      {a.review
                        ? `Điểm tự động: ${a.score} / ${a.max_score}`
                        : "Kết quả sẽ hiển thị theo chính sách của giảng viên."}
                    </p>
                    <Badge tone="green">{statusLabel[a.status]}</Badge>
                    {a.status === "PENDING_REVIEW" && (
                      <p>
                        Phần tự luận hoặc tệp bài làm đang chờ giảng viên chấm.
                      </p>
                    )}
                  </div>
                )}
                {a.questions.map((q: Row, index: number) => (
                  <article
                    id={`q-${index}`}
                    key={q.id}
                    className="panel quiz-question"
                  >
                    <div className="section-head">
                      <Badge tone="wine">Câu {index + 1}</Badge>
                      <small>{q.points} điểm</small>
                    </div>
                    <h3>{q.prompt}</h3>
                    <fieldset disabled={!active || busy}>
                      {["SINGLE_CHOICE", "TRUE_FALSE"].includes(q.type) ? (
                        q.options.map((o: string, j: number) => (
                          <label
                            key={j}
                            className={`answer-option ${answers[q.id] === j ? "selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              checked={answers[q.id] === j}
                              onChange={() => change(q.id, j)}
                            />
                            <span>{o}</span>
                          </label>
                        ))
                      ) : q.type === "MULTIPLE_CHOICE" ? (
                        q.options.map((o: string, j: number) => (
                          <label key={j} className="answer-option">
                            <input
                              type="checkbox"
                              checked={(answers[q.id] || []).includes(j)}
                              onChange={(e) =>
                                change(
                                  q.id,
                                  e.target.checked
                                    ? [...(answers[q.id] || []), j]
                                    : (answers[q.id] || []).filter(
                                        (x: number) => x !== j,
                                      ),
                                )
                              }
                            />
                            {o}
                          </label>
                        ))
                      ) : ["MATCHING", "ORDERING", "FILL_BLANK"].includes(
                          q.type,
                        ) ? (
                        <SequenceAnswer
                          question={q}
                          value={answers[q.id]}
                          onChange={(value) => change(q.id, value)}
                        />
                      ) : q.type === "FILE_UPLOAD" ? (
                        <QuizFile
                          sid={a.section_id}
                          value={answers[q.id]}
                          onChange={(v) => change(q.id, v)}
                          disabled={!active || busy}
                        />
                      ) : q.type === "ESSAY" ? (
                        <textarea
                          aria-label={`Trả lời câu ${index + 1}`}
                          rows={7}
                          value={answers[q.id] || ""}
                          onChange={(e) => change(q.id, e.target.value)}
                        />
                      ) : (
                        <input
                          type={q.type === "NUMERIC" ? "number" : "text"}
                          aria-label={`Trả lời câu ${index + 1}`}
                          value={answers[q.id] ?? ""}
                          onChange={(e) => change(q.id, e.target.value)}
                        />
                      )}
                    </fieldset>
                    {a.review && (
                      <div className="answer-review">
                        <strong>Đáp án: </strong>
                        {["SINGLE_CHOICE", "TRUE_FALSE"].includes(q.type)
                          ? q.options[q.answer]
                          : JSON.stringify(q.answer)}
                        <p>{q.explanation}</p>
                      </div>
                    )}
                  </article>
                ))}
              </section>
              <aside className="quiz-sidebar panel">
                <h3>Điều hướng câu hỏi</h3>
                <div className="question-numbers">
                  {a.questions.map((q: Row, i: number) => (
                    <a
                      key={q.id}
                      href={`#q-${i}`}
                      className={answers[q.id] !== undefined ? "answered" : ""}
                    >
                      {i + 1}
                    </a>
                  ))}
                </div>
                <p className="muted">
                  {Object.keys(answers).length}/{a.questions.length} câu đã trả
                  lời
                </p>
                <small aria-live="polite">{saving}</small>
                {active ? (
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => setConfirm(true)}
                  >
                    Nộp bài kiểm tra
                  </button>
                ) : (
                  <Link className="button" href="/courses">
                    Về học phần
                  </Link>
                )}
              </aside>
            </div>
          </>
        )}
      </State>
      {confirm && (
        <Dialog title="Nộp bài kiểm tra?" onClose={() => setConfirm(false)}>
          <p>
            Bạn đã trả lời {Object.keys(answers).length} / {a?.questions.length}{" "}
            câu. Sau khi nộp, lần làm này sẽ được khóa.
          </p>
          <div className="actions">
            <button className="button" onClick={() => setConfirm(false)}>
              Tiếp tục làm
            </button>
            <button className="button primary" disabled={busy} onClick={finish}>
              {busy ? "Đang nộp…" : "Xác nhận nộp bài"}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}

function QuizFile({
  sid,
  value,
  onChange,
  disabled,
}: {
  sid: string;
  value?: Row;
  onChange: (v: Row) => void;
  disabled: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      <label className="field">
        <span>Tệp bài làm (tối đa 10 MB)</span>
        <input
          type="file"
          disabled={disabled || busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            setError("");
            try {
              const result = await upload(sid, file);
              onChange({ file_id: result.id });
            } catch (e: any) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">Đang tải tệp…</p>}
      {value?.file_id && (
        <a href={`/api/v1/files/${value.file_id}`} className="text-link">
          Tải tệp bài làm đã lưu
        </a>
      )}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
function QuizReview({ quizId }: { quizId: string }) {
  const [page, setPage] = useState(1),
    { data, loading, error } = useApi(
      `/quizzes/${quizId}/review?page=${page}&limit=10`,
    ),
    { refresh, toast } = useSession();
  return (
    <>
      <p className="muted">
        Điểm chấm được lưu nháp. Công bố trong sổ điểm sau khi kiểm tra. Sổ điểm
        dùng lần nộp mới nhất.
      </p>
      <State loading={loading} error={error} empty={!data?.length}>
        {data?.map((a: Row) => (
          <details className="panel" key={a.id}>
            <summary>
              {a.student} · Lần {a.attempt} · {statusLabel[a.status]} ·{" "}
              {a.score}/{a.max_score}
            </summary>
            <Form
              label="Lưu kết quả chấm"
              onSubmit={async (f) => {
                const scores = Object.fromEntries(
                  a.questions
                    .filter((q: Row) =>
                      ["ESSAY", "FILE_UPLOAD"].includes(q.type),
                    )
                    .map((q: Row) => [q.id, Number(f.get(q.id))]),
                );
                await api(`/attempts/${a.id}/review`, "POST", {
                  scores,
                  feedback: val(f, "feedback"),
                });
                refresh();
                toast("Đã lưu điểm nháp.");
              }}
            >
              {a.questions.map((q: Row, i: number) => (
                <div className="quiz-question" key={q.id}>
                  <h3>
                    {i + 1}. {q.prompt}
                  </h3>
                  {q.type === "FILE_UPLOAD" ? (
                    a.answers[q.id]?.file_id ? (
                      <a
                        className="text-link"
                        href={`/api/v1/files/${a.answers[q.id].file_id}`}
                      >
                        Tải tệp sinh viên
                      </a>
                    ) : (
                      <p>Không nộp tệp</p>
                    )
                  ) : (
                    <p className="prose">
                      {["SINGLE_CHOICE", "TRUE_FALSE"].includes(q.type)
                        ? q.options[a.answers[q.id]] || "Chưa trả lời"
                        : JSON.stringify(a.answers[q.id] ?? "Chưa trả lời")}
                    </p>
                  )}
                  {["ESSAY", "FILE_UPLOAD"].includes(q.type) ? (
                    <Field
                      name={q.id}
                      label={`Điểm (tối đa ${q.points})`}
                      type="number"
                      min={0}
                      max={q.points}
                      step="0.01"
                      value={a.manual_scores?.[q.id] ?? 0}
                    />
                  ) : (
                    <p className="muted">
                      Đáp án:{" "}
                      {["SINGLE_CHOICE", "TRUE_FALSE"].includes(q.type)
                        ? q.options[q.answer]
                        : JSON.stringify(q.answer)}
                    </p>
                  )}
                </div>
              ))}
              <Field
                name="feedback"
                label="Nhận xét"
                type="textarea"
                required={false}
                value={a.review_feedback}
              />
            </Form>
          </details>
        ))}
      </State>
      <div className="actions">
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
          disabled={!data || data.length < 10}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </button>
      </div>
    </>
  );
}
