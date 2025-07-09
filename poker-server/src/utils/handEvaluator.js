// Poker hand evaluation functions
function getHandRank(cards) {
  const suits = cards.map(c => c.suit);
  const ranks = cards.map(c => c.rank);
  const rankCounts = {};
  
  // Count ranks
  ranks.forEach(rank => {
    rankCounts[rank] = (rankCounts[rank] || 0) + 1;
  });
  
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const uniqueRanks = Object.keys(rankCounts).length;
  
  // Convert rank to number for comparison (A=14, K=13, Q=12, J=11)
  const rankValue = (rank) => {
    if (rank === 'A') return 14;
    if (rank === 'K') return 13;
    if (rank === 'Q') return 12;
    if (rank === 'J') return 11;
    return parseInt(rank);
  };
  
  const sortedRanks = Object.keys(rankCounts)
    .sort((a, b) => rankValue(b) - rankValue(a));
  
  const isFlush = suits.every(suit => suit === suits[0]);
  const rankValues = ranks.map(rankValue).sort((a, b) => b - a);
  const isStraight = rankValues.every((val, i) => i === 0 || val === rankValues[i-1] - 1);
  
  // Determine hand type and return [handRank, tiebreakers...]
  if (isStraight && isFlush) return [8, rankValues[0]]; // Straight flush
  if (counts[0] === 4) return [7, rankValue(sortedRanks[0])]; // Four of a kind
  if (counts[0] === 3 && counts[1] === 2) return [6, rankValue(sortedRanks[0]), rankValue(sortedRanks[1])]; // Full house
  if (isFlush) return [5, ...rankValues]; // Flush
  if (isStraight) return [4, rankValues[0]]; // Straight
  if (counts[0] === 3) return [3, rankValue(sortedRanks[0]), ...sortedRanks.slice(1).map(rankValue)]; // Three of a kind
  if (counts[0] === 2 && counts[1] === 2) {
    // Two pair
    const pairs = sortedRanks.filter(rank => rankCounts[rank] === 2).map(rankValue).sort((a, b) => b - a);
    const kicker = sortedRanks.find(rank => rankCounts[rank] === 1);
    return [2, pairs[0], pairs[1], rankValue(kicker)];
  }
  if (counts[0] === 2) {
    // One pair
    const pair = sortedRanks.find(rank => rankCounts[rank] === 2);
    const kickers = sortedRanks.filter(rank => rankCounts[rank] === 1).map(rankValue).sort((a, b) => b - a);
    return [1, rankValue(pair), ...kickers];
  }
  
  // High card
  return [0, ...rankValues];
}

function getBestHand(playerCards, communityCards) {
  // Ensure both parameters are arrays
  if (!Array.isArray(playerCards)) {
    console.error('getBestHand: playerCards is not an array:', playerCards);
    return null;
  }
  if (!Array.isArray(communityCards)) {
    console.error('getBestHand: communityCards is not an array:', communityCards);
    return null;
  }
  
  const allCards = [...playerCards, ...communityCards];
  
  // Ensure we have enough cards
  if (allCards.length < 5) {
    console.error('getBestHand: Not enough cards for evaluation. Total cards:', allCards.length);
    return null;
  }
  
  console.log('getBestHand: Evaluating with', allCards.length, 'cards');
  
  let bestHand = null;
  let bestRank = [-1];
  
  // Try all combinations of 5 cards from 7 available
  for (let i = 0; i < allCards.length - 4; i++) {
    for (let j = i + 1; j < allCards.length - 3; j++) {
      for (let k = j + 1; k < allCards.length - 2; k++) {
        for (let l = k + 1; l < allCards.length - 1; l++) {
          for (let m = l + 1; m < allCards.length; m++) {
            const hand = [allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]];
            const rank = getHandRank(hand);
            
            if (compareHands(rank, bestRank) > 0) {
              bestRank = rank;
              bestHand = hand;
            }
          }
        }
      }
    }
  }
  
  if (!bestHand) {
    console.error('getBestHand: Failed to find any valid hand combination');
    return null;
  }
  
  console.log('getBestHand: Best hand found with rank:', bestRank);
  return { hand: bestHand, rank: bestRank };
}

function compareHands(hand1Rank, hand2Rank) {
  for (let i = 0; i < Math.max(hand1Rank.length, hand2Rank.length); i++) {
    const val1 = hand1Rank[i] || 0;
    const val2 = hand2Rank[i] || 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
}

function getHandDescription(rank) {
  if (!rank || !Array.isArray(rank) || rank.length === 0) {
    console.error('getHandDescription: Invalid rank provided:', rank);
    return 'Unknown';
  }
  
  const handTypes = [
    'High Card', 'One Pair', 'Two Pair', 'Three of a Kind', 
    'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush'
  ];
  
  const rankName = (val) => {
    if (val === 14) return 'A';
    if (val === 13) return 'K';
    if (val === 12) return 'Q';
    if (val === 11) return 'J';
    return val.toString();
  };
  
  const handTypeIndex = rank[0];
  const handType = handTypes[handTypeIndex];
  
  if (!handType) {
    console.error('getHandDescription: Unknown hand type index:', handTypeIndex);
    return 'Unknown';
  }
  
  switch (handTypeIndex) {
    case 0: // High card
      return `${handType} (${rankName(rank[1])} high)`;
    case 1: // One pair
      return `${handType} (${rankName(rank[1])}s)`;
    case 2: // Two pair
      return `${handType} (${rankName(rank[1])}s and ${rankName(rank[2])}s)`;
    case 3: // Three of a kind
      return `${handType} (${rankName(rank[1])}s)`;
    case 4: // Straight
      return `${handType} (${rankName(rank[1])} high)`;
    case 5: // Flush
      return `${handType} (${rankName(rank[1])} high)`;
    case 6: // Full house
      return `${handType} (${rankName(rank[1])}s full of ${rankName(rank[2])}s)`;
    case 7: // Four of a kind
      return `${handType} (${rankName(rank[1])}s)`;
    case 8: // Straight flush
      return `${handType} (${rankName(rank[1])} high)`;
    default:
      console.error('getHandDescription: Unhandled hand type:', handTypeIndex, handType);
      return handType;
  }
}

module.exports = {
  getHandRank,
  getBestHand,
  compareHands,
  getHandDescription
};
