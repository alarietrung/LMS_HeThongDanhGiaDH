# Triển khai và vận hành

## Trước production

Chưa triển khai Internet trong phiên làm việc này. Dockerfile/Compose là cấu hình khởi đầu; cần chạy staging, kiểm thử tải, bảo mật và phục hồi trước khi nhận dữ liệu sinh viên thật.

1. Tạo môi trường PostgreSQL riêng, Redis riêng và Azure Blob container **private**. Không dùng chung `.data` của môi trường demo.
2. Sao chép `.env.example` thành `.env` rồi cấu hình. Không đưa `.env` hoặc bản sao dữ liệu lên Git. Dùng secret manager của hạ tầng ở production.
3. Đặt `DEMO_MODE=false`, `NODE_ENV=production`, `APP_URL=https://<tên-miền>` và `ENTRA_REDIRECT_URI=https://<tên-miền>/auth/microsoft/callback`.
4. Cấu hình DATABASE_URL, REDIS_URL, AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER. Tạo khóa TOKEN_ENCRYPTION_KEY 32 byte base64 bằng lệnh trong `.env.example`. Không xoay khóa này tùy tiện khi còn token cache cần giải mã.
5. Bootstrap admin bằng Object ID Entra (`BOOTSTRAP_ADMIN_OID`) và email trước lần chạy đầu trên DB trống. Trường hợp DB đã khởi tạo không có admin cần thao tác khôi phục có kiểm soát của quản trị CSDL; không có đường vòng đăng nhập công khai.
6. Đặt TLS reverse proxy trước cổng 3000; API 4100 chỉ nội bộ. Bật HTTPS thật và kiểm tra cookie Secure. Compose chỉ bind cổng ra loopback; không mở PostgreSQL/Redis ra Internet.

## Microsoft 365

Đăng ký app confidential web trong tenant trường, cung cấp tenant ID, client ID và client secret qua máy chủ. Cho phép redirect URI chính xác; flow authorization code + PKCE. Scopes trong mã là openid, profile, offline_access, User.Read và Calendars.ReadWrite (delegated). Nhà trường cần xét duyệt quyền phù hợp với chính sách tenant. Không dùng endpoint login giả.

Người dùng cần tồn tại trong LMS qua SIS với `microsoft_id` trùng Entra Object ID. Không tự tạo người dùng chỉ vì đăng nhập được Microsoft. Giảng viên phải có Outlook mailbox/license thích hợp để tạo sự kiện có Teams. App dùng Graph v1.0 `POST /me/events`, `isOnlineMeeting=true`, `onlineMeetingProvider=teamsForBusiness`, transactionId để chống tạo trùng. Chưa có webhook đồng bộ thay đổi từ Outlook hay retry Graph tự động.

Tài liệu chính thức: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow và https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0.

## Azure Blob

Container phải tồn tại, private; CORS chỉ cho APP_URL với PUT và header Content-Type/x-ms-blob-type. Backend ký URL tải lên ngắn hạn và xác minh tệp sau tải lên. Download phải qua API kiểm tra quyền. Giới hạn hiện tại 10 MB/tệp; chưa có antivirus, quota theo người dùng hay tác vụ dọn upload dang dở. Không mở public container.

## SIS

Hiện có adapter **nhập JSON thủ công**, preview cấu trúc và execute trong transaction, upsert theo external_id. SIS_BASE_URL/SIS_API_TOKEN chưa được dùng để gọi API tự động. Cần hợp đồng API thực tế để triển khai lịch delta-sync, xử lý xung đột, vô hiệu hóa user và báo cáo lỗi theo dòng. Payload mẫu có ngay trong màn hình Quản trị → Đồng bộ SIS. Preview chưa phải một dry-run đầy đủ về tham chiếu.

## Docker

Node 24, PostgreSQL 17 và Redis 7. Đặt POSTGRES_PASSWORD đủ mạnh trong `.env` (nếu có ký tự đặc biệt cần URL-encode phần password trong DATABASE_URL hoặc chỉnh Compose dùng URL đã encode).

```powershell
docker compose up -d postgres redis
# Chỉ chạy production sau khi đã điền đầy đủ cấu hình thật:
docker compose --profile production up -d --build
```

Không tự chạy Compose production trong phiên này. `/health/live` kiểm tra tiến trình; `/health/ready` truy vấn DB, Redis (nếu bật), và Azure container (nếu bật). Không khẳng định Entra/SIS đang hoạt động chỉ từ việc có biến môi trường.

## Nâng cấp cấu trúc dữ liệu

API kiểm tra và áp dụng migration trước khi phục vụ request. `apps/api/src/db/schema.sql` là bản gốc `001_initial`; `apps/api/src/db/migrations/002_workspace_indexes.sql` bổ sung chỉ mục. Nhật ký `schema_migrations` lưu phiên bản, SHA-256 và thời điểm áp dụng. Nội dung SQL được chuẩn hóa CRLF trước khi tính checksum.

- Từ bản này, **không chỉnh sửa hoặc xóa file migration đã chạy**. Thay đổi tiếp theo phải thêm file như `003_ten_thay_doi.sql` trong thư mục migrations. Giữ toàn bộ file SQL khi đóng gói triển khai.
- Sao lưu DB và tệp trước nâng cấp; thử trên bản sao staging. Bản local cũ chưa có nhật ký sẽ được áp dụng baseline có kiểm tra tồn tại, không reset dữ liệu.
- Migration chạy trong transaction; PostgreSQL dùng advisory lock để tránh hai tiến trình áp dụng đồng thời. Nếu lỗi SQL/checksum hoặc thiếu migration nguồn, startup thất bại và transaction rollback; kiểm tra log, khôi phục file nguồn đúng phiên bản rồi thử lại.
- Đây là **forward migration**, không có lệnh tự động hạ phiên bản. Nếu cần quay lại bản ứng dụng không tương thích, phục hồi backup đã kiểm chứng cùng bộ mã phù hợp hoặc viết migration sửa tiến về phía trước. Không sửa checksum trong DB để bỏ qua lỗi.
- Kiểm thử hiện tại xác minh PGlite giữ dữ liệu qua restart và từ chối checksum bị thay đổi; đường PostgreSQL dịch vụ còn cần nghiệm thu staging.

## Backup / khôi phục

- Local: dừng START-LMS bằng Ctrl+C rồi sao lưu toàn bộ `.data` tới nơi riêng có kiểm soát quyền. Không chép nóng một phần tệp PostgreSQL nhúng.
- Production: lập lịch `pg_dump -Fc` hoặc snapshot có PITR; bật versioning/soft-delete Azure Blob và sao lưu cấu hình/khóa mã hóa trong kho secrets. Redis bật AOF trong Compose nhưng không thay thế backup DB.
- Phục hồi vào môi trường staging trống, kiểm tra đối chiếu user/enrollment/bài nộp/tệp/điểm, đo RPO/RTO trước khi chuyển traffic. Chưa có diễn tập restore tự động hoặc cam kết RPO/RTO.
- Không xóa `.data`, volume Docker, hoặc chạy reset dữ liệu để xử lý lỗi nếu chưa có bản sao kiểm chứng.

## Điều kiện nghiệm thu còn lại

Kiểm thử tenant thật, Graph/Blob/Redis/PostgreSQL thật; bài test end-to-end tự động trên Chrome/Safari/Android/iOS; kiểm thử tải/concurrency; rà soát RBAC và đa đơn vị; nghiệm thu migration và quy trình phục hồi; antivirus; monitoring/alerting; backup/restore; kiểm thử bảo mật độc lập. Đây là những hạng mục trước vận hành, không phải các tính năng đã được chứng nhận.
