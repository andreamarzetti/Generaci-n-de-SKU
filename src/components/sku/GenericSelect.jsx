import { useMemo, useRef, useState } from 'react'
import { GENERICOS_REPETIDOS } from '../../data/realData'
import { Field } from '../ui/Field'

const MAX_RESULTS = 50

const optionLabel = (generico) =>
  [generico.codigo, `${generico.tipologia} ${generico.modelo}`, generico.genero].filter(Boolean).join(' · ')

const normalize = (text) =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Todas las palabras buscadas tienen que aparecer en el texto de la opción (sin importar orden ni tildes). */
const matches = (label, terms) => {
  const text = normalize(label)
  return terms.every((term) => text.includes(term))
}

/**
 * Selector de código genérico con autocompletado: la lista real filtrada por marca y familia.
 * Nunca preselecciona: el genérico lo elige el usuario (si queda vacío, la validación bloquea).
 * Teclado: ↓/↑ recorren, Enter elige, Esc cierra; el botón ✕ lo limpia.
 */
export function GenericSelect({ id, genericos, value, onChange, hint, emptyMessage }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  const selected = genericos.find((generico) => generico.key === value)
  const repeatedModels = selected ? GENERICOS_REPETIDOS.get(selected.codigo) : null
  const listId = `${id}-opciones`
  const empty = genericos.length === 0

  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean)
    const filtered = terms.length ? genericos.filter((generico) => matches(optionLabel(generico), terms)) : genericos
    return filtered.slice(0, MAX_RESULTS)
  }, [genericos, query])

  const openList = () => {
    if (empty) return
    setQuery('')
    setActive(0)
    setOpen(true)
  }

  const choose = (generico) => {
    onChange(generico.key)
    setQuery('')
    setOpen(false)
  }

  const clear = () => {
    onChange('')
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const moveActive = (delta) => {
    if (!open) return openList()
    const next = Math.max(0, Math.min(results.length - 1, active + delta))
    setActive(next)
    listRef.current?.children[next]?.scrollIntoView({ block: 'nearest' })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveActive(1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveActive(-1)
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault()
      choose(results[active])
    } else if (e.key === 'Escape') {
      setQuery('')
      setOpen(false)
    }
  }

  const handleInput = (e) => {
    setQuery(e.target.value)
    setActive(0)
    setOpen(true)
    if (!e.target.value && value) onChange('')
  }

  const defaultHint = hint ?? `Obligatorio. ${genericos.length} genéricos de LS2 para esta familia.`
  const fieldHint = open
    ? `${results.length === MAX_RESULTS ? `Primeros ${MAX_RESULTS}` : results.length} resultado(s). Escribí código, modelo, tipología o género.`
    : defaultHint

  return (
    <Field label="Código genérico" htmlFor={id} hint={fieldHint}>
      <div className="combobox">
        <input
          id={id}
          ref={inputRef}
          type="text"
          className="input combobox__input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          disabled={empty}
          placeholder={empty ? 'Sin genéricos disponibles' : 'Buscá un genérico…'}
          value={open ? query : selected ? optionLabel(selected) : ''}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={() => setOpen(false)}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
        />
        {selected && !open && (
          <button type="button" className="combobox__clear" aria-label="Limpiar el código genérico" onClick={clear}>
            ✕
          </button>
        )}
        {open && (
          <ul id={listId} ref={listRef} className="combobox__list" role="listbox">
            {results.length === 0 ? (
              <li className="combobox__empty">Sin coincidencias para “{query}”.</li>
            ) : (
              results.map((generico, index) => (
                <li
                  key={generico.key}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={generico.key === value}
                  className={`combobox__option ${index === active ? 'is-active' : ''} ${generico.key === value ? 'is-selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(generico)
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  {optionLabel(generico)}
                  {GENERICOS_REPETIDOS.has(generico.codigo) && <span className="combobox__tag">código repetido</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      {empty && emptyMessage && (
        <p className="generic-warning" role="note">
          {emptyMessage}
        </p>
      )}
      {repeatedModels && (
        <p className="generic-warning" role="note">
          Este código genérico está asociado a más de un modelo ({repeatedModels.join(' y ')}). Es una inconsistencia de
          los datos reales para revisar con Andrés.
        </p>
      )}
    </Field>
  )
}
