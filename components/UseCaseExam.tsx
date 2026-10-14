import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, CheckCircle2, ChevronLeft, ChevronRight, Clock, GraduationCap, Loader2, RotateCcw, Sparkles, Target, TrendingUp, XCircle, Award, BookOpen, Maximize2, Minimize2, Pause, Play, Trash2, History } from 'lucide-react';
import ArchitectureDiagram from './ArchitectureDiagram';
import { generateExam, getExamFeedback } from '../services/examService';
import { shuffleOptions } from '../utils/shuffle';
import { examStore, SavedExam } from '../services/examStore';
import { Cloud, ExamConfig, ExamFeedback, ExamLevel, ExamQuestion, ExamRole, GeneratedArchitecture } from '../types';

const CLOUDS: Cloud[] = ['AWS', 'Azure', 'GCP', 'Hybrid', 'Multi-cloud'];
const LEVELS: [ExamLevel, string][] = [
  ['Beginner', 'Associate-level'],
  ['Advanced', 'Professional-level'],
  ['Expert', 'Enterprise architect'],
];
const ROLES: ExamRole[] = ['Architect', 'Developer', 'Admin'];
const COUNTS = [5, 10, 15, 20];
const PASS = 70;
const LETTERS = 'ABCDEF';

const card = 'rounded-xl border border-line bg-surface';
const chip = (on: boolean) =>
  `h-9 px-3.5 rounded-lg border text-sm font-medium transition-colors ${on ? 'bg-accent-soft border-accent text-fg' : 'border-line bg-surface hover:bg-surface2 text-muted hover:text-fg'}`;
const primary = 'h-9 px-4 flex items-center gap-2 rounded-lg bg-fg text-app text-sm font-semibold disabled:opacity-40';
const ghost = 'h-9 px-3 flex items-center gap-1.5 rounded-lg border border-line bg-surface text-sm font-medium hover:bg-surface2 disabled:opacity-40';
// Text scale for the exam view; fullscreen starts at Large.
const SIZES = [
  { label: 'Normal', body: 'text-sm', question: 'text-base', pad: 'p-3' },
  { label: 'Large', body: 'text-base', question: 'text-lg', pad: 'p-3.5' },
  { label: 'Extra large', body: 'text-lg', question: 'text-xl', pad: 'p-4' },
];

// Older questions have a paragraph only; split its sentences into bullets after the intro.
const sentences = (t: string) => t.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map((x) => x.trim()).filter(Boolean);

const Bullet: React.FC<{ text: string }> = ({ text }) => {
  const m = text.match(/^([A-Z][\w /&-]{1,24}):\s*(.+)$/);
  return <li>{m ? <><span className="font-semibold">{m[1]}:</span> {m[2]}</> : text}</li>;
};

const Scenario: React.FC<{ q: ExamQuestion; className?: string }> = ({ q, className = 'text-sm' }) => {
  const [intro, ...rest] = q.details?.length ? [q.scenario, ...q.details] : sentences(q.scenario);
  return (
    <div className={`${className} leading-relaxed space-y-2`}>
      {intro && <p>{intro}</p>}
      {rest.length > 0 && <ul className="list-disc pl-5 space-y-1 marker:text-muted">{rest.map((b, i) => <Bullet key={i} text={b} />)}</ul>}
    </div>
  );
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div className="mb-2">
    <div className="text-sm font-semibold">{children}</div>
    {hint && <div className="text-[11px] text-muted">{hint}</div>}
  </div>
);

const QuestionDiagram: React.FC<{ q: ExamQuestion; theme: 'dark' | 'light'; className?: string }> = ({ q, theme, className = 'h-72' }) => {
  const data = useMemo(() => ({ title: '', explanation: '', ...q.diagram! }) as GeneratedArchitecture, [q]);
  return (
    <div className={`${className} rounded-lg border border-line overflow-hidden`}>
      <ArchitectureDiagram data={data} onNodeClick={() => {}} theme={theme} showMiniMap={false} />
    </div>
  );
};

const UseCaseExam: React.FC<{ theme: 'dark' | 'light'; userId: string }> = ({ theme, userId }) => {
  const [cfg, setCfg] = useState<ExamConfig>({ count: 10, cloud: 'AWS', level: 'Advanced', roles: ['Architect'] });
  const [phase, setPhase] = useState<'setup' | 'loading' | 'exam' | 'results'>('setup');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ExamFeedback | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [target, setTarget] = useState(0);
  const [size, setSizeState] = useState(() => Number(localStorage.getItem('archgen-exam-size')) || 0);
  const setSize = (n: number) => { const v = Math.max(0, Math.min(SIZES.length - 1, n)); localStorage.setItem('archgen-exam-size', String(v)); setSizeState(v); };
  const [isFullscreen, setIsFullscreen] = useState(false);
  const fsRef = useRef<HTMLDivElement>(null);
  const [examId, setExamId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedExam[] | null>(null);
  const run = useRef(0); // bumps on each new exam so stale background batches are dropped

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!fsRef.current && document.fullscreenElement === fsRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) return document.exitFullscreen();
    await fsRef.current?.requestFullscreen();
    if (size === 0) setSize(1);
  };

  useEffect(() => {
    if (phase !== 'exam') return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  const secs = () => Math.round((Date.now() - startedAt) / 1000);

  // Saved exams list, refreshed whenever the setup screen is shown.
  useEffect(() => {
    if (phase === 'setup') examStore.list(userId).then(setSaved, (e) => { console.error(e); setSaved([]); });
  }, [phase, userId]);

  // Auto-save progress (debounced) while an exam is in progress.
  useEffect(() => {
    if (!examId || phase !== 'exam') return;
    const t = setTimeout(() => examStore.update(examId, { questions, answers, current, elapsed: secs() }).catch(console.error), 800);
    return () => clearTimeout(t);
  }, [examId, phase, questions, answers, current]);

  const load = (qs: ExamQuestion[], ans: (number | null)[], cur: number, el: number) => {
    setQuestions(qs);
    setAnswers(ans);
    setCurrent(cur);
    setStartedAt(Date.now() - el * 1000);
    setElapsed(el);
    setFeedback(null);
    setFeedbackError(false);
    setOpen(null);
  };

  // Streams questions into the current exam; resumes a partially generated exam when `existing` is given.
  const generate = async (config: ExamConfig, existing: ExamQuestion[], onFirst?: (qs: ExamQuestion[]) => void) => {
    const id = ++run.current;
    setTarget(config.count);
    setGenerating(true);
    let first = !!onFirst;
    try {
      const total = await generateExam(
        config,
        (qs) => {
          if (first) { first = false; onFirst!(qs); return; }
          setQuestions((prev) => [...prev, ...qs]);
          setAnswers((prev) => [...prev, ...qs.map(() => null)]);
        },
        () => run.current !== id,
        existing,
      );
      if (run.current === id) setTarget(total);
    } catch (e: any) {
      console.error(e);
      if (run.current !== id) return;
      if (existing.length) { setTarget(existing.length); return; }
      setError(e?.message || 'Failed to generate the exam. Please try again.');
      setPhase('setup');
    } finally {
      if (run.current === id) setGenerating(false);
    }
  };

  const startSaved = (qs: ExamQuestion[], config: ExamConfig) => {
    const id = run.current;
    load(qs, qs.map(() => null), 0, 0);
    setExamId(null);
    setPhase('exam');
    examStore
      .create(userId, { config, questions: qs, answers: qs.map(() => null), current: 0, elapsed: 0, status: 'in_progress' })
      .then((docId) => run.current === id && setExamId(docId), (e) => console.error('Could not save exam', e));
  };

  const start = () => {
    setError(null);
    setPhase('loading');
    const config = { ...cfg };
    generate(config, [], (qs) => startSaved(qs, config));
  };

  const stopGenerating = () => {
    run.current++;
    setGenerating(false);
  };

  const pause = async () => {
    stopGenerating();
    if (document.fullscreenElement) document.exitFullscreen();
    if (examId) await examStore.update(examId, { questions, answers, current, elapsed: secs() }).catch(console.error);
    setExamId(null);
    setPhase('setup');
  };

  const newExam = () => {
    stopGenerating();
    setExamId(null);
    setPhase('setup');
  };

  const fetchFeedback = async (id: string | null, qs: ExamQuestion[], ans: (number | null)[], config: ExamConfig) => {
    setFeedbackError(false);
    try {
      const fb = await getExamFeedback(config, qs, ans);
      setFeedback(fb);
      if (id) examStore.update(id, { feedback: fb }).catch(console.error);
    } catch (e) {
      console.error(e);
      setFeedbackError(true);
    }
  };

  const resume = (x: SavedExam) => {
    stopGenerating();
    setCfg(x.config);
    load(x.questions, x.answers, Math.min(x.current, x.questions.length - 1), x.elapsed);
    setExamId(x.id);
    setTarget(x.config.count);
    if (x.status === 'completed') {
      setTarget(x.questions.length);
      setPhase('results');
      if (x.feedback) setFeedback(x.feedback);
      else fetchFeedback(x.id, x.questions, x.answers, x.config);
      return;
    }
    setPhase('exam');
    if (x.questions.length < x.config.count) generate(x.config, x.questions);
    else setTarget(x.questions.length);
  };

  const remove = async (x: SavedExam) => {
    if (!confirm('Delete this exam and its progress?')) return;
    setSaved((list) => list?.filter((e) => e.id !== x.id) ?? null);
    await examStore.remove(x.id).catch(console.error);
  };

  const submit = async () => {
    const unanswered = answers.filter((a) => a == null).length;
    if (unanswered && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
    const el = secs();
    setElapsed(el);
    setPhase('results');
    const score = Math.round((questions.filter((q, i) => answers[i] === q.answerIndex).length / questions.length) * 100);
    if (examId) examStore.update(examId, { questions, answers, elapsed: el, status: 'completed', score, config: { ...cfg, count: questions.length } }).catch(console.error);
    fetchFeedback(examId, questions, answers, cfg);
  };

  const toggleRole = (r: ExamRole) =>
    setCfg((c) => {
      const roles = c.roles.includes(r) ? c.roles.filter((x) => x !== r) : [...c.roles, r];
      return { ...c, roles: roles.length ? ROLES.filter((x) => roles.includes(x)) : c.roles };
    });

  // ---------- Setup ----------
  if (phase === 'setup' || phase === 'loading') {
    const loading = phase === 'loading';
    return (
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-4xl space-y-4">
          <div className={`${card} p-5 space-y-6`}>
            <div>
              <Label hint="The exam starts after the first questions arrive; the rest load while you answer">Number of questions</Label>
              <div className="flex flex-wrap items-center gap-2">
                {COUNTS.map((n) => (
                  <button key={n} disabled={loading} onClick={() => setCfg({ ...cfg, count: n })} className={chip(cfg.count === n)}>{n}</button>
                ))}
                <input
                  type="number" min={1} max={30} value={cfg.count} disabled={loading}
                  onChange={(e) => setCfg({ ...cfg, count: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                  className="h-9 w-20 px-3 rounded-lg border border-line bg-surface2 text-sm outline-none focus:ring-2 focus:ring-accent"
                  aria-label="Custom number of questions"
                />
              </div>
            </div>

            <div>
              <Label>Cloud platform</Label>
              <div className="flex flex-wrap gap-2">
                {CLOUDS.map((c) => (
                  <button key={c} disabled={loading} onClick={() => setCfg({ ...cfg, cloud: c })} className={chip(cfg.cloud === c)}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <Label>Level</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {LEVELS.map(([l, d]) => (
                  <button key={l} disabled={loading} onClick={() => setCfg({ ...cfg, level: l })}
                    className={`p-3 rounded-lg border text-left transition-colors ${cfg.level === l ? 'bg-accent-soft border-accent' : 'border-line hover:bg-surface2'}`}>
                    <div className="text-sm font-semibold">{l}</div>
                    <div className="text-[11px] text-muted">{d}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label hint="Pick one or combine roles; questions are spread across them">Roles</Label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => (
                  <button key={r} disabled={loading} onClick={() => toggleRole(r)} className={chip(cfg.roles.includes(r))} aria-pressed={cfg.roles.includes(r)}>
                    {cfg.roles.includes(r) && <CheckCircle2 className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />}{r}
                  </button>
                ))}
              </div>
            </div>

            {error && <div className="px-3 py-2 rounded-lg border border-red-500/40 bg-red-500/10 text-red-500 text-sm">{error}</div>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
              <div className="text-xs text-muted">
                {cfg.count} questions · {cfg.cloud} · {cfg.level} · {cfg.roles.join(' + ')} · pass mark {PASS}%
              </div>
              <button onClick={start} disabled={loading} className={primary}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {loading ? 'Writing your first questions…' : 'Generate exam'}
              </button>
            </div>
          </div>

          <div className={card}>
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <History className="w-4 h-4" />
              <div>
                <div className="font-semibold">Your exams</div>
                <div className="text-[11px] text-muted">Progress is saved automatically — pause and continue any time</div>
              </div>
            </div>
            {saved === null ? (
              <div className="p-6 flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : saved.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">No exams yet. Generate one above.</div>
            ) : (
              saved.map((x) => {
                const done = x.status === 'completed';
                const answered = x.answers.filter((a) => a != null).length;
                const total = done ? x.questions.length : x.config.count;
                return (
                  <div key={x.id} className="px-4 py-3 border-t border-line first:border-t-0 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{x.config.cloud} · {x.config.level} · {x.config.roles.join(' + ')}</div>
                      <div className="text-[11px] text-muted">
                        {total} questions · {fmt(x.elapsed)} spent · {new Date(x.updatedAt).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    {done ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${(x.score ?? 0) >= PASS ? 'bg-accent-soft border-accent/50' : 'bg-red-500/10 border-red-500/40 text-red-500'}`}>Score {x.score ?? 0}%</span>
                    ) : (
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <span className="w-20 h-1.5 rounded-full bg-surface2 overflow-hidden"><span className="block h-full bg-accent" style={{ width: `${(answered / total) * 100}%` }} /></span>
                        {answered}/{total} answered
                      </span>
                    )}
                    <div className="flex items-center gap-1">
                      <button onClick={() => resume(x)} disabled={loading} className={ghost}>
                        {done ? <><BookOpen className="w-4 h-4" /> Review</> : <><Play className="w-4 h-4" /> Continue</>}
                      </button>
                      <button onClick={() => remove(x)} disabled={loading} className="h-9 w-9 flex items-center justify-center rounded-lg text-muted hover:text-red-500" title="Delete" aria-label="Delete exam">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  const correct = questions.filter((q, i) => answers[i] === q.answerIndex).length;

  // ---------- Exam ----------
  if (phase === 'exam') {
    const q = questions[current];
    const answered = answers.filter((a) => a != null).length;
    const sz = SIZES[size];
    return (
      <div ref={fsRef} className={`flex-1 min-h-0 flex flex-col gap-3 ${isFullscreen ? 'bg-app text-fg p-4 md:p-8' : ''}`}>
        <div className={`${card} px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2`}>
          <span className="text-sm font-semibold">Question {current + 1} of {target}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft border border-accent/50">{q.role}</span>
          <span className="text-xs text-muted">{q.domain}</span>
          <span className="ml-auto flex items-center gap-4 text-xs text-muted">
            {generating && <span className="flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Writing questions {questions.length}/{target}</span>}
            <span>{answered}/{target} answered</span>
            <span className="flex items-center gap-1 tabular-nums"><Clock className="w-3.5 h-3.5" />{fmt(elapsed)}</span>
            <span className="flex items-center rounded-lg border border-line overflow-hidden text-fg" role="group" aria-label="Text size">
              <button onClick={() => setSize(size - 1)} disabled={size === 0} className="h-7 px-2 text-xs hover:bg-surface2 disabled:opacity-40" title="Smaller text" aria-label="Smaller text">A−</button>
              <span className="h-7 px-2 flex items-center border-x border-line text-[11px] text-muted min-w-[72px] justify-center">{sz.label}</span>
              <button onClick={() => setSize(size + 1)} disabled={size === SIZES.length - 1} className="h-7 px-2 text-sm font-semibold hover:bg-surface2 disabled:opacity-40" title="Larger text" aria-label="Larger text">A+</button>
            </span>
            <button onClick={pause} disabled={!examId} className="h-7 px-2 flex items-center gap-1.5 rounded-lg border border-line text-fg text-xs hover:bg-surface2 disabled:opacity-40" title={examId ? 'Save progress and continue later' : 'Saving…'}>
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
            <button onClick={toggleFullscreen} className="h-7 px-2 flex items-center gap-1.5 rounded-lg border border-line text-fg text-xs hover:bg-surface2" title={isFullscreen ? 'Exit full screen (Esc)' : 'Full screen'}>
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}{isFullscreen ? 'Exit' : 'Full screen'}
            </button>
          </span>
          <div className="w-full h-1 rounded-full bg-surface2 overflow-hidden">
            <div className="h-full bg-accent transition-all" style={{ width: `${(answered / target) * 100}%` }} />
          </div>
        </div>

        {/* With a diagram: diagram left, use case + question right (stacked on small screens). */}
        <div className={`flex-1 min-h-0 overflow-y-auto lg:overflow-hidden ${q.diagram ? 'grid grid-cols-1 lg:grid-cols-2 gap-3' : ''}`}>
          {q.diagram && (
            <div className={`${card} p-3 flex flex-col min-h-0`}>
              <div className="flex items-center justify-between px-1 pb-2 text-[11px] font-semibold text-muted uppercase tracking-wide">
                <span>Current architecture</span>
                <span className="normal-case font-normal tracking-normal">Scroll to zoom · drag to pan</span>
              </div>
              {/* key remounts per question so the diagram re-fits its new nodes */}
              <QuestionDiagram key={q.id} q={q} theme={theme} className="h-[420px] shrink-0 lg:shrink lg:h-auto lg:flex-1 min-h-0" />
            </div>
          )}
          <div className={`min-h-0 pr-1 ${q.diagram ? 'lg:overflow-y-auto' : 'h-full overflow-y-auto'}`}>
          <div className={`${card} p-5 md:p-6 space-y-5 ${q.diagram ? '' : 'max-w-5xl mx-auto'}`}>
            <div className="rounded-lg bg-surface2 border border-line p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted uppercase tracking-wide mb-2"><Building2 className="w-3.5 h-3.5" /> Use case</div>
              <Scenario q={q} className={sz.body} />
            </div>
            <p className={`${sz.question} font-semibold leading-relaxed`}>{q.question}</p>
            <div className="space-y-2" role="radiogroup">
              {q.options.map((opt, i) => {
                const on = answers[current] === i;
                return (
                  <button key={i} role="radio" aria-checked={on}
                    onClick={() => setAnswers(answers.map((a, k) => (k === current ? i : a)))}
                    className={`w-full flex items-start gap-3 ${sz.pad} rounded-lg border text-left ${sz.body} transition-colors ${on ? 'bg-accent-soft border-accent' : 'border-line hover:bg-surface2'}`}>
                    <span className={`w-6 h-6 shrink-0 rounded-md border flex items-center justify-center text-xs font-semibold ${on ? 'bg-accent text-accent-fg border-accent' : 'border-line text-muted'}`}>{LETTERS[i]}</span>
                    <span className="pt-0.5 leading-relaxed">{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </div>

        <div className={`${card} px-4 py-3 flex flex-wrap items-center gap-3`}>
          <button onClick={() => setCurrent(current - 1)} disabled={current === 0} className={ghost}><ChevronLeft className="w-4 h-4" /> Previous</button>
          <div className="flex-1 flex flex-wrap justify-center gap-1">
            {questions.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} aria-label={`Go to question ${i + 1}`}
                className={`w-7 h-7 rounded-md text-xs font-medium border ${i === current ? 'border-fg' : 'border-line'} ${answers[i] != null ? 'bg-accent-soft' : 'bg-surface'}`}>
                {i + 1}
              </button>
            ))}
            {generating && Array.from({ length: Math.max(0, target - questions.length) }, (_, i) => (
              <span key={`p${i}`} className="w-7 h-7 rounded-md border border-dashed border-line text-xs text-muted flex items-center justify-center" title="Being written">{questions.length + i + 1}</span>
            ))}
          </div>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent(current + 1)} className={ghost}>Next <ChevronRight className="w-4 h-4" /></button>
          ) : generating ? (
            <button disabled className={ghost}><Loader2 className="w-4 h-4 animate-spin" /> Next question loading</button>
          ) : null}
          <button onClick={submit} disabled={generating} className={primary} title={generating ? 'Available once all questions are loaded' : undefined}>Submit exam</button>
        </div>
      </div>
    );
  }

  // ---------- Results ----------
  const pct = Math.round((correct / questions.length) * 100);
  const passed = pct >= PASS;
  const byDomain = Object.entries(
    questions.reduce<Record<string, [number, number]>>((acc, q, i) => {
      const [c, t] = acc[q.domain] || [0, 0];
      acc[q.domain] = [c + (answers[i] === q.answerIndex ? 1 : 0), t + 1];
      return acc;
    }, {}),
  ).sort((a, b) => a[1][0] / a[1][1] - b[1][0] / b[1][1]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`rounded-xl border p-4 ${passed ? 'border-accent bg-accent-soft' : 'border-red-500/40 bg-red-500/10'}`}>
          <div className="text-xs flex items-center gap-1.5"><Award className="w-3.5 h-3.5" /> Score</div>
          <div className="text-2xl font-bold mt-3">{pct}%</div>
          <div className="text-[11px] text-muted mt-1">{passed ? 'Pass' : 'Below pass mark'} · needs {PASS}%</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-xs flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Correct</div>
          <div className="text-2xl font-bold mt-3">{correct} / {questions.length}</div>
          <div className="text-[11px] text-muted mt-1">{answers.filter((a) => a == null).length} unanswered</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-xs flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Time</div>
          <div className="text-2xl font-bold mt-3 tabular-nums">{fmt(elapsed)}</div>
          <div className="text-[11px] text-muted mt-1">{fmt(Math.round(elapsed / questions.length))} per question</div>
        </div>
        <div className={`${card} p-4`}>
          <div className="text-xs flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Exam</div>
          <div className="text-base font-bold mt-3">{cfg.cloud} · {cfg.level}</div>
          <div className="text-[11px] text-muted mt-1">{cfg.roles.join(' + ')}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${card} xl:col-span-2`}>
          <div className="px-4 py-3 border-b border-line flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <div>
              <div className="font-semibold">AI feedback</div>
              <div className="text-[11px] text-muted">Where to focus to reach architect level</div>
            </div>
          </div>
          {!feedback && !feedbackError && (
            <div className="p-8 flex items-center justify-center gap-2 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Analysing your answers…</div>
          )}
          {feedbackError && (
            <div className="p-6 text-sm text-red-500 flex items-center justify-between gap-3">
              Couldn't generate feedback.
              <button className={ghost} onClick={() => fetchFeedback(examId, questions, answers, cfg)}>Retry</button>
            </div>
          )}
          {feedback && (
            <div className="p-4 space-y-5 text-sm">
              <div>
                <p className="leading-relaxed">{feedback.summary}</p>
                {feedback.readiness && <p className="text-muted mt-2 text-xs">{feedback.readiness}</p>}
              </div>
              {feedback.weakAreas?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Areas to improve</div>
                  <div className="space-y-2">
                    {feedback.weakAreas.map((w) => (
                      <div key={w.area} className="rounded-lg border border-line p-3">
                        <div className="font-semibold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-orange-500" />{w.area}</div>
                        <div className="text-muted text-xs mt-1">{w.why}</div>
                        <div className="text-xs mt-1.5"><span className="font-medium">How to improve: </span>{w.howToImprove}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {feedback.strengths?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Strengths</div>
                    <ul className="space-y-1.5">{feedback.strengths.map((s) => <li key={s} className="flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500 mt-0.5" />{s}</li>)}</ul>
                  </div>
                )}
                {feedback.studyPlan?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Study plan</div>
                    <ol className="space-y-1.5 list-decimal pl-5">{feedback.studyPlan.map((s) => <li key={s}>{s}</li>)}</ol>
                  </div>
                )}
              </div>
              {feedback.certifications?.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted" />
                  {feedback.certifications.map((c) => <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-accent-soft border border-accent/50">{c}</span>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={card}>
          <div className="px-4 py-3 border-b border-line">
            <div className="font-semibold">By domain</div>
            <div className="text-[11px] text-muted">Weakest first</div>
          </div>
          {byDomain.map(([d, [c, t]]) => (
            <div key={d} className="px-4 py-2.5 border-t border-line first:border-t-0">
              <div className="flex justify-between text-sm"><span className="truncate pr-2">{d}</span><span className="tabular-nums text-muted">{c}/{t}</span></div>
              <div className="h-1.5 mt-1.5 rounded-full bg-surface2 overflow-hidden">
                <div className={`h-full ${c / t >= PASS / 100 ? 'bg-accent' : 'bg-orange-500'}`} style={{ width: `${Math.max(4, (c / t) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={card}>
        <div className="px-4 py-3 border-b border-line flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold">Review answers</div>
            <div className="text-[11px] text-muted">Click a question for the use case and explanation</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => startSaved(questions.map(shuffleOptions), { ...cfg, count: questions.length })} className={ghost}><RotateCcw className="w-4 h-4" /> Retake</button>
            <button onClick={newExam} className={primary}><History className="w-4 h-4" /> All exams</button>
          </div>
        </div>
        {questions.map((q, i) => {
          const ok = answers[i] === q.answerIndex;
          const expanded = open === q.id;
          return (
            <div key={q.id} className="border-t border-line first:border-t-0">
              <button onClick={() => setOpen(expanded ? null : q.id)} className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-surface2" aria-expanded={expanded}>
                {ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />}
                <span className="flex-1 text-sm"><span className="text-muted mr-1.5">{i + 1}.</span>{q.question}</span>
                <span className="text-[11px] text-muted shrink-0">{q.domain}</span>
              </button>
              {expanded && (
                <div className="px-4 pb-4 pl-11 space-y-3 text-sm">
                  <div className={q.diagram ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>
                    {q.diagram && <QuestionDiagram key={q.id} q={q} theme={theme} className="h-80" />}
                    <Scenario q={q} className="text-sm text-muted" />
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((o, k) => (
                      <div key={k} className={`px-3 py-2 rounded-lg border ${k === q.answerIndex ? 'border-emerald-500/60 bg-emerald-500/10' : k === answers[i] ? 'border-red-500/50 bg-red-500/10' : 'border-line'}`}>
                        <span className="font-semibold mr-2">{LETTERS[k]}.</span>{o}
                        {k === q.answerIndex && <span className="ml-2 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Correct</span>}
                        {k === answers[i] && k !== q.answerIndex && <span className="ml-2 text-[11px] text-red-500 font-medium">Your answer</span>}
                        {q.rationales?.[k] && <div className="text-xs text-muted mt-1 pl-5">{q.rationales[k]}</div>}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg bg-surface2 border border-line p-3 leading-relaxed">
                    <ul className="list-disc pl-5 space-y-1">{sentences(q.explanation).map((b, k) => <Bullet key={k} text={b} />)}</ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UseCaseExam;
