import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
const root = process.cwd(),
  base = "http://127.0.0.1:4101",
  origin = "http://localhost:3001";
let server,
  logs = "";
let student,
  student2,
  lecturer,
  admin,
  sid,
  assignment,
  submission,
  grade,
  attempt,
  courseId;
async function request(actor, route, method = "GET", body, extra = {}) {
  const headers = {
    Origin: origin,
    ...(actor ? { Cookie: actor.cookie, "X-CSRF-Token": actor.csrf } : {}),
    ...extra,
  };
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (method !== "GET" && !headers["Idempotency-Key"])
    headers["Idempotency-Key"] = randomUUID();
  const res = await fetch(base + route, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return {
    status: res.status,
    data: data.data,
    error: data.error,
    headers: res.headers,
  };
}
async function login(persona) {
  const r = await request(null, "/auth/demo", "POST", { persona });
  assert.equal(r.status, 201, JSON.stringify(r.error));
  const cookie = r.headers.get("set-cookie").split(";")[0];
  const m = await request({ cookie, csrf: "" }, "/api/v1/me");
  return { cookie, csrf: m.data.csrf, me: m.data };
}
before(
  async () => {
    mkdirSync(".data/test-runs", { recursive: true });
    const dir = mkdtempSync(path.join(root, ".data/test-runs/run-"));
    server = spawn(process.execPath, ["apps/api/dist/main.js"], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DEMO_MODE: "true",
        DATA_DIR: path.join(dir, "postgres"),
        API_PORT: "4101",
        APP_URL: origin,
        DATABASE_URL: "",
        REDIS_URL: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (d) => (logs += d));
    server.stderr.on("data", (d) => (logs += d));
    let ready = false;
    for (let i = 0; i < 180; i++) {
      try {
        const r = await fetch(base + "/health/ready");
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {}
      if (server.exitCode !== null) throw new Error(logs.slice(-6000));
      await new Promise((r) => setTimeout(r, 250));
    }
    assert.ok(ready, logs.slice(-6000));
    student = await login("student");
    student2 = await login("student2");
    lecturer = await login("lecturer");
    admin = await login("admin");
    const c = await request(student, "/api/v1/courses");
    assert.equal(c.status, 200);
    assert.equal(c.data.length, 2);
    sid = c.data.find((c) => c.code === "030100236301").id;
  },
  { timeout: 60000 },
);
after(() => {
  server?.kill();
});
test("Unauthenticated, CSRF, and cross-origin mutations are rejected", async () => {
  assert.equal((await request(null, "/api/v1/courses")).status, 401);
  assert.equal(
    (
      await request(
        student,
        "/api/v1/calendar",
        "POST",
        {},
        { "X-CSRF-Token": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        student,
        "/api/v1/calendar",
        "POST",
        {},
        { Origin: "https://untrusted.invalid" },
      )
    ).status,
    403,
  );
});
test("Student cannot access admin, question answers or teacher write APIs", async () => {
  assert.equal((await request(student, "/api/v1/admin/users")).status, 403);
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/questions`)).status,
    403,
  );
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/assignments`, "POST", {}))
      .status,
    403,
  );
});
test("Locked content is withheld and prerequisite completion enforced", async () => {
  const m = await request(student, `/api/v1/courses/${sid}/modules`);
  const locked = m.data[0].items[2];
  assert.equal(locked.locked, true);
  assert.equal(locked.content, "");
  assert.equal(
    (await request(student, `/api/v1/items/${locked.id}/complete`, "POST", {}))
      .status,
    403,
  );
  assert.equal(
    (
      await request(
        student,
        `/api/v1/items/${m.data[0].items[1].id}/complete`,
        "POST",
        {},
      )
    ).status,
    201,
  );
  assert.equal(
    (await request(student, `/api/v1/items/${locked.id}/complete`, "POST", {}))
      .status,
    201,
  );
});
test("Teacher creates assignment and submission is versioned and idempotent", async () => {
  const a = await request(
    lecturer,
    `/api/v1/courses/${sid}/assignments`,
    "POST",
    {
      title: "Integration test assignment",
      description: "Submit text for assessment.",
      due_at: new Date(Date.now() + 86400000).toISOString(),
      points: 10,
      max_attempts: 3,
      status: "PUBLISHED",
    },
  );
  assert.equal(a.status, 201, JSON.stringify(a.error));
  assignment = a.data;
  const key = randomUUID();
  const s = await request(
    student,
    `/api/v1/assignments/${a.data.id}/submissions`,
    "POST",
    { text: "Version one" },
    { "Idempotency-Key": key },
  );
  assert.equal(s.status, 201, JSON.stringify(s.error));
  const duplicate = await request(
    student,
    `/api/v1/assignments/${a.data.id}/submissions`,
    "POST",
    { text: "Version one" },
    { "Idempotency-Key": key },
  );
  assert.equal(duplicate.data.id, s.data.id);
  const version2 = await request(
    student,
    `/api/v1/assignments/${a.data.id}/submissions`,
    "POST",
    { text: "Version two" },
  );
  assert.equal(version2.data.attempt, 2);
  submission = version2.data;
  const history = await request(
    student,
    `/api/v1/assignments/${a.data.id}/submissions`,
  );
  assert.equal(history.data.length, 2);
  assert.ok(history.data.some((x) => x.text === "Version one"));
});
test("Student B cannot view or grade student A submission", async () => {
  const history = await request(
    student2,
    `/api/v1/assignments/${assignment.id}/submissions`,
  );
  assert.deepEqual(history.data, []);
  assert.equal(
    (
      await request(
        student2,
        `/api/v1/submissions/${submission.id}/grade`,
        "POST",
        { score: 10 },
      )
    ).status,
    403,
  );
});
test("Draft grades remain private; release delivers grade and notification", async () => {
  const g = await request(
    lecturer,
    `/api/v1/submissions/${submission.id}/grade`,
    "POST",
    { score: 8.5, feedback: "Good work" },
  );
  assert.equal(g.status, 201, JSON.stringify(g.error));
  grade = g.data;
  let list = await request(student, `/api/v1/courses/${sid}/gradebook`);
  assert.equal(list.data.grades.length, 0);
  const release = await request(
    lecturer,
    `/api/v1/grades/${grade.id}`,
    "PATCH",
    { status: "RELEASED" },
  );
  assert.equal(release.status, 200);
  list = await request(student, `/api/v1/courses/${sid}/gradebook`);
  assert.equal(Number(list.data.grades[0].score), 8.5);
  assert.equal(
    (await request(student2, `/api/v1/courses/${sid}/gradebook`)).data.grades
      .length,
    0,
  );
  assert.ok(
    (await request(student, "/api/v1/notifications")).data.some(
      (n) => n.title === "Điểm vừa công bố",
    ),
  );
});
test("Grade weights must sum to 100 and excessive grades are rejected", async () => {
  assert.equal(
    (
      await request(
        lecturer,
        `/api/v1/courses/${sid}/grade-categories`,
        "POST",
        [{ name: "Assignments", weight: 40 }],
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(lecturer, `/api/v1/grades/${grade.id}`, "PATCH", {
        score: 11,
      })
    ).status,
    400,
  );
});
test("Quiz starts without answer leakage, autosaves, submits and locks answers", async () => {
  const quizzes = await request(student, `/api/v1/courses/${sid}/quizzes`),
    q = quizzes.data[0];
  const start = await request(
    student,
    `/api/v1/quizzes/${q.id}/attempts`,
    "POST",
    {},
  );
  assert.equal(start.status, 201, JSON.stringify(start.error));
  attempt = start.data;
  assert.ok(
    attempt.questions.every((q) => !("answer" in q) && !("explanation" in q)),
  );
  const answers = Object.fromEntries(attempt.questions.map((q) => [q.id, 0]));
  const saved = await request(
    student,
    `/api/v1/attempts/${attempt.id}/answers`,
    "PUT",
    { answers },
  );
  assert.deepEqual(saved.data.answers, answers);
  assert.equal(
    (await request(student2, `/api/v1/attempts/${attempt.id}`)).status,
    403,
  );
  const done = await request(
    student,
    `/api/v1/attempts/${attempt.id}/submit`,
    "POST",
    { answers },
  );
  assert.equal(done.data.status, "SUBMITTED");
  assert.equal(done.data.review, true);
  const later = await request(
    student,
    `/api/v1/attempts/${attempt.id}/answers`,
    "PUT",
    { answers: {} },
  );
  assert.deepEqual(later.data.answers, answers);
});
test("Teacher creates question and quiz using bank question", async () => {
  const q = await request(
    lecturer,
    `/api/v1/courses/${sid}/questions`,
    "POST",
    {
      type: "NUMERIC",
      prompt: "2 + 2?",
      answer: { value: 4, tolerance: 0 },
      points: 2,
    },
  );
  assert.equal(q.status, 201, JSON.stringify(q.error));
  const quiz = await request(
    lecturer,
    `/api/v1/courses/${sid}/quizzes`,
    "POST",
    {
      title: "Teacher-created quiz",
      duration_minutes: 5,
      opens_at: new Date(Date.now() - 1000).toISOString(),
      closes_at: new Date(Date.now() + 86400000).toISOString(),
      question_ids: [q.data.id],
    },
  );
  assert.equal(quiz.status, 201, JSON.stringify(quiz.error));
});
test("Attendance validates code and student can check in once", async () => {
  const a = await request(
    lecturer,
    `/api/v1/courses/${sid}/attendance`,
    "POST",
    {
      title: "Test session",
      starts_at: new Date(Date.now() - 60000).toISOString(),
      ends_at: new Date(Date.now() + 3600000).toISOString(),
      code: "567890",
    },
  );
  assert.equal(a.status, 201);
  assert.equal(
    (
      await request(
        student,
        `/api/v1/attendance/${a.data.id}/check-in`,
        "POST",
        { code: "000000" },
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await request(
        student,
        `/api/v1/attendance/${a.data.id}/check-in`,
        "POST",
        { code: "567890" },
      )
    ).data.status,
    "PRESENT",
  );
});
test("Private file remains private and disguised binary is rejected", async () => {
  const f = new FormData();
  f.set(
    "file",
    new Blob(["Private report"], { type: "text/plain" }),
    "report.txt",
  );
  const up = await request(student, `/api/v1/courses/${sid}/files`, "POST", f);
  assert.equal(up.status, 201, JSON.stringify(up.error));
  assert.equal(
    (await request(student2, `/api/v1/files/${up.data.id}`)).status,
    403,
  );
  const bad = new FormData();
  bad.set(
    "file",
    new Blob(["not a pdf"], { type: "application/pdf" }),
    "fake.pdf",
  );
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/files`, "POST", bad))
      .status,
    400,
  );
});
test("Discussions, messages and calendar persist server-side", async () => {
  const d = await request(
    student,
    `/api/v1/courses/${sid}/discussions`,
    "POST",
    { title: "Question from learner", content: "How do I verify DNS?" },
  );
  assert.equal(d.status, 201);
  assert.equal(
    (
      await request(
        lecturer,
        `/api/v1/discussions/${d.data.id}/posts`,
        "POST",
        { content: "Use nslookup." },
      )
    ).status,
    201,
  );
  assert.equal(
    (await request(student, `/api/v1/discussions/${d.data.id}/posts`)).data
      .posts.length,
    2,
  );
  assert.equal(
    (
      await request(student, "/api/v1/messages", "POST", {
        recipient_id: lecturer.me.id,
        content: "Thank you",
      })
    ).status,
    201,
  );
  const cal = await request(student, "/api/v1/calendar");
  assert.equal(cal.status, 200, JSON.stringify(cal.error));
  assert.ok(cal.data.length > 0);
});
test("SIS preview/execute uses external IDs and repeated execution is idempotent", async () => {
  const payload = {
    users: [
      {
        external_id: "test-sis-user",
        name: "Imported learner",
        email: "imported@example.edu.vn",
        student_code: "TEST-SIS",
      },
    ],
    terms: [
      {
        external_id: "test-term",
        name: "HK test",
        academic_year: "2026-2027",
        starts_at: "2026-01-01T00:00:00Z",
        ends_at: "2027-01-01T00:00:00Z",
      },
    ],
    courses: [
      {
        external_id: "test-course",
        code: "TEST101",
        name: "Test course",
        credits: 3,
      },
    ],
    sections: [
      {
        external_id: "test-section",
        name: "TEST101-01",
        course_external_id: "test-course",
        term_external_id: "test-term",
      },
    ],
    enrollments: [
      {
        section_external_id: "test-section",
        user_external_id: "test-sis-user",
        kind: "STUDENT",
      },
    ],
  };
  const p = await request(admin, "/api/v1/admin/sis/preview", "POST", payload);
  assert.equal(p.status, 201);
  const run = await request(
    admin,
    `/api/v1/admin/sis/${p.data.id}/execute`,
    "POST",
    {},
  );
  assert.equal(run.data.status, "COMPLETED", JSON.stringify(run.error));
  assert.equal(
    (await request(admin, `/api/v1/admin/sis/${p.data.id}/execute`, "POST", {}))
      .data.status,
    "COMPLETED",
  );
  const courses = await request(admin, "/api/v1/courses");
  courseId = courses.data.find((c) => c.code === "TEST101").id;
  assert.equal(
    (await request(student, `/api/v1/courses/${courseId}`)).status,
    403,
  );
});
test("Unconfigured Microsoft is explicit and does not simulate a meeting", async () => {
  const r = await request(lecturer, `/api/v1/courses/${sid}/teams`, "POST", {
    title: "Test",
    starts_at: new Date().toISOString(),
    ends_at: new Date(Date.now() + 3600000).toISOString(),
  });
  assert.equal(r.status, 503);
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/teams`)).data.meetings
      .length,
    0,
  );
});
test("Quiz file answers enforce ownership and manual review stays draft", async () => {
  const f = new FormData();
  f.set("file", new Blob(["Quiz report"]), "quiz-report.txt");
  const file = (
    await request(student, `/api/v1/courses/${sid}/files`, "POST", f)
  ).data;
  const question = (
    await request(lecturer, `/api/v1/courses/${sid}/questions`, "POST", {
      type: "FILE_UPLOAD",
      prompt: "Upload report",
      answer: null,
      points: 10,
    })
  ).data;
  const q = (
    await request(lecturer, `/api/v1/courses/${sid}/quizzes`, "POST", {
      title: "Manual file quiz",
      duration_minutes: 5,
      opens_at: new Date(Date.now() - 1000).toISOString(),
      closes_at: new Date(Date.now() + 86400000).toISOString(),
      question_ids: [question.id],
    })
  ).data;
  const a = (
    await request(student, `/api/v1/quizzes/${q.id}/attempts`, "POST", {})
  ).data;
  const b = (
    await request(student2, `/api/v1/quizzes/${q.id}/attempts`, "POST", {})
  ).data;
  assert.equal(
    (
      await request(student2, `/api/v1/attempts/${b.id}/answers`, "PUT", {
        answers: { [question.id]: { file_id: file.id } },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(student, `/api/v1/attempts/${a.id}/submit`, "POST", {
        answers: { [question.id]: { file_id: file.id } },
      })
    ).data.status,
    "PENDING_REVIEW",
  );
  assert.equal(
    (await request(student, `/api/v1/quizzes/${q.id}/review`)).status,
    403,
  );
  const list = await request(lecturer, `/api/v1/quizzes/${q.id}/review`);
  assert.equal(list.status, 200);
  assert.equal(list.data[0].answers[question.id].file_id, file.id);
  assert.equal(
    (
      await request(lecturer, `/api/v1/attempts/${a.id}/review`, "POST", {
        scores: { [question.id]: 11 },
      })
    ).status,
    400,
  );
  const review = await request(
    lecturer,
    `/api/v1/attempts/${a.id}/review`,
    "POST",
    { scores: { [question.id]: 9 }, feedback: "Good report" },
  );
  assert.equal(review.status, 201, JSON.stringify(review.error));
  assert.equal(Number(review.data.score), 9);
  assert.equal(review.data.status, "GRADED");
  assert.ok(
    !(
      await request(student, `/api/v1/courses/${sid}/gradebook`)
    ).data.grades.some((g) => g.source_id === q.id),
  );
});
test("Course detail preserves section identity and scheduled content requires a date", async () => {
  const c = await request(student, `/api/v1/courses/${sid}`);
  assert.equal(c.data.section, "QTMM-01");
  const m = (await request(lecturer, `/api/v1/courses/${sid}/modules`)).data[0];
  assert.equal(
    (
      await request(lecturer, `/api/v1/modules/${m.id}/items`, "POST", {
        title: "Missing date",
        status: "SCHEDULED",
      })
    ).status,
    400,
  );
});
test("Role permissions are data-driven, validated, and protected from self-lockout", async () => {
  assert.equal(
    (
      await request(student, "/api/v1/admin/roles/auditor", "PATCH", {
        permissions: ["course.view"],
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(admin, "/api/v1/admin/roles/super_admin", "PATCH", {
        permissions: [],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(admin, "/api/v1/admin/roles/auditor", "PATCH", {
        permissions: ["unsupported.permission"],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(admin, "/api/v1/admin/roles/auditor", "PATCH", {
        permissions: ["course.view", "gradebook.view"],
      })
    ).status,
    200,
  );
  const roles = await request(admin, "/api/v1/admin/roles");
  assert.deepEqual(roles.data.find((r) => r.id === "auditor").permissions, [
    "course.view",
    "gradebook.view",
  ]);
});
test(
  "Scheduled content becomes published and scheduled announcement notifies once",
  async () => {
    const m = (await request(lecturer, `/api/v1/courses/${sid}/modules`))
      .data[0];
    const title = "Scheduled integration announcement";
    const item = await request(
      lecturer,
      `/api/v1/modules/${m.id}/items`,
      "POST",
      {
        title: "Scheduled reading",
        status: "SCHEDULED",
        available_at: new Date(Date.now() + 500).toISOString(),
      },
    );
    assert.equal(item.status, 201);
    await request(lecturer, `/api/v1/courses/${sid}/announcements`, "POST", {
      title,
      content: "Scheduled content",
      publish_at: new Date(Date.now() + 500).toISOString(),
    });
    let published = false;
    for (let i = 0; i < 25; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const modules = (
        await request(lecturer, `/api/v1/courses/${sid}/modules`)
      ).data;
      if (
        modules.flatMap((m) => m.items).find((x) => x.id === item.data.id)
          ?.status === "PUBLISHED"
      ) {
        published = true;
        break;
      }
    }
    assert.ok(published);
    const notifications = (
      await request(student, "/api/v1/notifications?limit=100")
    ).data;
    assert.equal(notifications.filter((n) => n.title === title).length, 1);
  },
  { timeout: 30000 },
);
test("Rich learning content sanitizes HTML, preserves history and rejects stale updates", async () => {
  const m = (await request(lecturer, `/api/v1/courses/${sid}/modules`)).data[0];
  const made = await request(
    lecturer,
    `/api/v1/modules/${m.id}/items`,
    "POST",
    { title: "Học liệu tiếng Việt", content: "Bản đầu tiên", status: "DRAFT" },
  );
  assert.equal(made.status, 201);
  const id = made.data.id;
  const saved = await request(lecturer, `/api/v1/items/${id}`, "PATCH", {
    content_format: "HTML",
    content:
      '<h2>Tiếng Việt: ă â đ ê ô ơ ư</h2><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(2)"><a href="javascript:alert(3)">link</a>',
    base_revision: 1,
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.error));
  assert.equal(saved.data.revision, 2);
  assert.match(saved.data.content, /<h2>Tiếng Việt/);
  assert.doesNotMatch(saved.data.content, /script|onerror|javascript:/);
  assert.equal(
    (
      await request(lecturer, `/api/v1/items/${id}`, "PATCH", {
        content: "stale",
        base_revision: 1,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request(student, `/api/v1/items/${id}/revisions`)).status,
    403,
  );
  const history = await request(lecturer, `/api/v1/items/${id}/revisions`);
  assert.equal(history.data[0].snapshot.content, "Bản đầu tiên");
  const restored = await request(
    lecturer,
    `/api/v1/items/${id}/revisions/1/restore`,
    "POST",
    { base_revision: 2 },
  );
  assert.equal(restored.status, 201, JSON.stringify(restored.error));
  assert.equal(restored.data.content, "Bản đầu tiên");
  assert.equal(restored.data.revision, 3);
  const copy = await request(
    lecturer,
    `/api/v1/items/${id}/duplicate`,
    "POST",
    {},
  );
  assert.equal(copy.status, 201);
  assert.equal(copy.data.status, "DRAFT");
  assert.notEqual(copy.data.id, id);
});

test("Group workspace and files are restricted to members, course sharing requires staff", async () => {
  const group = await request(
    lecturer,
    `/api/v1/courses/${sid}/groups`,
    "POST",
    { name: "Private study group", members: [student.me.id] },
  );
  assert.equal(group.status, 201);
  const gid = group.data.id;
  assert.equal(
    (await request(student2, `/api/v1/groups/${gid}/workspace`)).status,
    403,
  );
  assert.equal(
    (
      await request(student2, `/api/v1/groups/${gid}/posts`, "POST", {
        content: "forbidden",
      })
    ).status,
    403,
  );
  const f = new FormData();
  f.set("file", new Blob(["Nội dung riêng tư"]), "nhom-hoc.txt");
  const file = await request(
    student,
    `/api/v1/courses/${sid}/files`,
    "POST",
    f,
  );
  assert.equal(file.status, 201);
  const fid = file.data.id;
  assert.equal(
    (
      await request(student, `/api/v1/files/${fid}/sharing`, "PATCH", {
        visibility: "COURSE",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(student, `/api/v1/files/${fid}/sharing`, "PATCH", {
        visibility: "GROUP",
        group_id: gid,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(student, `/api/v1/groups/${gid}/posts`, "POST", {
        content: "Chia sẻ tài liệu tiếng Việt",
        file_ids: [fid],
      })
    ).status,
    201,
  );
  const space = await request(lecturer, `/api/v1/groups/${gid}/workspace`);
  assert.equal(space.data.posts[0].file_ids[0], fid);
  assert.equal(space.data.files[0].id, fid);
  assert.equal((await request(student2, `/api/v1/files/${fid}`)).status, 403);
  assert.equal(
    (await request(student2, `/api/v1/courses/${sid}/files`)).data.some(
      (x) => x.id === fid,
    ),
    false,
  );
  const cf = new FormData();
  cf.set("file", new Blob(["Public class reading"]), "class-reading.txt");
  const shared = await request(
    lecturer,
    `/api/v1/courses/${sid}/files`,
    "POST",
    cf,
  );
  assert.equal(
    (
      await request(
        lecturer,
        `/api/v1/files/${shared.data.id}/sharing`,
        "PATCH",
        { visibility: "COURSE" },
      )
    ).status,
    200,
  );
  assert.equal(
    (await request(student2, `/api/v1/files/${shared.data.id}`)).status,
    200,
  );
});

test("Support workflow keeps tickets private and only admin changes status", async () => {
  const t = await request(student, "/api/v1/support", "POST", {
    title: "Cần hỗ trợ học liệu",
    content: "Tệp bài giảng cần cập nhật.",
  });
  assert.equal(t.status, 201);
  const id = t.data.id;
  assert.equal((await request(student2, `/api/v1/support/${id}`)).status, 403);
  assert.equal(
    (
      await request(student, `/api/v1/support/${id}/replies`, "POST", {
        content: "Tự giải quyết",
        status: "RESOLVED",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(admin, `/api/v1/support/${id}/replies`, "POST", {
        content: "Đã tiếp nhận yêu cầu.",
        status: "IN_PROGRESS",
      })
    ).status,
    201,
  );
  const viewed = await request(student, `/api/v1/support/${id}`);
  assert.equal(viewed.data.ticket.status, "IN_PROGRESS");
  assert.equal(viewed.data.replies[0].content, "Đã tiếp nhận yêu cầu.");
  assert.equal((await request(student, "/api/v1/admin/support")).status, 403);
  assert.ok(
    (
      await request(admin, "/api/v1/admin/support?status=IN_PROGRESS")
    ).data.some((t) => t.id === id),
  );
});

test("Teaching queue, class management and CLO report enforce roles", async () => {
  assert.equal((await request(student, "/api/v1/teaching/queue")).status, 403);
  const queue = await request(lecturer, "/api/v1/teaching/queue");
  assert.equal(queue.status, 200, JSON.stringify(queue.error));
  assert.ok(Array.isArray(queue.data));
  assert.equal((await request(student, "/api/v1/admin/sections")).status, 403);
  const sections = await request(admin, "/api/v1/admin/sections");
  assert.equal(sections.status, 200, JSON.stringify(sections.error));
  assert.ok(sections.data.some((s) => s.id === sid));
  const clo = await request(
    lecturer,
    `/api/v1/courses/${sid}/outcomes`,
    "POST",
    {
      code: "CLO-TEST",
      description: "Đánh giá năng lực thực hành",
      plo: "PLO1",
      mappings: [{ assignment_id: assignment.id, weight: 100 }],
    },
  );
  assert.equal(clo.status, 201);
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/outcome-report`)).status,
    403,
  );
  const report = await request(
    lecturer,
    `/api/v1/courses/${sid}/outcome-report`,
  );
  assert.equal(report.status, 200, JSON.stringify(report.error));
  const row = report.data.find(
    (r) => r.id === clo.data.id && r.user_id === student.me.id,
  );
  assert.equal(Number(row.attainment), 85);
  assert.equal(Number(row.assessed_weight), 100);
  assert.equal(
    Number(
      report.data.find(
        (r) => r.id === clo.data.id && r.user_id === student2.me.id,
      ).assessed_weight,
    ),
    0,
  );
});

test("Learning package preview/import is permissioned, draft-only and idempotent", async () => {
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/package`)).status,
    403,
  );
  const exported = await request(lecturer, `/api/v1/courses/${sid}/package`);
  assert.equal(exported.status, 200, JSON.stringify(exported.error));
  assert.equal(exported.data.format, "MITUNI_LEARNING_PACKAGE");
  assert.ok(exported.data.modules.length);
  assert.equal(exported.data.students, undefined);
  const payload = {
    format: "MITUNI_LEARNING_PACKAGE",
    version: 1,
    modules: [
      {
        title: "Module được nhập",
        items: [
          {
            title: "Bài giảng mẫu",
            content_format: "HTML",
            content: "<p>Nội dung an toàn</p><script>alert(1)</script>",
          },
        ],
      },
    ],
    questions: [
      {
        type: "TRUE_FALSE",
        prompt: "Câu hỏi được nhập",
        options: ["Đúng", "Sai"],
        answer: 0,
        points: 1,
      },
    ],
  };
  assert.equal(
    (
      await request(
        student,
        `/api/v1/courses/${sid}/package/preview`,
        "POST",
        payload,
      )
    ).status,
    403,
  );
  const before = (await request(lecturer, `/api/v1/courses/${sid}/modules`))
    .data.length;
  const preview = await request(
    lecturer,
    `/api/v1/courses/${sid}/package/preview`,
    "POST",
    payload,
  );
  assert.equal(preview.status, 201, JSON.stringify(preview.error));
  assert.equal(preview.data.summary.items, 1);
  assert.equal(
    (await request(lecturer, `/api/v1/courses/${sid}/modules`)).data.length,
    before,
  );
  assert.equal(
    (
      await request(
        admin,
        `/api/v1/package-imports/${preview.data.id}/execute`,
        "POST",
        {},
      )
    ).status,
    403,
  );
  const done = await request(
    lecturer,
    `/api/v1/package-imports/${preview.data.id}/execute`,
    "POST",
    {},
  );
  assert.equal(done.status, 201, JSON.stringify(done.error));
  assert.equal(
    (
      await request(
        lecturer,
        `/api/v1/package-imports/${preview.data.id}/execute`,
        "POST",
        {},
      )
    ).status,
    201,
  );
  const modules = (await request(lecturer, `/api/v1/courses/${sid}/modules`))
    .data;
  assert.equal(modules.length, before + 1);
  const imported = modules.find((m) => m.title === "Module được nhập");
  assert.equal(imported.status, "DRAFT");
  assert.equal(imported.items[0].status, "DRAFT");
  assert.doesNotMatch(imported.items[0].content, /script/);
  assert.equal(
    (await request(student, `/api/v1/courses/${sid}/modules`)).data.some(
      (m) => m.id === imported.id,
    ),
    false,
  );
});

test("Malformed questions are rejected for direct creation and package preview", async () => {
  for (const q of [
    { type: "NUMERIC", answer: { value: 3, tolerance: "bad" } },
    { type: "MULTIPLE_CHOICE", options: ["A", "B"], answer: [0, 0] },
    { type: "SHORT_ANSWER", answer: { html: "bad" } },
    { type: "MATCHING", answer: [{ value: "x" }] },
  ]) {
    const question = { prompt: "Validation test", ...q };
    assert.equal(
      (
        await request(
          lecturer,
          `/api/v1/courses/${sid}/questions`,
          "POST",
          question,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          lecturer,
          `/api/v1/courses/${sid}/package/preview`,
          "POST",
          {
            format: "MITUNI_LEARNING_PACKAGE",
            version: 1,
            questions: [question],
          },
        )
      ).status,
      400,
    );
  }
});

test("Full grade export respects release visibility and supports pagination", async () => {
  const own = await request(student, `/api/v1/courses/${sid}/gradebook/export`);
  assert.equal(own.status, 200);
  assert.ok(own.data.length);
  assert.ok(
    own.data.every(
      (g) => g.status === "RELEASED" && g.student === student.me.name,
    ),
  );
  const other = await request(
    student2,
    `/api/v1/courses/${sid}/gradebook/export`,
  );
  assert.equal(other.data.length, 0);
  const teacher = await request(
    lecturer,
    `/api/v1/courses/${sid}/gradebook/export`,
  );
  assert.equal(teacher.status, 200);
  assert.ok(teacher.data.length >= own.data.length);
  const first = await request(
      lecturer,
      `/api/v1/courses/${sid}/gradebook?limit=1&page=1`,
    ),
    second = await request(
      lecturer,
      `/api/v1/courses/${sid}/gradebook?limit=1&page=2`,
    );
  assert.equal(first.data.grades.length, 1);
  assert.equal(second.data.grades.length, 1);
  assert.notEqual(first.data.grades[0].id, second.data.grades[0].id);
});

test("Read-only course rejects new submissions and audit records grade release", async () => {
  assert.equal(
    (
      await request(admin, `/api/v1/admin/sections/${sid}`, "PATCH", {
        status: "READ_ONLY",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        student,
        `/api/v1/assignments/${assignment.id}/submissions`,
        "POST",
        { text: "After archive" },
      )
    ).status,
    403,
  );
  const log = await request(admin, "/api/v1/admin/audit?limit=100");
  assert.ok(log.data.some((a) => a.action === "GRADE_UPDATED"));
});
test("Disabling a user revokes access", async () => {
  assert.equal(
    (
      await request(admin, `/api/v1/admin/users/${student2.me.id}`, "PATCH", {
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await request(student2, "/api/v1/me")).status, 401);
});
