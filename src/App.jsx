import { useState, useCallback } from 'react'
import { parseAssignmentPrompt } from './parser'
import './App.css'

// ─── Sample prompt for the demo ──────────────────────────────────────────────
const SAMPLE_PROMPT = `Write a 4 to 5 page comparative analysis essay on two texts from the course reading list. Your essay should focus on a single theme, such as morality, gender, race, or personal identity. Include at least two direct quotations from each text and proper MLA citations. Submit a PDF on Canvas by Friday at 11:59 PM. You will also give a 3 minute class presentation next week.`

// ─── Icons (inline SVG, no library needed) ───────────────────────────────────
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

// ─── Loading Spinner ──────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      <span>Analyzing your assignment...</span>
    </div>
  )
}

// ─── Result Card ─────────────────────────────────────────────────────────────
function ResultCard({ result }) {
  const [checked, setChecked] = useState({})
  const [copied, setCopied] = useState(false)

  const toggleCheck = (i) => setChecked(prev => ({ ...prev, [i]: !prev[i] }))

  // Build plain-text export
  const exportText = () => {
    const lines = [
      `TASKFORGE — ${result.title}`,
      '',
      `Summary: ${result.summary}`,
      result.dueDate ? `Due: ${result.dueDate}` : '',
      '',
    ]
    if (result.deliverables.length > 0) {
      lines.push('Deliverables:')
      result.deliverables.forEach(d => lines.push(`  • ${d}`))
      lines.push('')
    }
    lines.push('Checklist:')
    result.checklist.forEach(t => lines.push(`  [ ] ${t}`))
    return lines.filter(l => l !== undefined).join('\n')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(exportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleExport = () => {
    const blob = new Blob([exportText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.title.replace(/\s+/g, '_')}_checklist.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="result-card">
      {/* Header */}
      <div className="result-header">
        <div>
          <h2 className="result-title">{result.title}</h2>
          <p className="result-summary">{result.summary}</p>
        </div>
        <div className="result-actions">
          <button className="btn-icon" onClick={handleCopy} title="Copy checklist">
            <CopyIcon /> {copied ? 'Copied!' : 'Copy'}
          </button>
          <button className="btn-icon" onClick={handleExport} title="Export as text">
            <DownloadIcon /> Export
          </button>
        </div>
      </div>

      {/* Due date badge */}
      {result.dueDate && (
        <div className="due-badge">
          <CalendarIcon />
          <span>Due: <strong>{result.dueDate}</strong></span>
        </div>
      )}

      {/* Deliverables */}
      {result.deliverables.length > 0 && (
        <section className="result-section">
          <h3 className="section-label">Deliverables</h3>
          <ul className="deliverables-list">
            {result.deliverables.map((d, i) => (
              <li key={i} className="deliverable-item">
                <span className="bullet" />
                {d}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Checklist */}
      <section className="result-section">
        <h3 className="section-label">
          Checklist
          <span className="progress-badge">
            {Object.values(checked).filter(Boolean).length}/{result.checklist.length}
          </span>
        </h3>
        <ul className="checklist">
          {result.checklist.map((task, i) => (
            <li
              key={i}
              className={`checklist-item ${checked[i] ? 'checked' : ''}`}
              onClick={() => toggleCheck(i)}
            >
              <span className="checkbox" aria-checked={!!checked[i]} role="checkbox">
                {checked[i] && (
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className="task-text">{task}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = useCallback(() => {
    if (!input.trim()) {
      setError('Please paste an assignment prompt first.')
      return
    }
    setError('')
    setLoading(true)
    setResult(null)

    // Simulate a brief "thinking" delay for realism
    setTimeout(() => {
      const parsed = parseAssignmentPrompt(input)
      if (!parsed || parsed.checklist.length === 0) {
        setError("Couldn't extract tasks. Try pasting a more detailed assignment prompt.")
        setLoading(false)
        return
      }
      setResult(parsed)
      setLoading(false)
    }, 900)
  }, [input])

  const handleTryExample = () => {
    setInput(SAMPLE_PROMPT)
    setResult(null)
    setError('')
  }

  const handleClear = () => {
    setInput('')
    setResult(null)
    setError('')
  }

  return (
    <div className="page">
      {/* ── Header ── */}
      <header className="header">
        <div className="logo">
          <span className="logo-mark">T</span>
          <span className="logo-text">TaskForge</span>
        </div>
        <p className="subtitle">Turn assignment prompts into actionable checklists</p>
      </header>

      <main className="main">
        {/* ── Input card ── */}
        <div className="input-card">
          <label className="input-label" htmlFor="prompt">
            Paste assignment prompt
          </label>
          <textarea
            id="prompt"
            className="textarea"
            placeholder="e.g. Write a 4–5 page comparative analysis essay on two texts from the course reading list..."
            value={input}
            onChange={e => { setInput(e.target.value); setError('') }}
            rows={7}
          />
          {error && <p className="error-msg">{error}</p>}

          <div className="button-row">
            <button
              className="btn-primary"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Generating...' : 'Generate Checklist'}
            </button>
            <button className="btn-secondary" onClick={handleTryExample}>
              Try Example
            </button>
            <button className="btn-ghost" onClick={handleClear}>
              Clear
            </button>
          </div>
        </div>

        {/* ── Loading state ── */}
        {loading && <Spinner />}

        {/* ── Results ── */}
        {result && !loading && <ResultCard result={result} />}
      </main>

      <footer className="footer">
        TaskForge · Built for class demo
      </footer>
    </div>
  )
}
