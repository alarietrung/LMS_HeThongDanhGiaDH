import { Db } from "./db";
import { demo } from "../auth/auth";
export async function seed(db: Db) {
  const student = [
    "course.view",
    "submission.create",
    "quiz.attempt",
    "discussion.create",
    "gradebook.view",
  ];
  const teaching = [
    ...student,
    "course.manage",
    "module.manage",
    "assignment.manage",
    "assignment.grade",
    "quiz.manage",
    "gradebook.manage",
    "attendance.manage",
    "analytics.view",
    "announcement.manage",
    "teams.manage",
  ];
  const all = [
    ...teaching,
    "system.manage",
    "user.manage",
    "sis.manage",
    "audit.view",
  ];
  for (const [id, name, permissions] of [
    ["student", "Sinh viên", student],
    ["lecturer", "Giảng viên", teaching],
    ["super_admin", "Quản trị hệ thống", all],
    ["university_admin", "Quản trị trường", all],
    [
      "teaching_assistant",
      "Trợ giảng",
      [...student, "module.manage", "attendance.manage"],
    ],
    [
      "grader",
      "Người chấm",
      [...student, "assignment.grade", "gradebook.manage"],
    ],
    ["auditor", "Quan sát", ["course.view"]],
    ...[
      "faculty_admin",
      "department_admin",
      "academic_affairs",
      "program_manager",
      "course_coordinator",
      "academic_advisor",
      "support",
    ].map((x) => [x, x, []]),
  ])
    await db.q(
      "INSERT INTO roles(id,name,permissions) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
      [id, name, JSON.stringify(permissions)],
    );
  if (await db.one("SELECT id FROM institutions LIMIT 1")) return;
  await db.tx(async (tx) => {
    const i = (await tx.one(
      "INSERT INTO institutions(name) VALUES($1) RETURNING id",
      ["MIT University"],
    ))!.id;
    if (!demo()) {
      if (
        process.env.BOOTSTRAP_ADMIN_OID &&
        process.env.BOOTSTRAP_ADMIN_EMAIL
      ) {
        const u = (await tx.one(
          "INSERT INTO users(institution_id,name,email,microsoft_id) VALUES($1,$2,$3,$4) RETURNING id",
          [
            i,
            "Quản trị trường",
            process.env.BOOTSTRAP_ADMIN_EMAIL,
            process.env.BOOTSTRAP_ADMIN_OID,
          ],
        ))!;
        await tx.q("INSERT INTO user_roles VALUES($1,$2)", [
          u.id,
          "super_admin",
        ]);
      }
      return;
    }
    const f = (await tx.one(
      "INSERT INTO faculties(institution_id,name,external_id) VALUES($1,$2,$3) RETURNING id",
      [i, "Khoa Công nghệ – Kỹ thuật", "demo-faculty"],
    ))!.id;
    await tx.q(
      "INSERT INTO departments(faculty_id,name,external_id) VALUES($1,$2,$3)",
      [f, "Bộ môn Công nghệ thông tin", "demo-department"],
    );
    await tx.q(
      "INSERT INTO programs(faculty_id,name,external_id) VALUES($1,$2,$3)",
      [f, "Công nghệ thông tin", "demo-program"],
    );
    const term = (await tx.one(
      "INSERT INTO terms(institution_id,name,academic_year,starts_at,ends_at,external_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        i,
        "Học kỳ 1",
        "2026–2027",
        "2026-08-01T00:00:00Z",
        "2027-01-31T23:59:00Z",
        "demo-term",
      ],
    ))!.id;
    const us: any = {};
    for (const [key, name, email, code, role] of [
      [
        "student",
        "Nguyễn Nam Trung",
        "trung.demo@student.mituni.local",
        "SV-DEMO-01",
        "student",
      ],
      [
        "student2",
        "Trần Minh Anh",
        "anh.demo@student.mituni.local",
        "SV-DEMO-02",
        "student",
      ],
      [
        "lecturer",
        "Trịnh Đình Thắng",
        "thang.demo@mituni.local",
        "GV-DEMO-01",
        "lecturer",
      ],
      [
        "admin",
        "Quản trị MITUNI",
        "admin.demo@mituni.local",
        "QT-DEMO-01",
        "super_admin",
      ],
    ]) {
      us[key] = (await tx.one(
        "INSERT INTO users(institution_id,name,email,student_code,external_id,faculty_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [i, name, email, code, `demo-${key}`, f],
      ))!.id;
      await tx.q("INSERT INTO user_roles VALUES($1,$2)", [us[key], role]);
    }
    for (const [index, code, name, image, description] of [
      [
        0,
        "030100236301",
        "Quản trị hệ thống mạng",
        "/assets/course-network.png",
        "Học phần cung cấp những kiến thức về quản trị mạng LAN theo mô hình domain bằng các dịch vụ của hệ điều hành Windows Server.",
      ],
      [
        1,
        "030100188602",
        "Đổi mới sáng tạo và khởi nghiệp",
        null,
        "Phát triển tư duy sáng tạo, khám phá vấn đề và xây dựng mô hình kinh doanh.",
      ],
    ] as const) {
      const c = (await tx.one(
        "INSERT INTO courses(institution_id,faculty_id,code,name,image,description,external_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
        [i, f, code, name, image, description, `demo-course-${index}`],
      ))!.id;
      const o = (await tx.one(
        "INSERT INTO course_offerings(course_id,term_id,external_id) VALUES($1,$2,$3) RETURNING id",
        [c, term, `demo-offering-${index}`],
      ))!.id;
      const s = (await tx.one(
        "INSERT INTO sections(offering_id,name,external_id) VALUES($1,$2,$3) RETURNING id",
        [o, index ? "DNST-02" : "QTMM-01", `demo-section-${index}`],
      ))!.id;
      for (const key of ["student", "student2", "lecturer"])
        await tx.q("INSERT INTO enrollments VALUES($1,$2,$3,true)", [
          s,
          us[key],
          key === "lecturer" ? "LECTURER" : "STUDENT",
        ]);
      const topics = index
        ? ["Khám phá cơ hội", "Tư duy thiết kế", "Mô hình kinh doanh"]
        : [
            "Thông tin chung về học phần",
            "Cài đặt Windows Server",
            "Dịch vụ Active Directory",
            "Quản lý người dùng và nhóm",
          ];
      let previous: string | undefined;
      for (const [pos, title] of topics.entries()) {
        const m = (await tx.one(
          "INSERT INTO modules(section_id,title,position,status) VALUES($1,$2,$3,$4) RETURNING id",
          [s, title, pos, "PUBLISHED"],
        ))!.id;
        for (const [ip, it] of [
          "Mục tiêu và hướng dẫn",
          "Bài giảng",
          "Thực hành và tự đánh giá",
        ].entries()) {
          const item = (await tx.one(
            "INSERT INTO module_items(module_id,title,type,content,position,status,prerequisite_id) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
            [
              m,
              `${pos + 1}.${ip + 1} ${it}`,
              "PAGE",
              `${title}\n\nMục tiêu\nNắm vững kiến thức nền tảng, vận dụng vào tình huống thực tế và ghi lại kết quả học tập.\n\nNội dung học tập\n1. Đọc tài liệu và phân tích yêu cầu.\n2. Thực hành từng bước, ghi chép các vấn đề gặp phải.\n3. Đối chiếu kết quả với tiêu chí đánh giá.\n\nHoạt động\nTrao đổi với giảng viên trong diễn đàn của học phần. Khi đã học xong, xác nhận hoàn thành để cập nhật tiến độ.`,
              ip,
              "PUBLISHED",
              ip === 2 ? previous : null,
            ],
          ))!.id;
          previous = item;
          if (pos === 0 && ip === 0)
            await tx.q(
              "INSERT INTO item_progress(user_id,item_id) VALUES($1,$2)",
              [us.student, item],
            );
        }
      }
      const rubric = (await tx.one(
        "INSERT INTO rubrics(section_id,title,criteria) VALUES($1,$2,$3) RETURNING id",
        [
          s,
          "Rubric bài thực hành",
          JSON.stringify([
            {
              id: "technical",
              title: "Kết quả kỹ thuật",
              max: 7,
              levels: [
                { label: "Tốt", score: 7 },
                { label: "Đạt", score: 5 },
                { label: "Cần bổ sung", score: 2 },
              ],
            },
            {
              id: "report",
              title: "Báo cáo và trình bày",
              max: 3,
              levels: [
                { label: "Tốt", score: 3 },
                { label: "Đạt", score: 2 },
                { label: "Cần bổ sung", score: 1 },
              ],
            },
          ]),
        ],
      ))!.id;
      const due = new Date(Date.now() + 5 * 86400000).toISOString();
      const a = (await tx.one(
        "INSERT INTO assignments(section_id,title,description,due_at,status,rubric_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [
          s,
          index
            ? "Đề xuất ý tưởng khởi nghiệp"
            : "Lab 01 — Cài đặt Windows Server",
          "Hoàn thành bài thực hành và nộp báo cáo. Trình bày mục tiêu, quy trình, hình ảnh kết quả và phần tự đánh giá. Có thể nộp văn bản, liên kết hoặc tệp.",
          due,
          "PUBLISHED",
          rubric,
        ],
      ))!.id;
      const bank = (await tx.one(
        "INSERT INTO question_banks(section_id,title) VALUES($1,$2) RETURNING id",
        [s, "Ngân hàng câu hỏi cơ bản"],
      ))!.id;
      const quiz = (await tx.one(
        "INSERT INTO quizzes(section_id,title,description,closes_at,status,review_policy) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
        [
          s,
          "Kiểm tra kiến thức — Tuần 1",
          "Hoàn thành bài kiểm tra để tự đánh giá kiến thức. Thời gian 15 phút.",
          due,
          "PUBLISHED",
          "IMMEDIATE",
        ],
      ))!.id;
      const qs = index
        ? [
            [
              "Một ý tưởng khởi nghiệp cần bắt đầu từ đâu?",
              ["Vấn đề của khách hàng", "Logo thương hiệu", "Tên miền website"],
              0,
            ],
            [
              "MVP giúp kiểm chứng giả thuyết với nguồn lực nhỏ.",
              ["Đúng", "Sai"],
              0,
            ],
          ]
        : [
            [
              "Dịch vụ nào phân giải tên miền thành địa chỉ IP?",
              ["DNS", "DHCP", "FTP", "SMTP"],
              0,
            ],
            [
              "Domain Controller quản lý xác thực tập trung trong miền.",
              ["Đúng", "Sai"],
              0,
            ],
            ["Địa chỉ IPv4 có bao nhiêu bit?", ["16", "32", "64", "128"], 1],
          ];
      for (const [pos, q] of qs.entries()) {
        const item = (await tx.one(
          "INSERT INTO questions(bank_id,type,prompt,options,answer,points,explanation) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            bank,
            "SINGLE_CHOICE",
            q[0],
            JSON.stringify(q[1]),
            JSON.stringify(q[2]),
            1,
            "Ôn lại bài giảng của module để hiểu nguyên lý.",
          ],
        ))!.id;
        await tx.q("INSERT INTO quiz_questions VALUES($1,$2,$3)", [
          quiz,
          item,
          pos,
        ]);
      }
      await tx.q("INSERT INTO grade_categories VALUES($1,$2,$3),($1,$4,$5)", [
        s,
        "Assignments",
        70,
        "Quiz",
        30,
      ]);
      await tx.q(
        "INSERT INTO announcements(section_id,title,content,pinned,author_id) VALUES($1,$2,$3,true,$4)",
        [
          s,
          "Chào mừng đến với học phần",
          "Các em xem đề cương, hoàn thành module đầu tiên và kiểm tra thời hạn bài tập. Chúc các em một học kỳ hiệu quả!",
          us.lecturer,
        ],
      );
      const d = (await tx.one(
        "INSERT INTO discussions(section_id,title,author_id,pinned) VALUES($1,$2,$3,true) RETURNING id",
        [s, "Hỏi đáp và trao đổi trong học phần", us.lecturer],
      ))!.id;
      await tx.q(
        "INSERT INTO discussion_posts(discussion_id,author_id,content) VALUES($1,$2,$3)",
        [
          d,
          us.lecturer,
          "Các em đặt câu hỏi tại đây. Khi gặp lỗi thực hành, mô tả bước đang thực hiện và kết quả mong đợi.",
        ],
      );
      const group = (await tx.one(
        "INSERT INTO study_groups(section_id,name,description,leader_id) VALUES($1,$2,$3,$4) RETURNING id",
        [s, "Nhóm thực hành 01", "Trao đổi và hỗ trợ thực hành", us.student],
      ))!.id;
      for (const key of ["student", "student2"])
        await tx.q("INSERT INTO group_members VALUES($1,$2)", [group, us[key]]);
      await tx.q(
        "INSERT INTO calendar_events(section_id,title,kind,starts_at,ends_at,location) VALUES($1,$2,$3,$4,$5,$6)",
        [
          s,
          `${name} · Buổi thực hành`,
          "TIMETABLE",
          new Date(Date.now() + 86400000),
          new Date(Date.now() + 86400000 + 3 * 3600000),
          "Phòng máy A.302",
        ],
      );
      const outcome = (await tx.one(
        "INSERT INTO learning_outcomes(section_id,code,description,plo) VALUES($1,$2,$3,$4) RETURNING id",
        [
          s,
          "CLO1",
          "Vận dụng kiến thức nền tảng để giải quyết bài thực hành.",
          "PLO3",
        ],
      ))!.id;
      await tx.q("INSERT INTO outcome_mappings VALUES($1,$2,100)", [
        outcome,
        a,
      ]);
      await tx.q(
        "INSERT INTO notifications(user_id,title,content,href) VALUES($1,$2,$3,$4)",
        [
          us.student,
          "Bài tập mới",
          index
            ? "Đề xuất ý tưởng khởi nghiệp"
            : "Lab 01 — Cài đặt Windows Server",
          `/courses/${s}?tab=assignments`,
        ],
      );
    }
  });
}
