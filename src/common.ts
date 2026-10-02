export type Random = () => number;
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const names = ['あなた', 'AI ソラ', 'AI モモ', 'AI レン'];
export type PlayingCard = { id: string; rank: number; suit: string };
export function deck(): PlayingCard[] {
  return ['♠', '♥', '♦', '♣'].flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}${i + 1}`, rank: i + 1, suit })));
}
export function cardLabel(card: PlayingCard): string {
  return card.rank === 0 ? '★ JOKER' : `${card.suit} ${['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][card.rank]}`;
}

