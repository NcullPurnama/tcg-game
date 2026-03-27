import Phaser from "phaser";
import { makeBtn } from "../core/ui.js";

export default class MainMenuScene extends Phaser.Scene {
  constructor() { super("MainMenu"); }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    this.add.rectangle(W/2, H/2, W, H, 0x0b1220);
    this.add.text(W/2, 110, "TCG PROTOTYPE", { fontSize: "48px", color: "#e5e7eb" }).setOrigin(0.5);

    makeBtn(this, W/2, 260, 320, 64, "PLAY", () => this.scene.start("Battle"));
    makeBtn(this, W/2, 340, 320, 64, "GACHA", () => this.scene.start("Gacha"));
    makeBtn(this, W/2, 420, 320, 64, "DECK", () => this.scene.start("Deck"));
    makeBtn(this, W/2, 500, 320, 64, "EXIT", () => {
      this.add.text(W/2, 560, "Silakan tutup tab/window.", { fontSize: "16px", color: "#fca5a5" }).setOrigin(0.5);
    });
  }
}