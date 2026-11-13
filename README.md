# P1 — Formula 1 Racing Simulator

Created & Engineered by **Shlok Vij**

**P1** is a high-performance 3D Formula 1 racing simulator built with React and Three.js. Designed for both mobile and desktop, it puts you in the cockpit of the championship **Red Bull #1 (Blue Car)** against 6 elite constructor teams across a full 5-lap Grand Prix.

---

## 🏎️ Features

- **Red Bull #1 Livery**: Iconic matte midnight blue chassis, crimson racing bull streaks, radiant yellow nose cone, and championship #1 decals.
- **Sun-Drenched Dynamic Lighting**: Enhanced illumination with ACES Filmic tone mapping, vibrant skies, radiant sunlight, and atmospheric weather transitions (Clear, Overcast, Storm).
- **Mobile First & Touch Ready**: Ergonomic touch controls tailored for mobile thumbs:
  - Responsive Left/Right steering pads
  - Dedicated Throttle (`GAS`) and Brake (`BRAKE`) pedals
  - Quick-action buttons for `DRS`, `ERS`, `CAM` (camera switch), and `⏸` (pause)
  - Haptic feedback and automatic mobile orientation assistance
- **Constructor Grid**: Battle wheel-to-wheel against Ferrari, Mercedes, McLaren, Aston Martin, Williams, and Alpine.
- **Telemetry & Setup Strategy**: Chief Engineer Shlok Vij setup profiles:
  - `P1 QUALIFYING SPEC` (Maximum downforce & bite)
  - `P1 GRAND PRIX CRAFT` (Tyre management & ERS harvest)
  - `P1 WET WEATHER INTEL` (Mechanical grip & rain balance)
- **Dynamic Systems**: Live DRS zones, energy recovery (ERS boost), slipstream drafting, tyre degradation, and lap time telemetry.

---

## 🎮 Controls

### Mobile
| Control | Action |
| --- | --- |
| `◀` / `▶` | Steer Left / Right |
| `▲ GAS` | Throttle / Accelerate |
| `▼ BRAKE` | Brake / Reverse |
| `DRS` | Open Drag Reduction System in DRS zones |
| `ERS` | Deploy hybrid battery electric boost |
| `CAM` | Toggle Chase, Cockpit, and Broadcast cameras |
| `⏸` | Pause race & access pit menu |

### Desktop / Keyboard
| Key | Action |
| --- | --- |
| `W` or `Up Arrow` | Accelerate |
| `S` or `Down Arrow` | Brake / Reverse |
| `A` / `D` or `Left` / `Right` | Steer |
| `Shift` | Open DRS (when inside zone) |
| `F` | Deploy ERS |
| `Space` | Handbrake / Drift |
| `C` | Change Camera View |
| `Esc` | Pause Race |

---

## 🛠️ Tech Stack

- **React 19**
- **Three.js** (WebGL 3D Rendering, ACES Filmic Tone Mapping)
- **Web Audio API** (Synthesized V6 Turbo-Hybrid engine and wind audio)
- **Responsive Touch Engine** (Pointer Events, touch action optimization)

---

## 🚀 Getting Started

```bash
# Clone the repository
git clone https://github.com/shlokvij/p1.git
cd p1

# Install dependencies
npm install --legacy-peer-deps

# Start the local development server
npm start

# Build for production
npm run build
```

---

## 🏁 Credits

Developed and engineered with passion by **Shlok Vij**.
