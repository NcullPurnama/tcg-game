import Phaser from "phaser";
import { makeBtn } from "../core/ui.js";
import { loadSave, saveSave } from "../core/save.js";

export default class GachaScene extends Phaser.Scene {
  constructor() {
    super("Gacha");
    this.resultPopup = null;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0b1220);
    this.add.text(W / 2, 70, "GACHA", { fontSize: "40px", color: "#e5e7eb" }).setOrigin(0.5);

    this.resultText = this.add
      .text(W / 2, 140, "Tekan Pull untuk mendapatkan character.", {
        fontSize: "18px",
        color: "#9ca3af",
        align: "center",
        wordWrap: { width: Math.min(720, W - 60) },
      })
      .setOrigin(0.5);

    makeBtn(this, W / 2, 250, 320, 64, "PULL 1x", () => this.pull(1));
    makeBtn(this, W / 2, 330, 320, 64, "PULL 10x", () => this.pull(10));
    makeBtn(this, W / 2, 440, 260, 56, "BACK", () => this.scene.start("MainMenu"));

    this.ownedText = this.add.text(24, H - 120, "", {
      fontSize: "16px",
      color: "#e5e7eb",
      wordWrap: { width: W - 48 },
    });

    this.refreshOwned();
  }

  // ================= GACHA CONFIG =================
  rollRarity() {
    const r = Math.random();
    if (r < 0.005) return "SSR";      // 0.5%
    if (r < 0.105) return "SR";       // 10%
    return "R";                       // sisa
  }

  getHeroRarity(hero) {
    if (hero?.rarity) return String(hero.rarity).toUpperCase();

    // mapping sementara (ubah sesukamu)
    const map = {
      h1: "R",
      h2: "R",
      h3: "R",
      h4: "R",
      h5: "R",
      h6: "R",
      h7: "SR",
      h8: "SR",
      h9: "SSR",
    };
    return map[hero.id] ?? "R";
  }

  getPools(heroes) {
    const pools = { R: [], SR: [], SSR: [] };
    for (const h of heroes) {
      const rar = this.getHeroRarity(h);
      if (rar === "SSR") pools.SSR.push(h);
      else if (rar === "SR") pools.SR.push(h);
      else pools.R.push(h);
    }
    return pools;
  }

  pickFromPool(pools, rarity) {
    const fallbackOrder =
      rarity === "SSR"
        ? ["SSR", "SR", "R"]
        : rarity === "SR"
          ? ["SR", "R", "SSR"]
          : ["R", "SR", "SSR"];

    for (const key of fallbackOrder) {
      if (pools[key]?.length) return Phaser.Utils.Array.GetRandom(pools[key]);
    }
    return null;
  }

  // ================= POPUP =================
  closeResultPopup() {
    if (!this.resultPopup) return;
    this.resultPopup.destroy(true);
    this.resultPopup = null;
  }

  rarityStyle(rarity) {
    if (rarity === "SSR") return { border: 0xf59e0b, label: "#fbbf24" };
    if (rarity === "SR") return { border: 0x60a5fa, label: "#93c5fd" };
    return { border: 0x9ca3af, label: "#d1d5db" };
  }

  makeCard({ x, y, w, h, heroName, rarity, isNew }) {
    const bg = this.add.rectangle(x, y, w, h, 0x0f172a, 0.96);
    const st = this.rarityStyle(rarity);
    bg.setStrokeStyle(3, st.border, 1);

    const rarityText = this.add
      .text(x - w / 2 + 10, y - h / 2 + 8, rarity, {
        fontSize: "14px",
        color: st.label,
      })
      .setOrigin(0, 0);

    const nameText = this.add
      .text(x, y - 2, heroName, {
        fontSize: "16px",
        color: "#e5e7eb",
        align: "center",
        wordWrap: { width: w - 20 },
      })
      .setOrigin(0.5);

    const tagText = this.add
      .text(x, y + h / 2 - 12, isNew ? "NEW" : "DUPE", {
        fontSize: "12px",
        color: isNew ? "#34d399" : "#9ca3af",
      })
      .setOrigin(0.5, 1);

    const c = this.add.container(0, 0, [bg, rarityText, nameText, tagText]);
    return c;
  }

  makeSimpleBtn(x, y, w, h, label, onClick) {
    const bg = this.add.rectangle(x, y, w, h, 0x2563eb, 1).setStrokeStyle(2, 0x1d4ed8, 1);
    const txt = this.add.text(x, y, label, { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0.5);

    bg.setInteractive({ useHandCursor: true })
      .on("pointerover", () => bg.setFillStyle(0x1d4ed8, 1))
      .on("pointerout", () => bg.setFillStyle(0x2563eb, 1))
      .on("pointerdown", () => onClick?.());

    return this.add.container(0, 0, [bg, txt]);
  }

  showResultPopupCards({ title, results }) {
    this.closeResultPopup();

    const W = this.scale.width;
    const H = this.scale.height;
    const depth = 9999;

    const overlay = this.add
      .rectangle(W / 2, H / 2, W, H, 0x000000, 0.65)
      .setInteractive()
      .setDepth(depth);

    const panelW = Math.min(900, W - 40);
    const panelH = Math.min(620, H - 80);

    const panel = this.add
      .rectangle(W / 2, H / 2, panelW, panelH, 0x111827, 0.98)
      .setStrokeStyle(2, 0x374151, 1)
      .setDepth(depth);

    const header = this.add
      .text(W / 2, H / 2 - panelH / 2 + 18, title, { fontSize: "22px", color: "#e5e7eb" })
      .setOrigin(0.5, 0)
      .setDepth(depth);

    const gridTop = H / 2 - panelH / 2 + 70;
    const gridBottom = H / 2 + panelH / 2 - 95;
    const gridLeft = W / 2 - panelW / 2 + 28;
    const gridRight = W / 2 + panelW / 2 - 28;

    const cols = 5;
    const rows = 2;
    const gapX = 14;
    const gapY = 14;

    const usableW = gridRight - gridLeft;
    const usableH = gridBottom - gridTop;

    const cardW = Math.floor((usableW - gapX * (cols - 1)) / cols);
    const cardH = Math.floor((usableH - gapY * (rows - 1)) / rows);

    const cards = [];
    const count = Math.min(10, results.length);

    for (let i = 0; i < count; i++) {
      const r = results[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const x = gridLeft + col * (cardW + gapX) + cardW / 2;
      const y = gridTop + row * (cardH + gapY) + cardH / 2;

      const card = this.makeCard({
        x,
        y,
        w: cardW,
        h: cardH,
        heroName: r.name,
        rarity: r.rarity,
        isNew: r.isNew,
      });

      card.setDepth(depth);
      card.alpha = 0;
      card.setScale(0.9);

      this.tweens.add({
        targets: card,
        alpha: 1,
        scale: 1,
        duration: 200,
        delay: i * 60,
        ease: "Back.Out",
      });

      cards.push(card);
    }

    const hint = this.add
      .text(W / 2, H / 2 + panelH / 2 - 78, "Klik background atau Close untuk menutup", {
        fontSize: "14px",
        color: "#9ca3af",
      })
      .setOrigin(0.5)
      .setDepth(depth);

    const closeBtn = this.makeSimpleBtn(W / 2, H / 2 + panelH / 2 - 36, 220, 50, "CLOSE", () =>
      this.closeResultPopup()
    );
    closeBtn.setDepth(depth);

    overlay.on("pointerdown", () => this.closeResultPopup());

    this.resultPopup = this.add.container(0, 0, [overlay, panel, header, ...cards, hint, closeBtn]);
    this.resultPopup.setDepth(depth);
  }

  // ================= PULL =================
  pull(n) {
    const characters = this.registry.get("characters");
    const heroes = characters?.heroes ?? [];
    if (!heroes.length) {
      this.resultText.setText("heroes di characters.json kosong.");
      return;
    }

    const pools = this.getPools(heroes);

    const s = loadSave() ?? {};
    s.ownedHeroes = s.ownedHeroes ?? [];
    s.ownedHeroesCount = s.ownedHeroesCount ?? {};

    const resultsForPopup = [];
    const gotCompact = [];

    for (let i = 0; i < n; i++) {
      const rarity = this.rollRarity();
      const pick = this.pickFromPool(pools, rarity);
      if (!pick) continue;

      const prevCount = s.ownedHeroesCount[pick.id] ?? 0;
      const isNew = prevCount === 0;

      s.ownedHeroesCount[pick.id] = prevCount + 1;
      if (isNew && !s.ownedHeroes.includes(pick.id)) s.ownedHeroes.push(pick.id);

      resultsForPopup.push({ id: pick.id, name: pick.name, rarity, isNew });
      gotCompact.push({ id: pick.id, rarity });
    }

    s.lastGacha = { at: Date.now(), results: gotCompact };
    saveSave(s);

    this.resultText.setText(`Terakhir Pull: ${n}x`);
    this.refreshOwned();

    this.showResultPopupCards({
      title: `Hasil Pull (${n}x)`,
      results: resultsForPopup.length
        ? resultsForPopup
        : [{ id: "none", name: "(tidak ada hasil)", rarity: "R", isNew: false }],
    });
  }

  refreshOwned() {
    const heroes = this.registry.get("characters")?.heroes ?? [];
    const s = loadSave() ?? {};
    const ownedIds = s.ownedHeroes ?? [];
    const ownedNames = heroes.filter((h) => ownedIds.includes(h.id)).map((h) => h.name);
    this.ownedText.setText(`Owned Characters: ${ownedNames.length ? ownedNames.join(", ") : "-"}`);
  }
}