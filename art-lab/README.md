# Art Lab: thử nghiệm đồ họa Cyber Mecha Country Wars

Cảnh thử nghiệm (PixiJS v8 + TypeScript + Vite, màn dọc 1080×1920) để so sánh 2 cách làm đồ họa trước khi chốt:

- **A · Code-drawn:** đơn vị, pháo đài, địa hình vẽ vector bằng code, "nướng" thành texture lúc khởi động. Mỗi đơn vị gồm nhiều bộ phận chuyển động riêng, tô màu theo nước khi chạy.
- **B · Images:** mỗi đơn vị/địa hình là 1 ảnh PNG (AI hoặc gói CC0) bỏ vào `public/art/`. Prompt và tên file: [docs/ART_PROMPTS.md](../docs/ART_PROMPTS.md).

Đây chưa phải code game thật (logic trận đấu chỉ đủ để thấy đồ họa chuyển động).

## Chạy thử

```bash
cd art-lab
npm install
npm run dev        # mở http://localhost:5173
```

`npm run build:single` tạo 1 file HTML duy nhất ở `dist-single/index.html` để gửi xem nhanh (bản này không có ảnh B).

## Có gì trong demo

| Nhóm | Nội dung |
| --- | --- |
| Đơn vị (6) | Bộ binh, Drone tự sát, Xe tăng nhẹ (tháp pháo xoay riêng, xích chạy, vết xích), Nhện máy (robot 4 chân thủy lực, tháp pháo đôi xoay riêng), Trực thăng (cánh quạt, đuôi, bóng đổ xa), Mecha Titan (bước chân, lõi phát sáng, tia railgun, loạt tên lửa) |
| Pháo đài | Lục giác, 6 tháp góc, lõi phát sáng, khiên năng lượng; bị phá thì nổ lớn rồi dựng lại |
| Địa hình (4) | Mỗi bản đồ có thêm đồ vật: hố bom, bao cát, chướng ngại chống tăng, dây thép gai, thùng hàng, viền tối. Rừng rậm (phế tích đá, boongke, đá rêu, khúc gỗ, bụi cây, tán cây đung đưa, tia nắng, đom đóm), Băng (thông phủ tuyết, trạm nghiên cứu, bồn nhiên liệu, hồ băng nứt, ánh lóe, đơn vị trượt), Đầm lầy độc (cây chết, xác mech chìm, đường ống, thùng độc, lau sậy, hồ phát sáng bằng shader GLSL, bong bóng, hơi độc), Thành phố đổ nát (đường, nhà sập, mái có máy lạnh, pin mặt trời, bãi trực thăng, chốt chặn ở ngã tư, đèn pha quét, xe cháy, lửa, biển neon nhấp nháy) |
| Thời tiết (5) | Mưa lớn (giọt + bắn nước), Giông sét (tia sét đánh vào đơn vị cao nhất, chớp màn hình, sấm), Bão tuyết, Sương mù, Gió mạnh (vệt gió, lá bay, khói và máy bay bị đẩy) |
| Hiệu ứng | Nổ nhiều tầng theo bậc (chớp sáng, cầu lửa đổi màu, tia lửa, mảnh văng có độ cao, vòng bụi, cột khói bốc lên, tàn lửa, nổ phụ, sóng nhiệt, chớp màn hình, hố bom), chớp nòng, đạn vạch, laser, tên lửa có khói, xác xe cháy, vết cháy lưu trên đất, rung màn hình, hit-stop, bloom toàn màn hình, shockwave |
| Khoảnh khắc donate | Gọi Titan: camera zoom, slow-motion, băng rôn cut-in kèm tên người tặng |
| Âm thanh, nhạc | Tổng hợp bằng Web Audio (bật nút Sound): hiệu ứng giới hạn 16 tiếng cùng lúc, nhạc nền chiến đấu Rê thứ 132 BPM tự mạnh dần theo trận (đông quân thêm trống, có Titan thêm trống taiko) |
| Kiểm tra tải | Nút "Stress: fill to 250 units", bộ đếm FPS/hạt, tự giảm hạt khi FPS < 50 |

## Bảng điều khiển

Góc trên trái: chọn Battle hoặc Side-by-side gallery (A và B đặt cạnh nhau), nguồn đồ họa A/B, địa hình, thời tiết, gọi từng đơn vị cho từng phe, siêu vũ khí, sét, bật tắt bloom và âm thanh.

Tham số URL: `?clean` ẩn bảng điều khiển (để quay hoặc cho vào OBS), `?skin=image`, `?terrain=swamp`, `?weather=storm`, `?view=gallery`, `?nobloom`.

## Cấu trúc

```
src/
  config.ts            hằng số, chỉ số đơn vị, phe
  draw/units.ts        vẽ vector 6 đơn vị + pháo đài (3 lớp: kim loại, sơn phe, neon)
  draw/terrain.ts      sinh địa hình (noise + vẽ canvas) + lớp động + shader hồ độc
  draw/fxTextures.ts   texture hiệu ứng (glow, khói, tia lửa, vết cháy...)
  draw/imageArt.ts     nạp ảnh phương án B, thiếu thì hiện khung MISSING IMAGE
  fx/particles.ts      hệ hạt dùng pool cố định 3.000 hạt
  fx/weather.ts        lớp thời tiết toàn màn hình
  fx/sfx.ts            âm thanh tổng hợp
  game/visuals.ts      lắp bộ phận thành đơn vị cho skin A hoặc B
  game/battle.ts       trận đấu tối giản để mọi thứ chuyển động
  main.ts              camera, HUD, gallery, bảng điều khiển
```
