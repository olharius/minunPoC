const money = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 0 })
const date = new Intl.DateTimeFormat('fi-FI', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })

export const fmtMoney = (n: number) => money.format(n)
export const fmtNum = (n: number) => num.format(n)
export const fmtDate = (d: Date) => date.format(d)
/** A cost shown as a negative amount (never "−0 $"). */
export const fmtCost = (n: number) => money.format(n ? -n : 0)
