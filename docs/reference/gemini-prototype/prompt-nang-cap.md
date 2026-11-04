Role: Bạn là một Senior Game Developer & Technical Artist chuyên làm game Interactive Live trên TikTok (thị trường US/UK).

Dựa trên bản [CURRENT GAMEPLAY & ARCHITECTURE SNAPSHOT] ở trên, tôi muốn bạn viết lại và nâng cấp toàn bộ phần **Đồ họa Nhân vật (Character Rigging), Vũ khí (Weapon Systems), Sân đấu (Arena Environment) và Hiệu ứng (VFX)** trong một file `index.html` duy nhất (sử dụng HTML5 Canvas kết hợp SVG/Procedural Vector Art hoặc PixiJS/Three.js tùy bạn chọn sao cho đẹp nhất).

### VẤN ĐỀ CỦA BẢN HIỆN TẠI:
Các nhân vật hiện tại vẫn đang dựa trên khối hình tròn (circle) gắn thêm lưỡi cưa đơn điệu, sân đấu còn phẳng và hiệu ứng vũ khí chưa đủ độ "cháy" để kích thích người xem nạp tiền (Pay-to-Flex).

### YÊU CẦU NÂNG CẤP CHI TIẾT:

1. THIẾT KẾ LẠI NHÂN VẬT (BỎ HÌNH TRÒN ĐƠN ĐIỆU -> CHUYỂN SANG MULTI-PART MECHA / HERO):
Hãy vẽ nhân vật bằng Procedural Multi-part Vector (nhiều bộ phận ghép lại có chuyển động độc lập: Thân giáp, Vai, Tay cầm vũ khí, Chân/Bánh xích, Đầu/Avatar người chơi):
- **Tier 0 (Free Chat - Cyber Soldier):** Lính bộ binh bọc giáp sắt góc cạnh (Polygon/Hexagon), cầm kiếm năng lượng ngắn chém về phía trước khi va chạm.
- **Tier 1 (Rose 1c - Dual-Chainsaw Berserker):** Robot chiến đấu có 2 cánh tay cơ khí vung 2 thanh đao cưa xích (Chainsaw Swords) chém vung vẩy liên tục, để lại vệt sáng Neon (Slash Trail) sau mỗi nhát chém.
- **Tier 2 (Heart 10c - Heavy Spider Mecha):** Cỗ máy 4 chân nhện cơ khí (procedural walk animation), trên lưng gắn ụ pháo đôi xoay 360 độ độc lập với hướng di chuyển, bắn đạn tên lửa có khói đuổi (Homing Missiles) hoặc pháo Railgun giật lùi nòng súng (recoil animation).
- **Tier 3 (Donut 30c - GIGA COLOSSUS WARLORD):** Một chiến thần giáp Hoàng Kim khổng lồ có đôi cánh năng lượng phát sáng sau lưng, tay cầm Đại Chùy Sấm Sét (Thunder Warhammer). Mỗi khi đập búa xuống đất sẽ tạo ra vết nứt địa chấn (Ground Crack) và sóng xung kích đẩy văng mọi kẻ địch xung quanh. Avatar của người Donate được đóng khung vương miện rực rỡ ngay trước ngực giáp.
- **Tier 4 (Galaxy 1000c - MECHA CYBER DRAGON / CELESTIAL GOD):** Rồng máy khổng lồ uốn lượn nhiều đốt thân (multi-segment procedural spine animation) bay lượn trên toàn bản đồ, phun biển lửa Plasma thiêu rụi kẻ địch và triệu hồi bão thiên thạch.

2. NÂNG CẤP VŨ KHÍ & COMBAT FEEL (JUICINESS):
- Thêm hiệu ứng **Hit-stop (khựng hình 2-3 frame)** và **Directional Knockback** khi vũ khí hạng nặng đập trúng mục tiêu.
- Thêm **Weapon Slash Arcs** (vệt chém hình bán nguyệt phát sáng), vỏ đạn văng ra đất, và hiệu ứng ** Ragdoll / Shatter** (khi lính chết sẽ vỡ tung thành các mảnh giáp sắt và bánh răng văng tứ tung trên sàn đấu rồi mờ dần).
- Thanh máu (HP Bar) của Boss và Căn cứ phải có hiệu ứng "tụt máu trễ" (white damage catch-up bar) giống các game đối kháng AAA.

3. NÂNG CẤP SÂN ĐẤU (INTERACTIVE ARENA & FORTRESSES):
- **4 Căn cứ Quốc gia (Fortresses):** Không vẽ hình tròn nữa. Hãy thiết kế thành 4 Pháo Đài Quân Sự Tương Lai (Cyber Citadel) có tường thành, tháp pháo tự động bắn bảo vệ trụ (Base Defense Turrets), và lõi năng lượng ở giữa. Khi trụ mất máu, pháo đài bốc khói đen và chập điện.
- **Chướng ngại vật & Vùng Buff giữa sân:** Thêm 1 "Lõi Năng Lượng Trung Tâm" (Center Power Core) — phe nào chiếm giữ khu vực giữa sân sẽ được nhận hiệu ứng cuồng nộ (tăng tốc độ đánh + phát sáng).
- Mặt sàn đấu có chiều sâu (hiệu ứng lưới 3D phối cảnh nhẹ, có vết cháy xém hoặc vết nứt lưu lại tạm thời sau các vụ nổ lớn).

4. GIỮ NGUYÊN CÁC TÍNH NĂNG KIẾM TIỀN & SIMULATOR:
- Giữ nguyên khung tỷ lệ 9:16 chuẩn TikTok Live bên trái và Bảng điều khiển giả lập (Simulator Control Panel) bên phải.
- Giữ nguyên Ngai vàng World Emperor, cảnh báo SOS Đỏ khi trụ dưới 25% HP, màn hình cắt cảnh Whale Galaxy, Web Audio Synth và cổng chờ WebSocket (`ws://localhost:8080`).

Hãy viết code hoàn chỉnh, chạy mượt 60FPS, tối ưu hóa hiệu ứng hạt (Particle Pool) để không bị giật lag khi có 100 nhân vật trên màn hình.