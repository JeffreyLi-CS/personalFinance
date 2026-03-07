// ─── TaskForge Parser ────────────────────────────────────────────────────────
// Rule-based assignment prompt parser.
// Returns structured JSON: { title, summary, dueDate, deliverables, checklist }

// Action verbs that signal a concrete task
const ACTION_VERBS = [
  'write', 'submit', 'include', 'prepare', 'analyze', 'analyse', 'cite',
  'upload', 'record', 'present', 'read', 'research', 'create', 'develop',
  'design', 'build', 'complete', 'draft', 'outline', 'compare', 'evaluate',
  'discuss', 'describe', 'explain', 'identify', 'summarize', 'summarise',
  'review', 'revise', 'edit', 'proofread', 'format', 'export', 'post',
  'choose', 'select', 'pick', 'find', 'gather', 'collect', 'list', 'make',
];

// Category map: verb → category
const CATEGORY_MAP = [
  { category: 'Research',     verbs: ['research', 'find', 'gather', 'collect', 'read', 'identify', 'choose', 'select', 'pick', 'analyze', 'analyse', 'evaluate', 'compare'] },
  { category: 'Writing',      verbs: ['write', 'draft', 'outline', 'describe', 'explain', 'discuss', 'summarize', 'summarise', 'develop', 'create', 'build', 'design', 'make', 'prepare', 'list', 'include'] },
  { category: 'Formatting',   verbs: ['format', 'cite', 'export'] },
  { category: 'Review',       verbs: ['review', 'revise', 'edit', 'proofread'] },
  { category: 'Submission',   verbs: ['submit', 'upload', 'post', 'record', 'complete'] },
  { category: 'Presentation', verbs: ['present'] },
];

// Priority heuristics
const HIGH_KEYWORDS = /\b(submit|upload|due|deadline|required|must|final|turn\s+in|graded?|marks)\b/i;
const LOW_KEYWORDS  = /\b(proofread|practice|rehearse|format\s+citations?|double.check|review\s+before)\b/i;

// Phrases that hint at a deliverable
const DELIVERABLE_HINTS = [
  'page', 'pages', 'essay', 'report', 'presentation', 'slides', 'video',
  'poster', 'paper', 'document', 'pdf', 'file', 'recording', 'demo',
  'prototype', 'proposal', 'draft', 'outline', 'summary', 'analysis',
  'reflection', 'journal', 'portfolio', 'project', 'assignment',
];

// Regex patterns for detecting due dates
const DATE_PATTERNS = [
  /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b[^.]*?(?:at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm))?/gi,
  /\bdue\s+(?:on\s+)?([^.,]+?\d{4}|\w+\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,\s*\d{4})?)/gi,
  /\bsubmit\s+by\s+([^.,]+)/gi,
  /\bdeadline[:\s]+([^.,]+)/gi,
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?\b/gi,
];

let _idCounter = 0;
function makeTaskId() { return `t${++_idCounter}`; }

/** Split text into sentences, trimming whitespace. */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/** Check if a sentence contains an action verb. */
function hasActionVerb(sentence) {
  const lower = sentence.toLowerCase();
  return ACTION_VERBS.some(verb => new RegExp(`\\b${verb}\\b`).test(lower));
}

/** Return the first matching action verb in the task text. */
function getFirstVerb(task) {
  const lower = task.toLowerCase();
  for (const verb of ACTION_VERBS) {
    if (new RegExp(`\\b${verb}\\b`).test(lower)) return verb;
  }
  return null;
}

/** Assign a category based on the leading action verb. */
function assignCategory(task) {
  const verb = getFirstVerb(task);
  if (!verb) return 'Other';
  for (const { category, verbs } of CATEGORY_MAP) {
    if (verbs.includes(verb)) return category;
  }
  return 'Other';
}

/** Assign priority based on task keywords. */
function assignPriority(task) {
  if (HIGH_KEYWORDS.test(task)) return 'high';
  if (LOW_KEYWORDS.test(task)) return 'low';
  return 'medium';
}

/** Check if a sentence mentions a deliverable. */
function hasDeliverableHint(sentence) {
  const lower = sentence.toLowerCase();
  return DELIVERABLE_HINTS.some(hint => lower.includes(hint));
}

/** Try to extract a due date string from the text. */
function extractDueDate(text) {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0]
        .replace(/^(by|due on?|submit by|deadline[:\s]+)/i, '')
        .trim();
    }
  }
  return null;
}

/** Infer a title from the text. */
function inferTitle(text) {
  const titleKeywords = [
    { pattern: /comparative\s+analysis/i,                       label: 'Comparative Analysis' },
    { pattern: /\bresearch\s+paper\b/i,                          label: 'Research Paper' },
    { pattern: /\bliterature\s+review\b/i,                       label: 'Literature Review' },
    { pattern: /\bcase\s+study\b/i,                              label: 'Case Study' },
    { pattern: /\blab\s+report\b/i,                              label: 'Lab Report' },
    { pattern: /\bfinal\s+project\b/i,                           label: 'Final Project' },
    { pattern: /\bterm\s+paper\b/i,                              label: 'Term Paper' },
    { pattern: /\bgroup\s+project\b/i,                           label: 'Group Project' },
    { pattern: /\breflection\s+(?:essay|paper|journal)\b/i,      label: 'Reflection Essay' },
    { pattern: /\bpersonal\s+(?:statement|narrative|essay)\b/i,  label: 'Personal Essay' },
    { pattern: /\bargumentative\s+essay\b/i,                     label: 'Argumentative Essay' },
    { pattern: /\bexpository\s+essay\b/i,                        label: 'Expository Essay' },
    { pattern: /\bpresentation\b/i,                              label: 'Presentation' },
    { pattern: /\bposter\b/i,                                    label: 'Poster' },
    { pattern: /\bportfolio\b/i,                                 label: 'Portfolio' },
    { pattern: /\bdemo\b/i,                                      label: 'Demo' },
    { pattern: /\bessay\b/i,                                     label: 'Essay' },
    { pattern: /\breport\b/i,                                    label: 'Report' },
    { pattern: /\bproject\b/i,                                   label: 'Project' },
  ];
  for (const { pattern, label } of titleKeywords) {
    if (pattern.test(text)) return label;
  }
  const words = text.split(/\s+/).slice(0, 5).join(' ').replace(/[^\w\s]/g, '');
  return words.length > 3 ? words : 'Assignment';
}

/** Build a short summary sentence from the text. */
function buildSummary(text) {
  const sentences = splitSentences(text);
  const actionSentences = sentences.filter(hasActionVerb);
  if (actionSentences.length === 0) {
    return text.substring(0, 150).trim() + (text.length > 150 ? '...' : '');
  }
  const core = actionSentences
    .slice(0, 2)
    .map(s => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, ''))
    .join(', then ');
  return core.charAt(0).toUpperCase() + core.slice(1) + '.';
}

/** Extract deliverables: sentences that mention a deliverable keyword + a quantity. */
function extractDeliverables(text) {
  const sentences = splitSentences(text);
  const deliverables = [];
  for (const sentence of sentences) {
    if (!hasDeliverableHint(sentence)) continue;
    const quantityMatch = sentence.match(
      /\b(?:a|an|\d+[\s-](?:to\s+\d+)?)\s*(?:[\w-]+\s+){0,3}(?:essay|report|paper|presentation|slides|video|recording|poster|pdf|file|draft|outline|summary|analysis|reflection|journal|portfolio|project|prototype|demo)\b/i
    );
    if (quantityMatch) {
      let item = quantityMatch[0].trim();
      item = item.charAt(0).toUpperCase() + item.slice(1);
      if (!deliverables.includes(item)) deliverables.push(item);
    }
  }
  return deliverables;
}

/**
 * Shorten a cleaned task sentence to its key terms.
 * Strips quantifiers, location phrases, and date references.
 */
function toKeyTerm(task) {
  let t = task
    // Remove quantity specs: "a 4 to 5 page", "at least two", "3-minute"
    .replace(/\b(a\s+)?\d+[\s-](?:to\s+\d+\s+)?(?:page|pages|minute|minutes|word|words|slide|slides|hour|hours)\b/gi, '')
    .replace(/\bat\s+least\s+\w+(\s+\w+)?\b/gi, '')
    .replace(/\b\d+[\s-](?:page|pages|minute|minutes|word|words|slide|slides)\b/gi, '')
    // Remove trailing date/time specs
    .replace(/\s+by\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).+$/i, '')
    .replace(/\s+(?:by|before|until)\s+.{0,40}$/i, '')
    // Remove platform/location phrases: "on Canvas", "via email", "to the website"
    .replace(/\s+(?:on|via|through|using)\s+\w+(\s+\w+)?(?:\s+platform|\s+system|\s+portal)?$/i, '')
    // Collapse extra whitespace
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

  // Cap at 65 chars, break at word boundary
  if (t.length > 65) {
    t = t.substring(0, 65).replace(/\s+\S+$/, '').trim();
  }

  return t || task.substring(0, 65);
}

/** Remove leading filler and cap length. */
function cleanTask(sentence) {
  let task = sentence
    .replace(/^(you\s+(will\s+also\s+|will\s+|should\s+|must\s+|are\s+expected\s+to\s+|need\s+to\s+)|students?\s+(must|should|will|are\s+required\s+to)\s+|make\s+sure\s+to\s+|be\s+sure\s+to\s+|don't\s+forget\s+to\s+|remember\s+to\s+)/i, '')
    .replace(/\.$/, '')
    .trim();
  return task.charAt(0).toUpperCase() + task.slice(1);
}

/** Build a checklist of task objects from the text. */
function buildChecklist(text) {
  const sentences = splitSentences(text);
  const seenTexts = new Set();
  const taskTexts = [];

  for (const sentence of sentences) {
    if (!hasActionVerb(sentence)) continue;
    const taskText = toKeyTerm(cleanTask(sentence));
    if (taskText && taskText.length > 5 && !seenTexts.has(taskText.toLowerCase())) {
      seenTexts.add(taskText.toLowerCase());
      taskTexts.push(taskText);
    }
  }

  // If very few tasks, try comma/semicolon fragments
  if (taskTexts.length < 3) {
    const fragments = text
      .split(/[,;]/)
      .map(f => f.trim())
      .filter(f => f.length > 15 && hasActionVerb(f));
    for (const frag of fragments) {
      const taskText = toKeyTerm(cleanTask(frag));
      if (taskText && !seenTexts.has(taskText.toLowerCase())) {
        seenTexts.add(taskText.toLowerCase());
        taskTexts.push(taskText);
      }
    }
  }

  return expandChecklist(taskTexts, text).map(text => ({
    id: makeTaskId(),
    text,
    category: assignCategory(text),
    priority: assignPriority(text),
    checked: false,
  }));
}

/** Add logically implied tasks that are often unstated. */
function expandChecklist(tasks, text) {
  const expanded = [...tasks];
  if (/submit|upload|post\s+to/i.test(text) && !expanded.some(t => /review|proofread/i.test(t))) {
    expanded.push('Review and proofread before submitting');
  }
  if (/citation|bibliography|works\s+cited|reference/i.test(text) && !expanded.some(t => /citation|reference/i.test(t))) {
    expanded.push('Format citations correctly');
  }
  if (/presentation|present/i.test(text) && !expanded.some(t => /practice|rehearse/i.test(t))) {
    expanded.push('Practice your presentation');
  }
  return expanded;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Parse an assignment prompt into structured output.
 * @param {string} text - Raw assignment instructions
 * @returns {{ title, summary, dueDate, deliverables, checklist }}
 */
export function parseAssignmentPrompt(text) {
  if (!text || text.trim().length === 0) return null;

  const dueDate = extractDueDate(text);
  const title = inferTitle(text);
  const checklist = buildChecklist(text);
  const deliverables = extractDeliverables(text);
  const summary = buildSummary(text);

  return { title, summary, dueDate, deliverables, checklist };
}
