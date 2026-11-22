const gtinLength = /^(?:\d{8}|\d{12,14})$/

export function gtinCheckDigit(body) {
  if (!/^\d+$/.test(body)) throw new TypeError('A GTIN body must contain digits')
  const sum = [...body].reverse().reduce((total, digit, index) =>
    total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0)
  return (10 - sum % 10) % 10
}

export function isValidGtin(value) {
  return typeof value === 'string' && gtinLength.test(value) && Number(value.at(-1)) === gtinCheckDigit(value.slice(0, -1))
}
