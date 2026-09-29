# LMS MITUNI

Ứng dụng LMS chạy tại **D:\LMS MITUNI**. Đây là hệ thống độc lập dựa trên nhận diện MITUNI, không phải máy chủ Moodle của trường và không tự kết nối tài khoản đang đăng nhập ở website trường.

## Mở ứng dụng

1. Cài Node.js 24 LTS nếu máy chưa có.
2. Mở `START-LMS.bat` trong thư mục này.
3. Truy cập http://localhost:3000.
4. Từ trang giới thiệu chọn **Đăng nhập**, sau đó chọn **Sinh viên**, **Giảng viên** hoặc **Quản trị** trong khu vực dùng thử. Các thao tác được lưu vào cơ sở dữ liệu trên máy, không gửi sang trường.

Giữ cửa sổ máy chủ đang chạy. Dừng bằng Ctrl+C. Lần chạy đầu có thể mất thời gian biên dịch. Cổng web là 3000, API nội bộ là 4100; dùng đúng `localhost` để khớp chính sách Origin. Nếu đã có máy chủ chạy thì không mở thêm một bản.

`index.html`, `app.js`, `catalog.js`, `data.js`, `styles.css`, `fidelity.css`, `assets` và `start-server.bat` là **bản giao diện tĩnh cũ**, được giữ nguyên. App mới dùng `apps/` và `START-LMS.bat`. Bản nguồn ở ổ C được giữ làm bản dự phòng; phát triển tiếp tại ổ D.

## Kiến trúc và dữ liệu

- Next.js + React + TypeScript, responsive desktop/tablet/mobile; PWA có manifest, icon và trang ngoại tuyến.
- Landing page riêng, font Be Vietnam Pro tự lưu cùng ứng dụng, hỗ trợ đầy đủ dấu tiếng Việt và không phụ thuộc dịch vụ font bên ngoài.
- Soạn học liệu rich text có tự lưu, lịch sử và khôi phục phiên bản; nhập/xuất gói JSON học liệu và ngân hàng câu hỏi dưới dạng nháp. Thư viện tệp phân quyền, không gian nhóm, hàng đợi chấm, báo cáo CLO và xử lý ticket hỗ trợ có giao diện riêng.
- NestJS modular monolith, REST API, PostgreSQL. Không cấu hình DATABASE_URL thì môi trường phát triển dùng PostgreSQL nhúng PGlite tại `.data/postgres`.
- Dữ liệu thử được khởi tạo một lần, giữ lại qua lần chạy sau. Tệp riêng tư tối đa 10 MB lưu tại `.data/files`; production dùng Azure Blob.
- Session HttpOnly, CSRF/Origin, kiểm tra quyền và enrollment ở API, kiểm tra định dạng tệp, nhật ký thay đổi điểm/quyền/SIS. Không lưu access token vào localStorage.
- Nếu có REDIS_URL: BullMQ xử lý lịch phát hành, thông báo hẹn giờ, kết thúc bài kiểm tra, dọn phiên hết hạn. Local không có Redis dùng tác vụ định kỳ 15 giây trong tiến trình API.
- Nâng cấp DB bằng migration có phiên bản và checksum. Không sửa migration đã chạy; xem quy trình trong `docs/DEPLOYMENT.md`.

## Lệnh phát triển

```powershell
cd 'D:\LMS MITUNI'
npm ci
npm run dev
```

Các lệnh kiểm tra: `npm run typecheck`, `npm run build`, `npm test`. Kiểm thử API dùng cổng 4101 và một cơ sở dữ liệu riêng trong `.data/test-runs`, không xóa dữ liệu dùng thử chính. Không chạy hai bộ kiểm thử cùng lúc.

Kết quả kiểm chứng ngày 29/09/2026 và phạm vi chưa kiểm chứng: `docs/QA-2026-09-29.md`.

`npm run build` tạo bản biên dịch. `npm start` là chế độ production, bắt buộc cấu hình thật và không cho đăng nhập persona dùng thử.

## Android / iPhone

App sử dụng PWA, **không phải APK/IPA đã phát hành lên kho ứng dụng**. Giao diện có thanh điều hướng dưới, menu thu gọn, vùng an toàn và trang ngoại tuyến. Bài nộp/điểm không được cache offline; vẫn cần Internet tới máy chủ khi học và nộp bài.

Khi triển khai một địa chỉ HTTPS hợp lệ: Android dùng menu trình duyệt **Cài ứng dụng / Thêm vào màn hình chính**; iPhone dùng Safari → Chia sẻ → **Thêm vào Màn hình chính**. `localhost` trên điện thoại là điện thoại, không phải máy tính này. Chưa tự mở cổng LAN hay đưa app lên Internet.

## Kết nối trường và triển khai

Xem `docs/DEPLOYMENT.md` và `docs/FEATURES.md`. Microsoft 365/Teams, Azure, SIS thật cần thông tin cấu hình do đơn vị vận hành cung cấp. Không dùng cookie hoặc mật khẩu tài khoản ở LMS cũ làm thông tin đăng nhập cho app mới.

**Trạng thái:** nền tảng nghiệp vụ cốt lõi có dữ liệu thật ở local; chưa nghiệm thu toàn bộ 130 mục của đặc tả, chưa đạt điều kiện đưa vào vận hành toàn trường. Danh sách phần đã làm, phần giới hạn và phần chưa làm nằm trong `docs/FEATURES.md`.
