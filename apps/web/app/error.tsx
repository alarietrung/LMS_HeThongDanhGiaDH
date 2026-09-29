"use client";
export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="state" style={{ minHeight: "100dvh" }}>
      <img src="/assets/mituni-logo.png" alt="MIT University" width={160} />
      <h1>Trang chưa tải được</h1>
      <p>Dữ liệu đã lưu trên máy chủ không bị mất. Bạn có thể thử tải lại.</p>
      <div className="actions">
        <button className="button primary" onClick={() => retry()}>
          Thử lại
        </button>
        <a className="button" href="/dashboard">
          Về trang chủ
        </a>
      </div>
    </main>
  );
}
