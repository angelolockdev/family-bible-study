import type { PreparationDraft, PreparationMode } from './preparationStorage'

type PreparationFieldsProps = {
  draft: PreparationDraft
  onChange: (changes: Partial<PreparationDraft>) => void
}

export function ModeChoice({ mode, onChange }: { mode: PreparationMode; onChange: (mode: PreparationMode) => void }) {
  return (
    <fieldset className="assistant-mode">
      <legend>Fomba fanomanana <small>Mode de préparation</small></legend>
      <label data-selected={mode === 'manual'}>
        <input type="radio" name="preparation-mode" checked={mode === 'manual'} onChange={() => onChange('manual')} />
        <span><strong>Fanomanana an-tanana</strong><small>Manuelle · manorata amin’ny teninao</small></span>
      </label>
      <label data-selected={mode === 'guided'}>
        <input type="radio" name="preparation-mode" checked={mode === 'guided'} onChange={() => onChange('guided')} />
        <span><strong>Fanomanana misy tari-dalana</strong><small>Guidée · misaintsaina vao mahita soso-kevitra</small></span>
      </label>
    </fieldset>
  )
}

export function PreparationFields({ draft, onChange }: PreparationFieldsProps) {
  const fields: Array<{ name: keyof PreparationDraft; label: string; hint: string; placeholder: string }> = [
    { name: 'mainIdea', label: 'Hevi-dehibe', hint: 'Idée principale', placeholder: 'Soraty amin’ny fehezanteny iray ny hevitra fototra…' },
    { name: 'evidenceNotes', label: 'Fanamarihana porofo', hint: 'Notes de preuve', placeholder: 'Andinin-teny na porofo manohana ny hevitrao…' },
    { name: 'reflectionNotes', label: 'Fanamarihana fandinihana', hint: 'Notes de réflexion', placeholder: 'Inona no nianaranao sy tsapanao?' },
    { name: 'personalAnswer', label: 'Valin-tena', hint: 'Réponse personnelle', placeholder: 'Ahoana no hampiharanao izany amin’ity herinandro ity?' },
  ]
  return (
    <fieldset className="assistant-fields">
      <legend>Analyse personnelle</legend>
      {fields.map(({ name, label, hint, placeholder }) => (
        <label key={name} data-filled={Boolean(String(draft[name]).trim())}>
          <span>{label}<small>{hint}</small></span>
          <textarea placeholder={placeholder} value={String(draft[name])} onChange={(event) => onChange({ [name]: event.target.value })} />
        </label>
      ))}
    </fieldset>
  )
}
