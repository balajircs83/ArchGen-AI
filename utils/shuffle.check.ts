// Run: npx tsx utils/shuffle.check.ts
import { shuffleOptions } from './shuffle';

const seen = new Set<number>();
for (let i = 0; i < 400; i++) {
  const s = shuffleOptions({ options: ['a', 'b', 'c', 'd'], rationales: ['ra', 'rb', 'rc', 'rd'], answerIndex: 2 });
  if (s.options[s.answerIndex] !== 'c') throw new Error('shuffle broke the answer mapping');
  if (s.options.some((o, k) => s.rationales![k] !== 'r' + o)) throw new Error('rationale detached from its option');
  seen.add(s.answerIndex);
}
if (seen.size !== 4) throw new Error('answer position is not random');
console.log('shuffle ok');
