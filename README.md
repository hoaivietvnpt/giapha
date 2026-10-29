# Gia Phả Dòng Họ

Web app gia phả điện tử cho dòng họ: cây phả hệ trực quan, hồ sơ từng người, lịch ngày giỗ âm lịch, vị trí phần mộ. Chạy miễn phí trên **GitHub Pages**, dữ liệu dùng chung qua **Firebase** để nhiều người trong họ cùng xem và cập nhật.

## Tính năng

- **Cây gia phả**: sơ đồ theo từng đời, vợ/chồng đứng cạnh nhau, dâu/rể viền nét đứt, người đã mất có dải tang. Phóng to/thu nhỏ, kéo, chụm hai ngón trên điện thoại; thu gọn/mở từng nhánh; xem riêng một nhánh; ẩn/hiện cháu ngoại; tìm người trên cây.
- **Hồ sơ thành viên** (bấm vào bất kỳ ai):
  - Trạng thái **Còn sống / Đã mất**, đời thứ mấy, tuổi hoặc hưởng thọ.
  - Người còn sống: tiểu sử, nghề nghiệp, **số điện thoại (bấm để gọi), Zalo, Facebook, email, trang mạng khác, địa chỉ**.
  - Người đã mất: ngày mất, **ngày giỗ âm lịch** (tự tính từ ngày mất dương lịch), lần giỗ thứ mấy, **vị trí phần mộ** kèm bản đồ và nút chỉ đường. Đứng tại mộ có thể bấm "Vị trí hiện tại" để lưu toạ độ.
  - Quan hệ: cha mẹ, vợ/chồng, anh chị em, con — bấm để chuyển qua người khác.
- **Danh sách thành viên**: tìm theo tên (gõ không dấu cũng được), lọc theo đời, giới tính, còn sống/đã mất, huyết thống/dâu rể, chi.
- **Lịch ngày giỗ**: các ngày giỗ sắp tới quy ra dương lịch, đếm ngược; tải file `.ics` để thêm vào lịch điện thoại (có nhắc trước 1 ngày, 10 năm tới).
- **In / xuất ảnh** cây gia phả (PNG khổ lớn).
- **Phân quyền**: ai cũng xem được cây; *Thành viên* mới xem được liên hệ; *Biên tập* được thêm/sửa/xoá; *Quản trị* cấp quyền.
- Sao lưu / khôi phục bằng file JSON.

## Cấu trúc

```
index.html            Giao diện chính
css/style.css         Giao diện
js/app.js             Điều hướng & các trang
js/person.js          Hồ sơ thành viên & biểu mẫu
js/tree.js            Vẽ cây (SVG), phóng to, xuất ảnh
js/family.js          Tính đời, quan hệ, ngày giỗ
js/lunar.js           Âm lịch Việt Nam (thuật toán Hồ Ngọc Đức)
js/store.js           Dữ liệu: Firebase hoặc chế độ dùng thử
js/firebase-config.js Cấu hình Firebase (bạn điền)
js/sample-data.js     Dữ liệu mẫu hư cấu
firestore.rules       Quy tắc bảo mật Firestore
```

Không cần build, không cần Node — chỉ là HTML/CSS/JS thuần.

## Cài đặt

### 1. Bật GitHub Pages
Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / `(root)` → Save.
Sau 1–2 phút trang chạy tại `https://hoaivietvnpt.github.io/giapha/` (ở chế độ dùng thử với dữ liệu mẫu). Trang hiện dùng tên miền riêng `https://giapha.nhv.me/` (file `CNAME`); GitHub tự chuyển địa chỉ cũ sang tên miền này.

### 2. Tạo Firebase (miễn phí, gói Spark)
1. Vào <https://console.firebase.google.com> → **Add project** (VD: `giapha`). Có thể tắt Google Analytics.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable**.
3. Authentication → **Settings → Authorized domains → Add domain**: `giapha.nhv.me` (và `hoaivietvnpt.github.io` nếu vẫn mở bằng địa chỉ cũ).
4. **Build → Firestore Database → Create database** → chọn vùng `asia-southeast1` → *Start in production mode*.
5. Firestore → tab **Rules** → dán toàn bộ nội dung file `firestore.rules` → **Publish**.
6. **Project settings** (bánh răng) → *Your apps* → biểu tượng **Web `</>`** → đặt tên → **Register app** → sao chép khối `firebaseConfig`.
7. Mở `js/firebase-config.js`, dán các giá trị vào, commit & push.

### 3. Lần đăng nhập đầu tiên
Mở trang web → **Đăng nhập** bằng Google. **Người đầu tiên đăng nhập sẽ tự động là Quản trị viên** — hãy làm bước này ngay sau khi cài.

Vào **Quản trị** để:
- Nhập tên dòng họ, quê gốc, nhà thờ họ, giới thiệu.
- **Phân quyền**: thêm Gmail của người trong họ vào *Biên tập* (được sửa gia phả) hoặc *Thành viên* (được xem SĐT, MXH).
- Nếu muốn bắt đầu từ dữ liệu mẫu: ở chế độ dùng thử bấm *Tải bản sao lưu*, sau đó ở bản Firebase bấm *Nhập từ file*.

## Nhập gia phả từ Google Sheet

Tiện khi đã có sẵn danh sách hoặc nhiều người cùng điền:

1. Mở [Google Sheet mẫu](https://docs.google.com/spreadsheets/d/1y6rTIRon0wkKMxYWBlnXtFudMNTMvAJVYnGS-nQL13w/copy) để tạo bản sao vào Drive của bạn (hoặc tải [file mẫu CSV](mau/gia-pha-mau.csv)). Xoá các dòng mẫu (hư cấu) rồi điền người trong họ.
2. Mỗi người một dòng, có **Mã** riêng (1, 2, 3…). Cột **Mã cha**, **Mã mẹ**, **Mã vợ/chồng** ghi mã của người tương ứng (nhiều vợ/chồng cách nhau bằng `;`).
3. Ngày tháng: `12/03/1950`, `03/1950` hoặc `1950`. Ngày giỗ âm lịch: `15 tháng 7` (thêm chữ `nhuận` nếu tháng nhuận); để trống thì web tự tính từ ngày mất dương lịch.
4. **Chia sẻ** sheet: “Bất kỳ ai có đường liên kết” → Người xem.
5. Trên web: **Quản trị → Nhập từ Google Sheet** → dán link → *Đọc dữ liệu* → kiểm tra → *Nhập vào gia phả*.

Có thể sửa sheet rồi nhập lại bất cứ lúc nào: người cùng **Mã** sẽ được cập nhật. Nút *Xuất ra CSV* tạo file đúng định dạng này từ dữ liệu đang có trên web. Ngoài link Google Sheet, cũng có thể chọn file `.csv` hoặc `.xlsx` từ máy.

## Cài lên điện thoại & nhắc ngày giỗ

- Web là một ứng dụng (PWA): trên Android mở bằng Chrome → menu ⋮ → **Cài đặt ứng dụng**; trên iPhone mở bằng Safari → **Chia sẻ → Thêm vào MH chính**. Biểu tượng gia phả sẽ nằm trên màn hình chính.
- Trang **Ngày giỗ → Ứng dụng & nhắc giỗ → Bật nhắc ngày giỗ**: máy báo **trước 3 ngày** và **đúng ngày giỗ**. Android (Chrome, đã cài) có thể tự kiểm tra khi chạy nền; iPhone kiểm tra mỗi lần mở ứng dụng.
- Cách chắc chắn nhất: bấm **Thêm vào lịch điện thoại (.ics)** – lịch của máy sẽ nhắc trước 3 ngày và trước 1 ngày, kể cả khi không mở web.

## Tin tức dòng họ

Mục **Tin tức**: Biên tập viên bấm *Viết bài mới* – có ảnh bìa, trình soạn thảo đầy đủ (tiêu đề, chữ đậm/nghiêng, màu, danh sách, căn lề, trích dẫn, liên kết, chèn ảnh, video YouTube). Ảnh được thu nhỏ tự động. Có thể ghim bài, lưu nháp. Ba bài mới nhất hiện ở trang chủ.

## Gửi thông báo đẩy đến điện thoại (push)

Quản trị vào **Quản trị → Gửi thông báo đến mọi người** (hoặc tích *Gửi thông báo* khi đăng bài). Máy nào đã cài ứng dụng và bấm *Bật thông báo* sẽ nhận được, kể cả khi không mở app (iPhone cần iOS 16.4+ và đã *Thêm vào MH chính*). Nhắc ngày giỗ cũng được máy chủ gửi lúc ~8:00 sáng theo mốc mỗi người đã chọn.

Việc gửi do GitHub Actions (`.github/workflows/push.yml`, 10 phút chạy một lần) thực hiện – miễn phí. **Cài đặt một lần:**

1. Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key** → tải file JSON về máy (giữ bí mật, không gửi cho ai).
2. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**: Name `FIREBASE_SERVICE_ACCOUNT`, Secret = dán toàn bộ nội dung file JSON → *Add secret*.
3. Tab **Actions** → *Gửi thông báo gia phả* → *Run workflow* để chạy thử.

Lưu ý: GitHub có thể chạy trễ vài phút; nếu repo không có thay đổi trong 60 ngày, GitHub sẽ tạm dừng lịch chạy – vào tab Actions bấm bật lại.

## Phân quyền tự động

Email ghi trong phần liên hệ của mỗi người (nhập trên web hoặc cột *Email* trong Google Sheet) được tự động thêm vào nhóm **Thành viên** – đăng nhập bằng Gmail đó là xem được số điện thoại, mạng xã hội. Quản trị có thể nâng lên *Biên tập* trong trang Quản trị.

## Mẹo nhập liệu

- Bắt đầu từ **thủy tổ** (người cao nhất), rồi bấm vào người đó → *Thêm con*, *Thêm vợ/chồng*… để mở rộng dần.
- Ngày tháng có thể nhập đủ `dd/mm/yyyy`, chỉ `mm/yyyy` hoặc chỉ năm.
- Nếu chỉ biết ngày giỗ âm lịch (không rõ ngày mất dương lịch), nhập thẳng vào ô *Ngày / Tháng* âm lịch.
- Ảnh chân dung được tự động thu nhỏ và lưu cùng dữ liệu (không cần Firebase Storage).
- Nên **tải bản sao lưu JSON** định kỳ.

## Ghi chú bảo mật
- Thông tin cơ bản (tên, năm sinh, quan hệ, phần mộ, tiểu sử) **công khai** cho ai có đường link.
- Liên hệ (SĐT, Zalo, Facebook, email, địa chỉ) nằm ở bộ sưu tập riêng `contacts`, chỉ người được cấp quyền *Thành viên* trở lên mới đọc được (được Firestore Rules bảo vệ).
- `apiKey` của Firebase web là khoá công khai, để trong repo là bình thường; an toàn dữ liệu do `firestore.rules` quyết định.
