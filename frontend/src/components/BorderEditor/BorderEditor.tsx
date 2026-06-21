import { useEffect, useState } from 'react'
import { Square, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/useStore'

export default function BorderEditor() {
  const {
    borderEnabled, setBorderEnabled,
    borderWidth, setBorderWidth,
    borderHeight, setBorderHeight,
    borderColor, setBorderColor,
    borderMode, setBorderMode,
    setPendingPreviewAction,
  } = useStore()

  const [draftEnabled, setDraftEnabled] = useState(borderEnabled)
  const [draftWidth, setDraftWidth] = useState(borderWidth)
  const [draftHeight, setDraftHeight] = useState(borderHeight)
  const [draftColor, setDraftColor] = useState(borderColor)
  const [draftMode, setDraftMode] = useState(borderMode)

  useEffect(() => {
    setDraftEnabled(borderEnabled)
    setDraftWidth(borderWidth)
    setDraftHeight(borderHeight)
    setDraftColor(borderColor)
    setDraftMode(borderMode)
  }, [borderEnabled, borderWidth, borderHeight, borderColor, borderMode])

  const hasChanges =
    draftEnabled !== borderEnabled ||
    draftWidth !== borderWidth ||
    draftHeight !== borderHeight ||
    draftColor !== borderColor ||
    draftMode !== borderMode

  const applyChanges = () => {
    setPendingPreviewAction('Border applied successfully.')
    setBorderEnabled(draftEnabled)
    setBorderWidth(draftWidth)
    setBorderHeight(draftHeight)
    setBorderColor(draftColor)
    setBorderMode(draftMode)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Border</h2>
        <p className="text-xs text-zinc-500">Add a colored border around the video</p>
      </div>

      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3">
        <label htmlFor="border-enabled" className="flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            id="border-enabled"
            type="checkbox"
            checked={draftEnabled}
            onChange={e => setDraftEnabled(e.target.checked)}
            className="accent-cyan-600"
          />
          <Square size={16} />
          <span>Enable border</span>
        </label>

        {/* Border position selection removed as requested */}

        <div className={`space-y-2 ${!draftEnabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Border width</span>
            <span className="font-mono">{draftWidth}px</span>
          </div>
          <input
            aria-label="Border width"
            type="range"
            min={0}
            max={300}
            step={1}
            value={draftWidth}
            onChange={e => setDraftWidth(Number(e.target.value))}
            disabled={!draftEnabled}
            className="w-full accent-cyan-600 h-1 disabled:opacity-50"
          />
        </div>

        <div className={`space-y-2 ${!draftEnabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Border height</span>
            <span className="font-mono">{draftHeight}px</span>
          </div>
          <input
            aria-label="Border height"
            type="range"
            min={0}
            max={300}
            step={1}
            value={draftHeight}
            onChange={e => setDraftHeight(Number(e.target.value))}
            disabled={!draftEnabled}
            className="w-full accent-cyan-600 h-1 disabled:opacity-50"
          />
        </div>

        <div className={`space-y-2 ${!draftEnabled ? 'opacity-50' : ''}`}>
          <label htmlFor="border-color" className="text-xs text-zinc-500">Border color</label>
          <div className="flex items-center gap-2">
            <input
              id="border-color"
              aria-label="Border color"
              type="color"
              value={draftColor}
              onChange={e => setDraftColor(e.target.value)}
              disabled={!draftEnabled}
              className="w-10 h-9 p-0 border border-zinc-200 rounded-lg bg-white"
            />
            <input
              aria-label="Border color value"
              value={draftColor}
              onChange={e => setDraftColor(e.target.value)}
              disabled={!draftEnabled}
              className="flex-1 bg-white border border-zinc-200 rounded-lg px-3 py-2 text-xs font-mono text-zinc-600"
            />
          </div>
        </div>
      </div>

      <button type="button"
        onClick={applyChanges}
        disabled={!hasChanges}
        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <CheckCircle2 size={16} />
        Apply border
      </button>
    </div>
  )
}
