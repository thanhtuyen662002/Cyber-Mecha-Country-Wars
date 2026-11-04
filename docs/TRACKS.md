# Phát triển song song: nhánh 2D và nhánh 3D

Cập nhật: 04/11/2026

Game được làm song song theo 2 hướng đồ họa để cuối cùng chọn bản đẹp nhất:

| Nhánh | Phụ trách | Công nghệ | Trạng thái |
| --- | --- | --- | --- |
| `track/2d` | Oscar | PixiJS v8 + TypeScript + Vite, đồ họa vẽ 100% bằng code | Đã có bản chơi được v1 (`game/` + `bridge/`) |
| `track/3d` | Bạn của Oscar | Tự chọn, gợi ý Three.js + TypeScript + Vite (xem bên dưới) | Bắt đầu từ tài liệu |

Hai bản dùng **chung luật chơi, chung nguồn sự kiện TikTok và chung tiêu chí chấm**, chỉ khác phần hình ảnh. Nhờ vậy bản nào thắng cũng lên live được ngay, và việc so sánh là công bằng.

## Đọc gì trước

1. [PLAN.md](PLAN.md): kế hoạch tổng, luật chơi, 24 đơn vị và 7 bậc quà, địa hình, thời tiết, camera, ổn định 24/7, lộ trình. Bảng "Đã chốt" ở cuối là các quyết định của Oscar.
2. File này: những gì cả 2 nhánh phải giữ giống nhau.
3. [README của bản 2D v1](https://github.com/thanhtuyen662002/Cyber-Mecha-Country-Wars/blob/track/2d/game/README.md): bản đang chạy làm gì, cách chơi chi tiết, tham số URL. Đây là "bản mẫu" để đối chiếu tính năng.
4. [units/](units/README.md): poster thiết kế 24 đơn vị của bản 2D (hình dáng, màu, vai trò), dùng làm tham chiếu khi dựng model.
5. [ART_PROMPTS.md](ART_PROMPTS.md): mô tả phong cách, góc nhìn, màu từng đơn vị (viết cho ảnh AI, nhánh 2D không dùng nữa, nhánh 3D có thể dùng làm gợi ý concept model).
6. [reference/gemini-prototype/](reference/gemini-prototype/): bản thử đầu tiên làm bằng Gemini. Chỉ để tham khảo ý tưởng, không dùng lại code (nhiều lỗi hiệu năng, xem PLAN.md mục "Hiện trạng").

## Cách dùng nhánh git

- `main`: chỉ chứa tài liệu chung. Ai muốn sửa luật chơi hoặc tài liệu chung thì mở pull request vào `main` để người kia thấy.
- `track/2d`, `track/3d`: mỗi người commit thẳng vào nhánh của mình (hoặc tạo nhánh con rồi PR vào nhánh đó). Không merge 2 nhánh track vào nhau.
- Khi `main` có tài liệu mới: `git merge origin/main` vào nhánh track của mình.
- Code của mỗi nhánh để trong thư mục riêng: 2D là `game/`, 3D nên là `game3d/`, để lỡ sau này gộp chung repo cũng không đụng nhau. `bridge/` dùng chung.

Bắt đầu cho nhánh 3D:

```bash
git clone https://github.com/thanhtuyen662002/Cyber-Mecha-Country-Wars.git
cd Cyber-Mecha-Country-Wars
git checkout track/3d

# Xem bản 2D đang chạy để đối chiếu (cần Node 20+)
git worktree add ../cmcw-2d track/2d
cd ../cmcw-2d/game && npm install && npm run dev   # mở http://localhost:5173/?sim
```

`?sim` bật người xem giả lập, bảng "CMCW operator" ở góc trên trái cho phép bắn quà từng mức, đổi thời tiết, spam 500 quà.

## Hợp đồng chung: cả 2 nhánh phải đạt

### Màn hình và môi trường chạy

- Là 1 trang web chạy làm **Browser source** trong TikTok LIVE Studio (OBS dự phòng), khung dọc **1080 × 1920**, 60 FPS.
- Chạy offline: font, model, texture, âm thanh đóng gói cùng game, không tải từ CDN.
- Máy stream của Oscar: i5 đời 12, RTX 3060 12 GB, 64 GB RAM, chạy chung với TikTok LIVE Studio và TikFinity. Game phải giữ 60 FPS với 250 quân và nhiều hiệu ứng cùng lúc trên máy này.
- Mọi chữ trên màn hình bằng **tiếng Anh** (thị trường Mỹ, Anh, châu Âu). Cờ nước vẽ bằng code hoặc texture, **không dùng emoji cờ** (Windows không hiển thị).

### Nguồn sự kiện TikTok

- Game kết nối `ws://localhost:21213/` (WebSocket của TikFinity), không được thì `ws://localhost:21214/` (bridge dự phòng [`bridge/`](https://github.com/thanhtuyen662002/Cyber-Mecha-Country-Wars/tree/track/2d/bridge) dùng TikTok-Live-Connector). Mất kết nối thì tự thử lại 1, 2, 4… tối đa 30 giây, trong lúc đó quân CPU giữ sân.
- Tin nhắn có dạng `{"event": "gift", "data": {...}}` (chat, gift, like, follow, share). Bản 2D đã viết sẵn bộ chuẩn hóa về 1 kiểu sự kiện chung, xử lý cả combo quà (Rose x20 chỉ tính khi combo kết thúc): [`game/src/net/events.ts`](https://github.com/thanhtuyen662002/Cyber-Mecha-Country-Wars/blob/track/2d/game/src/net/events.ts). Nhánh 3D nên chép nguyên file này cùng `live.ts` và `sim.ts` (giả lập người xem), vì chúng không phụ thuộc PixiJS.
- Chưa kiểm chứng trên máy thật (mốc M0): TikFinity bản miễn phí có mở cổng 21213 không, và giá xu quà thật.

### Luật chơi

Theo PLAN.md và bản 2D v1. Tóm tắt những thứ phải giống:

- Người xem vào phe bằng cách gõ cờ hoặc mã/tên nước (`us`, `uk`, `canada`, `!join de`), nhớ lâu dài, đổi tối đa 1 lần/ngày. Không dùng IP.
- 7 bậc quà theo số xu, ranh giới đọc từ file cấu hình `game/public/config/game.json` (`tierMinCoins: [0, 1, 10, 100, 500, 5000, 30000]`), không viết cứng trong code.
- Đơn vị và hệ khắc chế: bảng trong PLAN.md, bản 2D cài trong [`game/src/core/units.ts`](https://github.com/thanhtuyen662002/Cyber-Mecha-Country-Wars/blob/track/2d/game/src/core/units.ts). Bản ra mắt cần tối thiểu 13 đơn vị trong bảng "Đã chốt".
- Lệnh chat chọn đơn vị: `!tank` `!aa` `!spider` `!drone` `!flame` `!robot` `!bomber`.
- Vòng 15 phút, 60 giây cuối điểm x2, màn vinh danh rồi đổi địa hình. Thời tiết đổi 3–5 phút/lần, báo trước 15 giây.
- HUD: ngai World Emperor (top xu trong ngày), banner SOS khi pháo đài dưới 25%, gợi ý khắc chế, feed hạ gục, bảng điểm các nước.
- Quà không bao giờ bị mất: tặng khi chưa chọn nước thì thành "Lính đánh thuê"; quà to có cut-in và camera zoom theo bậc.
- Quân CPU ghi rõ tên nước, không giả tên người xem.

Phần luật chơi trong bản 2D không phụ thuộc đồ họa, có thể chép sang 3D: `game/src/core/` (cấu hình, quốc gia + nhận diện cờ, đơn vị + khắc chế), `game/src/sim/game.ts` và `players.ts` (luật vòng đấu, người chơi), `game/src/sys/` (lưu IndexedDB, watchdog). Riêng `sim/world.ts` (chiến trường) đang dính PixiJS, cần tách phần mô phỏng ra nếu muốn dùng lại.

### Ổn định 24/7

- Logic chạy nhịp cố định (bản 2D: 30 lần/giây), hình nội suy, không phụ thuộc màn 60 hay 144 Hz.
- Mọi thứ có trần và dùng pool: quân, hạt, đạn, xác xe, âm thanh. Không tạo object mới liên tục trong vòng lặp.
- Lưu trạng thái định kỳ, tải lại trang thì chơi tiếp. Watchdog tự tải lại khi đứng hình, mất WebGL hoặc bộ nhớ quá ngưỡng.
- Hạ chất lượng tự động khi FPS tụt.

Chi tiết từng con số nằm trong PLAN.md mục "Hiệu năng và ổn định 24/7".

## Gợi ý cho nhánh 3D

Đây là gợi ý, người làm 3D tự quyết.

- **Three.js + TypeScript + Vite** hợp nhất: chạy được làm Browser source như bản 2D, chép được nguyên phần sự kiện và luật chơi. Babylon.js cũng được. Unity/Godot bản desktop đẹp nhưng không nhúng trực tiếp làm Browser source, phải quay cửa sổ, nặng và khó treo 24/7 hơn.
- Camera nhìn chéo từ trên (kiểu RTS) để người xem trên điện thoại vẫn đọc được trận trong 1 giây.
- 250 quân cùng lúc: dùng `InstancedMesh` cho các đơn vị giống nhau, model low-poly, ít draw call. Bloom bằng postprocessing nhưng chỉ 1 pass.
- Model: low-poly tự dựng, hoặc asset CC0 (Kenney, Quaternius…). Không dùng model hay âm thanh có bản quyền vì sẽ phát trên TikTok.
- Đặt tham số URL giống bản 2D để chấm cùng cách: `?sim`, `?clean`, `?sound`, `?nolive`, `?lowres`.

## Chấm điểm để chọn bản

Đề xuất: sau khoảng 2–3 tuần, mỗi nhánh có 1 cảnh so tài giống nhau rồi cùng xem trên điện thoại (qua khung 9:16) và đo trên máy stream.

**Cảnh so tài:** 4 nước (US, GB, CA, AU), quân bậc 0 đến bậc 5 (bộ binh, drone, xe tăng, trực thăng, robot, Mecha Titan), 1 địa hình, 1 thời tiết, 1 vụ nổ lớn có cut-in, có âm thanh, chạy bằng `?sim`.

| Tiêu chí | Cách đo |
| --- | --- |
| Đẹp, "đã mắt" | Xem trên điện thoại; quà to có đủ hoành tráng để người xem muốn tặng không |
| Đọc được trong 1 giây | Người lạ nhìn 1 giây có biết phe nào đang thắng, quà nào vừa được tặng không |
| Hiệu năng | FPS với 250 quân + thời tiết trên máy stream, khi chạy chung TikTok LIVE Studio và TikFinity |
| Ổn định | Chạy giả lập dồn dập vài giờ (sau này 72 giờ), bộ nhớ có tăng dần không |
| Dễ thêm nội dung | Thêm 1 đơn vị hoặc 1 địa hình mới mất bao lâu (gói nội dung ra mỗi 2 tuần) |

Bản thắng đi tiếp lên live; ý tưởng hay của bản kia (hiệu ứng, camera) thì chuyển sang.
