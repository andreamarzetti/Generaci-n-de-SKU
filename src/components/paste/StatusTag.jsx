import { STATUS } from '../../parsing/normalize'

const META = {
  [STATUS.DETECTED]: { tone: 'ok', label: 'Detectado' },
  [STATUS.DEDUCED]: { tone: 'warn', label: 'Deducido' },
  [STATUS.MISSING]: { tone: 'neutral', label: 'Completar' },
  [STATUS.EDITED]: { tone: 'neutral', label: 'Editado' },
}

/**
 * Origen de un dato interpretado. El motivo se ve al pasar el mouse o con el foco
 * del teclado, y los lectores de pantalla lo leen como parte de la etiqueta.
 */
export function StatusTag({ status, reason }) {
  const meta = META[status] ?? META[STATUS.MISSING]
  if (!reason) {
    return <span className={`badge badge--${meta.tone} status-tag`}>{meta.label}</span>
  }
  return (
    <span className={`badge badge--${meta.tone} status-tag has-tip`} tabIndex={0} data-tip={reason}>
      {meta.label}
      <span className="sr-only">: {reason}</span>
    </span>
  )
}
