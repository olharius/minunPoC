import { useEffect, useState } from 'react'
import { loadFromBrowser, saveToBrowser, type SaveFile } from './game/save'
import type { GameState } from './game/types'
import { GameScreen } from './ui/GameScreen'
import { StartScreen } from './ui/StartScreen'

export default function App() {
  const [autosave, setAutosave] = useState<SaveFile | null>(() => loadFromBrowser())
  const [state, setState] = useState<GameState | null>(null)

  // Autosave on every change.
  useEffect(() => {
    if (state) saveToBrowser(state)
  }, [state])

  if (!state) return <StartScreen autosave={autosave} onStart={setState} />
  return (
    <GameScreen
      state={state}
      onChange={setState}
      onQuit={() => {
        setAutosave(loadFromBrowser())
        setState(null)
      }}
    />
  )
}
