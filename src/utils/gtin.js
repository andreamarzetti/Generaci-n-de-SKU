// Dígito verificador GS1 (GTIN-8/12/13/14). Estándar público, no es regla de negocio interna.
export function gtinCheckDigit(body) {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i])
    sum += digit * (i % 2 === 0 ? 3 : 1)
  }
  return String((10 - (sum % 10)) % 10)
}

export function withCheckDigit(body) {
  return body + gtinCheckDigit(body)
}

export function isValidGtin(code) {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return false
  return gtinCheckDigit(code.slice(0, -1)) === code.slice(-1)
}
