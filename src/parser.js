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

/** Split text into sentences, trimming whitespace. */
function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

/** Check if a sentence starts with or contains an action verb. */
function hasActionVerb(sentence) {
  const lower = sentence.toLowerCase();
  return ACTION_VERBS.some(verb => {
    const pattern = new RegExp(`\\b${verb}\\b`);
    return pattern.test(lower);
  });
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
      // Clean up the matched string
      return match[0]
        .replace(/^(by|due on?|submit by|deadline[:\s]+)/i, '')
        .trim();
    }
  }
  return null;
}

/** Infer a title from the text.
 *  Looks for known assignment types, then falls back to the first noun phrase. */
function inferTitle(text) {
  const titleKeywords = [
    { pattern: /comparative\s+analysis/i, label: 'Comparative Analysis' },
    { pattern: /\bresearch\s+paper\b/i, label: 'Research Paper' },
    { pattern: /\bliterature\s+review\b/i, label: 'Literature Review' },
    { pattern: /\bcase\s+study\b/i, label: 'Case Study' },
    { pattern: /\blab\s+report\b/i, label: 'Lab Report' },
    { pattern: /\bfinal\s+project\b/i, label: 'Final Project' },
    { pattern: /\bterm\s+paper\b/i, label: 'Term Paper' },
    { pattern: /\bgroup\s+project\b/i, label: 'Group Project' },
    { pattern: /\breflection\s+(?:essay|paper|journal)\b/i, label: 'Reflection Essay' },
    { pattern: /\bpersonal\s+(?:statement|narrative|essay)\b/i, label: 'Personal Essay' },
    { pattern: /\bargumentative\s+essay\b/i, label: 'Argumentative Essay' },
    { pattern: /\bexpository\s+essay\b/i, label: 'Expository Essay' },
    { pattern: /\bpresentation\b/i, label: 'Presentation' },
    { pattern: /\bposter\b/i, label: 'Poster' },
    { pattern: /\bportfolio\b/i, label: 'Portfolio' },
    { pattern: /\bdemo\b/i, label: 'Demo' },
    { pattern: /\bessay\b/i, label: 'Essay' },
    { pattern: /\breport\b/i, label: 'Report' },
    { pattern: /\bproject\b/i, label: 'Project' },
  ];

  for (const { pattern, label } of titleKeywords) {
    if (pattern.test(text)) return label;
  }

  // Fallback: first 5 significant words
  const words = text.split(/\s+/).slice(0, 5).join(' ').replace(/[^\w\s]/g, '');
  return words.length > 3 ? words : 'Assignment';
}

/** Build a short summary sentence from the text. */
function buildSummary(text, checklist, dueDate) {
  const sentences = splitSentences(text);
  const actionSentences = sentences.filter(hasActionVerb);

  if (actionSentences.length === 0) {
    return text.substring(0, 150).trim() + (text.length > 150 ? '...' : '');
  }

  // Take the first 2 action sentences and join them
  const core = actionSentences
    .slice(0, 2)
    .map(s => s.charAt(0).toLowerCase() + s.slice(1).replace(/\.$/, ''))
    .join(', then ');

  const suffix = dueDate ? ` Due: ${dueDate}.` : '';
  return core.charAt(0).toUpperCase() + core.slice(1) + '.' + suffix;
}

/** Extract deliverables: sentences that mention a deliverable keyword + a number or "a/an". */
function extractDeliverables(text) {
  const sentences = splitSentences(text);
  const deliverables = [];

  for (const sentence of sentences) {
    if (!hasDeliverableHint(sentence)) continue;

    // Look for patterns like "a 5-page report", "3-minute presentation"
    const quantityMatch = sentence.match(
      /\b(?:a|an|\d+[\s-](?:to\s+\d+)?)\s*(?:[\w-]+\s+){0,3}(?:essay|report|paper|presentation|slides|video|recording|poster|pdf|file|draft|outline|summary|analysis|reflection|journal|portfolio|project|prototype|demo)\b/i
    );

    if (quantityMatch) {
      let item = quantityMatch[0].trim();
      // Capitalize first letter
      item = item.charAt(0).toUpperCase() + item.slice(1);
      if (!deliverables.includes(item)) deliverables.push(item);
    }
  }

  return deliverables;
}

/** Build a checklist of actionable tasks from the text.
 *  Strategy: extract action sentences, then expand them into sub-tasks. */
function buildChecklist(text) {
  const sentences = splitSentences(text);
  const tasks = [];

  for (const sentence of sentences) {
    if (!hasActionVerb(sentence)) continue;

    // Trim the sentence to a clean imperative task
    let task = cleanTask(sentence);
    if (task && task.length > 5 && !tasks.includes(task)) {
      tasks.push(task);
    }
  }

  // If we got very few tasks, try sentence fragments split by semicolons/commas
  if (tasks.length < 3) {
    const fragments = text
      .split(/[,;]/)
      .map(f => f.trim())
      .filter(f => f.length > 15 && hasActionVerb(f));
    for (const frag of fragments) {
      const task = cleanTask(frag);
      if (task && !tasks.includes(task)) tasks.push(task);
    }
  }

  return expandChecklist(tasks, text);
}

/** Clean a sentence into a short imperative task string. */
function cleanTask(sentence) {
  // Remove leading filler like "You will", "You should", "Students must", "Make sure to"
  let task = sentence
    .replace(/^(you\s+(will\s+also\s+|will\s+|should\s+|must\s+|are\s+expected\s+to\s+|need\s+to\s+)|students?\s+(must|should|will|are\s+required\s+to)\s+|make\s+sure\s+to\s+|be\s+sure\s+to\s+|don't\s+forget\s+to\s+|remember\s+to\s+)/i, '')
    .replace(/\.$/, '')
    .trim();

  // Capitalize first letter
  task = task.charAt(0).toUpperCase() + task.slice(1);

  // Cap length at ~100 chars, cut at last word boundary
  if (task.length > 100) {
    task = task.substring(0, 100).replace(/\s+\S+$/, '') + '...';
  }

  return task;
}

/** Add logical prep tasks that are often implied but not stated. */
function expandChecklist(tasks, text) {
  const lower = text.toLowerCase();
  const expanded = [...tasks];

  // If there's a submission, make sure "review before submitting" is in there
  if (/submit|upload|post\s+to/i.test(text) && !expanded.some(t => /review|proofread/i.test(t))) {
    expanded.push('Review and proofread before submitting');
  }

  // If citations are required, add a formatting reminder
  if (/citation|bibliography|works\s+cited|reference/i.test(text) && !expanded.some(t => /citation|reference/i.test(t))) {
    expanded.push('Format citations according to the required style');
  }

  // If presentation is involved, add a practice step
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
  const summary = buildSummary(text, checklist, null); // omit date from summary body

  return { title, summary, dueDate, deliverables, checklist };
}
