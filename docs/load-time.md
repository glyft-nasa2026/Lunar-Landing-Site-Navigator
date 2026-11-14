# Load time on the real data (T27)

How long a judge waits on darksight.space with the real data. The numbers are measured in a
browser by a person; nothing here is estimated. A cell reading "–" is not measured yet.

| | |
|---|---|
| Measured on | 14 Nov 2026 |
| Commit measured | `577f394` on `main` (issue #66, pull request #71). darksight.space serves `assets/index-C1VpZADL.js`, the bundle in the `deploy` branch's build of `577f394` (`0af8056`). The site has no `version.txt`: that address returns the page itself |
| Laptop | Lenovo 83JC, AMD Ryzen 7 7435HS, Windows 11 Home; Brave 1.99.57 (Chromium 157) |
| Phone | – (model, browser, mobile network) |
| Method | Brave's developer tools (the same as Chrome's: Chromium), cache off, plain address typed and Enter pressed. Site data cleared before each "Loading" measurement |

## 1. What goes over the network

Size sent over the network (the "transferred" column), and whether the response carries a
`content-encoding` header. The size on disk is from the deployed build.

| File | On disk | Sent over the network | `content-encoding` |
|---|---|---|---|
| `data/ephemeris.json` | 3.1 KB | – | – |
| `data/ephemeris/2020.bin` | 0.70 MB | – | – |
| `data/dem.bin` | 12.84 MB | – | – |
| JavaScript (`assets/index-*.js`) | – | – | – |
| `data/globe.bin` (issue #66, picture only) | 8.29 MB | – | – |
| `data/north.bin` (issue #66, picture only) | 0.52 MB | – | – |

## 2. Load times

Seconds from pressing Enter on the plain address.

| Moment | Fast 4G | No throttle | Phone, mobile data |
|---|---|---|---|
| Readout shows Sun and Earth numbers (smooth Moon) | – | – | – |
| "Loading" line at the top gone (height map in) | – | – | – |
| 3D scene shows terrain | – | – | – |

## 3. Longest freeze after loading

The Performance tab's longest task, everything already loaded.

| Action | Laptop | Phone |
|---|---|---|
| Pick a new site south of 85 S | – | – |
| Drag the time on the timeline | – | – |
| Pin | – | – |
| Click four or five spots on the Shackleton floor (issue #32, row 1) | – | – |

## 4. "Loading" when the time enters a decade not on the device

Site data cleared first. Seconds that the panels say "Loading" (issue #32, row 2).

| Action | Fast 4G | No throttle | Phone, mobile data |
|---|---|---|---|
| Page the timeline from December 2029 into January 2030 | – | – | – |
| Set the time to 1969 | – | – | – |

## 5. Budgets

| Budget | On "Fast 4G" | Measured | Result |
|---|---|---|---|
| Sun and Earth numbers on screen | 3 s | – | – |
| Height map in | 20 s | – | – |
| Longest freeze after loading | 0.5 s | – | – |

## 6. Fails and who can fix them

Each fail lists its numbers and the files a fix would touch, so anyone can claim it as a
separate task or pull request. This task changes no code.

None recorded yet.
