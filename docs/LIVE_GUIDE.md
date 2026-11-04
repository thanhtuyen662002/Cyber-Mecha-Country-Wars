# Hướng dẫn live Cyber Mecha Country Wars

Bản gốc (sửa được): https://claude.ai/artifact/X12u4JvWbaYFWhUBvbb2TT · cập nhật 2026-11-04

## 1. Chuẩn bị một lần

Làm các bước này một lần trên máy stream (i5 12th, RTX 3060). Sau đó mỗi buổi live chỉ cần làm theo mục 2.

- [ ] Cài **Node.js LTS** từ nodejs.org (bản 20 trở lên). Mở PowerShell, gõ `node -v` để kiểm tra.
- [ ] Lấy code mới nhất: trong `D:\Projects\Games\Cyber-Mecha-Country-Wars` chạy `git checkout track/2d` rồi `git pull`.
- [ ] Cài **TikTok LIVE Studio** (hoặc OBS Studio làm dự phòng).
- [ ] Tài khoản TikTok phải đủ điều kiện **LIVE và nhận quà**: từ 18 tuổi, đủ số follower TikTok yêu cầu ở khu vực của bạn (thường là 1.000), không bị hạn chế. Kiểm tra trong app: Hồ sơ > Cài đặt > LIVE.
- [ ] (Nên có) Cài **TikFinity** bản miễn phí, đăng nhập TikTok. Nếu TikFinity không mở được WebSocket cổng 21213 thì dùng bridge có sẵn trong repo (mục 2, cách B). Bridge đã chạy thử thành công với một kênh đang live.
- [ ] Chạy thử `start-live.bat` một lần để nó tự cài thư viện và build. Lần đầu mất vài phút.
- [ ] Cài Windows: tắt chế độ ngủ và tắt màn hình tự tắt khi đang cắm điện. Trong Chrome/Edge, tắt "Memory Saver" hoặc "Efficiency mode" để tab game không bị làm chậm.

## 2. Mỗi buổi live

Cả quy trình mất khoảng 5 phút. Làm đúng thứ tự: nguồn sự kiện, game, phần mềm live, rồi mới bấm Go LIVE.

1. **Mở nguồn sự kiện**, chọn một trong hai cách:
   - **Cách A, TikFinity:** mở TikFinity, đăng nhập, bấm kết nối vào tài khoản của bạn. Game tự tìm `ws://localhost:21213`.
   - **Cách B, bridge:** khi chạy `start-live.bat` ở bước 2, gõ tên TikTok của bạn (không có @). Bridge chỉ kết nối được khi bạn **đã bắt đầu live**. Trước đó nó sẽ tự thử lại, đó là bình thường.
2. **Bấm đúp `start-live.bat`.** Nếu dùng TikFinity thì bấm Enter, không gõ tên. Sẽ có cửa sổ "CMCW game" chạy game ở `http://localhost:5173`. Đừng tắt cửa sổ này trong lúc live.
3. **Kiểm tra trước trên trình duyệt:** mở `http://localhost:5173/`, bấm vào màn hình một lần để bật tiếng, xem bảng operator. Chấm tròn dưới thanh trên cùng: xanh lá là đang nhận sự kiện, vàng là đang kết nối, đỏ là mất kết nối. Khi đỏ, game vẫn chạy bằng quân máy.
4. **Thêm nguồn vào TikTok LIVE Studio** (chỉ cần làm lần đầu, những lần sau nguồn vẫn còn):
   - Thêm nguồn **Link / Browser**, URL `http://localhost:5173/?clean&sound`, kích thước **1080 × 1920**, khung dọc.
   - `?clean` ẩn bảng điều khiển. `?sound` bật tiếng mà không cần bấm.
   - Bật **Control audio via OBS / Capture audio** để tiếng game vào stream. Đặt micro của bạn cao hơn tiếng game một chút.
5. **Go LIVE.** Nếu dùng bridge, sau khoảng 10–30 giây cửa sổ bridge sẽ hiện `connected to @tên_bạn`.
6. **Thử ngay trong 1 phút đầu:** nhờ bạn bè hoặc chính bạn bằng tài khoản phụ gõ `us` trong chat. Khi đó lá cờ nhảy vào sân và có lính xuất hiện. Thả một bông hồng (1 xu) để thấy drone. Nếu không có gì xảy ra, xem mục 6.

Kết thúc buổi live: bấm End LIVE trước, sau đó mới đóng các cửa sổ game và bridge. Game tự lưu mỗi 30 giây. Mở lại trong vòng 15 phút thì chơi tiếp đúng trận đó.

## 3. Người xem chơi thế nào

Muốn tham gia, người xem chỉ cần gõ tên nước. Quà càng to thì quân càng mạnh. Cần nhắc đi nhắc lại hai ý này suốt buổi live.

| Người xem làm gì | Trong game |
| --- | --- |
| Gõ cờ hoặc mã nước (`us`, `uk`, `canada`, `!join de`) | Vào phe nước đó. Game nhớ lâu dài, mỗi ngày đổi được tối đa 1 lần |
| Chat bất kỳ (khi đã có nước) | 1 lính bộ binh, mỗi người 15 giây được 1 lần |
| Follow | Lính bắn tỉa |
| Share | Lính chống tăng. Cả phòng đủ 10 lượt share thì thả thùng tiếp tế |
| 100 like (của 1 người) | 1 lính. Cả phòng đủ 1.000 like thì thả thùng tiếp tế |
| Quà 1–9 xu | Drone tự sát, lính phun lửa, xe jeep |
| Quà 10–99 xu | Xe tăng, xe phòng không, nhện máy, drone sửa chữa |
| Quà 100–499 xu | Trực thăng, tăng chủ lực, pháo phản lực, xe EMP |
| Quà 500–4.999 xu | Robot chiến đấu, máy bay ném bom, tàu đệm khí, pháo đài di động, kèm cảnh quay riêng |
| Quà 5.000–29.999 xu | Mecha Titan, tàu sân bay drone, pháo đài bão táp, kèm cảnh quay toàn màn hình |
| Quà từ 30.000 xu | Oanh tạc chiến lược, pháo quỹ đạo, rồng Mecha |
| `!tank` `!aa` `!spider` `!robot` `!bomber`... | Chọn trước loại quân cho món quà kế tiếp. Không chọn thì game tự gọi loại khắc chế địch |
| `!rain` `!snow` `!sand`... (khi đang bình chọn) | Bình chọn thời tiết tiếp theo. Chỉ hiện các lệnh hợp với địa hình |

Các mốc kéo quà trong mỗi trận 5 phút: **rương chiến** của mỗi nước (300 / 1.500 / 5.000 / 15.000 xu), **Boss Raid** lúc còn 2:30, **phút cuối điểm x2**, và **khiên cứu viện** cho nước đang thua xa. Combo quà (ví dụ Rose x20) được tính khi combo kết thúc. Tặng quà khi chưa chọn nước vẫn không mất, quân vào phe "lính đánh thuê".

Các mốc xu nằm trong `game/public/config/game.json`. Sửa file này không cần build lại, chỉ cần tải lại trang game.

## 4. Kịch bản dẫn live và giờ live

Quà đến từ cảm xúc "nước tôi đang thua" hoặc "tôi muốn tên mình lên màn hình". Người dẫn nói tiếng Anh, ngắn gọn, nói theo những gì đang diễn ra trên sân.

**Giờ live:** khán giả chính là Mỹ và châu Âu. Giờ vàng là 19:00–23:00 giờ Mỹ miền Đông, tức 7:00–11:00 sáng Việt Nam (6:00–10:00 khi Mỹ dùng giờ mùa hè). Khung thứ hai là buổi tối châu Âu, khoảng 1:00–4:00 sáng Việt Nam. Hai tuần đầu nên live 2–3 giờ mỗi buổi, có người dẫn.

**Nhịp của một trận 5 phút:**

| Lúc | Nói gì (ví dụ) |
| --- | --- |
| Đầu trận | "New battle on the ice field! Type your country to join, us, uk, de, br..." |
| Có người mới vào | "Welcome @name, Germany is on the map!" (gọi tên người xem là cách giữ chân tốt nhất) |
| Pháo đài bị đánh, hiện SOS | "Canada's fortress is at 20%! One rose sends a drone, 100 coins sends a helicopter!" |
| Rương chiến gần đầy | "USA is 40 coins from three battle tanks!" |
| Còn 2:30 | "Boss raid! Whoever hits the Rogue Titan hardest gets 1,500 points!" |
| Phút cuối | "Final minute, double points! Last chance to flip the board!" |
| Có quà to | Cảm ơn bằng tên, nói tên quân vừa gọi: "@name just dropped a MECHA TITAN for Brazil!" |
| Kết thúc | Đọc nước thắng, MVP, người ủng hộ nhiều nhất, nhắc ngôi World Emperor |

**Nên và không nên:**

- Nên mời bạn bè vào những phút đầu để sân không trống. Quân máy ghi rõ tên nước, không giả làm người xem.
- Nên cắt clip các cảnh Titan, rồng, pháo quỹ đạo để đăng video ngắn kéo người vào live.
- Không hứa đổi quà lấy tiền hay phần thưởng ngoài game, và không dùng chữ "cá cược". TikTok cấm nội dung giống cờ bạc.
- Không để live tự chạy nhiều giờ mà không có người. TikTok có thể đánh dấu là nội dung không tương tác và giảm lượt đề xuất.

## 5. Bảng điều khiển operator và tham số URL

Mở `http://localhost:5173/` trên trình duyệt riêng, không có `?clean`, để điều khiển game trong lúc live. Bản trong LIVE Studio vẫn sạch vì chạy với `?clean`. Lưu ý: đây là hai tab riêng nên mỗi tab chạy một trận riêng. Chỉ dùng bảng operator để xem số liệu hoặc thử, còn đổi thời tiết hay địa hình thì làm ngay trong nguồn của LIVE Studio (chuột phải > Interact) bằng URL không có `?clean`.

Bảng operator có: trạng thái live (số tin nhắn nhận được, tin cuối cùng), gọi quân bất kỳ cho một nước, đổi thời tiết, đổi địa hình (bắt đầu trận mới), bật tắt bloom và âm thanh.

| Tham số | Tác dụng |
| --- | --- |
| `?clean` | Ẩn bảng điều khiển (dùng cho LIVE Studio/OBS) |
| `?sound` | Bật tiếng ngay, không cần bấm |
| `?mute` | Không phát tiếng |
| `?sim` | Người xem giả lập, để thử khi chưa live |
| `?nolive` | Không kết nối TikFinity hay bridge |
| `?ws=ws://host:port/` | Chỉ định nguồn sự kiện khác |
| `?lowres` | Render 720 × 1280 cho máy yếu |
| `?nobloom` | Tắt hiệu ứng phát sáng |
| `?round=120` | Trận 2 phút, để thử |
| `?units` | Mở bảng giới thiệu 24 đơn vị |
| `?reset` | Xóa dữ liệu đã lưu (điểm, người chơi, mùa), cẩn thận |

Các tham số nối bằng `&`, ví dụ `http://localhost:5173/?clean&sound&lowres`.

## 6. Xử lý sự cố

Gặp sự cố thì xem chấm trạng thái trên game và cửa sổ bridge trước. Gần như mọi lỗi đều nằm ở khâu kết nối, không phải ở game.

| Hiện tượng | Cách xử lý |
| --- | --- |
| Người xem chat mà không có gì xảy ra, chấm đỏ | Bridge chưa kết nối. Xem cửa sổ bridge: nếu đang "retrying" thì chờ 30 giây sau khi Go LIVE. Kiểm tra tên TikTok đã gõ đúng, không có @ |
| Bridge báo "requires a Business plan" | Mở `bridge` > kiểm tra không đặt biến `EXTENDED_GIFTS=1`. Mặc định đã tắt |
| Bridge báo bị giới hạn (rate limit) | Đăng ký khóa miễn phí tại eulerstream.com, chạy bridge với biến `EULER_API_KEY`. Hoặc chuyển sang TikFinity |
| Chat chạy nhưng quà ra sai loại quân | Xem tin cuối cùng trong bảng operator để biết số xu thật của quà, rồi chỉnh `tierMinCoins` trong `game/public/config/game.json` |
| Không có tiếng trên stream | Kiểm tra URL có `&sound`, và đã bật Capture audio cho nguồn trong LIVE Studio |
| Giật, FPS thấp | Game tự giảm hiệu ứng khi dưới 50 FPS. Nếu vẫn giật, thêm `&lowres` hoặc `&nobloom` |
| Game tự tải lại | Bình thường: watchdog tải lại khi treo quá 5 giây hoặc sau 6 giờ, và chơi tiếp đúng trận. Nếu xảy ra liên tục thì chụp màn hình console (F12) gửi mình |
| `start-live.bat` báo thiếu Node.js | Cài Node.js LTS rồi chạy lại |
| Cổng 5173 đang bận | Game cũ còn chạy. Đóng cửa sổ "CMCW game" cũ hoặc khởi động lại máy |

## 7. Sau buổi live: ghi số liệu

Ghi mỗi buổi một dòng vào bảng dưới. Sau 1–2 tuần, mình dựa vào số liệu này để chỉnh mốc xu, độ dài trận và giờ live. Số người xem và xu lấy trong phần tổng kết LIVE của TikTok sau khi kết thúc.

| Ngày | Giờ (VN) | Thời lượng (giờ) | Người xem đỉnh | Thời gian xem TB (phút) | Tổng xu | Quà được tặng nhiều nhất | Ghi chú (lỗi, điều người xem hỏi) |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |  |
