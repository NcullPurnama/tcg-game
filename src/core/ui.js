export function makeBtn(scene, x, y, w, h, label, onClick) {
  const r = scene.add.rectangle(x, y, w, h, 0x2563eb)
    .setStrokeStyle(2, 0x1d4ed8)
    .setOrigin(0.5);

  const t = scene.add.text(x, y, label, { fontSize: "22px", color: "#ffffff" })
    .setOrigin(0.5);

  r.setInteractive({ useHandCursor: true });
  r.on("pointerdown", onClick);
  r.on("pointerover", () => r.setFillStyle(0x1d4ed8));
  r.on("pointerout", () => r.setFillStyle(0x2563eb));

  return { r, t, destroy: () => { r.destroy(); t.destroy(); } };
}