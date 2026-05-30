# ⚽ Draft Zone — Football Draft Game

A 2-player 4-3-3 football draft game, playable entirely in the browser. No server needed.

## 🎮 How to Play

1. Both players enter their names
2. Player 1 picks a slot on their formation (e.g. ST, RW, LB)
3. 5 random players eligible for that position appear as FIFA-style cards
4. Pick one — they join your squad and can't be drafted again
5. Players alternate until both squads are full (11 players each)
6. Scores are calculated — highest average across Attack, Midfield & Defence wins!

## 📂 File Structure

```
football-draft-game/
├── index.html       ← The full game (HTML + CSS + JS)
├── players.js       ← Player database — EDIT THIS to add/change players
├── faces/           ← Player face images (PNG or JPG)
│   ├── default.png  ← Fallback face used when no image is set
│   └── mbappe.png   ← Example: named to match player entry in players.js
└── README.md
```

## 🧑‍💻 Adding Players

Open `players.js` and add an entry to the `PLAYERS` array:

```js
{
  name: "Your Player",
  nation: "England",
  club: "Arsenal",
  rating: 85,          // overall shown top-left of card
  attack: 80,          // used when position is: LW, RW, ST, CAM
  midfield: 75,        // used when position is: CDM, CM, CAM
  defense: 60,         // used when position is: GK, LB, CB, RB, CDM
  positions: ["RW", "LW"],   // which slots this player can appear in
  face: "faces/yourplayer.png",
  rarity: "gold"       // "gold", "silver", "bronze", or "special"
}
```

### Positions Reference

| Position | Label         | Contributes to |
|----------|---------------|----------------|
| GK       | Goalkeeper    | Defence        |
| RB       | Right Back    | Defence        |
| CB       | Centre Back   | Defence        |
| LB       | Left Back     | Defence        |
| CDM      | Defensive Mid | Defence + Mid  |
| CM       | Centre Mid    | Midfield       |
| CAM      | Attacking Mid | Midfield + Att |
| RW       | Right Wing    | Attack         |
| LW       | Left Wing     | Attack         |
| ST       | Striker       | Attack         |

Players can have multiple positions: `positions: ["CM", "CAM"]`

## 🖼️ Adding Face Photos

1. Create a `faces/` folder in the repo
2. Upload images named e.g. `mbappe.png`, `haaland.png`
3. Set `face: "faces/mbappe.png"` in the player entry
4. Add a `faces/default.png` as a fallback (any generic silhouette)

If no image is found, the card shows a ⚽ emoji placeholder automatically.

## 🚀 GitHub Pages Setup

1. Go to repo **Settings → Pages**
2. Source: **Deploy from branch** → `main` → `/ (root)` → Save
3. Visit: `https://YOUR-USERNAME.github.io/football-draft-game`

## 📊 Scoring

- **Attack** = average of: LW, RW, ST, CAM (attack stat), CDM (shares with def)
- **Midfield** = average of: CM (midfield stat), CDM (shares), CAM (shares)
- **Defence** = average of: GK, LB, CB×2, RB (defense stat), CDM (shares)
- **Total** = (Attack + Midfield + Defence) / 3
