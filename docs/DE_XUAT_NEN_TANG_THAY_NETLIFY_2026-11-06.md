# Đề xuất nền tảng thay Netlify cho Bảo An Learning

Ngày đối chiếu tài liệu: **06/11/2026**, Asia/Saigon. Người dùng cho biết trang đã hoàn thành, tài khoản Netlify Free hết credit và **chỉ có 1–2 người dùng**. Đề xuất đã cập nhật theo quy mô nhỏ này. Đây là đề xuất lựa chọn, chưa chuyển hosting, mua gói hoặc thay đổi dữ liệu.

## Lựa chọn ưu tiên

**Ưu tiên Vercel Hobby + giữ Supabase hiện có**, nếu đây là ứng dụng cá nhân, phi thương mại đúng điều kiện Hobby. Với 1–2 người dùng, nên thử trong hạn mức miễn phí và quan sát usage trước khi mua gói trả phí. Đây là nhận định theo quy mô và mã hiện tại, chưa phải kết quả triển khai hoặc đo dung lượng sử dụng. [Điều kiện Vercel Hobby](https://vercel.com/docs/plans/hobby).

Giao diện và dữ liệu học vẫn được giữ; cần chuyển adapter API Netlify sang Vercel, routing, secrets, cookie/CSRF và kiểm thử học/lưu tiến độ. Không chỉ tải thư mục dist lên rồi coi API đã hoạt động. Nếu Supabase hiện dùng Free và vẫn trong hạn mức, có thể bắt đầu với mục tiêu chi phí hosting/DB là 0 USD; media và tài nguyên vẫn phải theo dõi.

**Render trả phí là phương án tùy chọn**, khi cần dịch vụ Node không ngủ lúc ít truy cập hoặc mục đích sử dụng không phù hợp Hobby và chủ dự án muốn dùng Render.

Render công bố web service Starter từ **7 USD/tháng**, 512 MB RAM, 0,5 CPU. Các dịch vụ compute trả phí không tự ngủ vì không có truy cập như gói Free. Đây là chi phí compute khởi điểm, không phải báo giá trọn gói: kiểm tra thêm băng thông, build, thuế, tên miền và chi phí Supabase tại lúc đăng ký. [Thông tin giá của Render](https://render.com/articles/best-netlify-alternatives-in-2026), [hành vi dịch vụ trả phí](https://render.com/docs/faq).

Quy mô 100 học sinh trong đề xuất ban đầu **không được dùng để quyết định mua hosting cho nhu cầu hiện tại 1–2 người**. Các kịch bản tải lớn đã lập trước đó chỉ là tài liệu cho giai đoạn mở rộng nếu cần; lần chuyển này ưu tiên xác nhận đầy đủ luồng của hai tài khoản và theo dõi usage.

## So sánh các phương án

| Phương án | Chi phí công bố | Phù hợp với dự án | Giới hạn cần tính khi quyết định |
| --- | --- | --- | --- |
| Vercel Hobby + Supabase | 0 USD trong hạn mức Hobby; Supabase theo gói hiện có | Ưu tiên cho 1–2 người nếu dùng cá nhân, phi thương mại | Cần adapter API; theo dõi tài nguyên và media |
| Cloudflare Workers + Static Assets + Supabase | Có Free; Workers Paid tối thiểu 5 USD/tháng và tính thêm phần vượt mức | Đáng thử nếu ưu tiên chi phí phục vụ giao diện/ảnh, chấp nhận việc chuyển runtime | Free chỉ 10 ms CPU/request và 100.000 Worker requests/ngày; phải kiểm chứng phần đăng nhập, DB và import |
| Render trả phí + Supabase | Web service từ 7 USD/tháng; DB/media tính riêng | Phương án tùy chọn để giữ runtime Node.js không ngủ lúc ít truy cập | Cần tạo entry máy chủ cloud; chưa cần mua chỉ vì kế hoạch tải lớn trước đây |
| Render Free + Supabase | Có thể bắt đầu 0 USD trong hạn mức | Dựng bản demo hoặc kiểm tra quá trình chuyển | Ngủ sau 15 phút không có truy cập; khởi động lại khoảng một phút, không phù hợp mục tiêu mở bài nhanh ở lần truy cập đầu |

Nguồn từng hàng: [Render](https://render.com/articles/best-netlify-alternatives-in-2026), [Cloudflare Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Render Free](https://render.com/docs/free). Mức công sức chuyển ở đây là đánh giá kỹ thuật của người lập đề xuất, không phải cam kết của nhà cung cấp.

### Cloudflare cần được hiểu đúng

Request được phục vụ trực tiếp từ Static Assets là miễn phí và không giới hạn theo tài liệu; request chạy Worker có hạn mức/tính phí riêng. Cấu hình route sao cho ảnh, CSS và JS tĩnh không vô tình chạy qua Worker trên mọi request. [Static Assets billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

Không mặc định toàn bộ API hiện tại sẽ hoạt động trong Workers Free. Dự án dùng `pg`, `scrypt`, xử lý audio và các module Node. Cloudflare hiện hỗ trợ nhiều Node API, gồm phần lớn `node:crypto`, nhưng vẫn cần build/thử trên runtime thật, kiểm tra giới hạn CPU/bộ nhớ và vòng đời kết nối PostgreSQL. Không giảm độ mạnh băm mật khẩu chỉ để vừa Free. [Node compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/), [crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).

### Vercel cần được hiểu đúng

Không tự kết luận một sản phẩm dùng cho lớp học đáp ứng điều kiện “personal, non-commercial” chỉ vì không thu tiền học sinh. Chủ dự án cần đối chiếu cách sử dụng thực tế với điều kiện Hobby. Nếu phải dùng Pro, giá nền công bố hiện từ **20 USD/tháng**, có mức sử dụng kèm theo và phí vượt mức, nên không phải lựa chọn rẻ nhất trong các phương án trả phí nêu trên. [Điều kiện Hobby](https://vercel.com/docs/plans/hobby), [giá Vercel](https://vercel.com/pricing).

## Căn cứ từ mã hiện tại

- Frontend React/Vite đã tách khỏi dữ liệu; không cần làm lại bản đồ, nhân vật hoặc nội dung học để đổi hosting.
- `netlify/functions/online.mjs` khởi tạo `PostgresStore`, private Supabase Storage và `createCloudApi`; API nằm dưới `/api/online/*`.
- `server/cloud-api.mjs` đã dùng giao diện Request/Response, cookie phiên riêng, CSRF, public origin và giao thức câu hỏi hiện có.
- `server/run-online.mjs` phục vụ chế độ SQLite cục bộ. **Không dùng nguyên `npm run online` để thay API Supabase trên Render**: cần entry máy chủ cloud dùng PostgresStore và private Storage hiện có.
- `netlify.toml` chứa cache headers, CSP, routing và build config; cần chuyển các hành vi tương ứng sang nền tảng mới.

## Cấu trúc tham khảo nếu chọn phương án Render

```text
Trình duyệt học sinh/phụ huynh/giáo viên
                 |
                 | HTTPS cùng origin
                 v
Render: frontend dist + API Node.js /api/online/*
                 |
                 +--> Supabase PostgreSQL hiện có
                 +--> Supabase private Storage hiện có
```

Ưu tiên phục vụ giao diện và API cùng origin để giữ đường gọi tương đối, cookie và CSRF. Chỉ tách ảnh/giao diện sang Cloudflare khi byte tải hoặc chi phí thực tế cho thấy có lợi; lúc đó cần thiết kế routing/proxy phù hợp.

Các bước chuyển dự kiến:

1. Chốt source/build và sao lưu DB/media; không xóa dự án Netlify hoặc Supabase.
2. Tạo entry Node cloud dùng các thành phần API hiện có, lắng nghe `PORT`/`0.0.0.0` theo yêu cầu nền tảng. Giữ IP người gọi đáng tin cho rate limit, cookie, CSRF và security/cache headers.
3. Tạo cấu hình build/start và secrets phía máy chủ. Không đưa secret/service-role key vào frontend. Dùng phiên bản Node tương thích và cách build/đọc module TypeScript đã được kiểm chứng.
4. Dựng URL thử với DB/bucket thử riêng. Kiểm tra đăng nhập, học liệu, audio, hoán vị đáp án, chấm/sao, phụ huynh và giáo viên trước khi trỏ vào dữ liệu đang sử dụng.
5. Với nhu cầu hiện tại, thử hai tài khoản độc lập, đồng thời học và lưu tiến độ; đo RAM/CPU/kết nối DB/media, không lấy mục tiêu 100 phiên làm điều kiện mua máy. Nếu mở rộng sau này mới chạy diễn tập tải lớn.
6. Chuyển domain/public origin trong cửa sổ đã thống nhất; kiểm tra phiên đăng nhập mới, dữ liệu và bản cũ còn mở. Giữ khả năng quay lại môi trường trước khi có đủ bằng chứng.

Các bước này là phạm vi công việc tương lai, không phải thao tác đã thực hiện trong lần tư vấn này. Nếu đổi nền tảng, cập nhật kế hoạch staging/cold-start theo nền tảng mới; số đo Netlify cũ không thay cho nghiệm thu Render hoặc Workers.

## Chi phí Supabase vẫn cần theo dõi riêng

Đổi hosting không làm mất hạn mức DB/media đang dùng. Supabase Free hiện công bố 500 MB DB, 1 GB file storage và 5 GB egress, cùng 5 GB cached egress; project Free có thể bị pause sau một tuần không hoạt động. Nếu cần nâng, Pro công bố từ 25 USD/tháng, tổng thực tế còn phụ thuộc cấu hình/số project và usage. Không lấy số monthly active users của Supabase Auth làm sức chứa hệ thống này: ứng dụng đang có cơ chế đăng nhập riêng. [Giá và hạn mức Supabase](https://supabase.com/pricing).

## Quyết định theo ưu tiên

- **Hiện tại 1–2 người, dùng cá nhân/phi thương mại:** ưu tiên Vercel Hobby + Supabase hiện có, bắt đầu trong hạn mức miễn phí.
- **Chấp nhận đợi Netlify sang kỳ mới:** có thể giữ hosting cũ và kiểm tra nguồn tiêu credit; ít người không đồng nghĩa ít credit khi deploy nhiều. Chưa xem Usage & billing nên chưa kết luận nguyên nhân hết credit của tài khoản.
- **Cần Node không ngủ hoặc muốn chọn gói trả phí:** cân nhắc Render; không mặc định phải mua vì nhu cầu chỉ 1–2 người.
- **Ưu tiên chi phí phục vụ ảnh/giao diện và sẵn sàng chuyển runtime:** thử Cloudflare Workers + Static Assets trước khi cam kết chuyển toàn bộ.
- **Không phù hợp điều kiện Hobby nhưng vẫn muốn thử miễn phí:** Render Free dùng cho demo nếu chấp nhận lần mở đầu chậm; đối chiếu lại cách sử dụng trước khi chọn gói lâu dài.

Nhật ký: đã đối chiếu mã triển khai hiện có và tài liệu chính thức; cập nhật khuyến nghị sau khi người dùng xác nhận chỉ 1–2 người dùng. Chưa mua gói, deploy, chuyển domain, thay mã ứng dụng hoặc kiểm thử tải.
