import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BuildScene } from './three/Scene.js'
import { STAGES, stageAt } from './stages.js'

const clamp01 = (x) => Math.min(1, Math.max(0, x))

export default function App() {
  const hostRef = useRef(null)
  const barRef = useRef(null)
  const heroRef = useRef(null)
  const sceneRef = useRef(null)
  const idxRef = useRef(0)
  const [ready, setReady] = useState(false)
  const [stageIdx, setStageIdx] = useState(0)
  const [modal, setModal] = useState(false)

  useEffect(() => {
    const scene = new BuildScene(hostRef.current, {
      onLoad: () => setReady(true),
      onProgress: (p) => {
        if (barRef.current) barRef.current.style.transform = `scaleX(${p})`
        if (heroRef.current) {
          const o = 1 - clamp01((p - 0.045) / 0.028)
          const h = heroRef.current
          h.style.opacity = o
          h.style.transform = `translateY(${(1 - o) * -34}px)`
          h.style.pointerEvents = o < 0.12 ? 'none' : 'auto'
        }
        const i = stageAt(p)
        if (i !== idxRef.current) {
          idxRef.current = i
          setStageIdx(i)
        }
      },
    })
    sceneRef.current = scene
    return () => { scene.dispose && scene.dispose() }
  }, [])

  const jumpTo = (s) => {
    const el = document.documentElement
    const max = el.scrollHeight - (el.clientHeight || window.innerHeight)
    window.scrollTo({ top: s.start * max + 4, behavior: 'smooth' })
  }

  const stage = STAGES[stageIdx]

  return (
    <div className="relative">
      {/* 3D canvas host */}
      <div ref={hostRef} className="fixed inset-0 z-0" />

      {/* legibility gradients */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-56 bg-gradient-to-t from-black/55 to-transparent" />
      <div className="grain pointer-events-none fixed inset-0 z-40 opacity-[0.045] mix-blend-overlay" />

      <Header onQuote={() => setModal(true)} />

      <AnimatePresence>
        {stageIdx === 0 && <Hero key="hero" hostRef={heroRef} onQuote={() => setModal(true)} />}
      </AnimatePresence>

      <AnimatePresence>
        {stage.title && stageIdx < 6 && (
          <StageCaption key={stage.id} stage={stage} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {stageIdx === 6 && <Welcome key="wel" />}
      </AnimatePresence>

      <ProgressBar activeIdx={stageIdx} barRef={barRef} onJump={jumpTo} />

      <AnimatePresence>
        {!ready && <Loader key="loader" />}
      </AnimatePresence>

      <AnimatePresence>
        {modal && <QuoteModal key="modal" onClose={() => setModal(false)} />}
      </AnimatePresence>

      {/* scroll spacer */}
      <div className="pointer-events-none relative z-0 h-[1000vh] w-full" aria-hidden="true" />
    </div>
  )
}

/* ------------------------------------------------------------------ header */
function Header({ onQuote }) {
  return (
    <header className="hdr fixed inset-x-0 top-0 z-30 flex items-start justify-between gap-2 px-4 sm:px-6 md:px-10">
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="shrink-0 text-white sm:h-[26px] sm:w-[26px]">
          <path d="M3 11.2 12 3.5l9 7.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.4 10v9.2h13.2V10" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M9.7 19.2v-5.4h4.6v5.4" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        <div className="min-w-0 leading-none">
          <div className="font-display text-[18px] font-semibold tracking-wide sm:text-[22px]">OAKHAVEN</div>
          <div className="mt-1 whitespace-nowrap text-[8px] font-medium tracking-[0.16em] text-gold sm:text-[9px] sm:tracking-[0.34em]">
            LUXURY CUSTOM HOMES
          </div>
        </div>
        <div
          className="logo-chip pointer-events-none absolute left-4 select-none sm:left-6 md:left-10"
          style={{ top: 'calc(env(safe-area-inset-top, 0px) + 62px)' }}
        >
          <div className="flex items-center gap-2 rounded border border-white/20 bg-black/20 px-2.5 py-1.5 opacity-55 backdrop-blur-[1px]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M3 11.2 12 3.5l9 7.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5.4 10v9.2h13.2V10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-[10px] font-semibold tracking-[0.26em] text-white">
              OAKHAVEN
            </span>
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <a href="tel:+919876543210" className="hidden text-sm text-white/75 transition hover:text-white md:block">
          +91 98765 43210
        </a>
        <button
          onClick={onQuote}
          className="rounded-full border border-white/25 bg-white/5 px-3.5 py-2 text-[10px] font-semibold tracking-[0.12em] text-white backdrop-blur transition hover:border-gold hover:bg-gold hover:text-ink sm:px-5 sm:py-2.5 sm:text-[11px] sm:tracking-[0.18em]"
        >
          <span className="sm:hidden">GET A QUOTE</span>
          <span className="hidden sm:inline">GET A FREE QUOTE</span>
        </button>
      </div>
    </header>
  )
}

/* -------------------------------------------------------------------- hero */
function Hero({ hostRef, onQuote }) {
  return (
    <motion.section
      className="pointer-events-auto fixed left-0 top-0 z-20 flex vh w-full items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.25 } }}
    >
      <div
        ref={hostRef}
        className="ml-5 mr-5 max-w-2xl sm:ml-[7vw] sm:mr-0 [text-shadow:0_1px_3px_rgba(10,12,16,0.45),0_10px_40px_rgba(10,12,16,0.35)]"
      >
        <motion.div
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="text-[10px] font-medium tracking-[0.16em] text-gold sm:tracking-[0.42em]"
        >
          LUXURY CUSTOM HOMES — THE PLAN
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.3 }}
          className="hero-title t-hero font-display font-semibold tracking-tight"
        >
          Built from the
          <br />
          <span className="gold-shine italic">blueprint up.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.5 }}
          className="hero-p mt-6 max-w-md text-[14px] leading-relaxed text-white/65 sm:mt-7 sm:text-[15px]"
        >
          Every home starts as lines on paper.
          <br className="hidden md:block" /> Scroll to watch this one take shape.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.68 }}
          className="hero-actions flex flex-wrap items-center gap-x-5 gap-y-3"
        >
          <button
            onClick={onQuote}
            className="rounded-full bg-gold px-6 py-3.5 text-[11px] font-semibold tracking-[0.16em] text-ink shadow-[0_10px_40px_-12px_rgba(233,198,98,0.7)] transition hover:bg-gold-soft sm:px-7 sm:text-[12px]"
          >
            GET A FREE QUOTE
          </button>
          <span className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-white/50 sm:text-[11px]">
            <span className="inline-block h-px w-8 bg-white/40" />
            SCROLL TO BUILD
          </span>
        </motion.div>
      </div>
    </motion.section>
  )
}

/* ------------------------------------------------------------ stage caption */
function StageCaption({ stage }) {
  return (
    <motion.div
      className="pointer-events-none fixed bottom-32 left-4 right-4 z-20 sm:bottom-28 sm:left-[7vw] sm:right-auto sm:max-w-lg [text-shadow:0_1px_3px_rgba(10,12,16,0.55),0_8px_30px_rgba(10,12,16,0.4)]"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -18 }}
      transition={{ duration: 0.55, ease: [0.22, 0.9, 0.3, 1] }}
    >
      <div className="text-[9px] font-semibold tracking-[0.34em] text-gold sm:text-[10px] sm:tracking-[0.42em]">
        {stage.eyebrow}
      </div>
      <h2 className="t-stage mt-2.5 font-display font-semibold tracking-tight sm:mt-3">
        {stage.title}
      </h2>
      <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/70 sm:mt-4 sm:text-[14px]">
        {stage.caption}
      </p>
    </motion.div>
  )
}

/* ----------------------------------------------------------------- welcome */
function Welcome() {
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-20 flex items-end justify-center px-5 pb-[15vh] sm:pb-[14vh]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      <motion.h2
        initial={{ opacity: 0, y: 30, letterSpacing: '0.2em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.02em' }}
        transition={{ duration: 1.2, ease: [0.22, 0.9, 0.3, 1] }}
        className="t-welcome text-center font-display font-semibold"
      >
        <span className="text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.45)]">Welcome home.</span>
      </motion.h2>
    </motion.div>
  )
}

/* ------------------------------------------------------------ progress bar */
function ProgressBar({ activeIdx, barRef, onJump }) {
  return (
    <div className="dock fixed inset-x-0 bottom-0 z-30 px-4 sm:px-6 md:px-10">
      <div className="mb-2 text-center text-[9px] font-semibold tracking-[0.3em] text-gold sm:hidden">
        {STAGES[activeIdx].label}
      </div>
      <div className="flex items-end justify-between gap-1">
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onJump(s)}
            aria-label={`Jump to ${s.label}`}
            aria-current={i === activeIdx ? 'step' : undefined}
            className={`group flex min-h-[44px] flex-1 flex-col items-center justify-end gap-2 py-1 transition-opacity sm:min-h-0 sm:flex-none sm:justify-start sm:py-0 ${
              i > activeIdx ? 'opacity-35' : 'opacity-100'
            }`}
          >
            <span
              className={`hidden text-[9px] font-semibold tracking-[0.22em] transition sm:block md:text-[10px] ${
                i === activeIdx ? 'text-gold' : 'text-white/70 group-hover:text-white'
              }`}
            >
              {s.label}
            </span>
            <span
              className={`h-3 w-px transition sm:h-2.5 ${
                i === activeIdx ? 'bg-gold' : 'bg-white/35'
              }`}
            />
          </button>
        ))}
      </div>
      <div className="relative mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
        <div
          ref={barRef}
          className="h-full w-full origin-left rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ loader */
function Loader() {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#07080a] px-6"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: 'easeOut' } }}
    >
      <div className="font-display text-2xl font-semibold sm:text-3xl">OAKHAVEN</div>
      <div className="mt-2 text-[9px] tracking-[0.34em] text-gold">
        LUXURY CUSTOM HOMES
      </div>
      <div className="mt-8 h-px w-44 overflow-hidden bg-white/15">
        <motion.div
          className="h-full w-full origin-left bg-gold"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
        />
      </div>
      <div className="mt-4 text-[10px] tracking-[0.28em] text-white/40">
        SETTING THE BLUEPRINT
      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------- quote form */
function QuoteModal({ onClose }) {
  const [sent, setSent] = useState(false)
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm sm:px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="modal-card w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-ink/95 p-5 shadow-2xl sm:p-8"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.35, ease: [0.22, 0.9, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[9px] font-semibold tracking-[0.32em] text-gold sm:text-[10px] sm:tracking-[0.4em]">
              START YOUR BUILD
            </div>
            <h3 className="mt-2 font-display text-2xl font-semibold sm:text-3xl">
              Get a free quote
            </h3>
          </div>
          <button
            onClick={onClose}
            className="-mr-1 shrink-0 p-1 text-white/50 transition hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {sent ? (
          <p className="mt-8 text-[15px] leading-relaxed text-white/75">
            Thanks — your plans are on their way to the drafting table.
            <br />
            We'll be in touch within one business day.
          </p>
        ) : (
          <form
            className="quote-form mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setSent(true)
            }}
          >
            <input
              required
              placeholder="Full name"
              className="w-full rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-base outline-none transition placeholder:text-white/35 focus:border-gold sm:text-sm"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <input
                required
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-base outline-none transition placeholder:text-white/35 focus:border-gold sm:text-sm"
              />
              <input
                required
                placeholder="Phone"
                type="tel"
                inputMode="tel"
                className="w-full rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-base outline-none transition placeholder:text-white/35 focus:border-gold sm:text-sm"
              />
            </div>
            <textarea
              rows={4}
              placeholder="Tell us about your build…"
              className="w-full resize-none rounded-lg border border-white/12 bg-white/5 px-4 py-3 text-base outline-none transition placeholder:text-white/35 focus:border-gold sm:text-sm"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-gold py-3.5 text-[12px] font-semibold tracking-[0.18em] text-ink transition hover:bg-gold-soft"
            >
              REQUEST MY QUOTE
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
