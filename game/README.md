# Cyber Mecha Country Wars: game

Bản game chạy thật (PixiJS v8 + TypeScript + Vite, màn dọc 1080×1920), dựng trên đồ họa vẽ bằng code của [art-lab](../art-lab/README.md). Mọi chữ trên màn hình bằng tiếng Anh cho thị trường phương Tây.

## Chạy thử trên máy

```bash
cd game
npm install
npm run dev            # mở http://localhost:5173
```

- Bảng **CMCW operator** ở góc trên trái dùng để thử: bật người xem giả lập, gửi quà theo từng mức xu, follow, share, like, đổi thời tiết, spam 500 quà, kết thúc vòng.
- `npm run build` tạo thư mục `dist/` chạy offline (không cần mạng, không CDN).
- `npm run build:single` tạo 1 file `dist-single/index.html` để gửi xem nhanh; bản này tự bật người xem giả lập và không kết nối live.


## Đưa lên TikTok LIVE

**Cách nhanh nhất trên Windows:** bấm đúp `start-live.bat` ở thư mục gốc repo. Lần đầu nó tự cài và build, sau đó mở game ở `http://localhost:5173` và (nếu bạn gõ tên TikTok) chạy luôn bridge. Các bước chi tiết bên dưới.

1. Cài và mở **TikFinity** (bản miễn phí), đăng nhập TikTok, bấm kết nối vào phiên live.
2. Chạy game: `npm run build` rồi `npx vite preview --port 5173` (hoặc `npm run dev`).
3. Trong **TikTok LIVE Studio** (hoặc OBS): thêm nguồn **Browser / Link**, URL `http://localhost:5173/?clean&sound`, kích thước **1080 × 1920**.
   - `?clean` ẩn bảng điều khiển. `?sound` bật âm thanh ngay (trình duyệt thường chặn tự phát).
4. Chấm nhỏ góc phải dưới thanh trên cùng: xanh lá = đang nhận sự kiện live, vàng = đang kết nối, đỏ = mất kết nối (game vẫn chạy với quân CPU và tự kết nối lại 1, 2, 4… tối đa 30 giây).

Game tự thử `ws://localhost:21213/` (WebSocket của TikFinity) rồi `ws://localhost:21214/` (bridge dự phòng bên dưới). **Cần kiểm chứng trên máy Oscar (mốc M0):** TikFinity bản miễn phí có mở WebSocket 21213 không, và tên/giá quà thật. Mở bảng operator (bỏ `?clean`) để xem dòng `live … msgs …` và `last:` (tin nhắn thô gần nhất).

### Dự phòng: bridge TikTok-Live-Connector

Nếu TikFinity không mở WebSocket cho app ngoài:

```bash
cd bridge
npm install
npm start -- ten_tiktok_cua_ban     # không cần dấu @
```

Bridge kết nối vào live bằng thư viện mã nguồn mở TikTok-Live-Connector và phát lại sự kiện trên `ws://localhost:21214/` cùng định dạng TikFinity, nên game không cần đổi gì.

## Cách chơi (khớp PLAN.md)

| Hành động người xem | Kết quả |
| --- | --- |
| Gõ cờ (🇺🇸) hoặc mã/tên nước (`us`, `uk`, `canada`, `!join de`) | Vào phe nước đó, nhớ lâu dài; đổi tối đa 1 lần/ngày. Nước mới có người chơi thì pháo đài "hạ cánh" |
| Chat bất kỳ (khi đã chọn nước) | 1 lính súng trường (mỗi người 15 giây/lần) |
| Follow / Share | Lính bắn tỉa / Lính chống tăng |
| 100 like của 1 người | 1 lính; cả phòng đủ 1.000 like thì thả thùng tiếp tế |
| Quà 1–9 xu | Drone tự sát hoặc Lính phun lửa |
| 10–99 | Xe tăng nhẹ, Xe phòng không, Nhện máy |
| 100–499 | Trực thăng tấn công |
| 500–4.999 | Robot chiến đấu hoặc Máy bay ném bom (camera zoom + cut-in) |
| 5.000–29.999 | Mecha Titan (zoom, slow-motion, cut-in toàn màn hình, thùng vàng) |
| từ 30.000 | Oanh tạc chiến lược vào pháo đài mạnh nhất của địch |
| `!tank` `!aa` `!spider` `!drone` `!flame` `!robot` `!bomber` | Chọn trước đơn vị cho món quà kế tiếp của mức đó; không chọn thì game tự gọi đơn vị khắc chế địch |

Quà combo (Rose x20) chỉ tính khi combo kết thúc, gọi tối đa 10 quân, phần dư cộng thành máu. Tặng quà khi chưa chọn nước thì thành "Lính đánh thuê" và được nhắc gõ cờ, quà không bao giờ mất.

Ranh giới mức xu, nước khởi đầu, thời lượng vòng… nằm trong [`public/config/game.json`](public/config/game.json), sửa không cần build lại.

## Vòng lặp giữ chân và kéo donate

- **Trận 5 phút** (`roundSeconds` trong `public/config/game.json`). 60 giây cuối điểm x2 có banner "FINAL MINUTE", 10 giây cuối đếm ngược lớn giữa màn hình.
- **Quỹ chiến tranh (war chest):** mọi xu tặng cho một nước dồn vào thanh dưới cờ nước đó. Mốc 300 / 1.500 / 5.000 / 15.000 xu mở 3 Battle Tank / 2 War Robot / Mecha Titan / Orbital Cannon (`CHEST_GOALS` trong `src/sim/game.ts`).
- **Underdog:** khi nước dẫn đầu có ≥400 điểm và nước yếu nhất dưới 40% điểm đó, nước yếu nhất được khiên pháo đài 45 giây (nhận 50% sát thương), điểm và war chest x1.5.
- **Boss Raid** lúc còn 2:30: Rogue Titan trung lập rơi xuống giữa bản đồ, nước gây nhiều sát thương nhất được +1.500 điểm.
- **Bình chọn thời tiết:** 45–15 giây trước khi đổi thời tiết, chat `!rain !storm !snow !fog !wind !sand !heat !emp` (người có cấp cao được tính nhiều phiếu hơn).
- **Sau mỗi trận:** trang 2 của màn chiến thắng hiện bảng mùa (thắng/xu theo tháng) và Hall of Legends (top người ủng hộ mọi thời đại, cấp được giữ mãi).

## Âm thanh, nhạc và vật lý môi trường

- **Âm thanh thu âm thật (tùy chọn):** bỏ file CC0 vào `public/audio/` và khai báo trong `public/audio/manifest.json` (xem `public/audio/README.md`). Có file thì game dùng file thật (vụ nổ lớn vẫn giữ lớp trầm tổng hợp bên dưới), nhạc thu sẵn chuyển giữa bản êm và bản chiến theo độ căng của trận. Không có file thì dùng âm tổng hợp như dưới.

- **Âm thanh đặt trong chiến trường:** tiếng bên trái màn hình nghe bên tai trái, tiếng ngoài màn hình nhỏ và đục hơn. Mỗi vụ nổ có tiếng nổ chát, cú đấm trầm vào ngực, quả cầu lửa, tiếng ù kéo dài, mảnh kim loại rơi lách cách và tiếng vọng từ hai bên đồi. Nổ cực lớn (Titan chết, pháo đài nổ) làm cả âm thanh đục đi một nhịp kèm tiếng ù tai.
- **Âm thanh mới:** pháo rơi rít trước khi chạm đất, đạn bật khỏi giáp, đạn găm thép, đạn pháo rơi xuống nước, lửa gặp mưa xì hơi. Nền chiến trường xa (pháo và súng máy vọng lại) to dần theo độ căng của trận.
- **Thời tiết đổi màu âm thanh:** mưa, tuyết, sương mù, bão cát làm tiếng nổ đục và xa hơn.
- **Nhạc nền mới** (tự sáng tác, không bản quyền) kiểu nhạc phim chiến tranh, Rê thứ: dàn dây, đoạn dây nảy liên tục, trống taiko, kèn đồng trầm, giai điệu kèn hùng tráng, hợp xướng và tiếng "braam" lớn. Các lớp nhạc vào dần theo số quân và quân lớn trên sân. Phút cuối: nhịp nhanh hơn, lên nửa cung, thêm tiếng đồng hồ tích tắc.
- **Vật lý theo mặt đất** (`src/sim/surface.ts`): tuyết bung trắng và để lại vệt xích sâu, cát bốc cột bụi lâu tan, bùn văng và bám vết, nước dựng cột nước và gợn sóng quanh xe, bê tông tung bụi xám và tia lửa, núi lửa tung tro và than hồng. Xe trên băng trượt ngang để lại vệt trượt. Trời mưa: bánh xe té nước, lửa bốc hơi nước trắng. Nắng nóng: lửa to hơn. Khói và bụi bay theo gió.
- **Thời tiết hiện rõ:** đổi thời tiết hoặc địa hình hiện banner ghi rõ tác động ("All units -25% speed · range -20%"), góc trên luôn ghi tác động hiện tại và mũi tên hướng gió. Quân đổi màu theo thời tiết (phủ sương giá khi bão tuyết, bụi khi bão cát, ướt khi mưa).

## Có gì trong bản này

- **Bản đồ:** 1 màn hình, 12 vị trí pháo đài quanh rìa (pháo đài thu nhỏ khi đông nước), 3 cứ điểm giữa sân: Energy Core (cả phe bắn nhanh hơn 30%), Repair Depot (hồi máu), Factory (tự ra lính mỗi 10 giây). Quá 12 nước thì nước lâu không tương tác nhất "ngủ" và nhường chỗ.
- **24 đơn vị** đủ 7 bậc quà theo PLAN.md (Jeep, Drone sửa chữa, Tăng chủ lực, Pháo phản lực, Xe EMP, Tàu đệm khí, Pháo đài di động, Tàu sân bay drone, Pháo đài bão táp, Pháo quỹ đạo, Rồng Mecha…) với hệ khắc chế (bảng `COUNTER` trong `src/core/units.ts`), pháo đài có súng phòng thủ, quân CPU (ghi rõ tên nước, không giả tên người xem) giữ sân khi chat vắng.
- **8 địa hình** xoay vòng mỗi vòng đấu (rừng, sa mạc làm lún bánh xe và quá nhiệt vũ khí năng lượng, băng trơn, núi lửa có dòng dung nham đốt quân mặt đất, đầm lầy độc, biển đảo với nước làm chậm quân bộ, thành phố đổ nát, khu công nghiệp có kho xăng nổ dây chuyền và cột điện phóng điện), **8 thời tiết** đổi 3–5 phút/lần, báo trước 15 giây, có tác động lên lối chơi (mưa, giông sét, bão tuyết, sương mù, gió mạnh, bão cát giảm tầm và mài giáp, nắng nóng làm quá nhiệt vũ khí năng lượng, bão điện từ làm rơi drone và tăng sức vũ khí năng lượng).
- Giao diện phong cách tương lai (khung kính neon, font Orbitron/Rajdhani đóng gói sẵn), nút **Unit guide** hoặc `?units` để xem cả 24 đơn vị.
- **Vòng 15 phút**, 60 giây cuối "Final Assault" điểm x2, kết thúc sớm khi chỉ còn 1 pháo đài; màn vinh danh 12 giây (nước thắng, top 5, MVP, người ủng hộ nhiều nhất) rồi đổi địa hình.
- **HUD:** Ngai vàng World Emperor (top xu trong ngày) kèm lời kêu gọi giành ngai, đồng hồ, bảng điểm 6 nước, thời tiết + dự báo, banner SOS khi pháo đài dưới 25%, gợi ý khắc chế ("đang bị ném bom, tặng 10+ xu gõ !aa"), kèo "VS" 2 nước đánh nhau nhiều nhất, feed hạ gục, dòng hướng dẫn xoay vòng.
- **Cờ 66 nước vẽ bằng code**, vì cờ emoji không hiển thị trên Windows (TikTok LIVE Studio/OBS).
- **Cấp bậc** Private → Marshal theo tổng xu, màu tên theo cấp.

## Ổn định 24/7

| Cơ chế | Chi tiết |
| --- | --- |
| Vòng lặp cố định | Logic 30 lần/giây, hình nội suy 60 FPS, không phụ thuộc 60/144 Hz |
| Trần số lượng | 250 quân (vượt trần: lính rẻ gộp thành tiểu đội, quân đắt thay lính rẻ cũ nhất), 3.000 hạt, 500 đạn, 60 tia, 30 xác xe, 6 thùng, 16 tiếng âm thanh |
| Pool | Hình đơn vị, tên, thanh máu, đạn, hạt đều tái sử dụng |
| Lưới không gian | Tìm mục tiêu và va chạm chỉ xét ô lân cận |
| Hàng đợi sự kiện | Quà không bao giờ bị bỏ; chat/like quá tải thì bỏ cái cũ; xử lý 8 sự kiện/tick (240/giây) |
| Lưu trạng thái | IndexedDB mỗi 30 giây: vòng đấu, HP pháo đài, điểm, người chơi (tối đa 5.000), thống kê mùa. Tải lại trong 15 phút thì chơi tiếp đúng vòng đó |
| Watchdog | Đứng hình > 5 giây, mất WebGL, lỗi dồn dập: lưu rồi tải lại. Mỗi 6 giờ hoặc bộ nhớ > 1,5 GB: tải lại ở màn vinh danh |
| Chất lượng tự động | FPS < 50 trong 10 giây: giảm hạt một nửa và tắt bloom; FPS ổn định 30 giây thì bật lại |

Tham số URL khác: `?sim` bật người xem giả lập, `?nolive` không kết nối live, `?ws=ws://host:port/` chỉ định nguồn, `?lowres` render 720×1280 cho máy yếu, `?nobloom`, `?round=120` vòng 2 phút để thử, `?reset` xóa dữ liệu đã lưu.

## Chưa làm (các mốc sau)

- Bản đồ lục giác nở ra theo số nước (bản này dùng 12 vị trí trên 1 màn hình), tiền đồn cho nước ngủ.
- Lưới nguyên tố (cháy lan, đóng băng, giật điện qua nước, axit, nổ metan), nhà phá hủy được.
- Skin/khung tên theo cấp bậc, avatar người tặng (bình chọn thời tiết, Boss Raid, bảng mùa đã có, xem mục trên).
- Âm thanh file thật nếu cần (hiện là âm tổng hợp bằng code), đo FPS và soak test 72 giờ trên máy stream.

## Cấu trúc

```
src/
  main.ts            ghép mọi thứ: vòng lặp, camera đạo diễn, hiệu ứng, watchdog
  core/              hằng số, quốc gia + nhận diện cờ/mã nước, đơn vị + khắc chế + mức quà
  draw/              đồ họa vẽ bằng code (đơn vị, cờ, địa hình, texture hiệu ứng)
  fx/                hạt, thời tiết, âm thanh (từ art-lab)
  net/               chuẩn hóa sự kiện TikFinity/TikTok-Live-Connector, kết nối WebSocket, giả lập
  sim/               chiến trường (world.ts), luật chơi (game.ts), người chơi, hình đơn vị
  sys/               lưu IndexedDB, watchdog
  ui/                HUD trên stream, bảng operator
../bridge/           TikTok-Live-Connector → ws://localhost:21214
```
