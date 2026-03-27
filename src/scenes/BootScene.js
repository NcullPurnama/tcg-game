import Phaser from "phaser";
import { loadSave, saveSave, makeDefaultSave } from "../core/save.js";

export default class BootScene extends Phaser.Scene {
  constructor() { super("Boot"); }

  preload() {
    this.load.json("characters", "assets/data/characters.json");
    this.load.json("supports", "assets/data/supports.json");
  }

  create() {
    const characters = this.cache.json.get("characters");
    const supports = this.cache.json.get("supports");

    this.registry.set("characters", characters);
    this.registry.set("supports", supports);

    let s = loadSave();
    if (!s) {
      s = makeDefaultSave(characters, supports);
      saveSave(s);
    }

    this.scene.start("MainMenu");
  }
}