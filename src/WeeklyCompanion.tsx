import { useEffect, useMemo, useState } from 'react'
import { ScripturePopover } from './components/ScripturePopover'
import studiesData from './data/studies.json'
import watchtowerData from './data/watchtower-studies.json'
import { PreparationWorkspace, type AssistantStudy } from './features/study-assistant/PreparationWorkspace'
import { visibleArchiveItems } from './features/study-assistant/archiveWindow'
import { loadPreparationStore } from './features/study-assistant/preparationStorage'
import { getStudySelectionReason, selectStudy, type StudySelectionReason } from './features/study-assistant/studySelection'
import { WatchtowerWorkspace, type WatchtowerStudy } from './features/study-assistant/WatchtowerWorkspace'
import './styles.css'

type Day = { day: string; focus: string }
type Verse = { reference: string; application: string; url: string }
type FamilyStudy = AssistantStudy & {
  kind: 'family'
  printPrompt: string
  generatedAt?: string
}
type PreachingStudy = {
  id: string
  kind: 'preaching'
  startDate: string
  endDate: string
  weekLabel: string
  publishedAt: string
  generatedAt?: string
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
type RouteSection = 'top' | 'fianarana' | 'fanompoana' | 'tilikambo' | 'fanomanana' | 'tahiry'
type Route = { section: RouteSection; studyId?: string }

const studies = studiesData as Study[]
const familyStudies = studies.filter((study): study is FamilyStudy => study.kind === 'family')
const preachingStudies = studies.filter((study): study is PreachingStudy => study.kind === 'preaching')
const watchtowerStudies = watchtowerData as WatchtowerStudy[]

const roles = [
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
const bibleBooks: Record<string, { number: number; slug: string }> = {
  Jeremia: { number: 24, slug: 'jeremia' },
  '1 Petera': { number: 60, slug: '1-petera' },
}

function getRoute(): Route {
  const [rawSection = 'top', studyId] = window.location.hash.replace(/^#\/?/, '').split('/')
  const section = rawSection === 'assistant' ? 'tilikambo' : rawSection
  const validSections: RouteSection[] = ['top', 'fianarana', 'fanompoana', 'tilikambo', 'fanomanana', 'tahiry']
  return { section: validSections.includes(section as RouteSection) ? section as RouteSection : 'top', studyId }
}

function selectionLabel(reason: StudySelectionReason) {
  if (reason === 'current') return 'Amin’ity herinandro ity'
  if (reason === 'upcoming') return 'Herinandro manaraka'
  return 'Tahiry farany'
}

export function visualStateForReason(reason: StudySelectionReason) {
  return reason === 'archive-fallback' ? 'past' : reason
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
  return <ScripturePopover label={verse.reference} url={verse.url}>{verse.application}</ScripturePopover>
}

function TextWithVerses({ text }: { text: string }) {
  const parts = text.split(/(Jeremia\s+\d+:\d+(?:\s*[-,]\s*\d+)?|1 Petera\s+\d+:\d+(?:\s*[-,]\s*\d+)?)/g)
  return <>{parts.map((part, index) => {
    const url = buildBibleUrl(part)
    return url ? <VerseLink key={`${part}-${index}`} verse={{ reference: part, application: text, url }} /> : <span key={`${part}-${index}`}>{part}</span>
  })}</>
}

function SiteNavigation({ section, familyStudy, preachingStudy }: { section: RouteSection; familyStudy?: FamilyStudy; preachingStudy?: PreachingStudy }) {
  const links: Array<{ section: RouteSection; label: string; href: string }> = [
    { section: 'top', label: 'Fandraisana', href: '#/top' },
    { section: 'fianarana', label: 'Fianarana', href: `#/fianarana/${familyStudy?.id ?? ''}` },
    { section: 'fanompoana', label: 'Fanompoana', href: `#/fanompoana/${preachingStudy?.id ?? ''}` },
    { section: 'tilikambo', label: 'Tilikambo Fiambenana', href: '#/tilikambo' },
    { section: 'fanomanana', label: 'Fanomanana', href: '#/fanomanana' },
    { section: 'tahiry', label: 'Tahiry', href: '#/tahiry' },
  ]
  return (
    <nav className="site-nav" aria-label="Fizarana lehibe">
      <a className="site-brand" href="#/top" aria-label="Fandraisana — Fianaram-pianakaviana" aria-current={section === 'top' ? 'page' : undefined}><span aria-hidden="true">JW</span><strong>Fianaram-pianakaviana</strong></a>
      <div className="site-nav__links">{links.slice(1).map((link) => <a key={link.section} href={link.href} aria-current={section === link.section ? 'page' : undefined}>{link.label}</a>)}</div>
    </nav>
  )
}

function generationState(generatedAt: string | undefined, today: Date) {
  if (!generatedAt) return { label: 'Daty tsy fantatra', stale: true }
  const generated = new Date(generatedAt)
  const ageDays = Math.floor((today.getTime() - generated.getTime()) / 86_400_000)
  return { label: generated.toLocaleDateString('mg-MG', { day: 'numeric', month: 'long', year: 'numeric' }), stale: ageDays > 8 }
}

function Dashboard({ familyStudy, familyReason, preachingStudy, preachingReason, watchtowerStudy, watchtowerReason, today }: {
  familyStudy?: FamilyStudy
  familyReason: StudySelectionReason
  preachingStudy?: PreachingStudy
  preachingReason: StudySelectionReason
  watchtowerStudy?: WatchtowerStudy
  watchtowerReason: StudySelectionReason
  today: Date
}) {
  if (!familyStudy) return <section className="system-state"><h1>Tsy misy katalaogy</h1><p>Tsy misy fianarana ao amin’ny katalaogy. Mbola azo jerena ny loharano ofisialy ao amin’ny jw.org.</p></section>
  const store = loadPreparationStore()
  const draft = store.drafts.find((item) => item.studyId === familyStudy.id)
  const nextFamily = [...familyStudies].filter((study) => study.startDate > familyStudy.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  const generatedDates = [...studies.map((study) => study.generatedAt), ...watchtowerStudies.map((study) => study.generatedAt)].filter((value): value is string => Boolean(value)).sort()
  const freshness = generationState(generatedDates.at(-1), today)
  const cards = [
    { label: 'Fianarana', title: familyStudy.reading, meta: familyStudy.theme, href: `#/fianarana/${familyStudy.id}`, reason: familyReason },
    { label: 'Fanompoana', title: preachingStudy?.title ?? 'Mbola tsy misy', meta: preachingStudy?.theme ?? 'Miandry ny famoahana manaraka.', href: preachingStudy ? `#/fanompoana/${preachingStudy.id}` : '#/fanompoana', reason: preachingReason },
    { label: 'Tilikambo Fiambenana', title: watchtowerStudy?.title ?? 'Mbola tsy misy', meta: watchtowerStudy?.weekLabel ?? 'Miandry ny famoahana manaraka.', href: watchtowerStudy ? `#/tilikambo/${watchtowerStudy.id}` : '#/tilikambo', reason: watchtowerReason },
  ]
  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-hero">
        <div><p className="eyebrow">Fandaharana isan-kerinandro</p><h1 id="dashboard-title">Herinandro {familyStudy.weekLabel}</h1><p>Jereo vetivety izay homanina, dia midira amin’ny fizarana ilainao ihany.</p></div>
        <div className="dashboard-actions"><a className="primary-action" href="#/fanomanana">Hanomboka ny fanomanana</a>{nextFamily && <a className="secondary-action" href={`#/fianarana/${nextFamily.id}`}>Herinandro manaraka</a>}</div>
      </header>
      <div className="dashboard-status" role={freshness.stale ? 'alert' : 'status'}><span className={freshness.stale ? 'status-dot status-dot--warning' : 'status-dot'} /> <strong>Votoaty nohavaozina farany:</strong> {freshness.label}. {freshness.stale ? 'Mety tsy nahomby na mbola tsy tonga ny fanavaozana mandeha ho azy; mbola azo ampiasaina ny votoaty voamarina farany.' : 'Vonona hampiasaina.'}</div>
      <div className="dashboard-grid">{cards.map((card) => <article className="dashboard-card" key={card.label}><span className={`state-badge state-badge--${visualStateForReason(card.reason)}`}>{selectionLabel(card.reason)}</span><p className="eyebrow">{card.label}</p><h2>{card.title}</h2><p>{card.meta}</p><a href={card.href}>Sokafy <span aria-hidden="true">→</span></a></article>)}</div>
      <aside className="progress-card" aria-label="Fandrosoana manokana"><div><p className="eyebrow">Fandrosoana manokana</p><h2>{draft?.completedQuestionCount ?? 0}/{familyStudy.days.length} vita</h2><p>{draft ? `Voatahiry farany: ${new Date(draft.updatedAt).toLocaleString('mg-MG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Tsy mbola misy fanomanana voatahiry.'}</p></div><a href="#/fanomanana">{draft ? 'Hanohy' : 'Hanomboka'}</a></aside>
    </section>
  )
}

function FamilyStudyView({ study, today }: { study: FamilyStudy; today: Date }) {
  const [activityIndex, setActivityIndex] = useState(0)
  const [promptCopied, setPromptCopied] = useState(false)
  const activity = activities[activityIndex]
  const activeDay = getStudySelectionReason(study, today) === 'current' ? weekdayNames[today.getDay()] : null
  const history = visibleArchiveItems(familyStudies, today)
  async function copyPrompt() {
    await navigator.clipboard?.writeText(study.printPrompt)
    setPromptCopied(true)
    window.setTimeout(() => setPromptCopied(false), 1800)
  }
  return <section className="workspace-page" aria-labelledby="family-title">
    <header className="workspace-header"><div><p className="eyebrow">{selectionLabel(getStudySelectionReason(study, today))}</p><h1 id="family-title">{study.reading}</h1><p>{study.weekLabel} · {study.theme}</p></div><a href={study.sourceUrl} target="_blank" rel="noreferrer">Loharano ofisialy jw.org</a></header>
    <div className="study-grid">
      <aside className="archive-sidebar study-history" aria-label="Navigation chronologique des lectures"><div className="archive-sidebar__header"><span className="archive-sidebar__icon" aria-hidden="true">↗</span><div><strong>Tahiry</strong><small>Roa volana farany</small></div></div><nav className="archive-sidebar__nav">{history.map((item) => <a className={`archive-nav-item ${item.id === study.id ? 'is-selected' : ''}`} href={`#/fianarana/${item.id}`} aria-current={item.id === study.id ? 'page' : undefined} key={item.id}><span className="archive-nav-item__dot" aria-hidden="true" /><span className="archive-nav-item__copy"><strong>{item.weekLabel}</strong><small>{item.reading}</small></span><span className="archive-nav-item__arrow" aria-hidden="true">›</span></a>)}</nav></aside>
      <article className="weekly-card"><p className="eyebrow">Famakiana isan’andro</p><h2>{study.reading}</h2><ol>{study.days.map((day) => <li className={day.day === activeDay ? 'is-today' : ''} key={day.day}><strong>{day.day}{day.day === activeDay && <span className="today-badge">Anio</span>}</strong><span><TextWithVerses text={day.focus} /></span></li>)}</ol><blockquote><span>Andinin-teny hotadidiana</span><VerseLink verse={study.memoryVerse} /></blockquote><a href={study.sourceUrl} target="_blank" rel="noreferrer">Jereo ao amin’ny jw.org</a></article>
      <article className="activity-card" key={activityIndex}><img className="activity-art" src={`${import.meta.env.BASE_URL}assets/${activity.art}`} alt={activity.artAlt} /><p className="eyebrow">Hetsika ho an’ny fianakaviana</p><h2>{activity.title}</h2><p className="activity-description">{activity.description}</p><dl><div><dt>Ankizy lehibe</dt><dd>{activity.childOne}</dd></div><div><dt>Ankizy kely</dt><dd>{activity.childTwo}</dd></div></dl><button type="button" onClick={() => setActivityIndex((current) => (current + 1) % activities.length)}>Hetsika manaraka</button></article>
    </div>
    <section className="section-grid" aria-labelledby="roles-title"><div className="section-heading"><div><p className="eyebrow">Fandraisana anjara</p><h2 id="roles-title">Anjara andraikitra</h2></div><p>Azo ovaina isaky ny fianarana.</p></div><div className="role-grid">{roles.map((role) => <article className={`role-card ${role.className}`} key={role.id}><span className="role-dot" aria-hidden="true" /><p className="role-person">{role.person}</p><h3>{role.title}</h3><p>{role.action}</p></article>)}</div></section>
    <details className="print-prompt"><summary>Prompt ho an’ny sary azo pirinty</summary><div><pre>{study.printPrompt}</pre><button type="button" data-state={promptCopied ? 'copied' : 'default'} onClick={copyPrompt}>{promptCopied ? 'Voakopia' : 'Adikao ny prompt'}</button></div></details>
  </section>
}

function PreachingView({ study, reason }: { study: PreachingStudy; reason: StudySelectionReason }) {
  return <section className="workspace-page preaching-page" aria-labelledby="preaching-title"><header className="workspace-header"><div><p className="eyebrow">{selectionLabel(reason)} · Fanomanana ny fanompoana</p><h1 id="preaching-title">{study.title}</h1><p>{study.weekLabel} · {study.subtitle}</p></div><a href={study.sourceUrl} target="_blank" rel="noreferrer">Loharano ofisialy jw.org</a></header><div className="preaching-study__grid"><article className="preaching-study__card preaching-study__card--focus"><span className="preaching-study__label">Tanjona</span><p>{study.objective}</p><span className="preaching-study__label">Lohahevitra</span><h2>{study.theme}</h2></article><article className="preaching-study__card"><span className="preaching-study__label">Fanombohana resaka</span><p>{study.opening}</p><span className="preaching-study__label">Fanontaniana</span><p>{study.question}</p></article><article className="preaching-study__card"><span className="preaching-study__label">Andinin-teny</span><VerseLink verse={study.scripture} /></article><article className="preaching-study__card"><span className="preaching-study__label">Rehefa mamaly ilay olona</span><p>{study.response}</p></article><article className="preaching-study__card"><span className="preaching-study__label">Dingana manaraka</span><p>{study.nextStep}</p></article><article className="preaching-study__card preaching-study__card--practice"><span className="preaching-study__label">Fanazaran-tena</span><p>{study.practice}</p><a href={study.sourceUrl} target="_blank" rel="noreferrer">Jereo ao amin’ny jw.org</a></article></div></section>
}

function HistoryView({ today }: { today: Date }) {
  const visibleStudies = visibleArchiveItems(studies, today)
  const visibleWatchtower = visibleArchiveItems(watchtowerStudies, today)
  return <section className="history-page" aria-labelledby="history-title"><header className="workspace-header"><div><p className="eyebrow">Roa volana farany</p><h1 id="history-title">Tahiry</h1><p>Fianarana, fanompoana ary Tilikambo Fiambenana voamarina.</p></div></header><div className="history-columns"><section><h2>Fianarana sy Fanompoana</h2>{visibleStudies.map((study) => <a className="history-item" href={`#/${study.kind === 'family' ? 'fianarana' : 'fanompoana'}/${study.id}`} key={study.id}><span>{study.kind === 'family' ? 'Fianarana' : 'Fanompoana'}</span><strong>{study.weekLabel}</strong><small>{study.kind === 'family' ? study.reading : study.theme}</small></a>)}</section><section><h2>Tilikambo Fiambenana</h2>{visibleWatchtower.map((study) => <a className="history-item" href={`#/tilikambo/${study.id}`} key={study.id}><span>Tilikambo Fiambenana</span><strong>{study.weekLabel}</strong><small>{study.title}</small></a>)}</section></div></section>
}

function CatalogueEmptyState({ title }: { title: string }) {
  return <section className="system-state"><p className="eyebrow">Katalaogy mbola tsy vonona</p><h1>{title}</h1><p>Tsy mbola misy votoaty voamarina amin’ity fizarana ity. Mbola afaka mijery ny loharano ofisialy ao amin’ny jw.org ianao, ary hiverina eto rehefa vita ny fanavaozana manaraka.</p></section>
}

export default function WeeklyCompanion() {
  const today = useMemo(() => new Date(), [])
  const [route, setRoute] = useState(getRoute)
  useEffect(() => {
    const syncRoute = () => setRoute(getRoute())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])

  const familySelection = selectStudy(familyStudies, 'family', today)
  const preachingSelection = selectStudy(preachingStudies, 'preaching', today)
  const watchtowerSelection = selectStudy(watchtowerStudies.map((study) => ({ ...study, kind: 'watchtower' })), 'watchtower', today)
  const familyStudy = familyStudies.find((study) => study.id === (route.section === 'fianarana' ? route.studyId : familySelection.study?.id)) ?? familyStudies.find((study) => study.id === familySelection.study?.id)
  const preachingStudy = preachingStudies.find((study) => study.id === (route.section === 'fanompoana' ? route.studyId : preachingSelection.study?.id)) ?? preachingStudies.find((study) => study.id === preachingSelection.study?.id)
  const watchtowerStudy = watchtowerStudies.find((study) => study.id === watchtowerSelection.study?.id)

  return <main className="app-shell"><SiteNavigation section={route.section} familyStudy={familyStudy} preachingStudy={preachingStudy} /><div className="route-content">
    {route.section === 'top' && <Dashboard familyStudy={familyStudy} familyReason={familySelection.reason} preachingStudy={preachingStudy} preachingReason={preachingSelection.reason} watchtowerStudy={watchtowerStudy} watchtowerReason={watchtowerSelection.reason} today={today} />}
    {route.section === 'fianarana' && (familyStudy ? <FamilyStudyView study={familyStudy} today={today} /> : <CatalogueEmptyState title="Tsy mbola misy fianarana" />)}
    {route.section === 'fanompoana' && (preachingStudy ? <PreachingView study={preachingStudy} reason={getStudySelectionReason(preachingStudy, today)} /> : <CatalogueEmptyState title="Tsy mbola misy fanomanana fanompoana" />)}
    {route.section === 'tilikambo' && <WatchtowerWorkspace studies={watchtowerStudies} selectedStudyId={route.studyId} today={today} />}
    {route.section === 'fanomanana' && <PreparationWorkspace studies={familyStudies} today={today} />}
    {route.section === 'tahiry' && <HistoryView today={today} />}
  </div><footer><p>Ny loharano sy andinin-teny rehetra dia mankany amin’ny jw.org ofisialy.</p><a href="#/top">Fandraisana</a></footer></main>
}
