# Biểu mẫu thực hiện và lưu bằng chứng

Các khối dưới đây là **mẫu trống**, không phải môi trường đã cấp hoặc phép đo đã thực hiện. Tên tool mới là hợp đồng đề xuất để dev triển khai; chưa có thì không ghi đã chạy.

## 1. Cấu hình một run

```json
{
  "schemaVersion": 1,
  "runId": null,
  "environment": "staging",
  "origin": null,
  "allowedOrigins": [],
  "expectedSourceId": null,
  "deployId": null,
  "datasetId": null,
  "accountsFile": "test-results/private/staging-accounts.json",
  "generator": {"machineId": null, "cpu": null, "ramGiB": null},
  "profiles": {"protocolVUs": 90, "browserVUs": 10},
  "limits": {"maxRequests": null, "maxEgressMiB": null, "maxDurationSeconds": null},
  "outputDir": null
}
```

Origin/source/budget chưa điền thì runner không chạy peak. File account chứa thông tin đăng nhập chỉ ở vùng private bị Git bỏ qua; kết quả xuất không chứa password/cookie/CSRF/PIN. Seed/preflight và cleanup chỉ tác động dataset/run ID đã định danh trên staging.

## 2. Hợp đồng công cụ nên có

| Công cụ | Đầu vào | Đầu ra bắt buộc |
| --- | --- | --- |
| `tools/run-game-performance.mjs` — đề xuất mới | Build URL, profile, fixture, game IDs, cold/warm, repetitions | Raw thao tác/request/bytes/cold state, percentiles, lỗi, ảnh/filmstrip theo nhu cầu |
| `tools/prepare-staging-fixture.mjs` — đề xuất mới | Staging allowlist, fixture version, expected build, run ID | Counts/ID/hash media, file account private, ledger baseline |
| `tools/staging_load_runner.mjs` — nâng cấp hiện có | Config, phase smoke/baseline/peak/burst, run ID | Active/in-flight/operation/request/error samples và report/exit code thật |
| `tools/verify-staging-ledger.mjs` — đề xuất mới | Run/dataset/source ID, receipt records | So sánh invariants và rows lỗi, kết quả đạt/chưa đạt |
| Pilot metric collector — đề xuất mới | Chỉ bật cho phiên pilot được định danh | INP/LCP/CLS/ready/ACK đã lọc thông tin riêng, trạng thái hỗ trợ |

CLI cụ thể do dev chốt cùng schema config và tests. Không gọi một tên script dự kiến như thể nó đã tồn tại. Các lệnh chuẩn hiện có vẫn dùng để hồi quy:

```powershell
npm run typecheck
npm test
npm run build
npm run test:assets
npm run test:online:browser
```

## 3. Mẫu raw metric

```json
{
  "runId": null,
  "sourceId": null,
  "timestampUtc": null,
  "profileId": null,
  "syntheticUserId": null,
  "operation": "game_open_ready",
  "gameId": null,
  "fixtureId": null,
  "cacheClass": "UNKNOWN",
  "runtimeClass": "UNKNOWN",
  "requestId": null,
  "startMs": null,
  "durationMs": null,
  "httpStatus": null,
  "success": null,
  "bytes": null,
  "errorClass": null
}
```

duration dùng monotonic clock trong từng client; timestampUtc để ghép log. Không lấy chênh hai máy làm duration nếu chưa đồng bộ. Mẫu thất bại có error, không được lén bỏ khỏi tổng attempts; percentiles thành công và tỷ lệ lỗi được báo cạnh nhau.

## 4. Mẫu bảng trước/sau tối ưu

| Game/profile | Build trước | Build sau | Cache/runtime | n | p50 | p95 | p99/max | CSS/JS/art bytes | Lỗi |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| Chưa chạy | — | — | — | 0 | — | — | — | — | — |

Kèm waterfall, ảnh 390/768/1440, CSS coverage theo trạng thái và tài nguyên bắt đầu trước tap. Nếu fixture/profile khác phải tạo hàng khác, không tính thành tăng tốc của cùng phép đo.

## 5. Mẫu ghi usability một tác vụ

| Session ID | Mã trẻ | Thiết bị/browser | Tác vụ | Bắt đầu/kết thúc | Tự hoàn thành | Trợ giúp | Tap nhầm | Điều trẻ nói/lỗi |
| --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| Chưa chạy | Uxx | — | — | — | CHUA_CHAY | — | — | — |

Mức trợ giúp: 0 tự làm sau lời giao nhiệm vụ ban đầu; 1 nhắc lại nhiệm vụ trung tính; 2 gợi vị trí/hướng thao tác; 3 người lớn làm thay. Chỉ mức 0 tính tự hoàn thành độc lập; ghi các nhóm còn lại riêng. Ghi nguyên nhân UI/content/device/network, không đánh giá năng lực trẻ từ phép thử giao diện.

Thông tin đồng ý theo dõi: mã người tham gia, ngày, đã có xác nhận người phụ trách hay chưa, trẻ đồng ý tham gia hay chưa, cho phép ghi màn hình hay không, có rút lui hay không. Danh tính/liên hệ/chữ ký được đơn vị giữ riêng; không cần đưa vào repo.

Hai câu hỏi trung tính cuối buổi: “Con thấy phần nào dễ hoặc khó?” và “Có nút hay chỗ nào con không tìm thấy?”. Có thể dùng ba mặt 🙂/😐/🙁, kèm lời nói; không thay log tác vụ bằng chỉ một điểm hài lòng.

## 6. Mẫu lỗi và thử lại

```text
Issue ID:
Run/source/device/task:
Ưu tiên P0/P1/P2/P3:
Bước tái hiện:
Expected:
Actual:
Ảnh/log đã ẩn danh:
Ảnh hưởng tới người dùng/dữ liệu:
Owner và phương án:
Build sửa:
Ca hồi quy và thử lại:
Kết quả thực tế:
Phần còn chưa kiểm chứng:
```

## 7. Cấu trúc bằng chứng đề xuất

```text
test-results/performance-<run-id>/
  config-public.json
  build-info.json
  dataset-summary.json
  browser-raw.jsonl
  protocol-raw.jsonl
  function-db-summary.json
  errors.json
  ledger-before.json
  ledger-after.json
  reconciliation.json
  report.json
  screenshots/
  usability-anonymized.json
docs/ket-qua-<run-id>/
  01_KET_QUA_HIEU_NANG.md
  02_KET_QUA_TAI_THAT.md
  03_KET_QUA_USABILITY.md
  04_VIEC_DA_SUA_VA_CON_LAI.md
```

`test-results/` đang bị Git bỏ qua: phải chọn bản đã lọc, có kích thước hợp lý để đưa vào hồ sơ docs/gói bàn giao, hoặc ghi nơi lưu có thể truy cập. Không để toàn bộ PASS chỉ trỏ tới file đã mất trên một máy.

## 8. Nhật ký công việc

| Ngày | Task | Người thực hiện | Source ID | Đã làm/tệp | Check/actual/evidence | Còn lại |
| --- | --- | --- | --- | --- | --- | --- |
| 06/11/2026 | Lập kế hoạch | Codex | b5f1c02… | Bộ tài liệu này và baseline đọc | Chỉ đọc mã/metadata, kiểm tra tài liệu; chưa triển khai/đo mới | Thực hiện P0→P3, T0→T1, U1→U2 |

Các hàng thực hiện tương lai để trống cho tới khi có việc thật. Người lập trình cập nhật mỗi đợt: thay đổi, lý do, phép đo/test, rủi ro, rollback và việc chờ chủ dự án. Chủ dự án xác nhận hồ sơ cuối dựa trên kết quả thực, không chỉ chữ “hoàn thành”.
