# CURRENT GAMEPLAY & ARCHITECTURE SNAPSHOT (v2.0)

## 1. Layout & Viewport (9:16 Vertical - 460x818px)
- **Top HUD (Z-index 20):** 
  - Live Timer, Round Counter, Audio Toggle, Country Win Scoreboard.
  - **World Emperor Throne Banner:** Displays #1 Top Donator (Avatar, Username, Country Flag, Total Coins) + Call-to-action prompt ("Send Donut/Galaxy to Steal Throne").
  - **SOS Emergency Overlay:** Red pulsing border + siren alert triggered when any Country Base HP drops below 25%.
- **Main Battle Arena (HTML5 Canvas - 60FPS Physics Engine):**
  - **4 Corner Fortresses (Bases):** USA (Top-Left, Blue), UK (Top-Right, Pink), Brazil (Bottom-Left, Green), Japan (Bottom-Right, Gold). Each base has 5,000 Max HP, regenerating shield rings, and takes siege damage on collision.
  - **Center Contested Zone:** Cybernetic grid with rotating radar rings and shockwave propagation.
- **Bottom HUD (Z-index 20):**
  - Live Kill/Event Feed (4 latest actions).
  - **4-Tier Gift Menu Dock:** Visual pricing cards showing exact TikTok Gifts (Chat = Free, Rose = 1c, Heart = 10c, Donut = 30c, Galaxy = 1000c).
- **Cinematic Overlay (Z-index 40):** Full-screen golden VIP Cut-in banner + Orbital Laser Beams when a Whale sends a Galaxy.

## 2. Current Unit Tiers & Mechanics (Need Visual Overhaul)
- **Tier 0 (Free Chat):** Basic Drone (35 HP, small radius, basic collision).
- **Tier 1 (Rose - 1 Coin):** Sawblade Mech (160 HP, 3 rotating outer sawblades that shred Tier 0 units on contact, spark particles).
- **Tier 2 (Heart - 10 Coins):** Plasma Tank (450 HP, long-range auto-targeting laser beam every 45 frames, heavy knockback).
- **Tier 3 (Donut - 30 Coins):** Giga Titan Boss (2,500 HP, 6 blades, heals friendly base +500 HP on spawn, displays floating Boss HP bar & Donator Nameplate).
- **Tier 4 (Galaxy - 1000 Coins):** God Dragon / Orbital Nuke (8,000 HP, triggers screen-wide orbital laser strike dealing -1,400 HP to all enemy bases, spawns dual-ringed golden mega boss).

## 3. Existing Technical Hooks
- Built-in Web Audio API Synthesizer (saw/laser/siren/explosion SFX).
- Built-in WebSocket client (`ws://localhost:8080`) listening for `{ type, country, user, gift }`.
- External Simulator Control Panel on the right side for instant 1-click testing.