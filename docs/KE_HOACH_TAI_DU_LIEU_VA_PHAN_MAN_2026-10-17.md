# Kế hoạch tải dữ liệu, bộ nhớ và phân màn trò chơi

Ngày 17/10/2026. **Bổ sung thay thế luật sao/tuần:** xem [kế hoạch sao từng câu](KE_HOACH_SAO_TUNG_CAU_VA_KHOA_TUAN_2026-10-17.md). Các đề xuất sao theo bộ/tự mở tuần bên dưới là kế hoạch gốc, đã được yêu cầu mới thay thế: mỗi câu tối đa 3 sao, mọi câu đạt 2 sao rồi xác nhận chuyển tuần; tuần cũ khóa.

 **Trạng thái: đã triển khai vào mã RC8; đang nghiệm thu tích hợp cục bộ.** Người dùng đã yêu cầu thực hiện kế hoạch, bổ sung khóa tuần tuần tự và kiểm tra đọc tiếng Việt. Chưa triển khai lên Netlify và chưa nghiệm thu trên thiết bị thật. Kết quả cuối ghi trong mục 16 của báo cáo rà soát chung.

## 1. Kết quả rà soát hiện trạng

| Phần | Hiện trạng đã đối chiếu trong mã | Hệ quả cần xử lý |
|---|---|---|
| Trang học sinh | `studentState → weeks → sets` trả nội dung pack của các tuần; state giữ danh sách này | Tổng nội dung trong RAM và JSON tăng khi lớp có thêm tuần/bộ |
| Mở trò | `/play` trả cả bộ nguồn và presentation của trò | Có thể lặp nội dung trong phản hồi và state; cần đo byte thực |
| Trí Nhớ | Dựng 2N thẻ cho cả bộ; bộ tối đa 30 cặp | Có thể có 60 nút thẻ cùng màn; audio của cặp đã ghép còn được giữ |
| Nối Từ | Dựng N thẻ mỗi cột cho cả bộ | Bộ 30 cặp thành 60 thẻ; nhiều ảnh và đoạn chữ cùng tồn tại |
| Căn chỉnh RC7 | Đã căn chữ/hình và cho cuộn theo vùng chơi | Căn kích thước chưa giới hạn số phần tử đang dựng |
| Tư liệu | Ảnh có lazy/async, audio có preload=none | Đã hạn chế tải trước, nhưng phần tử/media còn gắn vẫn có thể giữ tài nguyên |
| Cảnh 3D | Một canvas được tái sử dụng; năm GLB gốc tổng khoảng 7,27 MB; có pause/dispose và chất lượng tự điều chỉnh | Byte tải, RAM JS, RAM ảnh giải mã và GPU phải đo riêng; không suy RAM chỉ từ kích thước GLB |
| Phù hợp game | `onlinePresentation` kiểm tra cả bộ, không tự chọn một phần câu | Một câu dài/mơ hồ có thể làm cả bộ không dùng được ở trò ghép cặp; UI chưa giải thích đủ rõ |

Nguồn chính: `src/screens/OnlineStudentWorld.tsx`, `src/core/game-presentation.ts`, `src/core/online-exercises.ts`, `server/online-store.mjs`, `server/postgres-store.mjs`, `src/games/MemoryMatch.tsx`, `src/games/WordConnect.tsx`, `src/world3d/WorldCanvas.tsx`.

Chưa có phép đo mới chứng minh thiết bị người dùng hết RAM. Bước đầu phải ghi lại dung lượng phản hồi, heap/DOM và số tài nguyên GPU để chọn đúng phần cần giảm.

## 2. Thiết kế luồng tải mới

1. **Đăng nhập và mở hành trình:** chỉ lấy hồ sơ, số sao, tuần đang mở và danh sách tóm tắt gồm ID/version, tên bộ, số câu, trò được phép, tiến độ. Phản hồi này không chứa `items`, đoạn đọc hoặc danh mục media đầy đủ của mọi tuần.
2. **Mở lịch sử/tuần khác:** phân trang tóm tắt tối đa 20 bộ/lần; tải thêm khi người dùng mở/xem tiếp. Không tải sẵn tất cả lịch sử và toàn bộ câu hỏi.
3. **Bấm bắt đầu:** máy chủ kiểm tra lớp, tuần được mở, game, phiên bản; chỉ trả presentation của bộ đang chơi và metadata bộ nguồn. Bộ nguồn gốc vẫn nằm trên máy chủ để chấm và kiểm chứng. Không gửi đồng thời năm cách trình bày cho năm game.
4. **Trong lượt chơi:** giữ một bộ hiện tại, tối đa 30 câu như quy tắc đang có. Dựng phần tử theo màn; hiện chưa cần chia API thành từng câu vì giới hạn một bộ đã nhỏ. Chỉ cân nhắc phân trang câu hỏi nếu số đo chứng minh một bộ vẫn quá lớn.
5. **Gửi đáp án:** trả biên nhận gọn cho câu vừa gửi; không tải lại toàn bộ hành trình. Hoàn thành trả kết quả và cập nhật tiến độ liên quan; danh sách tuần dùng thay đổi tóm tắt, không gửi lại câu hỏi của mọi tuần.
6. **Thoát/đăng xuất:** hủy request không còn cần, bỏ state bộ đang chơi, dừng audio và giải phóng tài nguyên thuộc màn. Câu trả lời/sao đã được xác nhận tiếp tục nằm trên máy chủ.

Thay đổi hợp đồng API theo đường mới hoặc capability/version rõ ràng; giữ đường cũ trong giai đoạn chuyển tiếp để UI đang mở không bị lỗi. Cập nhật UI và Function cùng đợt; chưa cần thay schema chỉ để trả tóm tắt.

## 3. Giới hạn hiển thị từng trò

| Trò/dạng | Mỗi màn đề xuất | Dữ liệu vẫn phải hoàn thành |
|---|---|---|
| Trắc nghiệm, điền số/từ, đọc/nghe | 1 câu; dùng lại đoạn đọc/audio khi cùng nguồn | Toàn bộ câu gốc của bộ |
| Ghép Câu, Bậc Thang Quy Luật | 1 câu, 3–15 thẻ từ | Toàn bộ câu gốc của bộ |
| Trí Nhớ | Máy tính tối đa 6 cặp = 12 thẻ; điện thoại khởi đầu 4 cặp = 8 thẻ | Sao riêng từng câu nguồn; màn chỉ chia phần trình bày |
| Nối Từ | Máy tính tối đa 6 cặp, điện thoại khởi đầu 4 cặp | Toàn bộ cặp của bộ |

Đây là giới hạn thiết kế để thử nghiệm, chưa phải con số đã nghiệm thu với học sinh. Chữ dài vẫn được cuộn đầy đủ, không ép mọi trường hợp vừa một viewport.

Quy tắc phân màn:

- Chia theo ID câu/cặp nguồn rồi xáo trong màn. Hai mặt cùng cặp luôn ở cùng màn.
- Chia đều để tránh màn cuối chỉ có một cặp: 7 cặp với trần 6 thành **4 + 3**; 13 thành **5 + 4 + 4**; 30 thành **6 + 6 + 6 + 6 + 6**.
- Chốt phân màn lúc bắt đầu lượt. Đổi cỡ cửa sổ giữa lượt chỉ đổi cách trình bày, không xáo hoặc chuyển câu sang màn khác.
- Chỉ mở màn tiếp khi toàn bộ cặp hiện tại đã ghép và biên nhận lưu thành công. Nút chuyển màn không tạo attempt hoặc lượt thưởng.
- Giữ một session, source ID, contentVersion, item ID và thứ tự bằng chứng cho cả bộ. Chỉ hoàn thành lượt khi đủ tất cả câu được chọn; mỗi câu nguồn tối đa ba sao, chơi lại chỉ nhận phần tăng thêm.
- Tháo DOM/ảnh/audio của màn cũ. Chỉ giữ trạng thái nhỏ như ID đã ghép, vị trí màn và biên nhận; không giữ cây DOM của các màn đã qua.

## 4. Câu số 2 chỉ phù hợp hai game

Cơ chế hiện tại xét **cả bộ**. Ví dụ quiz chuyển sang Trí Nhớ/Nối Từ cần mọi đề và đáp án đúng ngắn tối đa 120 ký tự, đồng thời mặt thẻ không trùng; nối cặp chuyển thành trắc nghiệm cần ít nhất bốn cặp có đáp án khác nhau. Dạng đọc/nghe/điền hiện dùng Đảo Câu Hỏi. Điều kiện về số lượng và sự mơ hồ còn phụ thuộc cả nhóm, không thể quyết định chỉ từ một câu đứng riêng.

Thiết kế đề xuất:

1. Khi kiểm tra tài liệu, lập bảng **câu → game có thể dùng → lý do bị chặn/điều kiện còn thiếu**, kèm danh sách game chung của cả bộ.
2. Game mở cho bộ phải hỗ trợ tất cả câu và thỏa điều kiện chung của bộ. Ví dụ câu 1 hợp A/B/C, câu 2 chỉ hợp B/C, câu 3 hợp A/B/C thì bộ chỉ mở **B/C**.
3. Không tự bỏ câu 2 hoặc các câu không phù hợp để biến thành bộ ngắn hơn; điều đó có thể làm thay đổi tiến độ, độ khó và sao.
4. Nếu không còn game chung, chỉ rõ các câu gây xung đột và gợi ý tác giả tách/sửa trước khi giao. Không tự chia thành nguồn thưởng mới.
5. Bổ sung tùy chọn **người soạn giới hạn game** sau khi có bảng giải thích: phù hợp cấu trúc chưa đủ để kết luận phù hợp sư phạm, ví dụ một câu ghép văn có thể không nên đưa vào trò Quy Luật. Tác giả có thể bớt game; máy chủ vẫn chặn game không hỗ trợ dữ liệu.
6. Lưu nội dung câu một lần. Chỉ lưu danh sách game/metadata nhỏ; tạo presentation theo game được chọn khi mở lượt. Thêm chính sách game phải giữ mã câu ổn định, tạo phiên bản mới khi thay đổi bộ đã giao và không tạo thêm nguồn sao chỉ vì đổi game.

Trường giới hạn game chưa có trong mẫu/hợp đồng hiện tại. Khi triển khai phải bổ sung đồng bộ trình nhập, mẫu, validator, API và cả hai store; không chỉ ẩn nút ở giao diện.

## 5. Ngân sách bộ nhớ và tư liệu

Các ngưỡng sau là **mục tiêu khởi đầu cần đo và điều chỉnh**, không phải số đo hiện tại hoặc tổng RAM của ứng dụng:

| Tài nguyên | Ngân sách đề xuất |
|---|---|
| Danh sách hành trình | Tối đa 20 bộ tóm tắt/lần, không có nội dung câu |
| Bộ đệm câu hỏi | Tối đa 2 bộ, tổng JSON mã hóa khoảng 2 MiB; loại bộ ít dùng nhất khi vượt một trong hai giới hạn |
| Bộ lớn hơn ngân sách cache | Chỉ giữ bộ đang chơi, không lưu thêm bản đệm; đo RAM thực vì JSON byte không bằng heap/GPU |
| Media trò ghép cặp | Chỉ gắn media màn hiện tại; không tải trước audio của màn sau |
| Audio đang phát | Một audio tại một thời điểm; đổi màn/thoát thì pause, dỡ nguồn và dọn listener |
| Ảnh | Giữ tỷ lệ, kích thước giải mã phù hợp vùng hiển thị; dùng bản hiển thị nhỏ đã được kiểm tra, giữ bản gốc riêng cho người soạn |
| Mô hình 3D | Một renderer/context như hiện tại; không tạo canvas mới mỗi game hoặc sao chép texture không cần thiết |

Cache dùng khóa có tài khoản/workspace, pack ID, version và game khi cần. Xóa cache khi đăng xuất/đổi tài khoản; khi bắt đầu lượt vẫn phải được máy chủ cấp quyền. Không lưu toàn bộ học liệu hoặc audio vào localStorage/IndexedDB/Service Worker riêng chỉ để tránh request. Cache tệp công khai có hash của ứng dụng được quản lý riêng với nội dung học sinh.

Không giữ đồng thời base64, File/ArrayBuffer, Blob và ảnh giải mã cho cùng tệp sau khi nhập xong. Thu hồi object URL nếu ứng dụng tạo ra; không gọi revoke cho URL máy chủ thông thường.

Phần 3D thực hiện sau khi đo: nếu đây là nút thắt chính, thiết kế nạp cảnh tối thiểu/cảnh cần dùng trước, cảnh khác khi rảnh thành đợt riêng có kiểm thử renderer. Giữ nút vào bài trong lúc cảnh tải; chọn Nhẹ giảm tải render, không tự coi đó là đã giảm dung lượng tải mô hình.

## 6. Học sinh tự đổi mật khẩu

- Nút trong tài khoản học sinh; chỉ dựng/tải biểu mẫu khi mở. Không mở trong lúc đang gửi hoặc hoàn tất lượt chơi.
- Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận; giữ quy tắc 10–128 ký tự, không tự cắt khoảng trắng của mật khẩu.
- API chỉ tác động tài khoản đang đăng nhập, kiểm tra Origin/CSRF, hash mật khẩu hiện tại và giới hạn thử sai. Không nhận ID học sinh đích từ form, không ghi mật khẩu vào log/cache.
- Giao dịch kiểm tra lại session/active/hash cũ trước khi ghi, chặn việc ghi đè khi quản trị đặt lại mật khẩu/khóa tài khoản hoặc người dùng đăng xuất cùng lúc.
- Đổi thành công thu hồi các phiên, yêu cầu đăng nhập lại; giữ dữ liệu học, câu đã ghi, sao và lịch sử. Nhập sai mật khẩu hiện tại báo ngay trong form và không làm mất phiên.
- Tiêu chí: mật khẩu cũ không đăng nhập được, mật khẩu mới dùng được, thiết bị khác mất phiên; không thay được tài khoản khác; lỗi ghi rollback; sao/học liệu không đổi.

## 7. Thứ tự thực hiện và điểm dừng

| Bước | Đầu ra phải có trước khi sang bước sau | Tiêu chí đạt |
|---|---|---|
| 1. Đo bản hiện tại | Báo cáo byte/request, thời gian, DOM, heap và GPU trên thiết bị/mạng đại diện | Có baseline cho bộ 2/6/13/30 câu, nhiều tuần và 10 lần vào/thoát; phân biệt RAM, cache ổ đĩa và GPU |
| 2. Tải tóm tắt, tải bộ theo nhu cầu | API tóm tắt có trang; mở lượt chỉ lấy một bộ; cache giới hạn | Mở hành trình không trả items; số câu tải không tăng theo toàn lịch sử; không tải lại toàn bộ tuần khi trả lời |
| 3. Phân màn và giải phóng media | Trí Nhớ/Nối Từ theo trần 4/6 cặp, cleanup đúng vòng đời | Không vượt số thẻ thiết kế; không thiếu/trùng ID; audio màn cũ dừng; đủ câu mới được sao |
| 4. Giải thích/giới hạn game | Bảng từng câu, game chung, lý do; chính sách tác giả có version nếu bổ sung | Câu 2 chỉ hai game được xử lý rõ; không game không phù hợp, không tự bỏ câu hoặc tạo thêm sao |
| 5. Đổi mật khẩu | Form/API và kiểm thử cục bộ/cloud | Đạt tiêu chí mục 6; có thể làm độc lập khi luồng tải mới đã ổn định |
| 6. Kiểm thử, triển khai thử | So sánh baseline/sau sửa; tài khoản thử riêng trên Netlify | Dữ liệu/sao/phiên bản/quyền đúng, không tăng bộ nhớ tích lũy qua vòng vào/thoát; tốc độ thực tế tốt hơn baseline |

Không đồng thời viết lại renderer, đổi luật sao và đổi toàn bộ hợp đồng nhập trong một lượt. Mỗi bước có thể bàn giao/so sánh riêng, giữ bản trước để quay về; các thay đổi dữ liệu nếu có cần kế hoạch tương thích trước khi triển khai.

## 8. Bộ nghiệm thu cụ thể

- **Dữ liệu:** 2/3/4/6/7/10/13/30 câu/cặp; 1/10/30 tuần thử; nhiều bộ có cùng ảnh/đoạn đọc/audio; danh sách trống và trang cuối.
- **Phù hợp game:** câu 2 giới hạn hai game, câu dài 120 ký tự, đáp án/mặt thẻ trùng, thiếu bốn đáp án để chuyển dạng, sắp xếp câu không phù hợp sư phạm với Quy Luật.
- **Giao diện:** 360×740, 390×844, 766×471, 768×600, 1219×615, 1440×1000; đổi kích thước giữa lượt; không cắt chữ hoặc tràn ngang, nút ít nhất 44 px.
- **Tải:** mở lạnh/ấm, API chậm/mất kết nối, ảnh lỗi, chunk game lỗi, cảnh 3D lỗi; người dùng vẫn có thao tác thử lại. Request không còn dùng phải được hủy, không áp response cũ vào tài khoản/bộ mới.
- **Bằng chứng/sao:** next màn không tạo điểm; mất phản hồi rồi thử lại không nhân đôi; mỗi câu đúng lưu sao ngay, hoàn tất không thưởng thêm; chơi lại và chuyển game giữ trần ba sao/câu nguồn, tuần đã qua vẫn khóa.
- **Bộ nhớ:** ít nhất 10 vòng vào/thoát sau warm-up, thu số DOM node/listener, heap, texture/geometries/context; chờ cleanup/GC khi đo. Không đánh giá rò rỉ chỉ bằng một đỉnh heap. Cache câu hỏi không vượt cả số bộ và byte; không còn audio phát sau thoát, không tạo thêm WebGL context mỗi vòng. Đặt ngưỡng hồi phục từ baseline của cùng thiết bị và báo rõ dung sai, không hứa một mức MB chung cho mọi máy.
- **Tốc độ:** ghi TTFB, byte giải mã, thời gian từ bấm vào bài đến câu đầu có thể tương tác, thời gian nhận biên nhận đáp án; báo median/P95 và điều kiện mạng/thiết bị. Mục tiêu định lượng cuối cùng được chốt sau baseline, không lấy số fixture cục bộ để cam kết website thật.

Chỉ đánh dấu sẵn sàng production sau nghiệm thu website/thiết bị thật. Kiểm thử tự động cục bộ không thay thế bước này.

## 9. Bổ sung và quyết định triển khai RC8

- Hành trình dùng API tóm tắt tối đa 20 bộ/trang; máy chủ chỉ đọc metadata của toàn lịch sử và nội dung bộ hiện tại để xác định trò. Danh sách trò chỉ lấy khi bấm **Chọn trò để học hoặc ôn lại** ở bộ trong tuần hiện tại. Không giải mã đồng loạt 20 bộ lịch sử chỉ để dựng danh sách.
- Mỗi lần mở lượt vẫn xác thực lại lớp, tuần, phiên bản và game, kể cả gửi lại requestId cũ. Mọi câu nguồn trong tuần hiện tại đạt ít nhất **2 sao/câu** mới được xác nhận chuyển tuần. Học sinh chọn ôn lên 3 sao hoặc xác nhận sang tuần; tuần đã qua khóa bằng UI/API.
- Chọn giữ **0 bộ đã thoát trong cache** thay vì thêm LRU: chỉ giữ presentation đang chơi, tháo khi thoát/đăng xuất. Do không có cache câu hỏi nền, giới hạn 2 bộ/2 MiB không bị vượt bởi cache; kích thước heap/ảnh/GPU của bộ đang chơi được đo riêng. Không thêm localStorage/IndexedDB/SW cho học liệu riêng tư.
- Giữ API cũ để UI đang mở tương thích; UI mới dùng `/student/summary`, `/play/compact`, `/complete-compact`. Không thay schema dữ liệu.
- Đọc tiếng Việt: chọn rõ voice cùng ngôn ngữ, chờ `voiceschanged` tối đa 1,5 giây; thiếu giọng Việt thì báo để thêm giọng Việt/dùng âm thanh tác giả, không dùng mặc định ngoại ngữ. Câu có dấu Việt ưu tiên giọng Việt dù bộ gắn môn tiếng Anh. Đổi câu/màn/thoát hủy hàng chờ và lời đọc. Âm thanh thu sẵn giữ nguyên.
- Nghiệm thu giọng đọc phải có: mặc định tiếng Anh nhưng có giọng Việt; danh sách giọng tải trễ; chỉ có ngoại ngữ; thiếu quyền/mất kết nối; câu Việt trong bộ Anh; thoát khi đang chờ giọng; bật tệp thu sẵn khi TTS đang đọc. Kiểm thử mock chỉ xác minh lựa chọn/cleanup, còn chất lượng phát âm phải nghe trên Windows/điện thoại thật.
