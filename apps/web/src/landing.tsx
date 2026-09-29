"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  GraduationCap,
  Layers3,
  ShieldCheck,
  MonitorSmartphone,
  MessageCircle,
  ChevronRight,
  Menu,
  X,
  FileText,
  Play,
  ChartNoAxesCombined,
} from "lucide-react";

export function Landing({ signedIn = false }: { signedIn?: boolean }) {
  const [menu, setMenu] = useState(false),
    [role, setRole] = useState(0);
  const destination = signedIn ? "/dashboard" : "/login";
  const roles = [
    {
      name: "Sinh viên",
      title: "Mỗi ngày học tập, một bước tiến mới.",
      description:
        "Biết hôm nay cần học gì, bài nào sắp đến hạn và mình đã tiến bộ ra sao. Mọi thứ cần cho học kỳ nằm trong một không gian.",
      items: [
        "Học liệu và lộ trình theo từng học phần",
        "Nộp bài, làm kiểm tra và xem phản hồi",
        "Lịch học, điểm số và tiến độ cá nhân",
      ],
      icon: GraduationCap,
    },
    {
      name: "Giảng viên",
      title: "Tập trung vào việc dạy và truyền cảm hứng.",
      description:
        "Tổ chức nội dung theo module, giao bài và theo dõi từng lớp. Những công việc thường ngày được kết nối trong cùng một quy trình.",
      items: [
        "Xây dựng học phần và ngân hàng câu hỏi",
        "Chấm bài theo rubric, công bố kết quả",
        "Điểm danh và theo dõi hoạt động lớp",
      ],
      icon: BookOpen,
    },
    {
      name: "Quản trị",
      title: "Một nền tảng, quản lý nhất quán.",
      description:
        "Quản lý người dùng, vai trò và dữ liệu học vụ. Theo dõi thay đổi quan trọng và trạng thái các kết nối trong hệ thống.",
      items: [
        "Vai trò và quyền truy cập theo phân công",
        "Nhập dữ liệu học vụ qua quy trình kiểm tra",
        "Nhật ký hoạt động và yêu cầu hỗ trợ",
      ],
      icon: ShieldCheck,
    },
  ];
  const selected = roles[role],
    RoleIcon = selected.icon;
  return (
    <div className="landing">
      <a className="skip-link" href="#landing-main">
        Chuyển đến nội dung
      </a>
      <header className="landing-nav">
        <Link
          className="landing-brand"
          href="/"
          aria-label="MITUNI Học tập số — trang chủ"
        >
          <img src="/assets/mituni-logo.png" alt="MIT University" />
          <span>HỌC TẬP SỐ</span>
        </Link>
        <nav
          aria-label="Điều hướng trang giới thiệu"
          className={menu ? "is-open" : ""}
        >
          <a href="#trai-nghiem" onClick={() => setMenu(false)}>
            Trải nghiệm
          </a>
          <a href="#danh-cho-ban" onClick={() => setMenu(false)}>
            Dành cho bạn
          </a>
          <a href="#huong-dan" onClick={() => setMenu(false)}>
            Hướng dẫn
          </a>
        </nav>
        <Link className="landing-login" href={destination}>
          {signedIn ? "Vào học tập" : "Đăng nhập"}
          <ArrowUpRight size={17} />
        </Link>
        <button
          className="landing-menu"
          aria-label={menu ? "Đóng menu" : "Mở menu"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>
      <main id="landing-main">
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="landing-eyebrow">
              <span />
              KHÔNG GIAN HỌC TẬP MITUNI
            </span>
            <h1>
              Tri thức kết nối.
              <br />
              <em>Tương lai rộng mở.</em>
            </h1>
            <p>
              Học tập, cộng tác và phát triển — trong một không gian số dành
              riêng cho cộng đồng MIT University.
            </p>
            <div className="landing-actions">
              <Link className="landing-primary" href={destination}>
                Bắt đầu hành trình
                <ArrowUpRight size={19} />
              </Link>
              <a className="landing-secondary" href="#trai-nghiem">
                Khám phá không gian
                <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-note">
              <ShieldCheck size={18} />
              <span>Đăng nhập bằng tài khoản Microsoft 365 của trường.</span>
            </div>
          </div>
          <div
            className="landing-visual"
            aria-label="Minh hoạ không gian học tập, không phải dữ liệu cá nhân"
          >
            <div className="preview-label">
              <span className="live-dot" /> MỘT GÓC KHÔNG GIAN HỌC TẬP
            </div>
            <div className="landing-preview">
              <div className="preview-top">
                <div className="preview-monogram">M</div>
                <strong>Học kỳ của bạn</strong>
                <span className="preview-avatar">SV</span>
              </div>
              <div className="preview-greeting">
                <span>CHÀO NGÀY MỚI</span>
                <h2>Sẵn sàng cho điều mới?</h2>
                <p>Bắt đầu từ một bài học nhỏ, mỗi ngày.</p>
              </div>
              <div className="preview-course">
                <span className="preview-book">
                  <BookOpen size={27} />
                </span>
                <div>
                  <span>HỌC PHẦN</span>
                  <h3>Quản trị hệ thống mạng</h3>
                  <p>Module 02 · Cài đặt Windows Server</p>
                </div>
                <ArrowUpRight size={19} />
              </div>
              <div className="preview-progress">
                <span>Hành trình học tập</span>
                <strong>4 / 6 hoạt động</strong>
                <div>
                  <i />
                </div>
              </div>
              <div className="preview-next">
                <span className="preview-check">
                  <Check size={19} />
                </span>
                <div>
                  <strong>Mỗi bước tiến đều được ghi nhận</strong>
                  <p>Học liệu · Bài tập · Phản hồi</p>
                </div>
              </div>
            </div>
            <div className="preview-floating">
              <CalendarDays size={22} />
              <div>
                <strong>Không bỏ lỡ điều quan trọng</strong>
                <span>Lịch học và hạn nộp, cùng một nơi.</span>
              </div>
            </div>
            <span className="preview-caption">Giao diện minh hoạ</span>
          </div>
        </section>
        <div className="landing-strip">
          <span>DÀNH CHO MỘT HÀNH TRÌNH LIỀN MẠCH</span>
          <div>
            <BookOpen size={18} />
            Học tập có lộ trình
          </div>
          <div>
            <MessageCircle size={18} />
            Kết nối trong học phần
          </div>
          <div>
            <ChartNoAxesCombined size={18} />
            Theo dõi từng bước tiến
          </div>
        </div>
        <section className="landing-section" id="trai-nghiem">
          <div className="landing-section-head">
            <div>
              <p className="landing-eyebrow">HỌC TẬP, GỌN TRONG MỘT NƠI</p>
              <h2>
                Ít phân tán hơn.
                <br />
                Nhiều cảm hứng hơn.
              </h2>
            </div>
            <p>
              Từ buổi học đầu tiên đến khi nhận phản hồi, mọi hoạt động đều kết
              nối với học phần của bạn.
            </p>
          </div>
          <div className="landing-features">
            {[
              {
                icon: Layers3,
                no: "01",
                title: "Mở ra bài học tiếp theo",
                text: "Nội dung chia thành từng module rõ ràng. Xem học liệu, hoàn thành hoạt động và tiếp tục đúng nơi bạn đã dừng.",
              },
              {
                icon: FileText,
                no: "02",
                title: "Chủ động với mỗi thời hạn",
                text: "Bài tập, kiểm tra và lịch học được sắp xếp tập trung. Bài nộp có lịch sử để bạn dễ dàng kiểm tra lại.",
              },
              {
                icon: CheckCheck,
                no: "03",
                title: "Nhìn thấy sự tiến bộ",
                text: "Nhận phản hồi từ giảng viên, theo dõi điểm đã công bố và các hoạt động đã hoàn thành trong từng học phần.",
              },
            ].map((f) => (
              <article key={f.no}>
                <div className="feature-top">
                  <f.icon size={25} />
                  <span>{f.no}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
                <Link href={destination}>
                  Khám phá trong LMS
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-roles landing-section" id="danh-cho-ban">
          <div>
            <p className="landing-eyebrow">
              CÙNG MỘT KHÔNG GIAN. ĐÚNG VAI TRÒ.
            </p>
            <h2>
              Được thiết kế
              <br />
              cho hành trình của bạn.
            </h2>
            <div
              className="landing-role-tabs"
              role="tablist"
              aria-label="Chọn vai trò"
            >
              {roles.map((r, i) => (
                <button
                  key={r.name}
                  id={`role-tab-${i}`}
                  role="tab"
                  aria-selected={role === i}
                  aria-controls="role-panel"
                  onClick={() => setRole(i)}
                >
                  {r.name}
                </button>
              ))}
            </div>
            <div
              id="role-panel"
              role="tabpanel"
              aria-labelledby={`role-tab-${role}`}
            >
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <ul>
                {selected.items.map((t) => (
                  <li key={t}>
                    <Check size={17} />
                    {t}
                  </li>
                ))}
              </ul>
              <Link className="text-link" href={destination}>
                Đến không gian của bạn
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className="role-visual">
            <div className="role-orbit" />
            <div className="role-icon">
              <RoleIcon size={72} strokeWidth={1.3} />
            </div>
            <div className="role-visual-caption">
              <span>MIT UNIVERSITY</span>
              <strong>
                Học tập không chỉ là
                <br />
                một điểm đến.
              </strong>
              <p>Mà là hành trình cùng nhau.</p>
            </div>
          </div>
        </section>
        <section className="landing-section landing-mobile-section">
          <div className="mobile-illustration">
            <MonitorSmartphone size={84} strokeWidth={1} />
            <span>DESKTOP · TABLET · MOBILE</span>
          </div>
          <div>
            <p className="landing-eyebrow">
              KHÔNG GIAN QUEN THUỘC, TRÊN MỌI MÀN HÌNH
            </p>
            <h2>
              Ở đâu thuận tiện,
              <br />ở đó có việc học.
            </h2>
            <p>
              Trải nghiệm tự thích ứng với máy tính, Android và iPhone. Khi hệ
              thống được triển khai trên HTTPS, bạn có thể thêm LMS vào màn hình
              chính như một ứng dụng.
            </p>
            <a className="text-link" href="#huong-dan">
              Xem hướng dẫn bắt đầu
              <ChevronRight size={17} />
            </a>
          </div>
        </section>
        <section className="landing-section landing-faq" id="huong-dan">
          <div>
            <p className="landing-eyebrow">BẮT ĐẦU THẬT DỄ DÀNG</p>
            <h2>
              Một vài điều
              <br />
              bạn có thể muốn biết.
            </h2>
          </div>
          <div>
            {[
              [
                "Tôi dùng tài khoản nào để đăng nhập?",
                "Sử dụng tài khoản Microsoft 365 do nhà trường cấp. Tài khoản cần được cấp quyền trong LMS. Môi trường local có các vai trò dùng thử riêng, không kết nối dữ liệu của trường.",
              ],
              [
                "Tôi có cần cài ứng dụng không?",
                "Không bắt buộc. Bạn có thể học trực tiếp bằng trình duyệt. Trên địa chỉ HTTPS, dùng “Cài ứng dụng” trên Android hoặc “Thêm vào Màn hình chính” trong Safari trên iPhone.",
              ],
              [
                "Tôi chưa thấy học phần của mình?",
                "Học phần xuất hiện theo danh sách đăng ký và phân công từ dữ liệu học vụ. Hãy gửi yêu cầu trong mục Trợ giúp sau khi đăng nhập để quản trị kiểm tra.",
              ],
              [
                "Bài đã nộp được lưu ở đâu?",
                "Bài nộp và lịch sử các lần nộp được lưu trên máy chủ LMS. Chỉ xem là nộp thành công khi hệ thống xác nhận đã lưu; các thao tác học tập và nộp bài cần kết nối mạng.",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span>+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-cta">
          <div>
            <span>HỌC HÔM NAY. KIẾN TẠO NGÀY MAI.</span>
            <h2>
              Hành trình tiếp theo
              <br />
              bắt đầu từ bạn.
            </h2>
          </div>
          <Link href={destination}>
            Vào không gian học tập
            <ArrowUpRight size={22} />
          </Link>
        </section>
      </main>
      <footer className="landing-footer">
        <Link href="/" aria-label="MITUNI trang chủ">
          <img src="/assets/mituni-logo.png" alt="MIT University" />
        </Link>
        <p>
          Không gian học tập số
          <br />
          <span>Mien Dong Innovative Technology University</span>
        </p>
        <div>
          <a href="#huong-dan">Hướng dẫn sử dụng</a>
          <Link href={destination}>
            Truy cập hệ thống
            <ArrowUpRight size={14} />
          </Link>
          <small>© {new Date().getFullYear()} MITUNI LMS</small>
        </div>
      </footer>
    </div>
  );
}
