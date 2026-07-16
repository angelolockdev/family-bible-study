import { useEffect, useMemo, useRef, useState } from 'react'
import studiesData from './data/studies.json'
import watchtowerData from './data/watchtower-studies.json'
import { WatchtowerWorkspace, type WatchtowerStudy } from './features/study-assistant/WatchtowerWorkspace'
import './styles.css'

type Role = {
  id: string
  title: string
  action: string
  person: string
  className: string
}

type Day = { day: string; focus: string }
type Verse = { reference: string; application: string; url: string }
type FamilyStudy = {
  id: string
  kind: 'family'
  startDate: string
  endDate: string
  weekLabel: string
  reading: string
  theme: string
  days: Day[]
  memoryVerse: Verse
  sourceUrl: string
  printPrompt: string
}
type PreachingStudy = {
  id: string
  kind: 'preaching'
  startDate: string
  endDate: string
  weekLabel: string
  publishedAt: string
  title: string
  subtitle: string
  objective: string
  theme: string
  opening: string
  question: string
  scripture: Verse
  response: string
  nextStep: string
  practice: string
  sourceUrl: string
}
type Study = FamilyStudy | PreachingStudy

const roles: Role[] = [
  { id: 'guide', title: 'Mpitarika', action: 'Mamaky na mitantara', person: 'Ray aman-dreny', className: 'role--navy' },
  { id: 'connector', title: 'Mpampifandray', action: 'Mihaino sy mametraka fanontaniana', person: 'Ray aman-dreny', className: 'role--teal' },
  { id: 'answerer', title: 'Mpamaly sy Mpisafidy', action: 'Mamaly na misafidy sary', person: 'Ankizy lehibe', className: 'role--violet' },
  { id: 'participant', title: 'Mpandray anjara', action: 'Maneho amin’ny fihetsika', person: 'Ankizy kely', className: 'role--green' },
]

const activities = [
  { title: 'Karatra safidy', description: 'Mifidiana amin’ny sary roa izay mifanaraka amin’ilay tantara.', childOne: 'Misafidy sary iray ary milaza ny antony.', childTwo: 'Manondro na mitazona ilay sary.', art: 'activity-choice.svg', artAlt: 'Karatra roa azo isafidianana' },
  { title: 'Alaharo ny tantara', description: 'Apetraho araka ny filaharany ireo sary telo na efatra.', childOne: 'Mandahatra ireo sary.', childTwo: 'Mametraka ny sary farany.', art: 'activity-order.svg', artAlt: 'Karatra telo arindra amin’ny filaharany' },
  { title: 'Ataovy ilay fihetsika', description: 'Asehoy amin’ny fihetsika ny zavatra nitranga tao amin’ilay tantara.', childOne: 'Mamerina fihetsika iray ary mamaly fanontaniana.', childTwo: 'Manao fihetsika na manahaka feo tsotra.', art: 'activity-act.svg', artAlt: 'Ankizy maneho fihetsika' },
  { title: 'Mitadiava marika ao an-trano', description: 'Mitadiava zavatra roa ao an-trano mampahatsiahy ny lesona.', childOne: 'Mitady sy manonona zavatra iray.', childTwo: 'Mitondra na manondro zavatra iray.', art: 'activity-find.svg', artAlt: 'Trano sy fitaratra fanamafisam-pahitana' },
]

const weekdayNames = ['Alahady', 'Alatsinainy', 'Talata', 'Alarobia', 'Alakamisy', 'Zoma', 'Sabotsy']
const studies = studiesData as Study[]
const watchtowerStudies = watchtowerData as WatchtowerStudy[]
const bibleBooks: Record<string, { number: number; slug: string }> = {
  Jeremia: { number: 24, slug: 'jeremia' },
  '1 Petera': { number: 60, slug: '1-petera' },
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`)
}

function isWithinStudy(study: Study, date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return day >= dateAtNoon(study.startDate) && day <= dateAtNoon(study.endDate)
}

function pickDefaultStudy(items: Study[], kind: Study['kind'], today: Date) {
  const matching = items.find((study) => study.kind === kind && isWithinStudy(study, today))
  if (matching) return matching
  return items.filter((study) => study.kind === kind).sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
}

function getRoute() {
  const [section = 'top', studyId] = window.location.hash.replace(/^#\/?/, '').split('/')
  return { section, studyId }
}

function buildBibleUrl(reference: string) {
  const match = reference.match(/^(.+?)\s+(\d+):(\d+)(?:\s*[-,]\s*(\d+))?$/)
  if (!match) return null
  const [, bookName, chapterText, firstVerseText, lastVerseText] = match
  const book = bibleBooks[bookName]
  if (!book) return null
  const chapter = Number(chapterText)
  const firstVerse = Number(firstVerseText)
  const lastVerse = lastVerseText ? Number(lastVerseText) : null
  const verseId = (verse: number) => `${String(book.number).padStart(2, '0')}${String(chapter).padStart(3, '0')}${String(verse).padStart(3, '0')}`
  const anchor = lastVerse ? `v${verseId(firstVerse)}-v${verseId(lastVerse)}` : `v${verseId(firstVerse)}`
  return `https://www.jw.org/mg/zavatra-misy/baiboly/nwt/boky/${book.slug}/${chapter}/#${anchor}`
}

function VerseLink({ verse }: { verse: Verse }) {
  const [isPinned, setIsPinned] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const isOpen = isPinned || isHovering

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsPinned(false)
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsPinned(false)
        setIsHovering(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  return (
    <span
      className={`verse-link ${isOpen ? 'is-open' : ''}`}
      ref={wrapperRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onFocus={() => setIsHovering(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsHovering(false)
      }}
    >
      <button type="button" className="verse-link__trigger" aria-expanded={isOpen} onClick={() => setIsPinned((value) => !value)}>
        {verse.reference}
      </button>
      {isOpen && (
        <span className="verse-link__popover" role="dialog" aria-label={`Andinin-teny ${verse.reference}`}>
          <strong>{verse.reference}</strong>
          <p>{verse.application}</p>
          <a href={verse.url} target="_blank" rel="noreferrer">Vakio ao amin’ny jw.org</a>
        </span>
      )}
    </span>
  )
}

function TextWithVerses({ text }: { text: string }) {
  const parts = text.split(/(Jeremia\s+\d+:\d+(?:\s*[-,]\s*\d+)?|1 Petera\s+\d+:\d+(?:\s*[-,]\s*\d+)?)/g)
  return <>{parts.map((part, index) => {
    const url = buildBibleUrl(part)
    if (!url) return <span key={`${part}-${index}`}>{part}</span>
    return <VerseLink key={`${part}-${index}`} verse={{ reference: part, application: text, url }} />
  })}</>
}

export default function App() {
  const today = useMemo(() => new Date(), [])
  const initialRoute = useMemo(getRoute, [])
  const [activityIndex, setActivityIndex] = useState(0)
  const [familyStudyId, setFamilyStudyId] = useState(() => {
    const routed = studies.find((study) => study.kind === 'family' && study.id === initialRoute.studyId)
    return routed?.id ?? pickDefaultStudy(studies, 'family', today).id
  })
  const [preachingStudyId, setPreachingStudyId] = useState(() => {
    const routed = studies.find((study) => study.kind === 'preaching' && study.id === initialRoute.studyId)
    return routed?.id ?? pickDefaultStudy(studies, 'preaching', today).id
  })
  const [watchtowerStudyId, setWatchtowerStudyId] = useState(() => {
    const routed = watchtowerStudies.find((study) => study.id === initialRoute.studyId)
    return routed?.id
  })
  const [activeRoute, setActiveRoute] = useState(initialRoute)
  const [promptCopied, setPromptCopied] = useState(false)
  const roleCardsUrl = `${import.meta.env.BASE_URL}assets/role-cards.svg`
  const activity = activities[activityIndex]
  const activityArtUrl = `${import.meta.env.BASE_URL}assets/${activity.art}`
  const familyStudies = studies.filter((study): study is FamilyStudy => study.kind === 'family').sort((a, b) => b.startDate.localeCompare(a.startDate))
  const preachingStudies = studies.filter((study): study is PreachingStudy => study.kind === 'preaching').sort((a, b) => b.startDate.localeCompare(a.startDate))
  const familyStudy = familyStudies.find((study) => study.id === familyStudyId) ?? familyStudies[0]
  const preachingStudy = preachingStudies.find((study) => study.id === preachingStudyId) ?? preachingStudies[0]
  const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate())
  const archiveStudies = studies.filter((study) => dateAtNoon(study.endDate) >= twoMonthsAgo).sort((a, b) => b.startDate.localeCompare(a.startDate))
  const familyArchiveStudies = archiveStudies.filter((study): study is FamilyStudy => study.kind === 'family')
  const activeDay = isWithinStudy(familyStudy, today) ? weekdayNames[today.getDay()] : null

  useEffect(() => {
    function syncRoute() {
      const route = getRoute()
      const routedStudy = studies.find((study) => study.id === route.studyId)
      const routedWatchtowerStudy = watchtowerStudies.find((study) => study.id === route.studyId)
      if (routedStudy?.kind === 'family') setFamilyStudyId(routedStudy.id)
      if (routedStudy?.kind === 'preaching') setPreachingStudyId(routedStudy.id)
      if (route.section === 'assistant') setWatchtowerStudyId(routedWatchtowerStudy?.id)
      setActiveRoute(route)
      const targetId = route.section === 'assistant' ? 'assistant' : route.section === 'fianarana' ? 'fianarana' : route.section === 'fanompoana' ? 'fanompoana' : route.section === 'tahiry' ? 'tahiry' : 'top'
      window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }))
    }
    window.addEventListener('hashchange', syncRoute)
    if (window.location.hash) syncRoute()
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  async function copyPrintPrompt() {
    await navigator.clipboard?.writeText(familyStudy.printPrompt)
    setPromptCopied(true)
    window.setTimeout(() => setPromptCopied(false), 1800)
  }

  return (
    <main className="app-shell">
      <nav className="site-nav" aria-label="Fizarana lehibe">
        <a className="site-brand" href="#/top" aria-label="Fianaram-pianakaviana - pejy fandraisana"><span aria-hidden="true">JW</span><strong>Fianaram-pianakaviana</strong></a>
        <div>
          <a href={`#/fianarana/${familyStudy.id}`} aria-current={activeRoute.section === 'fianarana' ? 'page' : undefined}>Fianarana</a>
          <a href={`#/fanompoana/${preachingStudy.id}`} aria-current={activeRoute.section === 'fanompoana' ? 'page' : undefined}>Fanompoana</a>
          <a href="#/assistant" aria-current={activeRoute.section === 'assistant' ? 'page' : undefined}>Étude Tour de Garde</a>
        </div>
      </nav>

      {activeRoute.section === 'assistant' ? (
        <WatchtowerWorkspace studies={watchtowerStudies} selectedStudyId={watchtowerStudyId} today={today} onSelectStudy={setWatchtowerStudyId} />
      ) : <>

      <section className="hero" id="top" aria-labelledby="page-title">
        <div><p className="eyebrow">Mifototra amin’ny loharano ofisialy jw.org</p><h1 id="page-title">Fianaram-pianakaviana</h1><p className="intro">Drafitra tsotra, azo aleha isan’andro, ary tahiry azo averina jerena mandritra ny roa volana.</p></div>
        <div className="week-chip"><span className="live-dot">{isWithinStudy(familyStudy, today) ? 'Amin’ity herinandro ity' : 'Fandaharana voafidy'}</span><span>Herinandro</span><strong>{familyStudy.weekLabel}</strong></div>
        <a className="visual-credit" href={familyStudy.sourceUrl} target="_blank" rel="noreferrer">Sary ofisialy: jw.org</a>
      </section>

      <section className="section-grid" aria-labelledby="roles-title">
        <div className="section-heading"><div><p className="eyebrow">Fandraisana anjara</p><h2 id="roles-title">Anjara andraikitra amin’ity herinandro ity</h2></div><p>Ny anjara dia azo ovaina isaky ny fianarana.</p></div>
        <div className="role-grid">{roles.map((role) => <article className={`role-card ${role.className}`} key={role.id}><span className="role-dot" aria-hidden="true" /><p className="role-person">{role.person}</p><h3>{role.title}</h3><p>{role.action}</p></article>)}</div>
      </section>

      <section className="study-grid" id="fianarana" aria-label="Programme et activité">
        <aside className="archive-sidebar study-history" aria-label="Navigation chronologique des lectures">
          <div className="archive-sidebar__header"><span className="archive-sidebar__icon" aria-hidden="true">↗</span><div><strong>Historique</strong><small>Lectures des deux derniers mois</small></div></div>
          <nav className="archive-sidebar__nav">
            {familyArchiveStudies.map((study) => {
              const isSelected = study.id === familyStudyId
              return <a className={`archive-nav-item ${isSelected ? 'is-selected' : ''}`} href={`#/fianarana/${study.id}`} aria-current={isSelected ? 'page' : undefined} key={study.id}><span className="archive-nav-item__dot" aria-hidden="true" /><span className="archive-nav-item__copy"><strong>{study.weekLabel}</strong><small>{study.reading}</small></span><span className="archive-nav-item__arrow" aria-hidden="true">›</span></a>
            })}
          </nav>
        </aside>
        <article className="weekly-card" key={familyStudy.id}>
          <p className="eyebrow">Famakiana amin’ity herinandro ity</p><h2>{familyStudy.reading}</h2><p>{familyStudy.theme}</p>
          <ol>{familyStudy.days.map((day) => <li className={day.day === activeDay ? 'is-today' : ''} key={day.day}><strong>{day.day}{day.day === activeDay && <span className="today-badge">Anio</span>}</strong><span><TextWithVerses text={day.focus} /></span></li>)}</ol>
          <blockquote><span>Andinin-teny hotadidiana</span><VerseLink verse={familyStudy.memoryVerse} /></blockquote>
          <a href={familyStudy.sourceUrl} target="_blank" rel="noreferrer">Jereo ny loharano ofisialy ao amin’ny jw.org</a>
        </article>
        <article className="activity-card" key={activityIndex}>
          <img className="activity-art" src={activityArtUrl} alt={activity.artAlt} />
          <p className="eyebrow">Hetsika ho an’ny fianakaviana</p><h2>{activity.title}</h2><p className="activity-description">{activity.description}</p><dl><div><dt>Ankizy lehibe</dt><dd>{activity.childOne}</dd></div><div><dt>Ankizy kely</dt><dd>{activity.childTwo}</dd></div></dl><button type="button" onClick={() => setActivityIndex((current) => (current + 1) % activities.length)}>Activité suivante</button>
        </article>
      </section>

      <section className="print-prompt" key={`prompt-${familyStudy.id}`} aria-labelledby="prompt-title"><div><p className="eyebrow">Sary azo pirinty</p><h2 id="prompt-title">Prompt ho an’ny sary amin’ity herinandro ity</h2><p>Voatahiry miaraka amin’ilay fianarana mba ahafahanao mamerina manonta azy rehefa ilaina.</p></div><div><pre>{familyStudy.printPrompt}</pre><button type="button" onClick={copyPrintPrompt}>{promptCopied ? 'Voakopia' : 'Adikao ny prompt'}</button></div></section>

      <section className="preaching-study" id="fanompoana" aria-labelledby="preaching-title">
        <div className="preaching-study__heading"><div className="preaching-study__meta"><p className="eyebrow">Fanomanana ny fanompoana</p><span>Nohavaozina: {preachingStudy.publishedAt}</span></div><h2 id="preaching-title">{preachingStudy.title}</h2><p>{preachingStudy.subtitle}</p><strong className="study-date">Ho an’ny {preachingStudy.weekLabel}</strong></div>
        <a className="visual-credit visual-credit--section" href={preachingStudy.sourceUrl} target="_blank" rel="noreferrer">Sary ofisialy: jw.org</a>
        <div className="preaching-study__grid" key={preachingStudy.id}>
          <article className="preaching-study__card preaching-study__card--focus"><span className="preaching-study__label">Tanjona</span><p>{preachingStudy.objective}</p><span className="preaching-study__label">Lohahevitra</span><h3>{preachingStudy.theme}</h3></article>
          <article className="preaching-study__card"><span className="preaching-study__label">Fanombohana resaka</span><p>{preachingStudy.opening}</p><span className="preaching-study__label">Fanontaniana</span><p>{preachingStudy.question}</p></article>
          <article className="preaching-study__card"><span className="preaching-study__label">Andinin-teny</span><VerseLink verse={preachingStudy.scripture} /></article>
          <article className="preaching-study__card"><span className="preaching-study__label">Rehefa mamaly ilay olona</span><p>{preachingStudy.response}</p></article>
          <article className="preaching-study__card"><span className="preaching-study__label">Dingana manaraka</span><p>{preachingStudy.nextStep}</p></article>
          <article className="preaching-study__card preaching-study__card--practice"><span className="preaching-study__label">Fanazaran-tena</span><p>{preachingStudy.practice}</p><a href={preachingStudy.sourceUrl} target="_blank" rel="noreferrer">Jereo ao amin’ny jw.org</a></article>
        </div>
      </section>

      <section className="print-preview" aria-labelledby="print-title"><div><p className="eyebrow">Karatra azo pirinty</p><h2 id="print-title">Karatra fandraisana anjara</h2><p>Azo ampiasaina miaraka amin’ny anarana azo afindra mba hifandimby andraikitra ny rehetra.</p></div><img src={roleCardsUrl} alt="Planche de quatre cartes de rôles pour étude biblique familiale" /></section>
      <footer><p>Ny loharano sy andinin-teny rehetra dia mankany amin’ny jw.org ofisialy.</p><a href="#top">Hiverina eny ambony</a></footer>
      </>}
    </main>
  )
}