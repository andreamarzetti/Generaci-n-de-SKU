export function FamilySelector({ families, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label="Familia">
      {families.map((family) => (
        <button
          key={family.id}
          type="button"
          role="radio"
          aria-checked={family.id === value}
          className={`segmented__option ${family.id === value ? 'is-active' : ''}`}
          onClick={() => onChange(family.id)}
        >
          {family.label}
        </button>
      ))}
    </div>
  )
}
