import { Suspense } from "react";
import { LmsApp } from "../../src/app";
export default function Page() {
  return (
    <Suspense
      fallback={<div className="boot">Đang mở không gian học tập…</div>}
    >
      <LmsApp />
    </Suspense>
  );
}
