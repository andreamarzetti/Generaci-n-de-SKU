export function Button({ variant = 'secondary', size = 'md', className = '', ...props }) {
  return <button type="button" className={`btn btn--${variant} btn--${size} ${className}`} {...props} />
}
