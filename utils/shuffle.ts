// Model output tends to cluster correct answers on one letter; shuffle so position carries no signal.
// Per-option rationales move with their option.
export const shuffleOptions = <T extends { options: string[]; answerIndex: number; rationales?: string[] }>(q: T): T => {
  const order = q.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    rationales: q.rationales && order.map((i) => q.rationales![i]),
    answerIndex: order.indexOf(q.answerIndex),
  };
};
