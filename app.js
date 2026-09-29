(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const app = $("#app");
  const main = $("#mainContent");
  const nav = $("#mainNav");
  const state = {
    favorites: JSON.parse(localStorage.getItem("mituni-favorites") || "[]"),
    completed: JSON.parse(localStorage.getItem("mituni-completed") || "[]"),
    catalogPage: 1,
    catalogQuery: "",
    catalogCategory: "all"
  };

  const navItems = [
    ["HỌC TẬP", "#/dashboard", "⌂", "Bảng điều khiển", "dashboard"],
    ["HỌC TẬP", "#/courses", "▦", "Các khoá học của tôi", "courses"],
    ["HỌC TẬP", "#/catalog", "◫", "Danh mục khóa học", "catalog"],
    ["CÁ NHÂN", "#/grades", "◎", "Điểm", "grades"],
    ["CÁ NHÂN", "#/calendar", "□", "Lịch", "calendar"],
    ["CÁ NHÂN", "#/reports", "↗", "Reports & Analytics", "reports"],
    ["HỆ THỐNG", "#/settings", "⚙", "Tuỳ chọn", "settings"]
  ];

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
  }
  function saveState() {
    localStorage.setItem("mituni-favorites", JSON.stringify(state.favorites));
    localStorage.setItem("mituni-completed", JSON.stringify(state.completed));
  }
  function toast(message) {
    const el = $("#toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2200);
  }
  function footer() {
    return `<footer class="mit-footer">
      <div class="footer-inner"><img src="assets/mituni-logo.png" alt="MIT University">
      <div class="footer-columns"><div><h3>Trụ sở</h3><p>QL1A, khu phố Trần Hưng Đạo, phường Dầu Giây, Thành phố Đồng Nai</p><p>Hotline: 0981.767.568 hoặc (02513) 772 668</p><p>Hỗ trợ sinh viên: 02513.772.667 (bấm số 2)</p></div><div><h3>Links</h3><p>Home &nbsp;&nbsp;&nbsp;&nbsp; Đào tạo</p><p>Giới thiệu về trường &nbsp;&nbsp; Campus tour</p></div></div><small>© 2026 Welcome to MIT UNI</small></div></footer>`;
  }
  function breadcrumb(items) {
    return `<div class="breadcrumb">${items.map((x,i) => i === items.length - 1 ? `<span>${escapeHtml(x[0])}</span>` : `<a href="${x[1]}">${escapeHtml(x[0])}</a><span>/</span>`).join("")}</div>`;
  }
  function setNav(active) {
    const groups = {};
    navItems.forEach(([group,href,icon,label,key]) => (groups[group] ||= []).push({href,icon,label,key}));
    nav.innerHTML = Object.entries(groups).map(([group, items]) => `<div class="nav-group-label">${group}</div>${items.map(item => `<a class="nav-item ${item.key === active ? "active" : ""}" href="${item.href}"><span>${item.icon}</span><span>${item.label}</span></a>`).join("")}`).join("");
  }
  function courseCard(course) {
    const fav = state.favorites.includes(course.id);
    const imageStyle = course.image ? `style="background-image:url('${course.image}')"` : "";
    return `<article class="course-card">
      <div class="course-cover ${course.image ? "" : "pattern"}" ${imageStyle}>
        <button class="favorite" data-favorite="${course.id}" title="Đánh dấu sao">${fav ? "★" : "···"}</button>
        <span class="semester">${course.semester}</span>
      </div>
      <div class="course-body">
        <h3>${escapeHtml(course.name)} [${course.code}]</h3>
        <div class="teacher"><span class="teacher-avatar"></span>${escapeHtml(course.teacher)}</div>
        <a class="card-cover-link" href="#/course/${course.id}" aria-label="Xem ${escapeHtml(course.name)}"></a>
      </div>
    </article>`;
  }
  function miniCalendar() {
    const days = Array.from({length:30},(_,i)=>i+1);
    return `<div class="calendar-shell"><div class="calendar" style="font-size:12px">
      ${["T2","T3","T4","T5","T6","T7","CN"].map(d=>`<div class="cal-head">${d}</div>`).join("")}
      <div class="cal-day muted"></div>${days.map(d=>`<div class="cal-day ${d===25?"today":""}"><b>${d}</b><small>Không có sự kiện</small></div>`).join("")}
    </div></div>`;
  }

  function renderDashboard() {
    setNav("dashboard");
    main.innerHTML = `<div class="page-shell original-dashboard">
      <h1 class="original-page-title">Bảng Điều khiển</h1>
      <div class="dashboard-stats">${[["▣","2","Khóa học đã ghi danh"],["☑",state.completed.length,"Các hoạt động đã hoàn thành"],["▣","0","Khóa học đã hoàn thành"],["☷","0","Các hoạt động cần thực hiện"]].map(x=>`<div class="dashboard-stat"><span class="dashboard-stat-icon">${x[0]}</span><span class="dashboard-stat-number">${x[1]}</span><strong>${x[2]}</strong></div>`).join("")}</div>
      <section class="timeline-section"><h2>Mốc thời gian</h2><div class="timeline-controls"><select class="select"><option>7 ngày tiếp theo</option><option>Tất cả</option><option>Quá hạn</option><option>30 ngày tiếp theo</option></select><select class="select"><option>Sắp xếp theo ngày</option><option>Sắp xếp theo khóa học</option></select><label class="searchbox">⌕ <input placeholder="Tìm kiếm theo loại hoạt động hoặc tên"></label></div><div class="timeline-empty"><div class="empty-paper">▤</div><p>Không có khóa học nào đang diễn ra</p></div></section>
      <section class="dashboard-calendar"><h2>Lịch</h2><div class="calendar-month"><span>Tháng 9 2026</span><a href="#/calendar">Xem tất cả lịch →</a></div>${miniCalendar()}</section>
    </div>${footer()}`;
  }

  function renderCourses() {
    setNav("courses");
    main.innerHTML = `<div class="page-shell original-courses"><h1 class="original-page-title">Các khoá học của tôi</h1>
      <h2>Tổng quan về khóa học</h2><div class="course-filter-tabs"><button data-filter="all" class="active">All</button><button data-filter="active">Đang diễn tiến</button><button data-filter="upcoming">Sắp diễn ra</button><button data-filter="past">Đã diễn ra</button><button data-filter="starred">Đã gắn sao</button><button data-filter="hidden">Đã bị xóa khỏi chế độ xem</button></div>
      <div class="toolbar"><select class="select" id="courseFilter"><option value="all">Sắp xếp theo tên khóa học</option><option value="active">Đang diễn tiến</option><option value="starred">Đã gắn sao</option></select><label class="searchbox">⌕<input id="courseSearch" placeholder="Tìm kiếm"></label><span class="view-icons">▦ &nbsp; ☷ &nbsp; ▤</span></div>
      <div class="course-grid" id="courseGrid">${LMS_DATA.courses.map(courseCard).join("")}</div></div>${footer()}`;
    const rerender = () => {
      const q = $("#courseSearch").value.toLowerCase(); const f = document.querySelector(".course-filter-tabs button.active")?.dataset.filter || "all";
      const items = LMS_DATA.courses.filter(c => (`${c.name} ${c.code} ${c.teacher}`).toLowerCase().includes(q) && (f === "all" || f === "active" || (f === "starred" && state.favorites.includes(c.id))));
      $("#courseGrid").innerHTML = items.length ? items.map(courseCard).join("") : `<div class="empty">Không tìm thấy khóa học.</div>`;
    };
    $("#courseSearch").addEventListener("input", rerender); $("#courseFilter").addEventListener("change", rerender);
    $$(".course-filter-tabs button").forEach(btn=>btn.addEventListener("click",()=>{$$(".course-filter-tabs button").forEach(x=>x.classList.remove("active"));btn.classList.add("active");rerender();}));
  }

  function activityHtml(id) {
    const r = LMS_DATA.resources[id];
    const done = state.completed.includes(Number(id));
    const statusText = { ready:"Có nội dung", embedded:"Tài liệu nhúng", placeholder:"Nội dung mẫu", broken:"Liên kết lỗi" }[r.status] || "Trang";
    return `<div class="activity" data-resource="${id}" role="link" tabindex="0"><span class="activity-icon">${r.status === "embedded" ? "▧" : r.status === "broken" ? "!" : "▤"}</span><span><strong>${escapeHtml(r.title)}</strong><small>${statusText}</small></span><span class="status-dot ${done ? "ready" : r.status}"></span></div>`;
  }
  function renderCourse(id) {
    const course = LMS_DATA.courses.find(c => c.id === Number(id));
    if (!course) return renderNotFound();
    setNav("courses");
    const tiles = course.empty ? `<a class="section-tile" href="#/forum"><span class="tile-icon">▧</span><strong>Announcements</strong></a>` : [
      ["* Thông báo *","#/forum","▧"],["1. Nội quy học tập","#/resource/340",""],["2. Đề cương học phần","#/section/57/5",""],["3. Diễn đàn - Hỏi đáp","#/forum",""],["II. HỌC TẬP","#/section/57/1",""],["III. KIỂM TRA ĐÁNH GIÁ","#/section/57/2",""]
    ].map(([label,href,icon])=>`<a class="section-tile" href="${href}">${icon?`<span class="tile-icon">${icon}</span>`:""}<strong>${label}</strong></a>`).join("");
    main.innerHTML = `<div class="page-shell original-course-home">
      <section class="course-banner ${course.image ? "" : "plain"}"><small>${course.semester}</small><h1>${escapeHtml(course.name)} [${course.code}]</h1><div class="course-banner-bottom"><span class="banner-teacher"><i>${course.teacher.split(" ").map(x=>x[0]).slice(0,2).join("")}</i>${escapeHtml(course.teacher)}</span><span class="banner-progress">0% complete <span></span></span></div><a class="resume-button" href="${course.empty?"#/forum":"#/resource/322"}">Resume</a></section>
      <nav class="course-tabs"><a class="active" href="#/course/${course.id}">Khoá học</a><a href="#/section/${course.id}/members">Danh sách thành viên</a><a href="#/grades">Điểm số</a><a href="#/section/${course.id}/activities">Các hoạt động</a><a href="#/section/${course.id}/competencies">Năng lực</a></nav>
      <div class="course-introduction"><h2>${course.empty ? "Introduction" : "I. THÔNG TIN CHUNG VỀ HỌC PHẦN"}</h2>${course.empty?"":`<p>${escapeHtml(course.description)}</p>`}</div>
      <div class="section-tile-grid">${tiles}</div>
      <section class="reviews"><h2>Đánh giá và nhận xét</h2><div class="reviews-box"><div class="review-score"><strong>0</strong><span>☆☆☆☆☆</span><small>0 Đánh giá khóa học</small><button class="btn btn-gold" id="writeReview">Viết đánh giá</button></div><div class="review-bars">${[5,4,3,2,1].map(n=>`<div><span></span><b>${"★".repeat(n)}${"☆".repeat(5-n)}</b></div>`).join("")}</div></div><div class="review-bottom"><strong>Đánh giá</strong><select class="select"><option>Tất cả các xếp hạng</option>${[5,4,3,2,1].map(n=>`<option>${n} sao</option>`).join("")}</select></div><p>Không tìm thấy đánh giá nào.</p></section>
    </div>${footer()}`;
    const review=$("#writeReview"); if(review)review.addEventListener("click",()=>modal("Viết đánh giá","<p>Đánh giá chỉ được lưu trong bản local.</p><textarea class='select' style='width:100%;height:120px' placeholder='Nội dung đánh giá'></textarea>"));
  }

  const sectionMap = {
    "1": { title:"II. HỌC TẬP", type:"list", children:[3,6,7,9,10,11,12,13] },
    "2": { title:"III. KIỂM TRA ĐÁNH GIÁ", type:"resources", resourceIds:[338,319,320,321,322] },
    "3": { title:"1. Bài 1 Cài đặt Windows Server", type:"resources", resourceIds:[295,297,317,318] },
    "6": { title:"2. Bài 2 dịch vụ AD Windows Server", type:"resources", resourceIds:[327,328,329,330] },
    "7": { title:"3. Quản lý Người dùng và Nhóm", type:"resources", resourceIds:[332,334,335,333] },
    "9": { title:"4. Bài 4: Chính sách nhóm", type:"resources", resourceIds:[342,343,344,345] },
    "10": { title:"5. Tên bài", type:"resources", resourceIds:[347,350,349,348] },
    "11": { title:"6. Tên bài", type:"resources", resourceIds:[352,355,354,353] },
    "12": { title:"7. Tên bài", type:"resources", resourceIds:[357,359,360,358] },
    "13": { title:"TỔNG KẾT VÀ ĐÁNH GIÁ CHUNG", type:"resources", resourceIds:[323,324] },
    "5": { title:"2. Đề cương học phần", type:"resources", resourceIds:[288,286,313] }
  };
  function renderSection(courseId, sectionId) {
    const course=LMS_DATA.courses.find(c=>c.id===Number(courseId)); if(!course)return renderNotFound();
    const section=sectionMap[sectionId]; if(!section){setNav("courses");main.innerHTML=`<div class="page-shell">${breadcrumb([["Quản trị hệ thống mạng","#/course/57"],[sectionId==="members"?"Danh sách thành viên":sectionId==="activities"?"Các hoạt động":"Năng lực"]])}<h1 class="original-page-title">${sectionId==="members"?"Danh sách thành viên":sectionId==="activities"?"Các hoạt động":"Năng lực"}</h1><div class="original-card">Chức năng này đang hiển thị trong LMS gốc.</div></div>${footer()}`;return;}
    setNav("courses");
    const rows=section.type==="list"?section.children.map(id=>`<a class="section-row" href="#/section/${course.id}/${id}"><strong>${escapeHtml(sectionMap[id].title)}</strong><span>➜</span></a>`).join(""):section.resourceIds.map(id=>`<a class="section-row" href="#/resource/${id}"><span class="section-row-icon">▤</span><strong>${escapeHtml(LMS_DATA.resources[id].title)}</strong><span>➜</span></a>`).join("");
    main.innerHTML=`<div class="page-shell original-section">${breadcrumb([[`[${course.code}]_[32961]`,`#/course/${course.id}`],[section.title]])}<section class="course-banner ${course.image?"":"plain"}"><small>${course.semester}</small><div class="section-banner-copy"><h2>${escapeHtml(course.name)} [${course.code}]</h2><h1>${escapeHtml(section.title)}</h1><span class="banner-teacher"><i>TT</i>${escapeHtml(course.teacher)}</span></div></section><div class="original-card"><h2>${escapeHtml(section.title)}</h2>${rows}</div></div>${footer()}`;
  }

  function renderResource(id) {
    const r = LMS_DATA.resources[id]; if (!r) return renderNotFound();
    setNav("courses");
    const group = LMS_DATA.courses[1].groups.find(g=>g.activities.includes(Number(id)));
    const sectionId = Object.keys(sectionMap).find(k=>sectionMap[k].title===group?.title);
    const crumbs = [["[030100236301]_[32961]","#/course/57"],...(group && /^\d+\. Bài/.test(group.title)?[["II. HỌC TẬP","#/section/57/1"]]:[]),...(group?[[group.title,sectionId?`#/section/57/${sectionId}`:"#/course/57"]]:[]),[r.title]];
    const embedded = r.status==="embedded" && r.external?.includes("drive.google.com") ? `<iframe class="resource-iframe" src="${r.external}" title="${escapeHtml(r.title)}" loading="lazy"></iframe>` : "";
    const body = r.status==="broken" ? `<div class="broken-embed"></div>` : `<div class="resource-body ${r.html?"rich-resource":""}">${r.html||escapeHtml(r.content)}</div>${embedded}`;
    main.innerHTML = `<div class="page-shell original-resource">${breadcrumb(crumbs)}<h1 class="resource-heading"><span>▤</span>${escapeHtml(r.title)}</h1>
      <article class="original-card resource-card">${body}${r.external && !embedded ? `<p><a class="external-link" href="${r.external}" target="_blank" rel="noopener">${escapeHtml(r.external)}</a></p>` : ""}${r.updated?`<p class="last-edited">Sửa lần cuối: ${r.updated}</p>`:""}</article>
      <div class="resource-navigation"><a class="btn" href="#/course/57">‹ Hoạt động trước</a><select class="select" id="activityJump"><option>Chuyển đến hoạt động</option>${Object.entries(LMS_DATA.resources).map(([rid,item])=>`<option value="${rid}">${escapeHtml(item.title)}</option>`).join("")}</select><a class="btn btn-primary" href="#/course/57">Phần tiếp theo ›</a></div>
      <div class="local-completion"><button class="btn ${state.completed.includes(Number(id))?"btn-gold":""}" id="completeButton">${state.completed.includes(Number(id))?"✓ Đã hoàn thành":"Đánh dấu hoàn thành"}</button><small>Chỉ lưu trên máy này</small></div>
    </div>${footer()}`;
    $("#activityJump").addEventListener("change",e=>{if(e.target.value)location.hash=`#/resource/${e.target.value}`;});
    $("#completeButton").addEventListener("click", () => { const n=Number(id); state.completed = state.completed.includes(n) ? state.completed.filter(x=>x!==n) : [...state.completed,n]; saveState(); renderResource(id); toast(state.completed.includes(n) ? "Đã đánh dấu hoàn thành" : "Đã bỏ đánh dấu hoàn thành"); });
  }

  function renderForum() {
    setNav("courses");
    main.innerHTML = `<div class="page-shell">${breadcrumb([["Quản trị hệ thống mạng","#/course/57"],["I. THÔNG TIN CHUNG"],["Diễn đàn - Hỏi đáp"]])}<div class="page-title-row"><div><div class="eyebrow">Diễn đàn</div><h1>Diễn đàn Học phần Quản trị hệ thống mạng</h1><p>Trao đổi những vấn đề về học phần và các kỹ năng.</p></div><button class="btn btn-primary" id="newTopic">+ Thêm chủ đề</button></div>
      <section class="panel"><div class="toolbar"><label class="searchbox">⌕<input id="forumSearch" placeholder="Tìm kiếm thảo luận"></label><button class="btn">Đăng ký tới diễn đàn này</button></div><div class="table-wrap"><table><thead><tr><th>Trạng thái</th><th>Thảo luận</th><th>Người khởi tạo</th><th>Bài viết gần nhất</th><th>Phúc đáp</th><th>Đăng ký</th></tr></thead><tbody id="forumRows">${forumRows(LMS_DATA.forums)}</tbody></table></div></section>${footer()}</div>`;
    $("#forumSearch").addEventListener("input", e => { const q=e.target.value.toLowerCase(); $("#forumRows").innerHTML=forumRows(LMS_DATA.forums.filter(x=>x.title.toLowerCase().includes(q))); });
    $("#newTopic").addEventListener("click", () => modal("Chế độ bản local", `<p>Chức năng tạo chủ đề được mô phỏng nhưng không gửi dữ liệu lên LMS của trường.</p><label>Tiêu đề</label><input class="select" style="width:100%;margin:8px 0 12px" placeholder="Nhập tiêu đề"><label>Nội dung</label><textarea class="select" style="width:100%;min-height:120px;margin-top:8px" placeholder="Nhập nội dung"></textarea><div style="margin-top:14px"><button class="btn btn-primary" onclick="document.querySelector('#modalClose').click();">Lưu bản nháp local</button></div>`));
  }
  function forumRows(items) { return items.map(f=>`<tr><td>☆</td><td><span class="forum-topic" data-topic="${f.id}">${escapeHtml(f.title)}</span></td><td>${escapeHtml(f.author)}<small style="display:block;color:var(--muted)">${f.date}</small></td><td>${escapeHtml(f.latest)}<small style="display:block;color:var(--muted)">${f.date}</small></td><td>${f.replies}</td><td>${f.subscribed?"●":"○"}</td></tr>`).join(""); }

  function renderGrades() {
    setNav("grades");
    main.innerHTML = `<div class="page-shell">${breadcrumb([["Bảng điều khiển","#/dashboard"],["Điểm"]])}<div class="page-title-row"><div><div class="eyebrow">Kết quả học tập</div><h1>Điểm</h1><p>Bảng điểm quan sát được trong tài khoản ngày 25/09/2026.</p></div></div><section class="panel"><div class="table-wrap"><table><thead><tr><th>Tên khóa học</th><th>Điểm</th><th>Khoảng</th><th>Phần trăm</th><th>Phản hồi</th></tr></thead><tbody>${LMS_DATA.courses.map(c=>`<tr><td><a class="forum-topic" href="#/course/${c.id}">${escapeHtml(c.name)} [${c.code}]</a></td><td>—</td><td>0–0</td><td>—</td><td>Chưa có dữ liệu</td></tr>`).join("")}</tbody></table></div></section>${footer()}</div>`;
  }
  function renderCalendar() {
    setNav("calendar");
    main.innerHTML = `<div class="page-shell">${breadcrumb([["Bảng điều khiển","#/dashboard"],["Lịch"]])}<div class="page-title-row"><div><div class="eyebrow">Lịch học tập</div><h1>Tháng 9 2026</h1><p>Tất cả khóa học · Không có sự kiện trong tháng.</p></div><button class="btn btn-primary" id="newEvent">+ Sự kiện mới</button></div><section class="panel">${miniCalendar()}</section>${footer()}</div>`;
    $("#newEvent").addEventListener("click",()=>modal("Sự kiện mới — bản local","<p>Bản sao local không tạo sự kiện trên LMS thật. Anh có thể dùng mục này làm giao diện mẫu cho bản phát triển sau.</p>"));
  }
  function renderReports() {
    setNav("reports");
    main.innerHTML = `<div class="page-shell">${breadcrumb([["Bảng điều khiển","#/dashboard"],["Reports & Analytics"]])}<div class="page-title-row"><div><div class="eyebrow">Edwiser Reports Free</div><h1>Tổng quan</h1><p>18/09/2026 – 24/09/2026 · 7 ngày gần nhất</p></div></div><section class="stats-grid">${[["R","2","Tổng khóa học ghi danh"],["P","0","Khóa học hoàn thành"],["A",state.completed.length,"Hoạt động đã hoàn thành"],["T","3 h 38 min 20 s","Time spent on site"]].map(x=>`<div class="stat-card"><span class="stat-icon">${x[0]}</span><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join("")}</section><div class="report-grid"><section class="panel"><div class="panel-head"><h2>My Time Spent On Site</h2><button class="btn btn-small" id="exportReport">Download CSV</button></div><div class="chart">${[[22,"27 Aug"],[34,"31 Aug"],[28,"04 Sep"],[55,"08 Sep"],[41,"12 Sep"],[68,"16 Sep"],[86,"20 Sep"],[76,"24 Sep"]].map(x=>`<div class="bar" style="height:${x[0]}%" data-label="${x[1]}"></div>`).join("")}</div></section><section class="panel"><div class="panel-head"><h2>My Course Progress</h2></div><div class="donut"></div><p style="text-align:center;color:var(--muted)">Chỉ số hiển thị theo giao diện Reports gốc; tiến độ hoạt động hiện vẫn là 0%.</p></section></div>${footer()}</div>`;
    $("#exportReport").addEventListener("click",()=>downloadText("mituni-report.csv","metric,value\nEnrolled courses,2\nCompleted courses,0\nCompleted activities,"+state.completed.length+"\nTime spent,3 h 38 min 20 s\n"));
  }

  function renderCatalog() {
    setNav("catalog");
    const categories = [...new Set(LMS_DATA.catalog.map(x=>x.category))];
    main.innerHTML = `<div class="page-shell">${breadcrumb([["Trang chủ","#/dashboard"],["Danh mục khóa học"]])}<div class="page-title-row"><div><div class="eyebrow">Toàn hệ thống</div><h1>Danh mục 146 khóa học</h1><p>Dữ liệu hiển thị từ 9 nhánh học kỳ của LMS vào ngày 25/09/2026.</p></div><button class="btn" id="downloadCatalog">↓ Tải CSV</button></div><div class="toolbar"><label class="searchbox">⌕<input id="catalogSearch" placeholder="Tìm tên hoặc mã học phần" value="${escapeHtml(state.catalogQuery)}"></label><select class="select" id="catalogCategory"><option value="all">Tất cả danh mục</option>${categories.map(c=>`<option ${state.catalogCategory===c?"selected":""}>${escapeHtml(c)}</option>`).join("")}</select></div><div id="catalogResults"></div>${footer()}</div>`;
    const draw = () => {
      const q=state.catalogQuery.toLowerCase(); const filtered=LMS_DATA.catalog.filter(x=>(x.title.toLowerCase().includes(q)||String(x.id).includes(q))&&(state.catalogCategory==="all"||x.category===state.catalogCategory)); const per=15; const pages=Math.max(1,Math.ceil(filtered.length/per)); state.catalogPage=Math.min(state.catalogPage,pages); const items=filtered.slice((state.catalogPage-1)*per,state.catalogPage*per);
      $("#catalogResults").innerHTML=`<p class="muted"><strong>${filtered.length}</strong> khóa học phù hợp</p><div class="catalog-list">${items.map(x=>`<article class="catalog-item"><span class="catalog-id">#${x.id}</span><span><strong>${escapeHtml(x.title)}</strong><small style="display:block;color:var(--muted);margin-top:4px">course/view.php?id=${x.id}</small></span><span class="category-pill">${escapeHtml(x.category)}</span></article>`).join("")}</div><div class="pagination">${Array.from({length:Math.min(pages,9)},(_,i)=>i+1).map(p=>`<button class="page-btn ${p===state.catalogPage?"active":""}" data-page="${p}">${p}</button>`).join("")}${pages>9?`<span>… ${pages}</span>`:""}</div>`;
    };
    draw(); $("#catalogSearch").addEventListener("input",e=>{state.catalogQuery=e.target.value;state.catalogPage=1;draw();}); $("#catalogCategory").addEventListener("change",e=>{state.catalogCategory=e.target.value;state.catalogPage=1;draw();}); $("#downloadCatalog").addEventListener("click",()=>{const rows=["course_id,course_title,category,source_url",...LMS_DATA.catalog.map(x=>[x.id,x.title,x.category,x.url].map(v=>'"'+String(v).replaceAll('"','""')+'"').join(","))];downloadText("danh-muc-khoa-hoc-mituni.csv",rows.join("\n"));});
  }

  function renderSettings() {
    setNav("settings");
    const items=[["✎","Sửa hồ sơ cá nhân"],["A","Ngôn ngữ ưa thích"],["☷","Các lựa chọn diễn đàn"],["⌨","Ưu tiên của người biên soạn"],["□","Cài đặt ưu tiên cho lịch"],["▣","Content bank preferences"],["⚿","Khóa bảo mật"],["▢","Tùy chọn tin nhắn"],["♧","Tùy chọn thông báo"],["◉","Disable accessibility tool"],["✦","Quản lý huy hiệu"],["⌁","Các thiết lập hành trang"]];
    main.innerHTML=`<div class="page-shell">${breadcrumb([["Bảng điều khiển","#/dashboard"],["Tuỳ chọn"]])}<div class="page-title-row"><div><div class="eyebrow">Tài khoản</div><h1>Tuỳ chọn</h1><p>Các nhóm cài đặt được tái hiện theo trang Moodle gốc; thay đổi trong bản này chỉ được lưu cục bộ.</p></div></div><section class="panel"><div class="settings-list">${items.map(x=>`<div class="setting-card" data-setting="${escapeHtml(x[1])}"><span class="setting-icon">${x[0]}</span><span><strong>${escapeHtml(x[1])}</strong><small>Thiết lập cục bộ</small></span></div>`).join("")}</div></section>${footer()}</div>`;
  }
  function renderNotFound(){setNav("");main.innerHTML=`<div class="page-shell"><div class="empty"><div><h1>Không tìm thấy trang</h1><a class="btn btn-primary" href="#/dashboard">Về bảng điều khiển</a></div></div></div>`;}

  function modal(title, body){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=body;$("#modalBackdrop").classList.add("show");}
  function drawer(title, body){$("#drawerTitle").textContent=title;$("#drawerContent").innerHTML=body;$("#drawer").classList.add("open");$("#backdrop").classList.add("show");}
  function closeDrawer(){$("#drawer").classList.remove("open");$("#backdrop").classList.remove("show");$("#sidebar").classList.remove("mobile-open");}
  function downloadText(name,text){const blob=new Blob(["\ufeff"+text],{type:"text/csv;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Đã tạo tệp "+name);}

  function route(){const path=(location.hash||"#/dashboard").slice(2).split("/"); const [page,id,subId]=path; window.scrollTo(0,0); document.body.dataset.page=page; if(page==="dashboard")renderDashboard();else if(page==="courses")renderCourses();else if(page==="course")renderCourse(id);else if(page==="section")renderSection(id,subId);else if(page==="resource")renderResource(id);else if(page==="forum")renderForum();else if(page==="grades")renderGrades();else if(page==="calendar")renderCalendar();else if(page==="reports")renderReports();else if(page==="catalog")renderCatalog();else if(page==="settings")renderSettings();else renderNotFound(); closeDrawer(); main.focus({preventScroll:true});}

  document.addEventListener("click", e => {
    const fav=e.target.closest("[data-favorite]"); if(fav){e.preventDefault();const id=Number(fav.dataset.favorite);state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];saveState();fav.textContent=state.favorites.includes(id)?"★":"···";toast(state.favorites.includes(id)?"Đã gắn sao khóa học":"Đã bỏ gắn sao");}
    const activity=e.target.closest("[data-resource]"); if(activity)location.hash=`#/resource/${activity.dataset.resource}`;
    const section=e.target.closest(".section-title"); if(section){const card=section.closest(".section-card");card.classList.toggle("collapsed");section.lastElementChild.textContent=card.classList.contains("collapsed")?"⌄":"⌃";}
    const topic=e.target.closest("[data-topic]"); if(topic){const f=LMS_DATA.forums.find(x=>x.id===Number(topic.dataset.topic));modal(f.title,`<div class="resource-meta"><span class="tag">${f.author}</span><span class="tag">${f.date}</span><span class="tag">${f.replies} phản hồi</span></div><p>Trang thảo luận được tái hiện ở mức danh sách. Nội dung bài viết của sinh viên khác không được sao chép vào bản local để bảo vệ dữ liệu cá nhân.</p>`);}
    const page=e.target.closest(".page-btn[data-page]");if(page){state.catalogPage=Number(page.dataset.page);renderCatalog();}
    const setting=e.target.closest("[data-setting]");if(setting)modal(setting.dataset.setting,"<p>Đây là giao diện mô phỏng. Bản local không thay đổi tài khoản hoặc cấu hình trên hệ thống của trường.</p>");
  });
  $("#themeToggle").addEventListener("click",()=>{document.body.classList.toggle("dark");localStorage.setItem("mituni-theme",document.body.classList.contains("dark")?"dark":"light");});
  $("#sidebarToggle").addEventListener("click",()=>{$("#sidebar").classList.add("mobile-open");$("#backdrop").classList.add("show");});
  $("#floatingMenu").addEventListener("click",()=>{$("#sidebar").classList.add("mobile-open");$("#backdrop").classList.add("show");});
  $("#courseIndexTab").addEventListener("click",()=>drawer("Chỉ mục khóa học",LMS_DATA.courses[1].groups.map((g,i)=>`<a class="nav-item" href="#/section/57/${[5,3,6,7,9,10,11,12,13,2][i]}"><span>▤</span><span>${escapeHtml(g.title)}</span></a>`).join("")));
  $("#mobileMenu").addEventListener("click",()=>{$("#sidebar").classList.toggle("mobile-open");$("#backdrop").classList.toggle("show");});
  $("#notificationsButton").addEventListener("click",()=>drawer("Thông báo",`<div class="notification-item"><strong>Quản trị hệ thống mạng</strong><span>Khó khăn khi thực hành bài Lab</span><small>13/08/2026</small></div><div class="notification-item"><strong>Diễn đàn học phần</strong><span>Bài 1 Cài đặt Windows Server có phản hồi mới</span><small>18/08/2026</small></div><div class="notification-item"><strong>MIT University</strong><span>Chào mừng đến hệ thống Học tập số</span><small>Thông báo hệ thống</small></div>`));
  $("#messagesButton").addEventListener("click",()=>drawer("Tin nhắn",`<div class="empty"><div><strong>3 liên lạc</strong><p>Bản local không sao chép hội thoại riêng.</p></div></div>`));
  $("#profileButton").addEventListener("click",()=>drawer("Tài khoản",`<div class="mini-profile"><span class="avatar">TN</span><span><strong>Trung Nguyen Nam</strong><small>Sinh viên · 2 khóa học</small></span></div><hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><a class="nav-item" href="#/grades"><span>◎</span><span>Điểm</span></a><a class="nav-item" href="#/settings"><span>⚙</span><span>Tuỳ chọn</span></a><p class="muted" style="font-size:12px">Không lưu cookie, mật khẩu hoặc token Office 365.</p>`));
  $("#drawerClose").addEventListener("click",closeDrawer);$("#backdrop").addEventListener("click",closeDrawer);$("#modalClose").addEventListener("click",()=>$("#modalBackdrop").classList.remove("show"));$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")e.currentTarget.classList.remove("show");});
  window.addEventListener("hashchange",route); if(localStorage.getItem("mituni-theme")!=="light")document.body.classList.add("dark"); route();
})();
