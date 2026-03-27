import Phaser from "phaser";

import BootScene from "./scenes/BootScene.js";
import MainMenuScene from "./scenes/MainMenuScene.js";
import GachaScene from "./scenes/GachaScene.js";
import DeckScene from "./scenes/DeckScene.js";
import BattleScene from "./scenes/BattleScene.js";

const config = {
  type: Phaser.AUTO,
  parent: "game",
  backgroundColor: "#0b1220",
  scale: { mode: Phaser.Scale.RESIZE, width: "100%", height: "100%" },
  scene: [BootScene, MainMenuScene, GachaScene, DeckScene, BattleScene],
};

new Phaser.Game(config);