import Phaser from "phaser";
import { makeBtn } from "../core/ui.js";
import { loadSave, saveSave } from "../core/save.js";

export default class DeckScene extends Phaser.Scene {
  constructor() {
    super("Deck");
    this.heroSlotsUI = [];
    this.heroListUI = [];
    this.supportListUI = [];
    this.activeHeroSlot = 0;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W / 2, H / 2, W, H, 0x0b1220);
    this.add.text(W / 2, 60, "DECK", { fontSize: "40px", color: "#e5e7eb" }).setOrigin(0.5);

    makeBtn(this, W - 120, 60, 180, 44, "BACK", () => this.scene.start("MainMenu"));

    // data
    this.supports = this.registry.get("supports")?.cards ?? [];
    this.heroes = this.registry.get("characters")?.heroes ?? [];

    // load save
    this.state = loadSave() ?? {};
    this.state.ownedSupports = this.state.ownedSupports ?? this.supports.map((c) => c.id);
    this.state.deck = this.state.deck ?? []; // support deck (max 10)
    this.state.ownedHeroes = this.state.ownedHeroes ?? []; // dari gacha
    this.state.heroDeck = this.state.heroDeck ?? []; // hero deck (3)

    this.ensureHeroDeck();
    saveSave(this.state);

    // ===== Layout Constants =====
    const marginX = 24;
    const topY = 120;

    const colGap = 24;
    const colW = Math.floor((W - marginX * 2 - colGap) / 2);

    this.leftX = marginX;
    this.rightX = marginX + colW + colGap;
    this.colW = colW;

    // ===== Section 1: HERO =====
    this.add.text(this.leftX, topY, "HERO (Owned)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);
    this.add.text(this.rightX, topY, "DECK HERO (3)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);

    this.add.rectangle(W / 2, topY + 34, W - 48, 2, 0x243042, 1);

    this.heroHint = this.add
      .text(this.rightX, topY + 44, "Klik slot -> lalu pilih hero di kiri (tidak bisa dupe)", {
        fontSize: "14px",
        color: "#9ca3af",
      })
      .setOrigin(0, 0);

    // ===== Section 2: SUPPORT =====
    this.supportTitleY = Math.min(H - 320, topY + 340);

    this.add.text(this.leftX, this.supportTitleY, "SUPPORT (Owned)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);
    this.add.text(this.rightX, this.supportTitleY, "DECK SUPPORT (10)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);

    this.add.rectangle(W / 2, this.supportTitleY + 34, W - 48, 2, 0x243042, 1);

    // deck support text (kanan bawah)
    this.deckText = this.add.text(this.rightX, this.supportTitleY + 48, "", {
      fontSize: "16px",
      color: "#9ca3af",
      wordWrap: { width: this.colW },
      lineSpacing: 6,
    });

    // render all
    this.renderHeroDeckSlots();
    this.renderOwnedHeroList();
    this.renderOwnedSupportList();
    this.refreshSupportDeckText();
  }

  // ================= HERO DECK =================
  ensureHeroDeck() {
    const TEAM_SIZE = 3;
    const heroes = this.heroes ?? [];
    const heroIds = new Set(heroes.map((h) => h.id));

    // kalau heroDeck kosong -> isi dari ownedHeroes dulu, lalu fallback
    if (!this.state.heroDeck.length) {
      const pick = [];
      for (const id of this.state.ownedHeroes) {
        if (pick.length >= TEAM_SIZE) break;
        if (heroIds.has(id) && !pick.includes(id)) pick.push(id);
      }
      for (const h of heroes) {
        if (pick.length >= TEAM_SIZE) break;
        if (!pick.includes(h.id)) pick.push(h.id);
      }
      this.state.heroDeck = pick;
    }

    // pastikan panjang 3 & valid
    while (this.state.heroDeck.length < TEAM_SIZE) {
      const next = heroes.find((h) => !this.state.heroDeck.includes(h.id))?.id;
      if (!next) break;
      this.state.heroDeck.push(next);
    }
    this.state.heroDeck = this.state.heroDeck.slice(0, TEAM_SIZE);
    this.state.heroDeck = this.state.heroDeck.map((id) => (heroIds.has(id) ? id : heroes[0]?.id ?? id));

    // safety: pastikan tidak ada dupe (kalau ada, ganti dengan hero lain)
    const unique = [];
    for (const id of this.state.heroDeck) {
      if (!unique.includes(id)) unique.push(id);
    }
    while (unique.length < TEAM_SIZE) {
      const next = heroes.find((h) => !unique.includes(h.id))?.id;
      if (!next) break;
      unique.push(next);
    }
    this.state.heroDeck = unique.slice(0, TEAM_SIZE);
  }

  renderHeroDeckSlots() {
    this.heroSlotsUI.forEach((o) => o.destroy());
    this.heroSlotsUI = [];

    const heroes = this.heroes ?? [];
    if (!heroes.length) return;

    const heroById = new Map(heroes.map((h) => [h.id, h]));

    const startY = 170;
    const slotH = 64;
    const gap = 12;

    for (let i = 0; i < 3; i++) {
      const id = this.state.heroDeck[i];
      const hero = heroById.get(id);

      const x = this.rightX + this.colW / 2;
      const y = startY + i * (slotH + gap);

      const isActive = i === this.activeHeroSlot;

      const bg = this.add.rectangle(x, y, this.colW, slotH, 0x111827, 0.95);
      bg.setStrokeStyle(2, isActive ? 0x60a5fa : 0x374151, 1);

      const t1 = this.add
        .text(this.rightX + 12, y - 16, `Slot ${i + 1}`, { fontSize: "13px", color: "#9ca3af" })
        .setOrigin(0, 0.5);

      const t2 = this.add
        .text(this.rightX + 12, y + 8, hero ? hero.name : id, { fontSize: "18px", color: "#e5e7eb" })
        .setOrigin(0, 0.5);

      const hint = this.add
        .text(this.rightX + this.colW - 12, y, isActive ? "ACTIVE" : "CLICK", {
          fontSize: "14px",
          color: isActive ? "#34d399" : "#93c5fd",
        })
        .setOrigin(1, 0.5);

      bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
        this.activeHeroSlot = i;
        this.renderHeroDeckSlots();
        this.renderOwnedHeroList();
      });

      const c = this.add.container(0, 0, [bg, t1, t2, hint]);
      this.heroSlotsUI.push(c);
    }
  }

  renderOwnedHeroList() {
    this.heroListUI.forEach((o) => o.destroy());
    this.heroListUI = [];

    const heroes = this.heroes ?? [];
    if (!heroes.length) return;

    const heroById = new Map(heroes.map((h) => [h.id, h]));

    // owned fallback: kalau belum gacha, tetap bisa pilih semua hero
    const ownedIdsRaw = (this.state.ownedHeroes ?? []).length ? this.state.ownedHeroes : heroes.map((h) => h.id);
    const ownedIds = ownedIdsRaw.filter((id) => heroById.has(id));

    const startY = 170;
    const itemH = 48;
    const maxVisible = 6; // supaya tidak tabrakan section support
    const list = ownedIds.slice(0, maxVisible);

    const currentDeck = this.state.heroDeck ?? [];
    const activeSlotId = currentDeck[this.activeHeroSlot];

    for (let i = 0; i < list.length; i++) {
      const id = list[i];
      const hero = heroById.get(id);
      const name = hero ? hero.name : id;

      const x = this.leftX + this.colW / 2;
      const y = startY + i * itemH;

      const inOtherSlot = currentDeck.includes(id) && id !== activeSlotId; // hero sudah dipakai slot lain
      const isActiveHero = id === activeSlotId;

      const bgColor = inOtherSlot ? 0x0b1220 : isActiveHero ? 0x1f2937 : 0x0f172a;

      const bg = this.add.rectangle(x, y, this.colW, 42, bgColor, 0.95);
      bg.setStrokeStyle(1, 0x374151, 1);

      const txt = this.add
        .text(this.leftX + 12, y, name, {
          fontSize: "16px",
          color: inOtherSlot ? "#6b7280" : "#e5e7eb",
        })
        .setOrigin(0, 0.5);

      let tagText = "SELECT";
      let tagColor = "#34d399";
      if (isActiveHero) {
        tagText = "ACTIVE";
        tagColor = "#60a5fa";
      } else if (inOtherSlot) {
        tagText = "LOCKED";
        tagColor = "#9ca3af";
      }

      const tag = this.add
        .text(this.leftX + this.colW - 12, y, tagText, { fontSize: "14px", color: tagColor })
        .setOrigin(1, 0.5);

      if (!inOtherSlot) {
        bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
          // assign hero ke slot aktif
          this.state = loadSave() ?? this.state;
          this.state.heroDeck = this.state.heroDeck ?? [];

          const old = this.state.heroDeck[this.activeHeroSlot];
          this.state.heroDeck[this.activeHeroSlot] = id;

          // safety: tidak boleh dupe
          const set = new Set(this.state.heroDeck);
          if (set.size !== this.state.heroDeck.length) {
            // revert kalau jadi dupe
            this.state.heroDeck[this.activeHeroSlot] = old;
            return;
          }

          saveSave(this.state);
          this.renderHeroDeckSlots();
          this.renderOwnedHeroList();
        });
      }

      const c = this.add.container(0, 0, [bg, txt, tag]);
      this.heroListUI.push(c);
    }

    if (ownedIds.length > maxVisible) {
      const more = this.add.text(
        this.leftX,
        startY + maxVisible * itemH + 6,
        `+${ownedIds.length - maxVisible} hero lainnya (nanti bisa kita buat scroll)`,
        { fontSize: "13px", color: "#9ca3af" }
      );
      this.heroListUI.push(more);
    }
  }

  // ================= SUPPORT DECK =================
  renderOwnedSupportList() {
    this.supportListUI.forEach((o) => o.destroy());
    this.supportListUI = [];

    const ownedIds = this.state.ownedSupports ?? [];
    const ownedCards = this.supports.filter((c) => ownedIds.includes(c.id));

    const startY = this.supportTitleY + 48;
    const itemH = 48;
    const maxVisible = 7;

    const list = ownedCards.slice(0, maxVisible);

    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      const inDeck = (this.state.deck ?? []).includes(c.id);

      const x = this.leftX + this.colW / 2;
      const y = startY + i * itemH;

      const bg = this.add.rectangle(x, y, this.colW, 42, inDeck ? 0x1f2937 : 0x0f172a, 0.95);
      bg.setStrokeStyle(1, 0x374151, 1);

      const label = `${inDeck ? "✅" : "➕"} ${c.name} (Cost ${c.cost})`;
      const txt = this.add.text(this.leftX + 12, y, label, { fontSize: "16px", color: "#e5e7eb" }).setOrigin(0, 0.5);

      bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.toggleSupportDeck(c.id));

      const row = this.add.container(0, 0, [bg, txt]);
      this.supportListUI.push(row);
    }

    if (ownedCards.length > maxVisible) {
      const more = this.add.text(
        this.leftX,
        startY + maxVisible * itemH + 6,
        `+${ownedCards.length - maxVisible} support lainnya (nanti bisa kita buat scroll)`,
        { fontSize: "13px", color: "#9ca3af" }
      );
      this.supportListUI.push(more);
    }
  }

  toggleSupportDeck(cardId) {
    this.state = loadSave() ?? this.state;
    this.state.deck = this.state.deck ?? [];

    const idx = this.state.deck.indexOf(cardId);
    if (idx >= 0) this.state.deck.splice(idx, 1);
    else {
      if (this.state.deck.length >= 10) return this.toast("Deck penuh (max 10). Remove dulu.");
      this.state.deck.push(cardId);
    }

    saveSave(this.state);
    this.renderOwnedSupportList();
    this.refreshSupportDeckText();
  }

  refreshSupportDeckText() {
    const idToName = new Map(this.supports.map((c) => [c.id, c.name]));
    const list = (this.state.deck ?? []).map((id, i) => `${i + 1}. ${idToName.get(id) ?? id}`);
    this.deckText.setText(list.length ? list.join("\n") : "-");
  }

  toast(msg) {
    if (this.toastText) this.toastText.destroy();
    this.toastText = this.add
      .text(this.scale.width / 2, this.scale.height - 40, msg, { fontSize: "18px", color: "#fde68a" })
      .setOrigin(0.5);
    this.time.delayedCall(1000, () => this.toastText?.destroy());
  }
}