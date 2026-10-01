import { Icon } from './Icon'

/**
 * El color dice qué hace el botón:
 *  primary   (verde)       avanzar o crear: Siguiente, Crear, Nueva alta, Cargar
 *  success   (verde oscuro) confirmar o guardar: Guardar, Aceptar, Confirmar
 *  danger    (rojo)        quitar o descartar: Quitar, Descartar, Limpiar
 *  warning   (ámbar)       reemplazar o revisar algo que ya existe
 *  dark      (negro)       analizar o ejecutar: Interpretar, Validar
 *  secondary (blanco)      neutro: Cancelar, Anterior, Exportar, Copiar
 *  ghost                   acción secundaria sin énfasis
 * `icon` va a la izquierda; `iconRight`, a la derecha (flechas de avance).
 */
export function Button({ variant = 'secondary', size = 'md', icon, iconRight, className = '', children, ...props }) {
  return (
    <button type="button" className={`btn btn--${variant} btn--${size} ${className}`} {...props}>
      {icon && <Icon name={icon} />}
      {children}
      {iconRight && <Icon name={iconRight} />}
    </button>
  )
}
