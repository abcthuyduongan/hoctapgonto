# Ma trận nghiệm thu cho hai mục P2

**48 ca đặc tả, trạng thái ban đầu `CHUA_CHAY`.** Đây không phải báo cáo đã thực hiện. Một mã cần nhiều lần chạy theo game/browser/viewport/engine; không tính một lần PASS là phủ mọi môi trường.

## 1. Quy tắc chung

- Mỗi kết quả có source ID, fixture, môi trường, thời điểm, expected/actual và đường evidence tồn tại.
- PERF: production build, profile/byte/cold-warm như kế hoạch 01; lưu mọi mẫu, cả lỗi.
- LOAD: staging thật, account/cookie riêng; unit/PGlite/mock chỉ kiểm thử công cụ, không đóng cổng tải thật.
- USER: người và thiết bị thật, mã tham gia ẩn danh; có trợ giúp ghi đúng, không tự sinh biên bản.
- Các bất biến quyền, đáp án, tối đa sao, retry idempotent, tuần đóng và audio clock phải giữ nguyên.
- `PASS`, `FAIL`, `BLOCKED`, `SKIP_CO_LY_DO`, `CHUA_CHAY` là trạng thái; thiếu dữ liệu field thì dùng ghi chú `CHUA_KIEM_CHUNG`, không đổi thành PASS.

## 2. PERF01–PERF20

| ID | Ca kiểm tra | Kết quả mong đợi / bằng chứng |
| --- | --- | --- |
| PERF01 | Inventory tất cả consumer game-base/theme và bundle baseline | Có owner selector, graph và bytes; chưa xóa rule chỉ vì tên cũ |
| PERF02 | Auth/map chưa mở game | Không tải CSS riêng của cả 10 game vô ích; request graph có snapshot |
| PERF03 | Mở từng game cache lạnh | Shared nhỏ + CSS game đúng, không kéo stylesheet trò khác qua completion/runner |
| PERF04 | First paint game/chuyển cảnh/hiện feedback | Không FOUC, không nút mất kiểu, layout không nhảy che control |
| PERF05 | Hint/đúng/sai/pending/error/kết quả ở 10 game | Hành vi và styles giống hợp đồng cũ; ảnh đối chiếu |
| PERF06 | Rời/đổi game ít nhất 30 vòng | Không style rò, body scroll/focus được phục hồi, DOM/heap không tăng bất thường |
| PERF07 | Mobile portrait/landscape, DPR 1/2 | Chọn đúng variant; không tải đồng thời wide+tall ngoài nhu cầu |
| PERF08 | Map 390/768/1440, tất cả vùng/chương/chặng | Anchor và landmark đúng vị trí/tỷ lệ, không đè/cắt nút |
| PERF09 | Ảnh map/nền lỗi 404/chậm/decode lỗi | Fallback/retry rõ; không reset clock/session hoặc làm mất câu |
| PERF10 | G1: từng game 30 lần, ba batch | p50/p95/p99/n/max/errors; p95≤1.500 ms ở điều kiện tham chiếu |
| PERF11 | G1W mở lại 30 lần | Báo cache rõ, mục tiêu p95≤800 ms; session/ACK vẫn thật |
| PERF12 | Kiểm chứng cold/prefetch | Request trước tap ghi đủ; prefetch hoàn tất không được gán cold |
| PERF13 | Ảnh câu hỏi/audio/reference media | Ready gồm media bắt buộc; nghe đủ, không bỏ gating để đạt thời gian |
| PERF14 | CSS/JS/nền/body mới trên đường tới game | Đạt budget đã chốt hoặc ghi rõ chưa đạt; gzip và transfer tách riêng |
| PERF15 | Asset toàn bộ sau thêm variants | Dist trong ngân sách; manifest dimensions/hash/bytes đúng; không giữ thừa nhiều nguồn runtime |
| PERF16 | LCP/CLS/long-task trước-sau | Đủ raw data; CLS≤0,1 theo phạm vi đo; không gọi event max là INP |
| PERF17 | Mạng chậm/mất mạng khi import chunk hoặc media | UI giữ thao tác, retry chunk chính xác, không tải lặp vô hạn |
| PERF18 | Đáp án hoán vị, hints, audio, attempt/retry/sao/tuần | Các invariant nghiệp vụ không đổi khi chỉ tối ưu UI/tài nguyên |
| PERF19 | Đổi account, cache public/private và phiên bản mới | Không lẫn dữ liệu; tab cũ không 404 ngay sau deploy, private không precache |
| PERF20 | Rollback RC và full kiểm tra | Source/manifest/artifact khớp, gói trước dùng được, Node và Chrome/Edge không unexpected |

## 3. LOAD01–LOAD16

| ID | Ca kiểm tra | Kết quả mong đợi / bằng chứng |
| --- | --- | --- |
| LOAD01 | Preflight origin/build/schema/dataset/budget | Chỉ staging allowlist, đúng source và dữ liệu thử; thiếu input thì không lên 100 |
| LOAD02 | 100 account/cookie/CSRF | Tách phiên đúng, không hardcode cookie sai hoặc dùng token chung |
| LOAD03 | Success và 401/403/404/429/500/timeout/body lỗi | Runner counter/exit đúng, không tạo mẫu latency thành công giả |
| LOAD04 | Response body chậm, media hợp lệ và decode/playable | Timer tới body hoàn chỉnh; browser media readiness tách khỏi fetch headers |
| LOAD05 | 100 workflow có think-time và telemetry | Active healthy VU/in-flight/accounts/throughput rõ, không chỉ peak tài khoản |
| LOAD06 | S0/S1 smoke và kiểm tra máy tạo tải | Luồng học hết bài, generator không thành nút thắt, dừng job được |
| LOAD07 | 30 học sinh trong 30 phút | Đủ thời lượng và raw data; không lệch quyền/dữ liệu/sao |
| LOAD08 | Ramp 50/75/100 và giữ 100 trong 45 phút | Đủ 100 VU thật theo định nghĩa, error/latency đạt gate đã chốt |
| LOAD09 | Burst login cùng IP/NAT và nhiều nguồn | Legitimates không bị chặn sai; auth policy không bị tắt để qua test |
| LOAD10 | Browser/API/function/DB/Storage cùng request ID | Phân tách nguyên nhân; không gán toàn bộ thời gian cho Supabase |
| LOAD11 | First-in-instance/cold block | Có nguồn phân loại và raw n; chưa xác nhận cold thì ghi đúng, không dựa riêng chờ/lâu |
| LOAD12 | Retry/lỗi ACK và phiên gần hết hạn trong run riêng | Idempotent, số mẫu/lỗi giữ nguyên; không nhân sao hoặc mất đáp án |
| LOAD13 | Đối soát sau tải | Ledger/ví/attempt/contest/media và tuần đúng, 0 sai quyền/mất dữ liệu |
| LOAD14 | Ramp xuống, memory/connection/queue | Tài nguyên hồi phục, không để job/phiên chờ vô hạn |
| LOAD15 | Stop threshold/budget/restore thử | Dừng nhẹ nhàng, thu được evidence, staging phục hồi đúng nếu cần |
| LOAD16 | Báo cáo cuối đúng source/điều kiện/n | Công bố steady/cold/error/n/giới hạn; không dùng mô phỏng hay mẫu ít để ký SLA rộng |

## 4. USER01–USER12

| ID | Ca kiểm tra | Kết quả mong đợi / bằng chứng |
| --- | --- | --- |
| USER01 | Chuẩn bị người tham gia/đồng ý/account thử | Trẻ và người phụ trách hiểu buổi thử, có thể dừng; không ghi liên hệ/tên thật trong repo |
| USER02 | Kiểm kê thiết bị/mạng thật và nội dung vừa sức | Có model/OS/browser/DPR/network/content version, không nhầm khó kiến thức với khó UI |
| USER03 | Tự login và tìm bài từ map | Ghi thời gian/tap/trợ giúp; mục tiêu core độc lập theo kế hoạch |
| USER04 | Học câu ảnh/chữ, sai rồi làm lại/gợi ý | Hiểu phản hồi, lựa chọn rõ, server chấm và lưu đúng |
| USER05 | Nghe rồi trả lời | Audio dùng được trên máy thật, trẻ hiểu cần nghe; không mở trả lời sớm sai protocol |
| USER06 | Thoát/quay lại/tiến độ/sao | Không mất chỗ và dữ liệu; trẻ biết bài đã ghi nhận |
| USER07 | Quà/thị trấn thử và cách tìm điều khiển | Không hiểu nhầm giao dịch thật; nhìn/chạm/cuộn được, thao tác phụ không che bài |
| USER08 | Phụ huynh PIN/đúng con/giới hạn/báo cáo/quà | Hoàn thành nhiệm vụ, quyền và thông báo rõ, không tác động tài khoản khác |
| USER09 | Giáo viên mobile import/preview/focus/publish/xuất đáp án | Giữ draft/lớp, không publish trùng/sai, dùng được khi thao tác thực tế |
| USER10 | INP/ready/ACK trên thiết bị thật | Callback/metric hợp lệ; unsupported/not reported không là 0; không ngoại suy field p75 mẫu nhỏ |
| USER11 | Màu/font/touch/keyboard/zoom và cảm nhận | Không blocker, ghi lời nói/trợ giúp trung tính, số đếm rõ thay chấm cảm tính |
| USER12 | Vòng 2 thử lại và bàn giao | Lỗi P0/P1 được đóng, core mục tiêu đạt theo n thực, evidence ẩn danh và giới hạn còn lại rõ |

## 5. Cách lưu kết quả

Sao chép `KET_QUA_KIEM_THU_TEMPLATE.json` thành kết quả của run, một ca có thể nhiều environment records. Tối thiểu:

```json
{
  "id": "PERF10",
  "status": "CHUA_CHAY",
  "sourceId": null,
  "executedAt": null,
  "executor": null,
  "fixtureId": null,
  "environment": {"browser": null, "device": null, "network": null, "cacheState": null},
  "sampleCount": 0,
  "expected": "G1 p95 game-ready <= 1500 ms; 30 attempts per game",
  "actual": null,
  "errors": [],
  "evidence": [],
  "notes": ""
}
```

Evidence cần đúng file và build: JSON/raw samples, HAR/resource table, log chức năng/DB đã lọc, ảnh/biên bản theo mã người tham gia. Fullscreen video/hình mặt không bắt buộc. Mọi FAIL/BLOCKED có issue, owner và bước thử lại; SKIP phải có lý do/cách kiểm chứng sau.

Check chuẩn của dự án vẫn chạy sau sửa: typecheck, Node, build, assets và full browser. Các công cụ đo/cold-start/đối soát mới phải được triển khai rồi mới ghi đã chạy; không cung cấp số giả để điền đủ mẫu.
