# Nâng cấp Mầm từ v4 trở đi

## Dùng tiếp dữ liệu qua các phiên bản

1. Làm việc từ kho `Kenya-Assasin/mam-v4`; đọc lịch sử và kiểm tra phiên bản đang chạy.
2. Giữ `project_id` trong `.openai/hosting.json`, binding `DB` và kho D1 của Site. Không đăng ký Site mới cho v4.1/v5. Giữ quyền truy cập nếu không có yêu cầu đổi.
3. Không xóa/tái sử dụng ID bài/từ đã xuất bản. Không đổi thứ tự ba câu trong bài đã có, vì thẻ ôn tham chiếu chỉ số câu. Có thể sửa lời giải/nghĩa; câu gốc mới cần ID bài mới. Thêm nội dung bằng ID mới.
4. Không sửa migration SQL đã xuất bản. Thay đổi `db/schema.ts`, chạy `npm run db:generate`, kiểm tra SQL mới. Ưu tiên thêm bảng/cột với mặc định tương thích. Không dùng DROP, TRUNCATE hoặc tạo lại kho dữ liệu để nâng cấp.
5. Kiểm tra dữ liệu mẫu của bản trước, nhiều tài khoản, ôn tập và sao lưu. Chạy `npm run check`, `npm test`, `npm run build`. Thêm kiểm tra khi thay đổi cách lưu dữ liệu.
6. Cập nhật phiên bản trong `package.json`, `package-lock.json`, `lib/release.ts`, `CHANGELOG.md`. Giữ `formatVersion: 1` nếu cấu trúc sao lưu chưa đổi. Nếu đổi định dạng, thêm bộ đọc/chuyển đổi từ file cũ trước khi phát hành.
7. Tạo commit GitHub, chờ Actions đạt. Phát hành **cùng Site** qua Sites với mã nguồn đã kiểm tra. Lưu SHA GitHub và SHA nguồn Sites trong ghi chú phát hành; hai hệ thống có thể tạo SHA khác nhau cho cùng nội dung.

## Migration hiện có

- `0000_melted_post.sql`: tùy chọn, lịch sử, hoàn thành, thẻ ôn.
- `0001_equal_black_queen.sql`: thêm tiến bộ từ vựng.
- `0002_smart_wolfsbane.sql`: thêm mục tiêu tuần mặc định 3; giữ ngôn ngữ và các hàng dữ liệu có sẵn.

`lib/content-manifest.json` giữ mốc nội dung và dấu kiểm migration đã xuất bản. Không thay mốc cũ để làm kiểm tra vượt qua sau khi xóa/đổi nội dung. Chỉ bổ sung mốc nội dung/migration mới sau khi kiểm tra tương thích.

## Sao lưu và phục hồi

Người học vào **Tài khoản → Tải bản sao lưu** trước thay đổi lớn. JSON cá nhân không được commit. Nhập đúng tài khoản bằng **Chọn file để nhập → Nhập bổ sung**. Mục đã có không bị thay thế; nhập lại để tiếp tục khi bị gián đoạn.

Giới hạn 10 MB/50.000 bản ghi. Nếu vượt giới hạn, cần nâng cấp xuất/nhập hoặc hỗ trợ khôi phục riêng; không cắt file tùy tiện. Sao lưu của ứng dụng chỉ là dữ liệu một tài khoản, không thay thế sao lưu toàn kho D1 trước thay đổi lớn.

Nếu bản chạy mới có lỗi, quay lại mã ứng dụng tương thích với lược đồ hiện tại; không tự động xóa cột hoặc quay lùi dữ liệu. Với thay đổi phức tạp, thêm cấu trúc mới, chuyển dữ liệu có kiểm tra, rồi chỉ bỏ cấu trúc cũ trong một phát hành riêng có kế hoạch phục hồi.
