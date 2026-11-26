import { captainWage, traitInfo, xpToNext } from '../../game/captains'
import { fmtMoney } from '../../game/format'
import type { OwnedShip } from '../../game/types'

/** The ship's captain in one or two lines, or a note that there is none. */
export function CaptainInfo({ ship }: { ship: OwnedShip }) {
  const c = ship.captain
  if (!c) return <div className="captain muted">Ei kapteenia. Palkkaa kapteeni keskikokoisesta tai suuresta satamasta.</div>
  const next = xpToNext(c)
  return (
    <div className="captain">
      <div>
        🧑‍✈️ <strong>{c.name}</strong> · {traitInfo(c.trait).name} · taso {c.level}
      </div>
      <small className="muted">
        {traitInfo(c.trait).perLevel} · palkka {fmtMoney(captainWage(c))}/pv · {next === null ? 'huipputaso' : `seuraava taso ${next} meripäivän päästä`}
      </small>
    </div>
  )
}
