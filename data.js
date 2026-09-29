const LMS_DATA = (() => {
  const resources = {
    "340": { title: "Nội quy học tập", status: "ready", updated: "15/08/2026 07:47", content: `BẢNG NỘI QUY HỌC TẬP

(Áp dụng cho Học viên/Sinh viên)

Để đảm bảo hiệu quả tối đa trong quá trình học tập và hướng tới mục tiêu trở thành chuyên gia hàng đầu trong lĩnh vực Trí tuệ nhân tạo, yêu cầu học viên nghiêm túc thực hiện các quy định sau:

I. QUY ĐỊNH VỀ THỜI GIAN
Ca sáng: Bắt đầu vào lớp lúc 08:00.
Ca chiều: Bắt đầu vào lớp lúc 13:00.
Lưu ý: Học viên cần có mặt trước giờ học ít nhất 05 phút để ổn định vị trí và chuẩn bị tài liệu.

II. YÊU CẦU VỀ THAM GIA HỌC TẬP
Lý thuyết: Đảm bảo tham gia tối thiểu 80% tổng số tiết học để đủ điều kiện dự thi.
Thực hành: Yêu cầu tham gia 100% số buổi. Mọi trường hợp vắng mặt đều phải có lý do chính đáng và được sự cho phép của giảng viên hướng dẫn.

III. CẤU TRÚC ĐÁNH GIÁ KẾT QUẢ
Kết quả học tập được tổng hợp theo các thành phần: chuyên cần, thường xuyên, giữa kỳ và cuối kỳ.

IV. KỶ LUẬT HỌC ĐƯỜNG & PHÒNG MÁY
Nghiêm cấm chơi game, sử dụng điện thoại hoặc thiết bị giải trí không phục vụ bài học trong giờ. Tuân thủ an toàn, an ninh thông tin; ngồi đúng vị trí; giữ gìn thiết bị và không tự ý thay đổi cấu hình.` },
    "288": { title: "Mục tiêu HP Quản trị hệ thống mạng", status: "ready", content: `MỤC TIÊU ĐÀO TẠO HỌC PHẦN

3.1. Kiến thức
- Vận dụng được hệ điều hành mạng Windows Server vào các mô hình giả lập hệ thống quản trị mạng LAN, VLAN.
- Học phần đạt mục tiêu này thông qua CLO1, CLO2.

3.2. Kỹ năng
- Quản trị và phát triển hệ thống mạng Windows Server, tự chủ xây dựng cấu hình.
- Phát triển tư duy sáng tạo và khả năng giải quyết vấn đề.
- Kỹ năng lập kế hoạch, quản lý thời gian, làm việc và quản lý nhóm.
- Học phần đạt mục tiêu này thông qua CLO3, CLO4.

3.3. Mức tự chủ và trách nhiệm
- Rèn luyện kỹ năng tương tác, làm việc nhóm; thể hiện thái độ tích cực và trách nhiệm với bản thân, gia đình, tập thể.
- Học phần đạt mục tiêu này thông qua CLO5.` },
    "286": { title: "Đề cương học phần", status: "embedded", external: "https://drive.google.com/file/d/1wg06UDXlvAB0ychdY12_Y5Fr9MiC89U3/preview", content: "Đề cương được nhúng từ Google Drive trên LMS gốc." },
    "313": { title: "Tài liệu tham khảo", status: "ready", content: `TÀI LIỆU GIẢNG DẠY
[1] Fordan Krause (2023), Mastering Windows Server 2022, Packt Publishing Ltd.

TÀI LIỆU HƯỚNG DẪN TỰ HỌC
[2] Khoa CNTT (2025), Đại học Công nghệ Miền Đông, Các bài lab thực hành môn Hệ điều hành Windows Server.` },
    "325": { title: "Kinh nghiệm học tập", status: "ready", content: `KINH NGHIỆM THỰC CHIẾN

1. Nắm vững bản chất lý thuyết trước khi thực hành: hiểu DNS, Active Directory, Domain và phân quyền thay vì làm máy móc.

2. Thành thạo môi trường máy ảo: chủ động luyện tập bằng VMWare, VirtualBox hoặc Hyper-V.

3. Tuân thủ đúng quy trình kỹ thuật: đặt IP tĩnh và trỏ DNS đúng về máy chủ trước khi Join Domain hoặc nâng cấp Domain Controller.

4. Ghi chép thông số cẩn thận: tên miền, mật khẩu quản trị/DSRM, OU và địa chỉ IP.

5. Kết hợp GUI với PowerShell và công cụ quản trị từ xa RSAT.

6. Rèn luyện Troubleshooting: đọc Error logs, kiểm tra DNS, tường lửa và card mạng khi gặp lỗi.` },
    "295": { title: "1.1 Bài giảng", status: "embedded", external: "https://drive.google.com/file/d/1K7z5cGIEmX__9eWuQMuXfuiBkGvQ1unK/preview", content: "Bài giảng Bài 1 được nhúng từ Google Drive." },
    "297": { title: "1.2 Bài tập trên lớp", status: "ready", html: `<h1>PHIẾU LAB THỰC HÀNH TẠI PHÒNG MÁY</h1>
<p><strong>Môn học:</strong> Quản trị hệ thống mạng</p>
<p><strong>Bài thực hành:</strong> Bài 1 - Cài đặt hệ điều hành Windows Server (Thời lượng: 4 Tiết)</p>
<ul><li><strong>Họ và tên sinh viên:</strong> ................................................................</li><li><strong>Lớp:</strong> ................................... <strong>Ngày thực hành:</strong> ......................</li></ul>
<h2>I. MỤC TIÊU BÀI THỰC HÀNH</h2>
<p>Sau khi hoàn thành bài lab này, sinh viên đạt được các chuẩn kỹ năng sau:</p>
<ol><li><strong>Mô tả</strong> và phân biệt được các tính năng, phiên bản chuyên dụng của hệ điều hành Windows Server.</li><li><strong>Thực hiện thành thạo</strong> quy trình cài đặt hệ điều hành Windows Server (cả bản có giao diện GUI và bản Server Core) trên máy ảo.</li><li><strong>Thể hiện</strong> tính cẩn thận, chính xác, khoa học và tác phong công nghiệp trong suốt quá trình quản trị hệ thống.</li></ol>
<h2>II. NỘI DUNG VÀ CÁC BƯỚC THỰC HÀNH TẠI PHÒNG MÁY</h2>
<h3>Phần 1: Tìm hiểu lý thuyết và chuẩn bị môi trường (15 phút)</h3>
<ul><li><strong>Yêu cầu:</strong> Sinh viên khởi động phần mềm máy ảo (VMWare Workstation / VirtualBox / Hyper-V).</li><li><strong>Câu hỏi kiểm tra nhanh:</strong><ol><li>Nêu sự khác biệt chính về môi trường sử dụng giữa hai phiên bản Windows Server Datacenter và Windows Server Essentials.</li><li>Cấu hình tối thiểu về RAM và dung lượng ổ cứng yêu cầu để cài đặt phiên bản có giao diện Desktop Experience là bao nhiêu?</li></ol></li></ul>
<h3>Phần 2: Thực hành cài đặt Windows Server 2022 Datacenter (Desktop Experience) (90 phút)</h3>
<p>Sinh viên tiến hành tạo máy ảo mới, sử dụng file ISO Windows Server 2016 để cài đặt và thực hiện lần lượt các yêu cầu sau, chụp ảnh màn hình lưu vào báo cáo:</p>
<ul><li><strong>Bài tập 1: Khởi tạo và thiết lập thông tin ban đầu</strong><ul><li>Thực hiện cấu hình ngôn ngữ, định dạng thời gian và bàn phím ở màn hình Windows Setup.</li><li>Yêu cầu nộp ảnh: Màn hình cài đặt ngôn ngữ (Bước 1 &amp; 2).</li></ul></li><li><strong>Bài tập 2: Lựa chọn phiên bản và phân vùng ổ cứng</strong><ul><li>Chọn Windows Server 2022 Datacenter (Desktop Experience).</li><li>Chọn Custom: Install Windows only (advanced).</li><li>Tạo mới hoặc chọn phân vùng ổ cứng, dung lượng khuyến nghị tối thiểu 60 GB.</li><li>Chụp danh sách phiên bản và giao diện phân vùng trước khi nhấn Next.</li></ul></li><li><strong>Bài tập 3: Cấu hình bảo mật sau cài đặt</strong><ul><li>Chờ hoàn tất cài đặt và nhập mật khẩu quản trị cho Administrator.</li><li>Chụp giao diện Customize settings.</li></ul></li></ul>
<h3>Phần 3: Trải nghiệm cài đặt Windows Server 2022 Core (60 phút)</h3>
<ul><li>Tạo máy ảo thứ hai và cài đặt Windows Server 2022 Datacenter Evaluation bản Server Core.</li><li>Sau khi đăng nhập, kiểm tra cấu hình với sconfig.cmd và taskmgr.exe.</li><li>Chụp giao diện dòng lệnh quản trị sau khi đổi mật khẩu.</li></ul>
<h2>III. ĐÁNH GIÁ VÀ TỔNG KẾT BUỔI LAB</h2>
<ul><li><strong>Tiêu chí kỹ thuật (7 điểm):</strong> Hoàn tất cài đặt thành công cả hai mô hình GUI và Core.</li><li><strong>Tiêu chí tác phong (3 điểm):</strong> Báo cáo sạch sẽ, hình ảnh rõ ràng, chú thích đầy đủ.</li></ul>`, updated:"Thứ Sáu, 14 tháng 8 2026, 9:22 AM" },
    "317": { title: "1.3 Bài tập về nhà - Nâng cao", status: "ready", content: `Thực hiện lại các cài đặt đã thực hành trên lớp.
Ghi chú các bước thực hiện và những vấn đề cần quan tâm.
Tổng hợp kinh nghiệm trong quá trình thực hiện.` },
    "318": { title: "1.4 Tài liệu đọc thêm", status: "embedded", external: "https://drive.google.com/file/d/1JeTcT7sbyHJM4OyUqwV-EdLQozatY5_7/preview", content: "Tài liệu đọc thêm được nhúng từ Google Drive." },
    "327": { title: "2.1 Bài giảng", status: "embedded", external: "https://drive.google.com/file/d/1jkaeTHvvJO0ZJv4RTQ5NyecvBatPHPZW/preview", content: "Bài giảng dịch vụ Active Directory được nhúng từ Google Drive." },
    "328": { title: "2.2 Bài tập trên lớp", status: "ready", content: `PHIẾU LAB: BÀI 2 — ACTIVE DIRECTORY VÀ QUẢN TRỊ MIỀN (12 TIẾT)

MỤC TIÊU
- Khai báo IP tĩnh và cấu hình phân giải tên miền.
- Hiểu Domain và Active Directory.
- Nâng cấp Server thành Domain Controller.
- Tạo, quản lý người dùng; cấu hình Client Join Domain.

PHẦN 1 — MÔI TRƯỜNG BAN ĐẦU
Đặt tên Server, đặt mật khẩu mạnh cho Administrator và cấu hình địa chỉ IP tĩnh.

PHẦN 2 — CÀI AD DS
Mở Server Manager > Add Roles and Features; chọn Role-Based or Feature-Based Installation; cài Active Directory Domain Services; chọn Promote this server to a domain controller; Add a new forest; nhập Root domain name; đặt mật khẩu DSRM; chạy Prerequisites check và Install.

PHẦN 3 — TẠO NGƯỜI DÙNG
Trong Active Directory Users and Computers, tạo User mới và bật tùy chọn buộc đổi mật khẩu ở lần đăng nhập đầu.

PHẦN 4 — JOIN DOMAIN
Trên Windows 10 Client, đặt Preferred DNS Server về Domain Controller; mở System Properties; Join Domain; xác thực bằng tài khoản quản trị và khởi động lại.

RUBRIC
- Kỹ thuật và thao tác: 7 điểm.
- Tác phong, trình bày: 3 điểm.` },
    "329": { title: "2.3 Bài tập về nhà - Nâng cao", status: "placeholder", content: "Bài tập về nhà và nâng cao." },
    "330": { title: "2.4 Tài liệu đọc thêm", status: "embedded", external: "https://drive.google.com/file/d/1JeTcT7sbyHJM4OyUqwV-EdLQozatY5_7/preview", content: "Trang LMS gốc đang dùng cùng tài liệu Drive với mục 1.4." },
    "332": { title: "3.1 Bài giảng", status: "embedded", external: "https://drive.google.com/file/d/1XjMwHEqJf_vGuqXS_An-1pRDBOgj-VmQ/preview", content: "Bài giảng Quản lý người dùng và nhóm được nhúng từ Google Drive." },
    "334": { title: "3.2 Bài tập trên lớp", status: "ready", content: `PHIẾU LAB: BÀI 3 — QUẢN LÝ USER VÀ GROUP TRONG ACTIVE DIRECTORY (12 TIẾT)

MỤC TIÊU
- Tạo OU, Group và User bằng GUI và PowerShell.
- Cấu hình tài khoản, cấp quyền và quản lý tài nguyên.
- Giới hạn giờ đăng nhập, Home Folder và Account Lock-out.
- Cài RSAT trên Windows 10.

PHẦN 1 — OU VÀ NHÓM
Tạo OU gốc HANOI; các OU con Phong_Giam_doc, Phong_nhan_su, Phong_IT, Phong_SALE. Tạo Security Group GR_Phong_Giam_doc, tạo user và thêm vào nhóm.

PHẦN 2 — POWERSHELL
Dùng PowerShell tạo OU, User, Group và thêm User vào Group. Tại OU HCM, tự tạo hai nhóm Ke Toan, Nhan Su; mỗi nhóm ba tài khoản; thực hiện tìm kiếm, di chuyển và Disable tài khoản.

PHẦN 3 — CHÍNH SÁCH BẢO MẬT
Giới hạn giờ đăng nhập 07:00–18:00; cấu hình Home Folder và quota 500 MB; khóa tài khoản sau hai lần sai mật khẩu.

PHẦN 4 — RSAT
Cài Remote Server Administration Tools trên Windows 10 và dùng máy Client quản trị Active Directory từ xa.

RUBRIC: 7 điểm kỹ thuật, 3 điểm tác phong và trình bày.` },
    "335": { title: "3.3 Bài tập về nhà - Nâng cao", status: "placeholder", content: "Bài tập về nhà và nâng cao." },
    "333": { title: "3.4 Tài liệu đọc thêm", status: "embedded", external: "https://drive.google.com/file/d/1JeTcT7sbyHJM4OyUqwV-EdLQozatY5_7/preview", content: "Trang LMS gốc đang dùng lại tài liệu Drive." },
    "342": { title: "4.1 Bài giảng", status: "embedded", external: "https://drive.google.com/file/d/1EVoBp049cDxSkbrjr0pqbDNGpHY4f2bd/preview", content: "Bài giảng Chính sách nhóm được nhúng từ Google Drive." },
    "343": { title: "4.2 Bài tập trên lớp", status: "ready", content: `BÀI LAB 04 — GROUP POLICY TỰ ĐỘNG MAP Ổ ĐĨA MẠNG

MỤC TIÊU
Cấu hình GPO cho nhóm người dùng và tự động ánh xạ ổ đĩa mạng dùng chung cho phòng ban.

MÔI TRƯỜNG
- Windows Server đã là Domain Controller và có OU KeToan.
- Windows Client đã Join Domain.
- Thư mục Ke_Toan đã được chia sẻ, ví dụ: \\\\192.168.1.94\\ChuyenViet$\\Ke_Toan.

CÁC BƯỚC
1. Mở Group Policy Management, chọn OU KeToan, tạo GPO "Map KeToan cho NV phong ketoan".
2. Edit GPO > User Configuration > Preferences > Windows Settings > Drive Maps.
3. New > Mapped Drive; Action: Create; Location: đường dẫn UNC; bật Reconnect; Label: KeToan; chọn ký tự ổ đĩa I.
4. Tab Common > Item-level targeting > Organizational Unit > chọn OU KeToan.

RUBRIC
- Môi trường kiểm thử: 30%.
- Kết quả thực thi GPO: 40%.
- Báo cáo và minh chứng: 30%.` },
    "338": { title: "1. Đánh giá Bài tập trên lớp", status: "ready", external: "https://docs.google.com/spreadsheets/d/1CPAGN1u_uVb_H9GCy_yZMVB52On4WC9M/edit?usp=sharing", content: "Sinh viên nộp minh chứng kết quả bài thực hành trên lớp theo bảng Google Sheets được giảng viên cung cấp." }
  };

  const broken = [
    [344,"4.3 Bài tập về nhà - Nâng cao"],[345,"4.4 Tài liệu đọc thêm"],
    [347,"5.1 Bài giảng"],[350,"5.2 Bài tập trên lớp"],[349,"5.3 Bài tập về nhà - Nâng cao"],[348,"5.4 Tài liệu đọc thêm"],
    [352,"6.1 Bài giảng"],[355,"6.2 Bài tập trên lớp"],[354,"6.3 Bài tập về nhà - Nâng cao"],[353,"6.4 Tài liệu đọc thêm"],
    [357,"7.1 Bài giảng"],[359,"7.2 Bài tập trên lớp"],[360,"7.3 Bài tập về nhà - Nâng cao"],[358,"7.4 Tài liệu đọc thêm"]
  ];
  broken.forEach(([id,title]) => resources[id] = { title, status: "broken", content: "LMS gốc đang chứa iframe có địa chỉ “/preview” nhưng thiếu tệp nguồn. Nội dung chưa thể hiển thị." });
  [[323,"1. Tổng kết học phần"],[324,"2. Đánh giá chung quá trình học"],[319,"2. Đánh giá Thường xuyên"],[320,"3. Đánh giá Giữa kỳ"],[321,"4. Ôn tập & Đề thi mẫu"],[322,"5. Đánh giá Cuối kỳ"]]
    .forEach(([id,title]) => resources[id] = { title, status: "placeholder", content: "Bài tập về nhà và nâng cao." });

  const groups = [
    { title: "I. THÔNG TIN CHUNG VỀ HỌC PHẦN", activities: [340,288,286,313,325] },
    { title: "1. Bài 1 Cài đặt Windows Server", activities: [295,297,317,318] },
    { title: "2. Bài 2 dịch vụ AD Windows Server", activities: [327,328,329,330] },
    { title: "3. Quản lý Người dùng và Nhóm", activities: [332,334,335,333] },
    { title: "4. Bài 4: Chính sách nhóm", activities: [342,343,344,345] },
    { title: "5. Tên bài", activities: [347,350,349,348] },
    { title: "6. Tên bài", activities: [352,355,354,353] },
    { title: "7. Tên bài", activities: [357,359,360,358] },
    { title: "TỔNG KẾT VÀ ĐÁNH GIÁ CHUNG", activities: [323,324] },
    { title: "III. KIỂM TRA ĐÁNH GIÁ", activities: [338,319,320,321,322] }
  ];

  const courses = [
    { id: 86, code: "030100188602", name: "Đổi mới sáng tạo và khởi nghiệp", teacher: "Ngoc Luong Quy", semester: "HK 1(2026-2027)", image: null, description: "Học phần Đổi mới sáng tạo và khởi nghiệp.", progress: 0, empty: true },
    { id: 57, code: "030100236301", name: "Quản trị hệ thống mạng", teacher: "Thang Trinh Dinh", semester: "HK 1(2026-2027)", image: "assets/course-network.png", progress: 0, description: "Học phần cung cấp cho sinh viên những kiến thức cần thiết về quản trị mạng, tổng quan về nguyên lý quản trị mang, các thành phần cấu thành nên hệ thống mạng và sự tương tác giữa các thành phần này. Cung cấp cách quản trị hệ thống mạng LAN dựa trên mô hình domain bằng các dịch vụ của hệ điều hành Windows Server.", groups }
  ];

  const forums = [
    { id: 12, title: "How to fix network in oracle VirtualBox", author: "Anh Tran Duc", date: "18/08/2026", latest: "Thang Trinh Dinh", replies: 2, subscribed: true },
    { id: 8, title: "Bài 1 Cài đặt Windows Server", author: "Thang Trinh Dinh", date: "14/08/2026", latest: "Phuc Dang Van", replies: 16, subscribed: true },
    { id: 9, title: "Bài 2: Dịch vụ AD Windows Server", author: "Thang Trinh Dinh", date: "14/08/2026", latest: "Thang Trinh Dinh", replies: 0, subscribed: false }
  ];

  return { resources, courses, forums, catalog: [] };
})();
