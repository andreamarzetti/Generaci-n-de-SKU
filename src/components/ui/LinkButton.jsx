import { Icon } from './Icon'

/**
 * Acción en línea dentro de una tabla o un texto. El color indica la acción:
 * danger (quitar), success (aceptar o guardar) o neutral (editar, restablecer).
 * Con `iconOnly` queda solo el icono (para filas con poco lugar): el texto sigue siendo la
 * etiqueta para lectores de pantalla y se ve al pasar el mouse.
 */
export function LinkButton({ tone = 'neutral', icon, iconOnly = false, className = '', children, ...props }) {
  const title = iconOnly && typeof children === 'string' ? children : undefined
  return (
    <button type="button" title={title} className={`link-button link-button--${tone} ${iconOnly ? 'link-button--icon' : ''} ${className}`} {...props}>
      {icon && <Icon name={icon} size={iconOnly ? 16 : 13} />}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
    </button>
  )
}
