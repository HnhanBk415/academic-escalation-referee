export type TourSide = "top" | "right" | "bottom" | "left";
export type TourAlign = "start" | "center" | "end";

export interface TourStepItem {
  element: string; // Selector e.g. '[data-tour="..."]'
  title: string;
  description: string;
  side?: TourSide;
  align?: TourAlign;
}

export type PageTourKey =
  | "app-shell"
  | "home"
  | "ask"
  | "history"
  | "inbox"
  | "exceptions"
  | "documents"
  | "audit"
  | "verify"
  | "demo-scenario";

export const TOUR_STEPS: Record<PageTourKey, TourStepItem[]> = {
  "app-shell": [
    {
      element: '[data-tour="app-logo"]',
      title: "Chào mừng đến AER",
      description:
        "AER giúp sinh viên tra cứu quy chế môn học. Câu hỏi vượt thẩm quyền AI sẽ được chuyển tới giảng viên duyệt.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="main-nav"]',
      title: "Các khu vực chính",
      description:
        "Trang chủ giới thiệu hệ thống; Không gian làm việc là nơi hỏi đáp và duyệt hồ sơ; Audit Log ghi lại mọi bước xử lý; Verify Harness chạy bộ kiểm thử tự động.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="account-switcher"]',
      title: "Đổi vai trò để test",
      description:
        "Bản demo không cần đăng nhập. Chọn Sinh viên A, Sinh viên B hoặc Giảng viên để xem hệ thống từ mỗi phía.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="workspace-rail"]',
      title: "Tính năng theo vai trò",
      description:
        "Rê chuột vào mép trái để mở menu. Sinh viên: Hỏi đáp, Xem các câu đã hỏi. Giảng viên: Câu hỏi cần duyệt, Ngoại lệ đã duyệt, Tải quy chế.",
      side: "right",
      align: "center",
    },
    {
      element: '[data-tour="help-button"]',
      title: "Xem lại hướng dẫn",
      description:
        "Bấm vào đây bất cứ lúc nào để xem lại hướng dẫn của trang đang mở.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="account-switcher"]',
      title: "Reset dữ liệu demo",
      description:
        "Trong menu tài khoản có mục Reset dữ liệu demo để đưa hệ thống về trạng thái ban đầu trước khi test lại.",
      side: "bottom",
      align: "end",
    },
  ],
  home: [
    {
      element: '[data-tour="home-hero"]',
      title: "Bắt đầu nhanh",
      description:
        "Nút này đưa bạn tới nơi làm việc chính của vai trò hiện tại.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="home-steps"]',
      title: "Quy trình 3 bước",
      description:
        "Tóm tắt cách đặt câu hỏi để AI trả lời chính xác.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="home-routing"]',
      title: "Cách AI phân luồng",
      description:
        "AI có 4 cách xử lý: trả lời trực tiếp, hỏi lại khi thiếu thông tin, chuyển giảng viên khi vượt thẩm quyền, từ chối khi yêu cầu bất thường.",
      side: "top",
      align: "start",
    },
  ],
  ask: [
    {
      element: '[data-tour="ask-course"]',
      title: "Chọn môn học",
      description:
        "Câu trả lời chỉ dựa trên quy chế của môn bạn chọn.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ask-group"]',
      title: "Chọn nhóm",
      description:
        "Mặc định là nhóm của tài khoản. Có thể đổi sang nhóm khác để test hai sinh viên cùng một nhóm.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ask-input"]',
      title: "Đặt câu hỏi",
      description:
        "Nhập câu hỏi rồi nhấn Enter để gửi, Shift+Enter để xuống dòng.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="ask-suggestions"]',
      title: "Gợi ý nhanh",
      description:
        "Bấm một gợi ý để điền sẵn câu hỏi mẫu.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="ask-progress"]',
      title: "Theo dõi xử lý",
      description:
        "Thanh tiến trình cho biết AI đang ở bước nào và câu hỏi được phân luồng ra sao.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="ask-result"]',
      title: "Đọc kết quả",
      description:
        "Mỗi câu trả lời đều kèm trích dẫn quy chế. Nếu cần ngoại lệ, bấm Chuyển tiếp hồ sơ để gửi giảng viên.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="ask-try"]',
      title: "Thử ngay",
      description:
        "Hỏi 'Nhóm em xin phép có 6 thành viên được không?' để xem một yêu cầu được chuyển giảng viên. Sau đó đổi sang tài khoản Giảng viên để duyệt.",
      side: "top",
      align: "center",
    },
  ],
  history: [
    {
      element: '[data-tour="history-search"]',
      title: "Tìm hồ sơ",
      description:
        "Tìm theo nội dung câu hỏi hoặc mã hồ sơ.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="history-filters"]',
      title: "Lọc theo trạng thái",
      description:
        "Xem riêng các câu AI đã trả lời, đang chờ giảng viên, đã duyệt hoặc bị từ chối.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="history-first-row"]',
      title: "Mở một hồ sơ",
      description:
        "Bấm vào một dòng để xem chi tiết bên phải. Phím j/k để chuyển câu, Esc để đóng.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="history-reading-mode"]',
      title: "Chế độ đọc",
      description:
        "Ẩn danh sách và phóng to chữ để đọc câu trả lời dễ hơn; chỉnh cỡ chữ bằng A−/A/A+.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="history-refresh"]',
      title: "Cập nhật kết quả",
      description:
        "Khi giảng viên đã duyệt, bấm để xem quyết định mới nhất.",
      side: "bottom",
      align: "end",
    },
  ],
  inbox: [
    {
      element: '[data-tour="inbox-filters"]',
      title: "Hàng chờ thẩm định",
      description:
        "Danh sách các câu hỏi AI đã chuyển lên vì vượt thẩm quyền.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="inbox-first-row"]',
      title: "Mở hồ sơ",
      description:
        "Mỗi dòng là câu hỏi gốc của sinh viên kèm nhóm và chủ đề quy chế.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="inbox-citations"]',
      title: "Căn cứ quy chế",
      description:
        "Các đoạn quy chế AI đã đối chiếu, dùng làm căn cứ khi quyết định.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="inbox-decision"]',
      title: "Ra quyết định",
      description:
        "Chọn Phê duyệt, Từ chối, Cần thêm thông tin hoặc Chuyển tiếp, và ghi lý do bắt buộc.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="inbox-exception"]',
      title: "Tạo ngoại lệ",
      description:
        "Khi phê duyệt có thể tạo ngoại lệ cho nhóm hoặc sinh viên; câu hỏi sau của họ sẽ được AI áp dụng ngoại lệ này.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="inbox-sla"]',
      title: "Thời hạn xử lý",
      description:
        "Đồng hồ cho biết thời gian còn lại trước khi hồ sơ quá hạn.",
      side: "bottom",
      align: "end",
    },
  ],
  exceptions: [
    {
      element: '[data-tour="exceptions-filters"]',
      title: "Lọc ngoại lệ",
      description:
        "Lọc theo phạm vi (toàn môn, nhóm, cá nhân) và trạng thái.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="exceptions-table"]',
      title: "Danh sách ngoại lệ",
      description:
        "Mỗi ngoại lệ có chủ đề, nội dung và thời hạn hiệu lực.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="exceptions-revoke"]',
      title: "Thu hồi",
      description:
        "Thu hồi khi điều kiện không còn; sinh viên hỏi lại sẽ nhận quy định chung.",
      side: "bottom",
      align: "end",
    },
  ],
  documents: [
    {
      element: '[data-tour="docs-stepper"]',
      title: "Ba bước tiếp nhận",
      description:
        "Nhập nguồn tài liệu, rà soát phần nhận dạng chưa chắc chắn, rồi kiểm tra xung đột trước khi lưu.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="docs-meta"]',
      title: "Thông tin tài liệu",
      description:
        "Đặt tiêu đề và phiên bản để phân biệt các lần cập nhật.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="docs-upload"]',
      title: "Tải tệp",
      description:
        "Hỗ trợ PDF, Word, ảnh chụp. Ảnh và PDF scan được nhận dạng chữ tự động.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="docs-text"]',
      title: "Hoặc dán văn bản",
      description:
        "Dán trực tiếp nội dung quy định nếu không có tệp.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="docs-submit"]',
      title: "Trích xuất",
      description:
        "Hệ thống chưa lưu gì vào quy chế ở bước này; bạn có thể hủy bất cứ lúc nào.",
      side: "top",
      align: "end",
    },
    {
      element: '[data-tour="docs-conflicts"]',
      title: "Xử lý xung đột",
      description:
        "Nếu nội dung mới khác quy chế gốc hoặc bản cập nhật trước, chọn dùng bản mới hay giữ bản cũ cho từng đoạn.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="docs-try"]',
      title: "Thử ngay",
      description:
        "Dán 'Rubric đánh giá đồ án CO3001: báo cáo 35%, sản phẩm 35%, trình bày 20%, hợp tác nhóm 10%.' để thấy cảnh báo xung đột với rubric gốc.",
      side: "top",
      align: "center",
    },
  ],
  audit: [
    {
      element: '[data-tour="audit-search"]',
      title: "Tìm sự kiện",
      description:
        "Tìm theo mã hồ sơ, người thực hiện hoặc lý do.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="audit-filters"]',
      title: "Lọc loại sự kiện",
      description:
        "Xem riêng các bước phân luồng, quyết định, ngoại lệ hoặc thay đổi quy định.",
      side: "bottom",
      align: "start",
    },
    {
      element: '[data-tour="audit-table"]',
      title: "Nhật ký không sửa được",
      description:
        "Mỗi bước AI và con người đều được ghi lại để truy vết.",
      side: "top",
      align: "center",
    },
    {
      element: '[data-tour="audit-expand"]',
      title: "Xem chi tiết",
      description:
        "Mở để xem dữ liệu vào/ra của từng bước.",
      side: "bottom",
      align: "end",
    },
  ],
  verify: [
    {
      element: '[data-tour="verify-run"]',
      title: "Chạy kiểm thử",
      description:
        "Chạy 16 tình huống mẫu để kiểm tra AI phân luồng đúng. Dữ liệu test được tách riêng, không làm đầy hàng chờ giảng viên.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="verify-metrics"]',
      title: "Chỉ số chính",
      description:
        "Tỷ lệ đạt, tỷ lệ chuyển thừa (câu thường bị đẩy lên giảng viên) và tỷ lệ bỏ sót (câu cần thẩm quyền nhưng AI tự trả lời).",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="verify-latency"]',
      title: "Thời gian xử lý",
      description:
        "Mỗi ô là một ca: xanh dưới 2 giây, vàng 2–5 giây, đỏ trên 5 giây; viền đỏ là ca thất bại. Bấm ô để tới dòng tương ứng.",
      side: "bottom",
      align: "center",
    },
    {
      element: '[data-tour="verify-table"]',
      title: "Kết quả từng ca",
      description:
        "So sánh phân luồng dự kiến và thực tế của từng câu hỏi.",
      side: "top",
      align: "center",
    },
  ],
  "demo-scenario": [
    {
      element: '[data-tour="account-switcher"]',
      title: "Gửi câu hỏi xin 6 thành viên",
      description:
        "Ở tài khoản Sinh viên A, gửi câu xin 6 thành viên để kiểm tra yêu cầu chuyển lên giảng viên.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="account-switcher"]',
      title: "Đổi sang tài khoản Giảng viên",
      description:
        "Bấm vào menu tài khoản để chuyển sang vai trò Giảng viên nhằm thụ lý hồ sơ cần thẩm định.",
      side: "bottom",
      align: "end",
    },
    {
      element: '[data-tour="workspace-rail"]',
      title: "Phê duyệt kèm tạo ngoại lệ",
      description:
        "Mở hồ sơ trong Câu hỏi cần duyệt, chọn Phê duyệt kèm tạo ngoại lệ cho nhóm để áp dụng về sau.",
      side: "right",
      align: "center",
    },
    {
      element: '[data-tour="account-switcher"]',
      title: "Kiểm tra kết quả cập nhật",
      description:
        "Quay lại Sinh viên A, mở Hồ sơ câu hỏi và bấm Làm mới kết quả để thấy quyết định được áp dụng.",
      side: "bottom",
      align: "end",
    },
  ],
};

export function mapPathnameToTourKey(pathname: string): PageTourKey {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/workspace/ask")) return "ask";
  if (pathname.startsWith("/workspace/history")) return "history";
  if (pathname.startsWith("/workspace/inbox")) return "inbox";
  if (pathname.startsWith("/workspace/exceptions")) return "exceptions";
  if (pathname.startsWith("/workspace/documents")) return "documents";
  if (pathname.startsWith("/audit")) return "audit";
  if (pathname.startsWith("/verify")) return "verify";
  return "home";
}
