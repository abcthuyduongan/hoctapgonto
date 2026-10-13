# Prototype GLB — chưa phải nhân vật chính thức

`fox-guide-prototype.glb` là mô hình tự tạo bằng Python/trimesh, được dùng để kiểm thử đường nạp GLB từ React tới WebGL.

- Quyền sử dụng: OWNED (tài nguyên tự tạo trong dự án).
- Trạng thái: **technical prototype**, chưa có texture PBR, rig hay hoạt ảnh nhân vật.
- Tính năng: mô hình GLB tự chứa, 37 bộ phận, ~10.168 tam giác, màu vật liệu độc lập.
- Không dùng mô hình này làm bằng chứng nghiệm thu chuẩn mỹ thuật cao cấp.
- Khi tải thất bại hoặc chạy Canvas dự phòng, ứng dụng sử dụng cáo thủ tục cũ.

Mã tạo: `tools_generate_fox_glb.py`. Ảnh kiểm tra: `preview/fox-guide-prototype-qa.png`.
