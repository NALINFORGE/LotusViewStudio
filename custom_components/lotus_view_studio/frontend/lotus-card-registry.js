/*
 * Lotus View Studio custom-card registry.
 */
import { lotusT } from "./lotus-i18n.js?v=0.13.0b0";

export const LOTUS_STACK_CARD_ENTRY = Object.freeze({
  type: "lotus-visual-stack",
  name: "Lotus Stack",
  description: "Carte composite graphique à zones fractionnables et fusionnables, enregistrée en picture-elements natif Home Assistant.",
  preview: true,
});

export const LOTUS_SLIDE_CARD_ENTRY = Object.freeze({
  type: "lotus-slide-card",
  name: "Lotus Slide",
  description: "Slider de validation d’action, horizontal ou vertical, entièrement personnalisable avec éditeur visuel.",
  preview: true,
});

export const LOTUS_DIGICODE_CARD_ENTRY = Object.freeze({
  type: "lotus-digicode-card",
  name: "Lotus Digicode",
  description: "Digicode responsive et personnalisable validant un code stocké dans une entité numérique Home Assistant.",
  preview: true,
});

function registerEntry(entry) {
  if (!Array.isArray(window.customCards)) window.customCards = [];
  const cards = window.customCards;
  const localized = { ...entry, description: lotusT(entry.description) };
  const existing = cards.find((card) => card?.type === entry.type);
  if (existing) Object.assign(existing, localized);
  else cards.push(localized);
  return cards;
}

export function registerLotusStackCard() {
  if (!Array.isArray(window.customCards)) window.customCards = [];
  const cards = window.customCards;
  for (let index = cards.length - 1; index >= 0; index -= 1) {
    if (cards[index]?.type === "visual-stack-card") cards.splice(index, 1);
  }
  return registerEntry(LOTUS_STACK_CARD_ENTRY);
}

export function registerLotusSlideCard() {
  return registerEntry(LOTUS_SLIDE_CARD_ENTRY);
}

export function registerLotusDigicodeCard() {
  return registerEntry(LOTUS_DIGICODE_CARD_ENTRY);
}

export function registerLotusCards() {
  registerLotusStackCard();
  registerLotusSlideCard();
  registerLotusDigicodeCard();
  return window.customCards;
}

registerLotusCards();
