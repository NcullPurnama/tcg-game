const SAVE_KEY = "tcg_save_v1";

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function makeDefaultSave(charactersData, supportsData) {
  const heroes = charactersData?.heroes ?? [];
  const cards = supportsData?.cards ?? [];

  const ownedHeroes = heroes.length ? [heroes[0].id] : [];
  const ownedSupports = cards.map(c => c.id);
  const deck = ownedSupports.slice(0, 10);

  return { ownedHeroes, ownedSupports, deck, currency: 999, lastGacha: null };
}