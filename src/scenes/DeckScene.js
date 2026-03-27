import Phaser from "phaser";
import { makeBtn } from "../core/ui.js";
import { loadSave, saveSave } from "../core/save.js";

export default class DeckScene extends Phaser.Scene {
  constructor() {
    super("Deck");
    this.heroSlotsUI   = [];
    this.heroListUI    = [];
    this.supportListUI = [];
    this.activeHeroSlot = 0;

    // scroll state
    this.heroScrollY    = 0;
    this.supportScrollY = 0;
    this._heroDrag      = null;
    this._supportDrag   = null;
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
    const topY    = 120;
    const colGap  = 24;
    const colW    = Math.floor((W - marginX * 2 - colGap) / 2);

    this.leftX  = marginX;
    this.rightX = marginX + colW + colGap;
    this.colW   = colW;

    // scroll area bounds
    this.heroScrollStartY    = topY + 50;
    this.heroScrollAreaH     = 285;
    this.heroItemH           = 48;
    this.heroScrollY         = 0;

    this.supportTitleY       = Math.min(H - 320, topY + 340);
    this.supportScrollStartY = this.supportTitleY + 48;
    this.supportScrollAreaH  = Math.max(140, H - this.supportScrollStartY - 20);
    this.supportItemH        = 48;
    this.supportScrollY      = 0;

    // ===== Section 1: HERO =====
    this.add.text(this.leftX, topY, "HERO (Owned)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);
    this.add.text(this.rightX, topY, "DECK HERO (3)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);
    this.add.rectangle(W / 2, topY + 34, W - 48, 2, 0x243042, 1);

    this.heroHint = this.add
      .text(this.rightX, topY + 44, "Klik slot -> lalu pilih hero di kiri (tidak bisa dupe)", {
        fontSize: "14px", color: "#9ca3af",
      }).setOrigin(0, 0);

    // clipping mask untuk hero list (kiri atas)
    this.heroMaskShape = this.make.graphics({ add: false });
    this._redrawHeroMask();
    const heroMask = this.heroMaskShape.createGeometryMask();

    this.heroListContainer = this.add.container(0, 0);
    this.heroListContainer.setMask(heroMask);

    // scroll bar track hero
    this.heroTrack = this.add.rectangle(
      this.leftX + colW - 6,
      this.heroScrollStartY + this.heroScrollAreaH / 2,
      6, this.heroScrollAreaH, 0x1f2937
    ).setOrigin(0.5);
    this.heroThumb = this.add.rectangle(
      this.leftX + colW - 6,
      this.heroScrollStartY,
      6, 40, 0x4b5563
    ).setOrigin(0.5, 0);

    // ===== Section 2: SUPPORT =====
    this.add.text(this.leftX, this.supportTitleY, "SUPPORT (Owned)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);
    this.add.text(this.rightX, this.supportTitleY, "DECK SUPPORT (10)", { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0, 0);
    this.add.rectangle(W / 2, this.supportTitleY + 34, W - 48, 2, 0x243042, 1);

    // deck support text (kanan)
    this.deckText = this.add.text(this.rightX, this.supportTitleY + 48, "", {
      fontSize: "16px", color: "#9ca3af",
      wordWrap: { width: this.colW }, lineSpacing: 6,
    });

    // clipping mask untuk support list
    this.supportMaskShape = this.make.graphics({ add: false });
    this._redrawSupportMask();
    const supportMask = this.supportMaskShape.createGeometryMask();

    this.supportListContainer = this.add.container(0, 0);
    this.supportListContainer.setMask(supportMask);

    // scroll bar track support
    this.supportTrack = this.add.rectangle(
      this.leftX + colW - 6,
      this.supportScrollStartY + this.supportScrollAreaH / 2,
      6, this.supportScrollAreaH, 0x1f2937
    ).setOrigin(0.5);
    this.supportThumb = this.add.rectangle(
      this.leftX + colW - 6,
      this.supportScrollStartY,
      6, 40, 0x4b5563
    ).setOrigin(0.5, 0);

    // ===== Scroll input =====
    this._setupScrollInput();

    // render all
    this.renderHeroDeckSlots();
    this.renderOwnedHeroList();
    this.renderOwnedSupportList();
    this.refreshSupportDeckText();
  }

  _redrawHeroMask() {
    this.heroMaskShape.clear();
    this.heroMaskShape.fillStyle(0xffffff);
    this.heroMaskShape.fillRect(
      this.leftX, this.heroScrollStartY,
      this.colW, this.heroScrollAreaH
    );
  }

  _redrawSupportMask() {
    this.supportMaskShape.clear();
    this.supportMaskShape.fillStyle(0xffffff);
    this.supportMaskShape.fillRect(
      this.leftX, this.supportScrollStartY,
      this.colW, this.supportScrollAreaH
    );
  }

  _setupScrollInput() {
    // mouse wheel
    this.input.on("wheel", (pointer, _objs, _dx, dy) => {
      const px = pointer.x, py = pointer.y;
      if (this._inHeroZone(px, py))    this._scrollHero(dy * 0.6);
      if (this._inSupportZone(px, py)) this._scrollSupport(dy * 0.6);
    });

    // drag (touch / mouse)
    this.input.on("pointerdown", (p) => {
      if (this._inHeroZone(p.x, p.y))
        this._heroDrag = { startY: p.y, startScroll: this.heroScrollY };
      if (this._inSupportZone(p.x, p.y))
        this._supportDrag = { startY: p.y, startScroll: this.supportScrollY };
    });

    this.input.on("pointermove", (p) => {
      if (this._heroDrag && p.isDown) {
        const delta = this._heroDrag.startY - p.y;
        this._setHeroScroll(this._heroDrag.startScroll + delta);
      }
      if (this._supportDrag && p.isDown) {
        const delta = this._supportDrag.startY - p.y;
        this._setSupportScroll(this._supportDrag.startScroll + delta);
      }
    });

    this.input.on("pointerup", () => {
      this._heroDrag    = null;
      this._supportDrag = null;
    });
  }

  _inHeroZone(x, y) {
    return x >= this.leftX && x <= this.leftX + this.colW &&
           y >= this.heroScrollStartY && y <= this.heroScrollStartY + this.heroScrollAreaH;
  }

  _inSupportZone(x, y) {
    return x >= this.leftX && x <= this.leftX + this.colW &&
           y >= this.supportScrollStartY && y <= this.supportScrollStartY + this.supportScrollAreaH;
  }

  _maxHeroScroll() {
    const ownedCount = ((this.state.ownedHeroes ?? []).length || this.heroes.length);
    const totalH = ownedCount * this.heroItemH;
    return Math.max(0, totalH - this.heroScrollAreaH);
  }

  _maxSupportScroll() {
    const count = (this.state.ownedSupports ?? this.supports.map(c => c.id)).length;
    const totalH = count * this.supportItemH;
    return Math.max(0, totalH - this.supportScrollAreaH);
  }

  _scrollHero(delta) { this._setHeroScroll(this.heroScrollY + delta); }

  _setHeroScroll(val) {
    this.heroScrollY = Math.max(0, Math.min(val, this._maxHeroScroll()));
    this.heroListContainer.setY(-this.heroScrollY);
    this._updateHeroThumb();
  }

  _scrollSupport(delta) { this._setSupportScroll(this.supportScrollY + delta); }

  _setSupportScroll(val) {
    this.supportScrollY = Math.max(0, Math.min(val, this._maxSupportScroll()));
    this.supportListContainer.setY(-this.supportScrollY);
    this._updateSupportThumb();
  }

  _updateHeroThumb() {
    const max = this._maxHeroScroll();
    if (max <= 0) { this.heroThumb.setVisible(false); return; }
    this.heroThumb.setVisible(true);
    const ratio  = this.heroScrollAreaH / (this.heroScrollAreaH + max);
    const thumbH = Math.max(24, this.heroScrollAreaH * ratio);
    const travel = this.heroScrollAreaH - thumbH;
    const thumbY = this.heroScrollStartY + (this.heroScrollY / max) * travel;
    this.heroThumb.setSize(6, thumbH).setPosition(this.leftX + this.colW - 6, thumbY);
  }

  _updateSupportThumb() {
    const max = this._maxSupportScroll();
    if (max <= 0) { this.supportThumb.setVisible(false); return; }
    this.supportThumb.setVisible(true);
    const ratio  = this.supportScrollAreaH / (this.supportScrollAreaH + max);
    const thumbH = Math.max(24, this.supportScrollAreaH * ratio);
    const travel = this.supportScrollAreaH - thumbH;
    const thumbY = this.supportScrollStartY + (this.supportScrollY / max) * travel;
    this.supportThumb.setSize(6, thumbH).setPosition(this.leftX + this.colW - 6, thumbY);
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
    this.heroListContainer.removeAll(false);

    const heroes = this.heroes ?? [];
    if (!heroes.length) return;

    const heroById = new Map(heroes.map((h) => [h.id, h]));

    const ownedIdsRaw = (this.state.ownedHeroes ?? []).length
      ? this.state.ownedHeroes
      : heroes.map((h) => h.id);
    const ownedIds = ownedIdsRaw.filter((id) => heroById.has(id));

    const baseY     = this.heroScrollStartY;  // absolute Y tanpa scroll
    const itemH     = this.heroItemH;
    const currentDeck   = this.state.heroDeck ?? [];
    const activeSlotId  = currentDeck[this.activeHeroSlot];

    for (let i = 0; i < ownedIds.length; i++) {
      const id   = ownedIds[i];
      const hero = heroById.get(id);
      const name = hero ? hero.name : id;

      const x  = this.leftX + this.colW / 2;
      const y  = baseY + i * itemH + itemH / 2;   // posisi absolut (container scroll menggeser)

      const inOtherSlot  = currentDeck.includes(id) && id !== activeSlotId;
      const isActiveHero = id === activeSlotId;
      const bgColor      = inOtherSlot ? 0x0b1220 : isActiveHero ? 0x1f2937 : 0x0f172a;

      const bg  = this.add.rectangle(x, y, this.colW - 14, 42, bgColor, 0.95);
      bg.setStrokeStyle(1, isActiveHero ? 0x60a5fa : 0x374151, 1);

      const txt = this.add
        .text(this.leftX + 12, y, name, { fontSize: "16px", color: inOtherSlot ? "#6b7280" : "#e5e7eb" })
        .setOrigin(0, 0.5);

      let tagText = "SELECT", tagColor = "#34d399";
      if (isActiveHero)   { tagText = "ACTIVE"; tagColor = "#60a5fa"; }
      else if (inOtherSlot) { tagText = "LOCKED"; tagColor = "#9ca3af"; }

      const tag = this.add
        .text(this.leftX + this.colW - 22, y, tagText, { fontSize: "14px", color: tagColor })
        .setOrigin(1, 0.5);

      if (!inOtherSlot) {
        bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => {
          this.state = loadSave() ?? this.state;
          this.state.heroDeck = this.state.heroDeck ?? [];
          const old = this.state.heroDeck[this.activeHeroSlot];
          this.state.heroDeck[this.activeHeroSlot] = id;
          const set = new Set(this.state.heroDeck);
          if (set.size !== this.state.heroDeck.length) {
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
      this.heroListContainer.add(c);
    }

    // reset scroll ke atas setiap re-render (opsional: hapus baris ini kalau ingin posisi terjaga)
    this._setHeroScroll(this.heroScrollY);
    this._updateHeroThumb();
  }

  // ================= SUPPORT DECK =================
  renderOwnedSupportList() {
    this.supportListUI.forEach((o) => o.destroy());
    this.supportListUI = [];
    this.supportListContainer.removeAll(false);

    const ownedIds   = this.state.ownedSupports ?? [];
    const ownedCards = this.supports.filter((c) => ownedIds.includes(c.id));

    const baseY  = this.supportScrollStartY;
    const itemH  = this.supportItemH;

    for (let i = 0; i < ownedCards.length; i++) {
      const c      = ownedCards[i];
      const inDeck = (this.state.deck ?? []).includes(c.id);

      const x = this.leftX + this.colW / 2;
      const y = baseY + i * itemH + itemH / 2;

      const bg  = this.add.rectangle(x, y, this.colW - 14, 42, inDeck ? 0x1f2937 : 0x0f172a, 0.95);
      bg.setStrokeStyle(1, inDeck ? 0x60a5fa : 0x374151, 1);

      const label = `${inDeck ? "✅" : "➕"} ${c.name} (Cost ${c.cost})`;
      const txt   = this.add.text(this.leftX + 12, y, label, { fontSize: "16px", color: "#e5e7eb" }).setOrigin(0, 0.5);

      bg.setInteractive({ useHandCursor: true }).on("pointerdown", () => this.toggleSupportDeck(c.id));

      const row = this.add.container(0, 0, [bg, txt]);
      this.supportListUI.push(row);
      this.supportListContainer.add(row);
    }

    this._setSupportScroll(this.supportScrollY);
    this._updateSupportThumb();
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
    const prevScroll = this.supportScrollY;
    this.renderOwnedSupportList();
    this._setSupportScroll(prevScroll);
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