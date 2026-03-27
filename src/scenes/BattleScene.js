import Phaser from "phaser";
import { loadSave } from "../core/save.js";

const COST = { normal: 2, skill: 4, ult: 6 };

export default class BattleScene extends Phaser.Scene {
  constructor() { super("Battle"); }

  init() {
    this.turn = "player";
    this.ap = 0;
    this.enemyAp = 0;

    this.dice = { d1: 1, d2: 1, total: 0 };
    this.enemyDice = { d1: 1, d2: 1, total: 0 };

    this.hasRolled = false;

    this.selectedChar = null;
    this.targeting = false;
    this.pendingAction = null;
    this.pendingSupport = null;

    this.deck = [];
    this.discard = [];
    this.hand = [];

    this.heroesData = [];
    this.enemiesData = [];
    this.supportPool = [];
  }

  preload() {
    // kosong (sudah di-boot)
  }

  create() {
    // ---- Load JSON from registry/cache ----
    const characterData = this.registry.get("characters") ?? this.cache.json.get("characters");
    const supportData   = this.registry.get("supports") ?? this.cache.json.get("supports");

    this.heroesData = (characterData && characterData.heroes) ? characterData.heroes : [];
    this.enemiesData = (characterData && characterData.enemies) ? characterData.enemies : [];
    this.supportPool = (supportData && supportData.cards) ? supportData.cards : [];

    // fallback minimal
    if (this.heroesData.length < 3) this.heroesData = [
      { id:"h1", name:"Hero 1", maxHp:20, atk:3, skillDmg:6, ultAoe:4 },
      { id:"h2", name:"Hero 2", maxHp:20, atk:3, skillDmg:6, ultAoe:4 },
      { id:"h3", name:"Hero 3", maxHp:20, atk:3, skillDmg:6, ultAoe:4 },
    ];
    if (this.enemiesData.length < 3) this.enemiesData = [
      { id:"e1", name:"Enemy 1", maxHp:20, atk:2, skillDmg:4, ultAoe:3 },
      { id:"e2", name:"Enemy 2", maxHp:20, atk:2, skillDmg:4, ultAoe:3 },
      { id:"e3", name:"Enemy 3", maxHp:20, atk:2, skillDmg:4, ultAoe:3 },
    ];

    // ---- BG ----
    this.bg = this.add.rectangle(0, 0, 10, 10, 0x0b1220).setOrigin(0);

    // ---- Top bar ----
    this.topBar = this.add.container(0, 0);
    this.topBg = this.add.rectangle(0, 0, 10, 64, 0x0f172a).setOrigin(0).setAlpha(0.95);

    this.apText = this.add.text(18, 10, "", { fontSize: "18px", color: "#e5e7eb" });
    this.turnHint = this.add.text(18, 34, "", { fontSize: "14px", color: "#9ca3af", wordWrap: { width: 600 } });

    this.rollBtn = this.makeButton(0, 10, 140, 44, "ROLL", () => this.onRollClicked());
    this.endBtn  = this.makeButton(0, 10, 160, 44, "END TURN", () => this.endTurn());

    // tombol back ke menu
    this.btnMenu = this.makeButton(0, 10, 120, 44, "MENU", () => this.scene.start("MainMenu"));

    this.topBar.add([
      this.topBg, this.apText, this.turnHint,
      this.rollBtn.r, this.rollBtn.t,
      this.endBtn.r, this.endBtn.t,
      this.btnMenu.r, this.btnMenu.t
    ]);

    // ---- Right info panel ----
    this.infoPanel = this.add.container(0, 0);
    this.infoBg = this.add.rectangle(0, 0, 280, 10, 0x0f172a).setOrigin(0).setAlpha(0.9);
    this.infoTitle = this.add.text(12, 12, "INFO", { fontSize: "18px", color: "#9ca3af" });
    this.infoText = this.add.text(12, 44, "Hover kartu untuk info.", {
      fontSize: "16px", color: "#e5e7eb", lineSpacing: 6, wordWrap: { width: 256 }
    });
    this.infoPanel.add([this.infoBg, this.infoTitle, this.infoText]);

    // BATTLE LOG PANEL
    // ==================
    this.logPanel = this.add.container(0, 0);

    this.logBg = this.add.rectangle(0, 0, 280, 200, 0x111827)
      .setOrigin(0)
      .setAlpha(0.95);

    this.logTitle = this.add.text(12, 12, "BATTLE LOG", {
      fontSize: "16px",
      color: "#9ca3af"
    });

    this.logText = this.add.text(12, 40, "", {
      fontSize: "14px",
      color: "#e5e7eb",
      lineSpacing: 4,
      wordWrap: { width: 256 }
    });

    this.logPanel.add([this.logBg, this.logTitle, this.logText]);

    // simpan isi log
    this.logLines = [];

    // ---- Board ----
    this.board = this.add.container(0, 0);
    this.enemyLabel = this.add.text(0, 0, "ENEMY", { fontSize: "16px", color: "#9ca3af" });
    this.playerLabel = this.add.text(0, 0, "PLAYER", { fontSize: "16px", color: "#9ca3af" });
    this.board.add([this.enemyLabel, this.playerLabel]);

    this.enemySlots  = this.createTeamRow(3, false);
    this.playerSlots = this.createTeamRow(3, true);

    // ---- Hand bar ----
    this.handBar = this.add.container(0, 0);
    this.handBg = this.add.rectangle(0, 0, 10, 180, 0x0c152a).setOrigin(0).setAlpha(0.95);
    this.handTitle = this.add.text(18, 14, "SUPPORT HAND", { fontSize: "16px", color: "#9ca3af" });
    this.handBar.add([this.handBg, this.handTitle]);

    this.supportSlots = this.createSupportSlots(5);
    this.supportSlots.forEach(s => this.handBar.add([s.rect, s.title, s.cost]));

    // ---- Action menu ----
    this.actionMenu = this.createActionMenu().setVisible(false);

    // ---- Overlay targeting ----
    this.overlay = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.0).setOrigin(0).setDepth(900).setVisible(false);

    // Cancel controls
    this.input.keyboard.on("keydown-ESC", () => this.cancelSelection());
    this.input.on("pointerdown", (p) => { if (p.rightButtonDown()) this.cancelSelection(); });

    // Close menu on empty click
    this.input.on("pointerdown", (p) => {
      if (!this.actionMenu.visible) return;
      if (this.targeting) return;
      const b = this.actionMenu.getBounds();
      if (!b.contains(p.x, p.y)) {
        this.actionMenu.setVisible(false);
        this.selectedChar = null;
      }
    });

    // Init deck + starting hand (pakai deck dari save)
    this.initDeckFromSave();
    this.drawToHand(5);

    // Responsive layout
    this.scale.on("resize", (gs) => this.layout(gs.width, gs.height));
    this.layout(this.scale.width, this.scale.height);

    // Start: player wajib klik roll
    this.setPlayerNeedsRoll();
    this.updateUI();
  }

  initDeckFromSave() {
    const s = loadSave() ?? {};
    const chosen = (s.deck ?? []);
    const byId = new Map(this.supportPool.map(c => [c.id, c]));

    // pool yang dipakai battle = deck pilihan (10 kartu)
    const pickedCards = chosen.map(id => byId.get(id)).filter(Boolean);

    // fallback kalau deck kosong: pakai semua support
    const base = pickedCards.length ? pickedCards : this.supportPool;

    // bikin deck 20 kartu: 2 copy dari tiap kartu (atau sesuaikan)
    this.deck = [];
    for (let i = 0; i < 2; i++) base.forEach(c => this.deck.push({ ...c }));
    Phaser.Utils.Array.Shuffle(this.deck);

    this.discard = [];
    this.hand = [];
  }

  addLog(message) {
    this.logLines.push(message);

    // batasi 10 baris terakhir
    if (this.logLines.length > 10) {
      this.logLines.shift();
    }

    this.logText.setText(this.logLines.join("\n"));
  }

  // ===== Layout =====
  layout(W, H) {
    const PAD = 16;
    const TOP_H = 64;
    const HAND_H = 180;
    const INFO_W = 280;

    this.bg.setSize(W, H);
    this.overlay.setSize(W, H);

    this.topBg.setSize(W, TOP_H);

    // CENTER TOP BAR TEXT
    this.apText.setOrigin(0.5, 0);
    this.apText.setPosition(W / 2, 12);

    this.turnHint.setOrigin(0.5, 0);
    this.turnHint.setPosition(W / 2, 36);

    // top right buttons
    this.endBtn.r.setPosition(W - PAD - 160, 10);
    this.endBtn.t.setPosition(W - PAD - 160 + 80, 10 + 22);

    this.rollBtn.r.setPosition(W - PAD - 160 - 12 - 140, 10);
    this.rollBtn.t.setPosition(W - PAD - 160 - 12 - 140 + 70, 10 + 22);

    // menu button kiri atas
    this.btnMenu.r.setPosition(PAD, 10);
    this.btnMenu.t.setPosition(PAD + 60, 10 + 22);

    // wrap hint
    const rightButtonsWidth = 160 + 12 + 140;
    const usable = W - PAD * 2 - rightButtonsWidth - 20 - 140; // sisakan untuk MENU kiri
    this.turnHint.setWordWrapWidth(Math.max(260, usable));

    // info panel
    const midH = H - TOP_H - HAND_H - PAD * 2;
    const infoX = W - PAD - INFO_W;
    const infoY = TOP_H + PAD;
    
    const INFO_HEIGHT = 260;
    this.infoBg.setSize(INFO_W, INFO_HEIGHT);
    this.infoPanel.setPosition(infoX, infoY);

    this.infoPanel.setPosition(infoX, infoY);

    // LOG PANEL DI BAWAH INFO
    const infoBottom = this.infoPanel.y + this.infoBg.height + 12;

    this.logBg.setSize(280, 220);
    this.logPanel.setPosition(this.infoPanel.x, infoBottom);

    // board
    const boardX = PAD;
    const boardY = TOP_H + PAD;
    const boardW = W - INFO_W - PAD * 3;
    const boardH = midH;

    this.board.setPosition(boardX, boardY);

    this.enemyLabel.setPosition(0, 0);
    this.playerLabel.setPosition(0, boardH / 2);

    const cardW = Math.min(220, Math.max(150, Math.floor(boardW / 4)));
    const cardH = Math.min(240, Math.max(170, Math.floor(boardH / 3)));
    const gap = Math.floor((boardW - cardW * 3) / 4);
    const rowX0 = gap + cardW / 2;

    const enemyY = 40 + cardH / 2;
    const playerY = Math.floor(boardH / 2) + 40 + cardH / 2;

    this.placeRow(this.enemySlots, rowX0, enemyY, cardW, cardH, gap);
    this.placeRow(this.playerSlots, rowX0, playerY, cardW, cardH, gap);

    // hand bar
    const handY = H - HAND_H;
    this.handBg.setSize(W, HAND_H);
    this.handBar.setPosition(0, handY);

    // support cards centered
    const handAreaW = W - PAD * 2;
    const sW = Math.min(180, Math.max(130, Math.floor(handAreaW / 7)));
    const sH = 140;
    const sGap = Math.floor((handAreaW - sW * 5) / 6);
    const sX0 = PAD + sGap + sW / 2;
    const sY = 84;

    for (let i = 0; i < this.supportSlots.length; i++) {
      const s = this.supportSlots[i];
      const x = sX0 + i * (sW + sGap);
      s.rect.setPosition(x, sY).setSize(sW, sH);
      s.title.setPosition(x, sY - 18);
      s.cost.setPosition(x, sY + 52);
    }
  }

  placeRow(slots, x0, y, w, h, gap) {
    for (let i = 0; i < slots.length; i++) {
      const o = slots[i];
      const x = x0 + i * (w + gap);
      o.x = x; o.y = y;
      o.card.setPosition(x, y).setSize(w, h);
      o.name.setPosition(x, y - h / 2 + 22);
      o.hp.setPosition(x, y + h / 2 - 28);
      o.meta.setPosition(x, y + h / 2 - 10);
      o.glow.setPosition(x, y).setSize(w + 10, h + 10);
    }
  }

  // ===== UI Builders =====
  makeButton(x, y, w, h, label, onClick) {
    const r = this.add.rectangle(x, y, w, h, 0x2563eb).setOrigin(0, 0).setStrokeStyle(2, 0x1d4ed8);
    const t = this.add.text(x + w / 2, y + h / 2, label, { fontSize: "18px", color: "#fff" }).setOrigin(0.5);
    r.setInteractive({ useHandCursor: true });
    r.on("pointerdown", onClick);
    return { r, t };
  }

  setButtonEnabled(btn, enabled) {
    btn.r.disableInteractive();
    if (enabled) btn.r.setInteractive({ useHandCursor: true });
    btn.r.setFillStyle(enabled ? 0x2563eb : 0x1f2937);
    btn.t.setColor(enabled ? "#ffffff" : "#6b7280");
  }

  createTeamRow(count, isPlayer) {
    const slots = [];
    for (let i = 0; i < count; i++) {
      const data = isPlayer ? this.heroesData[i] : this.enemiesData[i];

      const card = this.add.rectangle(0, 0, 180, 220, 0x1f2937).setStrokeStyle(2, 0x374151);
      const name = this.add.text(0, 0, data.name, { fontSize: "18px", color: "#e5e7eb" }).setOrigin(0.5);
      const hp = this.add.text(0, 0, `HP:${data.maxHp}/${data.maxHp}`, { fontSize: "16px", color: "#a7f3d0" }).setOrigin(0.5);
      const meta = this.add.text(0, 0, isPlayer ? `U:0/3 | CD:0 | ATK+0` : "", { fontSize: "12px", color: "#9ca3af" }).setOrigin(0.5);
      const glow = this.add.rectangle(0, 0, 190, 230).setStrokeStyle(3, 0xfbbf24).setVisible(false);

      const obj = {
        id: i,
        isPlayer,
        data,
        x: 0, y: 0,
        card, name, hp, meta, glow,
        hpVal: data.maxHp,
        maxHp: data.maxHp,
        ultCharge: 0,
        skillCd: 0,
        atkBuff: 0,
        buffTurns: 0,
      };

      card.setInteractive({ useHandCursor: true });

      if (isPlayer) card.on("pointerdown", () => this.onHeroTap(obj));
      else card.on("pointerdown", () => this.onEnemyTap(obj));

      card.on("pointerover", () => { card.setFillStyle(0x273449); this.showInfo(obj); });
      card.on("pointerout", () => card.setFillStyle(0x1f2937));

      this.board.add([card, glow, name, hp, meta]);
      slots.push(obj);
    }
    return slots;
  }

  createSupportSlots(count) {
    const slots = [];
    for (let i = 0; i < count; i++) {
      const rect = this.add.rectangle(0, 0, 150, 140, 0x0f172a).setStrokeStyle(2, 0x334155);
      const title = this.add.text(0, 0, "-", { fontSize: "16px", color: "#e5e7eb", align: "center", wordWrap: { width: 160 } }).setOrigin(0.5);
      const cost = this.add.text(0, 0, "", { fontSize: "14px", color: "#9ca3af" }).setOrigin(0.5);

      rect.setInteractive({ useHandCursor: true });
      rect.on("pointerdown", () => this.onSupportTap(i));

      rect.on("pointerover", () => {
        rect.setFillStyle(0x13213d);
        const c = this.hand[i];
        if (c) this.infoText.setText(`SUPPORT: ${c.name}\nCost: ${c.cost}\nTarget: ${c.target}\nEffect: ${c.effect.type}`);
      });
      rect.on("pointerout", () => rect.setFillStyle(0x0f172a));

      slots.push({ rect, title, cost, index: i });
    }
    return slots;
  }

  createActionMenu() {
    const c = this.add.container(0, 0).setDepth(1000);
    const bg = this.add.rectangle(0, 0, 320, 170, 0x111827).setStrokeStyle(2, 0x374151).setOrigin(0);
    const title = this.add.text(16, 12, "PILIH AKSI", { fontSize: "18px", color: "#9ca3af" });

    const b1 = this.menuBtn(16, 48, `Normal ATK (${COST.normal} AP)`, () => this.chooseAction("normal"));
    const b2 = this.menuBtn(16, 92, `Skill (${COST.skill} AP)`, () => this.chooseAction("skill"));
    const b3 = this.menuBtn(16, 136, `ULT (${COST.ult} AP)`, () => this.chooseAction("ult"));

    c.add([bg, title, b1, b2, b3]);
    c.btns = { b1, b2, b3 };
    return c;
  }

  menuBtn(x, y, label, onClick) {
    const r = this.add.rectangle(x, y, 288, 36, 0x1f2937).setOrigin(0, 0).setStrokeStyle(1, 0x374151);
    const t = this.add.text(x + 10, y + 8, label, { fontSize: "16px", color: "#e5e7eb" });
    r.setInteractive({ useHandCursor: true });
    r.on("pointerdown", onClick);
    return new Phaser.GameObjects.Container(this, 0, 0, [r, t]);
  }

  setMenuBtnState(btn, enabled) {
    const rect = btn.list[0];
    const text = btn.list[1];
    rect.setFillStyle(enabled ? 0x1f2937 : 0x0b1220);
    text.setColor(enabled ? "#e5e7eb" : "#6b7280");
    rect.disableInteractive();
    if (enabled) rect.setInteractive({ useHandCursor: true });
  }

  // ===== Dice / Turns =====
  roll2d6() {
    const d1 = Phaser.Math.Between(1, 6);
    const d2 = Phaser.Math.Between(1, 6);
    return { d1, d2, total: d1 + d2 };
  }

  setPlayerNeedsRoll() {
    this.turn = "player";
    this.ap = 0;
    this.dice = { d1: 1, d2: 1, total: 0 };
    this.hasRolled = false;
    this.turnHint.setText("Klik ROLL untuk mulai turn.");
    this.cancelSelection();
    this.updateUI();
  }

  onRollClicked() {
    if (this.turn !== "player") return;
    if (this.hasRolled) return;

    const r = this.roll2d6();
    this.dice = r;
    this.ap = r.total;
    this.hasRolled = true;

    this.addLog(`PLAYER ROLL: ${r.d1}+${r.d2} = ${r.total} AP`);
    this.turnHint.setText(`Player turn — kamu punya ${r.total} AP. Klik Hero untuk aksi.`);
    this.updateUI();
  }

  startEnemyTurn() {
    this.turn = "enemy";
    const r = this.roll2d6();
    this.enemyDice = r;
    this.enemyAp = r.total;

    this.addLog(`ENEMY ROLL: ${r.d1}+${r.d2} = ${r.total} AP`);
    this.turnHint.setText(`Enemy turn — musuh punya ${r.total} AP...`);
    this.updateUI();

    this.time.delayedCall(900, () => this.enemyPlayWithDice());
  }

  enemyPlayWithDice() {
    const enemies = this.enemySlots.filter(e => e.hpVal > 0);
    const players = this.playerSlots.filter(p => p.hpVal > 0);
    if (!enemies.length || !players.length) return;

    const steps = [];
    let ap = this.enemyAp;
    while (ap >= COST.normal) {
      if (ap >= COST.ult) { steps.push("ult"); ap -= COST.ult; continue; }
      if (ap >= COST.skill) { steps.push("skill"); ap -= COST.skill; continue; }
      steps.push("normal"); ap -= COST.normal;
    }
    this.enemyAp = ap;
    this.updateUI();

    let i = 0;
    const doStep = () => {
      const playersAlive = this.playerSlots.filter(p => p.hpVal > 0);
      if (!playersAlive.length) return;

      if (i >= steps.length) {
        this.enemyAp = 0;
        this.updateUI();
        this.time.delayedCall(600, () => this.setPlayerNeedsRoll());
        return;
      }

      const target = Phaser.Utils.Array.GetRandom(playersAlive);
      const type = steps[i];

      this.flashTarget(target);

      this.time.delayedCall(450, () => {
        if (type === "ult") {
          playersAlive.forEach(p => this.dealDamageTo(p, 3));
          this.addLog("ENEMY ULT! (AOE -3)");
        } else if (type === "skill") {
          this.dealDamageTo(target, 5);
          this.addLog(`ENEMY Skill → ${target.data.name} (-5)`);
        } else {
          this.dealDamageTo(target, 2);
          this.addLog(`ENEMY Normal → ${target.data.name} (-2)`);
        }

        i++;
        this.updateUI();
        this.checkWinLose();
        this.time.delayedCall(900, doStep);
      });
    };

    doStep();
  }

  flashTarget(obj) {
    if (!obj || obj.hpVal <= 0) return;
    obj.glow.setVisible(true);
    this.time.delayedCall(350, () => obj.glow.setVisible(false));
  }

  // ===== Deck (Support) =====
  drawOne() {
    if (this.deck.length === 0) {
      if (this.discard.length === 0) return null;
      this.deck = this.discard.splice(0);
      Phaser.Utils.Array.Shuffle(this.deck);
    }
    return this.deck.pop();
  }

  drawToHand(n) {
    for (let i = 0; i < n; i++) {
      if (this.hand.length >= 5) break;
      const c = this.drawOne();
      if (!c) break;
      this.hand.push(c);
    }
    this.refreshHandUI();
  }

  discardFromHand(i) {
    const c = this.hand[i];
    if (!c) return;
    this.discard.push(c);
    this.hand.splice(i, 1);
    this.refreshHandUI();
  }

  refreshHandUI() {
    for (let i = 0; i < this.supportSlots.length; i++) {
      const s = this.supportSlots[i];
      const card = this.hand[i];
      if (!card) {
        s.title.setText("-");
        s.cost.setText("");
        s.rect.setAlpha(0.35);
      } else {
        s.title.setText(card.name);
        s.cost.setText(`COST ${card.cost}`);
        s.rect.setAlpha(1);
      }
    }
  }

  // ===== Info =====
  showInfo(obj) {
    if (!obj) return;
    if (obj.isPlayer) {
      this.infoText.setText(
        `${obj.data.name}\nHP: ${obj.hpVal}/${obj.maxHp}\nATK: ${obj.data.atk}\nSkill: ${obj.data.skillDmg}\nULT AOE: ${obj.data.ultAoe}\n\nULT: ${obj.ultCharge}/3\nSkill CD: ${obj.skillCd}\nATK Buff: +${obj.atkBuff} (${obj.buffTurns}T)`
      );
    } else {
      this.infoText.setText(
        `${obj.data.name}\nHP: ${obj.hpVal}/${obj.maxHp}\nATK: ${obj.data.atk}\nSkill: ${obj.data.skillDmg}\nULT AOE: ${obj.data.ultAoe}`
      );
    }
  }

  // ===== Interactions =====
  onHeroTap(hero) {
    if (this.turn !== "player") return;
    if (!this.hasRolled) return;

    if (this.targeting && this.pendingSupport?.card.target === "ally") {
      if (hero.hpVal > 0) this.resolveSupportTarget(hero);
      return;
    }

    if (this.targeting) return;
    if (hero.hpVal <= 0) return;

    this.selectedChar = hero;

    const canNormal = this.ap >= COST.normal;
    const canSkill  = this.ap >= COST.skill && hero.skillCd === 0;
    const canUlt    = this.ap >= COST.ult && hero.ultCharge >= 3;

    this.setMenuBtnState(this.actionMenu.btns.b1, canNormal);
    this.setMenuBtnState(this.actionMenu.btns.b2, canSkill);
    this.setMenuBtnState(this.actionMenu.btns.b3, canUlt);

    const menuW = 320, menuH = 170;
    const x = Phaser.Math.Clamp(hero.x - menuW / 2, 16, this.scale.width - 16 - menuW - 280 - 16);
    const y = Phaser.Math.Clamp(hero.y - 110, 90, this.scale.height - 200 - menuH);

    this.actionMenu.setPosition(this.board.x + x, this.board.y + y);
    this.actionMenu.setVisible(true);
    this.showInfo(hero);
  }

  chooseAction(type) {
    if (this.turn !== "player") return;
    if (!this.hasRolled) return;
    if (!this.selectedChar) return;

    if (type === "normal" && this.ap < COST.normal) return;
    if (type === "skill"  && (this.ap < COST.skill || this.selectedChar.skillCd > 0)) return;
    if (type === "ult"    && (this.ap < COST.ult || this.selectedChar.ultCharge < 3)) return;

    this.pendingAction = { type, from: this.selectedChar };
    this.actionMenu.setVisible(false);
    this.enterTargeting("enemy", `Pilih target untuk ${type.toUpperCase()}`);
  }

    onEnemyTap(enemy) {
    if (enemy.hpVal <= 0) return;

    // support target enemy
    if (this.targeting && this.pendingSupport?.card.target === "enemy") {
      this.resolveSupportTarget(enemy);
      return;
    }

    if (!this.targeting || !this.pendingAction) return;
    if (this.turn !== "player") return;
    if (!this.hasRolled) return;

    const { type, from } = this.pendingAction;

    if (type === "normal") {
      const dmg = from.data.atk + from.atkBuff;

      this.spendAP(COST.normal);
      this.dealDamageTo(enemy, dmg);
      from.ultCharge = Math.min(3, from.ultCharge + 1);

      this.addLog(` Player ${from.data.name} Normal → ${enemy.data.name} (-${dmg})`);
    }
    else if (type === "skill") {
      const dmg = from.data.skillDmg + from.atkBuff;

      this.spendAP(COST.skill);
      this.dealDamageTo(enemy, dmg);
      from.skillCd = 2;
      from.ultCharge = Math.min(3, from.ultCharge + 1);

      this.addLog(` Player ${from.data.name} Skill → ${enemy.data.name} (-${dmg})`);
    }
    else if (type === "ult") {
      this.spendAP(COST.ult);

      const hits = [];
      this.enemySlots.forEach(e => {
        if (e.hpVal > 0) {
          const dmg = from.data.ultAoe + from.atkBuff;
          this.dealDamageTo(e, dmg);
          hits.push(`${e.data.name}(-${dmg})`);
        }
      });

      from.ultCharge = 0;
      this.addLog(` Player ${from.data.name} ULT AOE → ${hits.join(", ")}`);
    }

    this.pendingAction = null;
    this.cancelSelection();
    this.updateUI();
    this.checkWinLose();
  }

  onSupportTap(i) {
    if (this.turn !== "player") return;
    if (!this.hasRolled) return;

    const card = this.hand[i];
    if (!card) return;
    if (this.ap < card.cost) { this.addLog("AP tidak cukup!"); return; }

    if (card.target === "ally" || card.target === "enemy") {
      this.pendingSupport = { card, handIndex: i };
      this.enterTargeting(card.target, `Pilih target: ${card.name}`);
      return;
    }

    this.playSupport(card, null);
    this.spendAP(card.cost);
    this.discardFromHand(i);
    this.updateUI();
  }

  resolveSupportTarget(targetObj) {
    const { card, handIndex } = this.pendingSupport;
    this.playSupport(card, targetObj);
    this.spendAP(card.cost);
    this.discardFromHand(handIndex);
    this.pendingSupport = null;

    this.cancelSelection();
    this.updateUI();
    this.checkWinLose();
  }

  // ===== Targeting =====
  enterTargeting(kind, msg) {
    this.targeting = true;
    this.overlay.setVisible(true).setFillStyle(0x000000, 0.25);

    this.clearHighlights();
    if (kind === "enemy") this.enemySlots.forEach(e => e.hpVal > 0 && e.glow.setVisible(true));
    if (kind === "ally")  this.playerSlots.forEach(p => p.hpVal > 0 && p.glow.setVisible(true));

    this.turnHint.setText(`${msg} (ESC / Right Click cancel)`);
  }

  clearHighlights() {
    this.playerSlots.forEach(p => p.glow.setVisible(false));
    this.enemySlots.forEach(e => e.glow.setVisible(false));
  }

  cancelSelection() {
    this.targeting = false;
    this.pendingAction = null;
    this.pendingSupport = null;
    this.selectedChar = null;

    this.actionMenu.setVisible(false);
    this.overlay.setVisible(false);
    this.clearHighlights();

    if (this.turn === "player") {
      if (!this.hasRolled) this.turnHint.setText("Klik ROLL untuk mulai turn.");
      else this.turnHint.setText(`Player turn — AP tersisa ${this.ap}.`);
    }
  }

  // ===== Combat / Effects =====
  spendAP(n) { this.ap = Math.max(0, this.ap - n); }

  dealDamageTo(target, dmg) {
    target.hpVal = Math.max(0, target.hpVal - dmg);
    this.floatText(this.board.x + target.x, this.board.y + target.y - 30, `-${dmg}`);
    this.tweens.add({
      targets: target.card, x: target.x + 7, yoyo: true, repeat: 3, duration: 40,
      onComplete: () => target.card.setPosition(target.x, target.y),
    });
  }

  playSupport(card, target) {
    const ef = card.effect;

    if (ef.type === "heal_all") {
      this.playerSlots.forEach(p => p.hpVal = Math.min(p.maxHp, p.hpVal + ef.value));
      this.addLog(`Support: ${card.name}`);
      return;
    }

    if (ef.type === "draw") {
      this.drawToHand(ef.value);
      this.addLog(`Support: Draw ${ef.value}`);
      return;
    }

    if (ef.type === "damage" && target) {
      this.dealDamageTo(target, ef.value);
      this.addLog(`Support: ${card.name}`);
      return;
    }

    if (ef.type === "buff_atk" && target) {
      target.atkBuff += ef.value;
      target.buffTurns = Math.max(target.buffTurns, ef.duration);
      this.addLog(`Support: +ATK ${ef.value} (${ef.duration}T)`);
      return;
    }

    if (ef.type === "charge_ult" && target) {
      target.ultCharge = Math.min(3, target.ultCharge + ef.value);
      this.addLog(`Support: Charge +${ef.value}`);
      return;
    }
  }

  endTurn() {
    if (this.turn !== "player") return;
    if (!this.hasRolled) return;

    this.playerSlots.forEach(p => {
      p.skillCd = Math.max(0, p.skillCd - 1);
      if (p.buffTurns > 0) {
        p.buffTurns--;
        if (p.buffTurns === 0) p.atkBuff = 0;
      }
    });

    this.drawToHand(1);

    this.cancelSelection();
    this.updateUI();
    this.checkWinLose();
    this.startEnemyTurn();
  }

  checkWinLose() {
    const enemyAlive = this.enemySlots.some(e => e.hpVal > 0);
    const playerAlive = this.playerSlots.some(p => p.hpVal > 0);
    if (!enemyAlive) this.addLog("MENANG!");
    if (!playerAlive) this.addLog("KALAH!");
  }

  updateUI() {
    this.apText.setText(
      `PLAYER AP: ${this.ap} (Roll ${this.dice.d1}+${this.dice.d2})   |   ENEMY AP: ${this.enemyAp} (Roll ${this.enemyDice.d1}+${this.enemyDice.d2})`
    );

    this.setButtonEnabled(this.rollBtn, this.turn === "player" && !this.hasRolled);

    this.playerSlots.forEach(p => {
      p.hp.setText(`HP:${p.hpVal}/${p.maxHp}`);
      p.meta.setText(`U:${p.ultCharge}/3 | CD:${p.skillCd} | ATK+${p.atkBuff}`);
      p.card.setAlpha(p.hpVal > 0 ? 1 : 0.35);
    });

    this.enemySlots.forEach(e => {
      e.hp.setText(`HP:${e.hpVal}/${e.maxHp}`);
      e.card.setAlpha(e.hpVal > 0 ? 1 : 0.35);
    });

    this.refreshHandUI();
  }

  floatText(x, y, msg) {
    const t = this.add.text(x, y, msg, { fontSize: "22px", color: "#fca5a5" }).setOrigin(0.5);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, duration: 600, onComplete: () => t.destroy() });
  }
}