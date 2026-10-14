import { groq, MODEL_ID } from './groqService';
import { ExamConfig, ExamFeedback, ExamQuestion, NodeType } from '../types';
import { shuffleOptions } from '../utils/shuffle';

// Groq free tier allows 8k tokens/minute for this model, so requests are small and sequential;
// the SDK waits out 429s via retry-after. ponytail: upgrade the Groq tier for larger parallel batches.
const BATCH = 2;

const LEVELS = {
  Beginner: 'Associate-level depth (e.g. AWS SAA/DVA/SOA, AZ-104/AZ-204, GCP ACE/PCD) applied to enterprise scenarios.',
  Advanced: 'Professional-level depth (e.g. AWS SAP/DOP, AZ-305/AZ-400, GCP PCA/PCDOE): multi-account/subscription, migration, DR with RPO/RTO, cost, governance.',
  Expert: 'Beyond professional exams: enterprise/chief-architect judgement — M&A integration, regulated workloads, global multi-region active-active, landing zones at 1000+ accounts, trade-offs with no perfect answer.',
};

const ROLE_FOCUS = {
  Architect: 'solution design, trade-offs, resilience, security architecture, migration strategy, cost optimisation, governance',
  Developer: 'application design, serverless/containers, SDK/API usage, CI/CD, data access patterns, observability, secure coding',
  Admin: 'operations, identity & access, networking, monitoring, backup/restore, patching, policy, incident response',
};

const json = async (system: string, user: string, temperature: number, effort: 'medium' | 'high' = 'medium') => {
  const res = await groq.chat.completions.create(
    {
    model: MODEL_ID,
    temperature,
    reasoning_effort: effort,
    max_completion_tokens: 5000,
    response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    },
    { maxRetries: 6 },
  );
  return JSON.parse(res.choices[0]?.message?.content || '{}');
};

const NODE_TYPES = Object.values(NodeType) as string[];

const clean = (raw: any, i: number): ExamQuestion | null => {
  if (!raw?.question || !Array.isArray(raw.options) || raw.options.length < 3) return null;
  const answerIndex = Number(raw.answerIndex);
  if (!(answerIndex >= 0 && answerIndex < raw.options.length)) return null;
  let diagram = raw.diagram;
  if (diagram?.nodes?.length) {
    const nodes = diagram.nodes.map((n: any) => ({ ...n, type: NODE_TYPES.includes(n.type) ? n.type : NodeType.SERVICE, details: n.details || '' }));
    const ids = new Set(nodes.map((n: any) => n.id));
    const edges = (diagram.edges || []).filter((e: any) => ids.has(e.source) && ids.has(e.target)).map((e: any, k: number) => ({ ...e, id: e.id || `e${k}` }));
    diagram = { nodes, edges };
  } else diagram = undefined;
  return shuffleOptions({
    id: `q${i}-${Math.random().toString(36).slice(2, 8)}`,
    role: raw.role,
    domain: raw.domain || 'General',
    scenario: raw.scenario || '',
    details: Array.isArray(raw.details) ? raw.details.map(String).filter(Boolean) : undefined,
    question: raw.question,
    options: raw.options.map((o: any) => String(o?.text ?? o)),
    answerIndex,
    explanation: raw.explanation || '',
    rationales: raw.options.every((o: any) => o?.why) ? raw.options.map((o: any) => String(o.why)) : undefined,
    diagram,
  });
};

const SYSTEM = `You are a principal cloud architect and certification exam author (AWS, Azure, Google Cloud).
You write realistic, enterprise-grade, scenario-based certification questions drawn from real projects.
Output ONLY a JSON object.`;

const batchPrompt = (cfg: ExamConfig, n: number, roles: string[], avoid: string[]) => `Write ${n} certification-style multiple-choice questions.

Cloud: ${cfg.cloud}${cfg.cloud === 'Hybrid' ? ' (on-premises datacenter + public cloud: Azure Arc, AWS Outposts, Anthos, ExpressRoute/Direct Connect/Interconnect, etc.)' : ''}${cfg.cloud === 'Multi-cloud' ? ' (workloads spanning AWS, Azure and GCP together)' : ''}
Level: ${cfg.level} — ${LEVELS[cfg.level]}
Roles for these questions, in order: ${roles.map((r, i) => `Q${i + 1}=${r} (${ROLE_FOCUS[r as keyof typeof ROLE_FOCUS]})`).join('; ')}
Do NOT repeat these topics already covered: ${avoid.join('; ') || 'none'}

Every question MUST:
- Describe a realistic enterprise use case like a real project brief, split for easy reading:
  - "scenario": 1-2 short sentences introducing a named fictional company, its industry and the goal.
  - "details": 4-7 short bullet strings, each starting with a label — "Scale:", "Current state:", "Requirement:", "Compliance:", "Constraint:" — covering users/regions/accounts/data volume, existing systems and pain points, business and compliance needs, and hard constraints (budget, RPO/RTO, latency, data residency, team skills, deadlines). One fact per bullet. The constraints must be what decides the correct answer.
- Ask what the ${roles.join('/')} should do, choosing the BEST option for the stated constraints.
- Have exactly 4 options, each {"text": the option, "why": one sentence on why it is correct or why it fails this scenario's constraints}, using real, current service names. All distractors must be plausible and technically valid on their own, wrong only for this scenario's constraints.
- Use different domains across the set (e.g. networking, identity, data, DR, migration, security, cost, observability, compute, DevOps, governance).
- Include "diagram" ONLY when the scenario describes an existing architecture worth visualising (about 1 in 3 questions). Diagram nodes: 3-8, type one of ${NODE_TYPES.join(', ')}. Otherwise omit "diagram".
- Keep the question itself out of "scenario"; put it only in "question".
- "explanation": 2-3 sentences on the key principle that decides the answer and the exam objective it maps to.
- NEVER refer to options by letter, number or position ("Option 2", "B", "the first") anywhere — options are shuffled before display. Refer to them by the service/approach name.

JSON shape:
{"questions":[{"role":"Architect","domain":"Disaster Recovery","scenario":"...","details":["Scale: ...","Current state: ...","Requirement: ...","Constraint: ..."],"question":"...","options":[{"text":"...","why":"..."},{"text":"...","why":"..."},{"text":"...","why":"..."},{"text":"...","why":"..."}],"answerIndex":0,"explanation":"...","diagram":{"nodes":[{"id":"n1","label":"...","type":"service","details":"..."}],"edges":[{"id":"e1","source":"n1","target":"n2","label":"..."}]}}]}`;

/** Streams questions to onBatch as they arrive; resolves with the total generated. */
export const generateExam = async (
  cfg: ExamConfig,
  onBatch: (qs: ExamQuestion[]) => void,
  isCancelled: () => boolean,
  existing: ExamQuestion[] = [], // already generated (resume) — avoided as topics and counted toward cfg.count
): Promise<number> => {
  const seeds = ['networking, identity, migration', 'data, disaster recovery, security', 'cost, governance, observability', 'compute, containers, DevOps', 'integration, analytics, compliance', 'hybrid connectivity, edge, resilience'];
  const covered = existing.map((q) => `${q.domain}: ${q.question.slice(0, 70)}`);
  let total = existing.length;
  let failures = 0;
  let lastError: unknown;

  while (total < cfg.count && failures < 3 && !isCancelled()) {
    const roles = Array.from({ length: Math.min(BATCH, cfg.count - total) }, (_, k) => cfg.roles[(total + k) % cfg.roles.length]);
    try {
      const res = await json(SYSTEM, batchPrompt(cfg, roles.length, roles, [...covered, `prefer topics: ${seeds[(total / BATCH) % seeds.length | 0]}`]), 0.9);
      const qs = ((res.questions || []) as any[]).map((raw, i) => clean(raw, total + i)).filter(Boolean).slice(0, cfg.count - total) as ExamQuestion[];
      if (!qs.length) throw new Error('empty batch');
      if (isCancelled()) break;
      qs.forEach((q) => covered.push(`${q.domain}: ${q.question.slice(0, 70)}`));
      total += qs.length;
      failures = 0;
      onBatch(qs);
    } catch (e) {
      console.warn('Exam batch failed', String(e).slice(0, 300));
      lastError = e;
      failures++;
    }
  }

  if (!total && !isCancelled()) throw lastError instanceof Error && /rate|413|429/i.test(lastError.message)
    ? new Error('The AI provider is rate-limiting requests. Wait a minute and try again.')
    : new Error('The AI returned no usable questions. Please try again.');
  return total;
};

export const getExamFeedback = async (cfg: ExamConfig, questions: ExamQuestion[], answers: (number | null)[]): Promise<ExamFeedback> => {
  const results = questions.map((q, i) => ({
    role: q.role,
    domain: q.domain,
    question: q.question,
    correct: answers[i] === q.answerIndex,
    chosen: answers[i] == null ? 'unanswered' : q.options[answers[i]!],
    rightAnswer: q.options[q.answerIndex],
  }));
  return json(
    'You are a senior cloud architecture mentor coaching people toward enterprise/system architect roles and certifications. Output ONLY a JSON object.',
    `A candidate took a ${cfg.level} ${cfg.cloud} exam for roles ${cfg.roles.join(' + ')}.
Results: ${JSON.stringify(results)}

Give specific, actionable coaching based on the mistakes (name the concepts and services they confused).
JSON shape: {"summary":"2-3 sentences","readiness":"one line on readiness for the matching real certification","strengths":["..."],"weakAreas":[{"area":"...","why":"what the wrong answers reveal","howToImprove":"concrete practice/lab/reading"}],"studyPlan":["week-by-week or step items"],"certifications":["recommended certs in order"]}`,
    0.4,
  );
};
