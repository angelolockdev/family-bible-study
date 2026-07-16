import type { PreparationDraft, PreparationMode } from './preparationStorage'

type PreparationFieldsProps = {
  draft: PreparationDraft
  onChange: (changes: Partial<PreparationDraft>) => void
}

export function ModeChoice({ mode, onChange }: { mode: PreparationMode; onChange: (mode: PreparationMode) => void }) {
  return (
    <fieldset className="assistant-mode">
      <legend>Choisissez votre mode de préparation</legend>
      <label><input type="radio" name="preparation-mode" checked={mode === 'manual'} onChange={() => onChange('manual')} /> Préparation manuelle</label>
      <label><input type="radio" name="preparation-mode" checked={mode === 'guided'} onChange={() => onChange('guided')} /> Préparation guidée</label>
    </fieldset>
  )
}

export function PreparationFields({ draft, onChange }: PreparationFieldsProps) {
  const fields: Array<[keyof PreparationDraft, string]> = [
    ['mainIdea', 'Hevi-dehibe / Idée principale'],
    ['evidenceNotes', 'Fanamarihana porofo / Notes de preuve'],
    ['reflectionNotes', 'Fanamarihana fandinihana / Notes de réflexion'],
    ['personalAnswer', 'Valin-tena / Réponse personnelle'],
  ]
  return (
    <fieldset className="assistant-fields">
      <legend>Analyse personnelle</legend>
      {fields.map(([name, label]) => (
        <label key={name}>{label}<textarea value={String(draft[name])} onChange={(event) => onChange({ [name]: event.target.value })} /></label>
      ))}
    </fieldset>
  )
}
