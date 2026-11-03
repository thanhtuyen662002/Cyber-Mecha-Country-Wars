# Prompt tạo ảnh cho Art Lab (phương án B: đồ họa bằng ảnh)

Cập nhật: 03/11/2026 · Dùng cho demo `art-lab/` (xem [art-lab/README.md](../art-lab/README.md))

Phương án A (vẽ bằng code) đã có sẵn trong demo. Phương án B cần ảnh do Oscar tạo bằng Midjourney hoặc Leonardo theo các prompt dưới đây. Tạo xong, bỏ file PNG vào `art-lab/public/art/` đúng tên, tải lại trang là demo tự dùng ảnh. Thiếu file nào thì demo hiện khung hồng "MISSING IMAGE" ở đúng chỗ đó.

## Quy tắc chung cho mọi ảnh đơn vị

1. **Góc nhìn:** thẳng từ trên xuống (top-down), không phối cảnh. Đây là điều AI hay làm sai nhất; ảnh nghiêng 3/4 sẽ trông lệch khi đơn vị xoay trong game.
2. **Hướng:** đầu đơn vị (nòng súng, mũi máy bay) **chĩa lên trên** mép ảnh. Game tự xoay theo hướng di chuyển.
3. **Nền trong suốt:** Leonardo bật "Transparency". Midjourney không làm nền trong suốt, nên tạo trên nền trơn rồi xóa nền bằng remove.bg, Photoshop hoặc công cụ xóa nền của Leonardo.
4. **Kích thước:** tạo 1024×1024, xuất PNG. Không cần thu nhỏ, demo tự co về đúng cỡ.
5. **Màu phe:** tạo bản **xám kim loại + đèn neon xanh cyan**. Ảnh đầy màu không đổi được sang màu nước khác như bản vẽ code, nên đây là một điểm cần so sánh (xem cuối trang).
6. **Một ảnh, một đơn vị.** Không chữ, không logo, không nền cảnh vật.

Đuôi prompt dùng chung (dán sau mỗi prompt đơn vị):

```
top-down orthographic view seen from directly above, single game sprite, centered, facing up toward the top edge, sci-fi military with cyberpunk neon accents, gunmetal grey armor plates with glowing cyan light strips, crisp clean silhouette readable at small size, soft ambient occlusion, studio lighting from top-left, isolated on plain flat background, no ground, no cast shadow, no text, no logo
```

Midjourney thêm: `--ar 1:1 --style raw --v 7 --no perspective, isometric, scenery, text, watermark, people`

Leonardo: model Phoenix hoặc Lightning XL, preset "Game Asset" hoặc "Concept Art", bật Transparency, tỷ lệ 1:1.

## Danh sách ảnh cần tạo

| File (đặt trong `art-lab/public/art/`) | Đơn vị | Prompt (trước đuôi chung) |
| --- | --- | --- |
| `unit_infantry.png` | Bộ binh (bậc 0) | `a futuristic infantry soldier in power armor holding a rifle pointing forward, helmet with glowing visor, small backpack` |
| `unit_drone.png` | Drone tự sát (bậc 1) | `a compact quadcopter kamikaze drone with four rotors in an X frame and a warhead nose, glowing sensor eye` |
| `unit_tank.png` | Xe tăng nhẹ (bậc 2) | `a light battle tank with two tracks, angular armored hull, rotating turret with a long cannon pointing forward, glowing headlights and engine vents` |
| `unit_spider.png` | Nhện máy (bậc 3) | `a six-legged spider mech walker, armored abdomen and thorax, cluster of glowing sensor eyes, twin laser emitters at the front, legs spread out symmetrically` |
| `unit_heli.png` | Trực thăng tấn công (bậc 3) | `an attack helicopter gunship with stub wings carrying rocket pods, tandem cockpit canopy, tail boom, main rotor blades visible as four thin blades` |
| `unit_titan.png` | Mecha Titan (bậc 5) | `a colossal bipedal mecha titan seen from above, massive shoulder armor, two long shoulder railgun cannons pointing forward, gatling arms, glowing reactor core in the chest, heavy feet` |
| `fortress.png` | Pháo đài quốc gia | `a hexagonal sci-fi military fortress base, thick armored walls, six corner gun turrets, central reactor keep with glowing core, landing pad markings` (không cần "facing up") |

### Ảnh nền địa hình (tile lặp)

Địa hình là ảnh vuông lặp lại (seamless) phủ cả màn hình. Không cần nền trong suốt. Midjourney thêm `--tile --ar 1:1 --v 7`; Leonardo bật "Tiling".

Đuôi prompt cho địa hình:

```
seamless tileable texture, top-down satellite view of the ground, game map background, muted desaturated colors so units stand out, no buildings in the center, no text, even lighting
```

| File | Địa hình | Prompt (trước đuôi địa hình) |
| --- | --- | --- |
| `terrain_jungle.png` | Rừng rậm | `dense tropical jungle floor, dark green foliage, ferns, muddy dirt patches, scattered tree canopies` |
| `terrain_ice.png` | Băng tuyết | `frozen tundra, cracked blue ice sheets, packed snow, scattered icy rocks` |
| `terrain_swamp.png` | Đầm lầy độc | `toxic swamp, murky dark mud, pools of glowing radioactive green liquid, dead tree stumps, rusted barrels` |
| `terrain_city.png` | Thành phố đổ nát | `ruined city blocks after war, cracked asphalt roads with lane markings, collapsed rooftops, rubble, burned cars` |

## Gợi ý khi tạo

- Mỗi prompt tạo 4 biến thể, chọn ảnh có hình dáng rõ nhất khi thu nhỏ (nheo mắt nhìn ảnh nhỏ cỡ đầu ngón tay; đó là cỡ thật trên điện thoại người xem).
- Đơn vị bậc cao (Titan, Pháo đài) đáng đầu tư nhiều lượt nhất, vì đó là thứ người xem trả nhiều tiền để thấy.
- Nếu AI vẫn vẽ nghiêng, thêm `blueprint-like top view, flat lay` vào đầu prompt.

## So sánh A và B: những gì cần xem

| Tiêu chí | A: vẽ bằng code | B: ảnh AI |
| --- | --- | --- |
| Độ chi tiết, "đã mắt" khi đứng yên | Gọn, phẳng, kiểu đồ họa vector neon | Thường đẹp và nhiều chi tiết hơn |
| Chuyển động | Có rig: chân nhện bước, cánh quạt quay, tháp pháo xoay riêng, Titan bước chân | Một khối cứng: chỉ xoay, nhún, thêm vệt cánh quạt bằng code |
| Màu theo nước | Tự đổi màu cho mọi nước, không tốn thêm ảnh | Phải tạo thêm ảnh hoặc đổi sắc độ (dễ lệch màu) |
| Đọc được trên điện thoại | Kiểm soát được: viền rõ, đèn neon theo màu phe | Tùy ảnh; ảnh nhiều chi tiết dễ thành "nhiễu" khi nhỏ |
| Thời gian thêm đơn vị mới | Claude vẽ, không cần Oscar | Oscar tạo prompt, chọn ảnh, xóa nền, kiểm tra |
| Hiệu năng | Như nhau (đều là texture trên GPU) | Như nhau |
| Bản quyền | Không vấn đề | Kiểm tra điều khoản thương mại của gói Midjourney/Leonardo đang dùng |

Hướng kết hợp đã bàn trong kế hoạch: đơn vị nhỏ và địa hình vẽ bằng code, đơn vị bậc cao, pháo đài, ảnh nền dùng ảnh AI. Demo cho phép xem cả hai trên cùng màn hình để Oscar chốt.
