# Mầm v4

Học tiếng Anh, tiếng Trung và tiếng Nhật từ đầu, dành cho người Việt dễ mất động lực. Mỗi ngôn ngữ có 30 bài giao tiếp và 120 từ/cụm từ thuộc 10 chủ đề. Học khoảng 5 phút, hoặc chọn một câu trong 1 phút khi mệt. Nghỉ học không trừ XP.

## Hoạt động học

- Nghe câu mẫu, chọn nghĩa, ghép câu, đáp hội thoại và thử nói. Tiếng Trung có pinyin; tiếng Nhật có romaji và phần làm quen kana.
- Tìm từ, lọc chủ đề, lưu từ yêu thích, chơi ghép năm cặp và ôn theo lịch nhớ.
- Gợi ý mỗi ngày, sáu huy hiệu, lịch sử và tiến bộ riêng ở ba ngôn ngữ.
- Chọn mục tiêu 1–7 ngày học trong 7 ngày gần nhất; một phút cũng tính.
- Vào **Tài khoản** để tải sao lưu JSON, xem trước và nhập bổ sung dữ liệu của chính mình.

XP và huy hiệu ghi nhận hoạt động, không chứng nhận trình độ. 30 bài là nền tảng giao tiếp ban đầu, chưa phải khóa luyện thi B1/VSTEP đầy đủ. Âm thanh phụ thuộc giọng đọc trên trình duyệt/thiết bị; luyện nói là tự nghe và so sánh, không ghi âm hoặc chấm phát âm.

## Tài khoản và dữ liệu

Người có đường dẫn có thể vào trang giới thiệu; học và lưu tiến bộ cần đăng nhập bằng ChatGPT. Máy chủ xác thực và chỉ truy vấn dữ liệu theo tài khoản đó. Trang cũ sau khi đổi tài khoản sẽ dừng ghi và yêu cầu mở lại.

V4 là Site riêng. Dữ liệu ở các phiên bản trước vẫn ở Site cũ, không tự chuyển sang v4. Từ v4 trở đi, cập nhật **trên cùng Site**, cùng kho D1 và cùng ID nội dung sẽ tiếp tục sử dụng tiến bộ đã lưu. Không tạo Site/kho dữ liệu mới cho mỗi phiên bản. Xem [hướng dẫn nâng cấp](UPGRADING.md).

Sao lưu định dạng 1 gồm mục tiêu, ngôn ngữ, lịch sử, bài hoàn thành, câu ôn và từ. File thuộc tài khoản xuất nó; giữ riêng vì chứa lịch sử học cá nhân. Nhập tối đa 10 MB/50.000 bản ghi, chia nhóm tối đa 100 bản ghi. Chỉ thêm mục chưa có, không ghi đè tiến bộ/lịch ôn/mục tiêu hiện tại. Tài khoản chưa có tùy chọn sẽ khôi phục tùy chọn trong file. Nhập lại không nhân đôi dữ liệu; nếu mạng ngắt, nhập lại cùng file để bổ sung phần còn thiếu. Đây là nhập bổ sung, không quay toàn bộ dữ liệu về một thời điểm cũ.

## Chạy và kiểm tra

Yêu cầu Node.js 24 trở lên cho bộ kiểm tra SQLite. Không cần khóa API cho các hoạt động học hiện tại.

```sh
npm run install:ci
npm run check
npm test
npm run dev
npm run build
```

Chỉ dùng danh tính thử nghiệm ở môi trường phát triển, không bỏ qua xác thực để dùng dữ liệu thật. Phát hành qua plugin Sites: đẩy mã nguồn, lưu và xuất bản đúng phiên bản. GitHub lưu mã nguồn và chạy kiểm tra, chưa tự triển khai lên Sites.

## Theo dõi trên GitHub

Kho `Kenya-Assasin/mam-v4` có mã nguồn, [lịch sử phiên bản](CHANGELOG.md), hướng dẫn nâng cấp, mẫu báo lỗi/đề xuất và GitHub Actions. Mỗi lần đẩy mã hoặc mở đề xuất thay đổi, Actions kiểm tra kiểu dữ liệu, nội dung, nâng cấp dữ liệu, nhập sao lưu, nhiều tài khoản và bản dựng.

Kiểm tra API chạy mã thật với SQLite trong bộ nhớ và danh tính giả lập. Chúng không xác nhận đăng nhập thật, giọng đọc, D1 đã triển khai hay mọi trình duyệt. Không đưa `.env`, thông tin xác thực, file sao lưu người học hoặc dữ liệu D1 vào GitHub.
