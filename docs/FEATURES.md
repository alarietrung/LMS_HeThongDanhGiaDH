# Phạm vi đã xây dựng và phần còn lại

Đối chiếu theo nhóm chức năng của tài liệu UNIVERSITY LMS. Không coi bảng này là chứng nhận hoàn thành 130/130 mục.

| Nhóm | Có thể sử dụng trong bản local | Giới hạn / chưa triển khai |
|---|---|---|
| Giao diện | Landing page riêng, Be Vietnam Pro self-hosted, dashboard theo vai trò, sidebar PC/mobile có quản lý focus, bottom nav, sáng/tối, trạng thái tải/lỗi/rỗng, PWA | Chưa thử thiết bị Android/iOS thật; tiếng Anh mới một phần điều hướng; chưa đạt kiểm toán WCAG |
| Xác thực | Session cookie HttpOnly, CSRF/Origin, xem/thu hồi phiên; mã Entra OIDC+PKCE và kiểm tra tenant; demo chỉ dev | Entra tenant thật chưa kiểm thử; conditional access theo cấu hình tenant |
| RBAC | Quyền lưu DB, vai trò người dùng, chỉnh permission với audit, kiểm tra enrollment ở backend | Chưa có scope khoa/bộ môn đầy đủ; một số vai trò khai báo nhưng mặc định không cấp quyền; không dùng như hệ thống đa trường hoàn chỉnh |
| Học phần | Danh sách, tổng quan, thành viên, module, thứ tự kéo thả, nháp/công bố/hẹn giờ, prerequisite, hoàn thành; rich editor tự lưu, lịch sử/khôi phục/nhân bản bài; gói JSON preview/import/export | Gói chỉ gồm module, nội dung và ngân hàng câu hỏi; không sao chép tệp nhị phân, bài tập/quiz, lịch, prerequisite, enrollment hay điểm; import luôn là nháp |
| Học liệu | Rich text được làm sạch HTML, bảng/liên kết/hình ảnh; thư viện tệp và preview, chia sẻ riêng tư/lớp/nhóm; local/Azure có kiểm tra nội dung và quyền | Chưa SCORM/xAPI/H5P, antivirus, quota; 10 MB/tệp; chưa pipeline xử lý video hoặc chú thích PDF |
| Bài tập | Tạo bài, deadline/nộp trễ/số lần, text/link/file, phiên bản bài nộp, idempotency, rubric, chấm/feedback | Chưa bài tập nhóm, chấm ẩn danh, plagiarism, peer review, comment theo vị trí tài liệu |
| Kiểm tra | Ngân hàng 10 loại và kiểm tra cấu trúc đáp án, snapshot, đảo câu, timer máy chủ, autosave, hết giờ tự nộp, tự chấm, tệp thật, chấm tự luận/tệp, chính sách xem đáp án; nút sắp xếp thứ tự và trường ghép/điền riêng | Chưa random pool theo tag, mật khẩu, phân tích độ khó, import QTI, proctoring; sổ điểm dùng lần nộp mới nhất |
| Điểm | Nháp/công bố, sinh viên chỉ thấy điểm công bố, trọng số 100%, tổng điểm, phân trang chi tiết, CSV toàn bộ tối đa 10.000 dòng theo quyền, audit; hàng đợi bài cần chấm | Chưa moderation/approval nhiều cấp, khóa kỳ, grade override workflow, SIS grade export tự động |
| Điểm danh | Tạo buổi, ghi nhận thủ công, mã có thời hạn, kiểm tra trạng thái | Chưa import log Teams, QR động, báo cáo chuyên sâu |
| Thảo luận | Chủ đề, phản hồi, khóa/mở, danh sách theo lớp | Chưa rich editor, mentions, reactions, gắn tệp trong bài thảo luận |
| Nhóm | Tạo nhóm, thành viên/trưởng nhóm, workspace trao đổi và tệp riêng cho thành viên/giảng viên, kiểm tra quyền phía API | Chưa realtime chat, bài tập/chấm điểm chung nhóm |
| Thông báo | Thông báo lớp, ghim, hẹn giờ, in-app notification/đánh dấu đã đọc | Lưu tùy chọn email nhưng chưa gửi email/push; chưa digest |
| Tin nhắn | Tin nhắn nội bộ giữa người cùng học phần, lưu DB | Chưa realtime WebSocket, upload, tìm kiếm lịch sử/phân trang UI |
| Lịch/công việc | Lịch tháng/tuần/ngày/agenda, bài tập đến hạn, nhắc cá nhân, sự kiện Teams | Chưa lịch lặp nâng cao, reminder delivery, kéo-thả đổi lịch |
| Tiến độ/CLO | Tiến độ hoàn thành, CLO/PLO; giao diện tạo CLO và mapping trọng số, báo cáo attainment theo sinh viên từ điểm công bố, CSV | Chưa báo cáo kiểm định toàn chương trình |
| Analytics | Các số liệu học phần, bài nộp/hoàn thành, cảnh báo theo quy tắc | Chưa warehouse/BI, theo dõi clickstream, mô hình dự đoán rủi ro |
| SIS | JSON preview, execute transaction, upsert external_id, lịch sử nhập | Chưa API adapter thật/delta-sync/scheduler SIS; preview mới kiểm tra cấu trúc; chưa đồng bộ đầy đủ bộ môn/chương trình/thời khóa biểu |
| Microsoft Teams | Mã Graph v1 Outlook Event + Teams, transactionId, trạng thái lỗi rõ ràng | Chưa chạy tenant thật, webhook/update/cancel/attendance, retry Graph tự động |
| Quản trị/hỗ trợ | Người dùng/quyền, cấu trúc SIS chỉ đọc, audit, danh sách lớp và đổi trạng thái, ticket cá nhân có phản hồi; hàng đợi quản trị, trạng thái cấu hình | Chưa phân công ticket, SLA/escalation, quản trị cấu trúc SIS thủ công đầy đủ |
| Hạ tầng | Build/typecheck, 30 kiểm thử tự động local, DB constraints, rate limit, headers, private files, health; migration version/checksum/transaction và khóa đồng thời PostgreSQL; cấu hình Docker/Postgres/Redis/Azure | Chưa kiểm thử Docker/Redis/Azure/PostgreSQL dịch vụ thật, CI/CD remote, rollback phiên bản tự động, HA, load test, backup restore drill, antivirus, monitoring/alerting production |

## Dữ liệu và an toàn

- Các bản ghi dùng thử được đánh dấu là demo; nội dung học liệu mẫu không thay thế giáo trình thật và không phải bản sao đầy đủ dữ liệu máy chủ trường.
- Không có mật khẩu local/đăng ký tài khoản cho production. Các persona dùng thử bị vô hiệu hóa khi NODE_ENV=production.
- Chưa có APK/IPA; đường triển khai di động hiện tại là PWA trên HTTPS. Có trang ngoại tuyến nhưng không cho làm/nộp bài offline để tránh tạo cảm giác bài đã gửi khi chưa có xác nhận máy chủ.
- Không cache API riêng tư bằng service worker. Điểm nháp không xuất hiện ở sổ điểm sinh viên. Chế độ xem đáp án quiz là một chính sách riêng do giảng viên chọn.
- Tất cả kiểm thử hiện tại chạy local với dữ liệu giả. Trước production cần đánh giá quyền, dữ liệu và hạ tầng thật theo `DEPLOYMENT.md`.
