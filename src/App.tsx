import { useState } from 'react'
import latestWeek from './data/latest-week.json'
import './styles.css'

type Role = {
  id: string
  title: string
  action: string
  person: string
  className: string
}

const roles: Role[] = [
  { id: 'guide', title: 'Mpitarika', action: 'Mamaky na mitantara', person: 'Angelo', className: 'role--navy' },
  { id: 'connector', title: 'Mpampifandray', action: 'Mihaino sy mametraka fanontaniana', person: 'Tatiana', className: 'role--teal' },
  { id: 'answerer', title: 'Mpamaly sy Mpisafidy', action: 'Mamaly na misafidy sary', person: 'Arielle', className: 'role--violet' },
  { id: 'participant', title: 'Mpandray anjara', action: 'Maneho amin’ny fihetsika', person: 'Gaëlle', className: 'role--green' },
]

const activities = [
  {
    title: 'Karatra safidy',
    description: 'Mifidiana amin’ny sary roa izay mifanaraka amin’ilay tantara.',
    arielle: 'Misafidy sary iray ary milaza ny antony.',
    gaelle: 'Manondro na mitazona ilay sary.',
  },
  {
    title: 'Alaharo ny tantara',
    description: 'Apetraho araka ny filaharany ireo sary telo na efatra.',
    arielle: 'Mandahatra ireo sary.',
    gaelle: 'Mametraka ny sary farany.',
  },
  {
    title: 'Ataovy ilay fihetsika',
    description: 'Asehoy amin’ny fihetsika ny zavatra nitranga tao amin’ilay tantara.',
    arielle: 'Mamerina fihetsika iray ary mamaly fanontaniana.',
    gaelle: 'Manao fihetsika na manahaka feo tsotra.',
  },
  {
    title: 'Mitadiava marika ao an-trano',
    description: 'Mitadiava zavatra roa ao an-trano mampahatsiahy ny lesona.',
    arielle: 'Mitady sy manonona zavatra iray.',
    gaelle: 'Mitondra na manondro zavatra iray.',
  },
]

export default function App() {
  const [activityIndex, setActivityIndex] = useState(0)
  const activity = activities[activityIndex]

  function showNextActivity() {
    setActivityIndex((current) => (current + 1) % activities.length)
  }

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Fianakaviana Lock To Hang</p>
          <h1 id="page-title">Fianaram-pianakaviana</h1>
          <p className="intro">Drafitra tsotra mba hianaran’ny fianakaviana miaraka, hifandimby handray anjara, ary hampihatra lesona iray isan-kerinandro.</p>
        </div>
        <div className="week-chip">
          <span>Herinandro</span>
          <strong>{latestWeek.weekLabel}</strong>
        </div>
      </section>

      <section className="section-grid" aria-labelledby="roles-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fandraisana anjara</p>
            <h2 id="roles-title">Anjara andraikitra amin’ity herinandro ity</h2>
          </div>
          <p>Ny anjara dia azo ovaina isaky ny fianarana.</p>
        </div>
        <div className="role-grid">
          {roles.map((role) => (
            <article className={`role-card ${role.className}`} key={role.id}>
              <span className="role-dot" aria-hidden="true" />
              <p className="role-person">{role.person}</p>
              <h3>{role.title}</h3>
              <p>{role.action}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="study-grid" aria-label="Programme et activité">
        <article className="weekly-card">
          <p className="eyebrow">Famakiana amin’ity herinandro ity</p>
          <h2>{latestWeek.reading}</h2>
          <p>{latestWeek.theme}</p>
          <ol>
            {latestWeek.days.map((day) => (
              <li key={day.day}>
                <strong>{day.day}</strong>
                <span>{day.focus}</span>
              </li>
            ))}
          </ol>
          <blockquote>
            <span>Andinin-teny hotadidiana</span>
            <strong>{latestWeek.memoryVerse.reference}</strong>
            <p>{latestWeek.memoryVerse.application}</p>
          </blockquote>
          <a href={latestWeek.sourceUrl} target="_blank" rel="noreferrer">Jereo ao amin’ny jw.org</a>
        </article>

        <article className="activity-card">
          <p className="eyebrow">Hetsika ho an’ny fianakaviana</p>
          <h2>{activity.title}</h2>
          <p className="activity-description">{activity.description}</p>
          <dl>
            <div><dt>Arielle</dt><dd>{activity.arielle}</dd></div>
            <div><dt>Gaëlle</dt><dd>{activity.gaelle}</dd></div>
          </dl>
          <button type="button" onClick={showNextActivity} aria-label="Activité suivante">Activité suivante</button>
        </article>
      </section>

      <section className="print-preview" aria-labelledby="print-title">
        <div>
          <p className="eyebrow">Karatra azo pirinty</p>
          <h2 id="print-title">Karatra fandraisana anjara</h2>
          <p>Azo ampiasaina miaraka amin’ny anarana azo afindra mba hifandimby andraikitra ny rehetra.</p>
        </div>
        <img src="/assets/role-cards.svg" alt="Planche de quatre cartes de rôles pour étude biblique familiale" />
      </section>
    </main>
  )
}
