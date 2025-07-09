/**
 * DeckManager - Handles deck creation, shuffling, and card dealing
 */
class DeckManager {
  constructor() {
    this.deck = [];
  }

  createDeck() {
    const SUITS = ['♠', '♥', '♦', '♣'];
    const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ suit, rank, id: `${rank}${suit}` });
      }
    }
    this.deck = this.shuffleDeck(deck);
    return this.deck;
  }

  shuffleDeck(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  dealCard() {
    if (this.deck.length > 0) {
      return this.deck.pop();
    }
    return null;
  }

  dealCards(count) {
    const cards = [];
    for (let i = 0; i < count; i++) {
      const card = this.dealCard();
      if (card) {
        cards.push(card);
      }
    }
    return cards;
  }

  getRemainingCards() {
    return this.deck.length;
  }

  reset() {
    this.deck = [];
  }
}

module.exports = DeckManager;
