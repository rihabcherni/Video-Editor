import { useEffect, useState } from 'react'
import { Square, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import ColorPicker from '../common/ColorPicker'

export default function BorderEditor() {
  const {
    borderEnabled, setBorderEnabled,
    borderWidth, setBorderWidth,
    borderHeight, setBorderHeight,
    borderColor, setBorderColor,
    borderDraftEnabled, setBorderDraftEnabled,
    borderDraftWidth, setBorderDraftWidth,
    borderDraftHeight, setBorderDraftHeight,
    borderDraftColor, setBorderDraftColor,
    pushActionToast,
  } = useStore()

  const [justApplied, setJustApplied] = useState(false)

  // Sync draft store from applied state when applied state changes (e.g. on reset)
  useEffect(() => {
    setBorderDraftEnabled(borderEnabled)
    setBorderDraftWidth(borderWidth)
    setBorderDraftHeight(borderHeight)
    setBorderDraftColor(borderColor)
  }, [borderEnabled, borderWidth, borderHeight, borderColor, setBorderDraftEnabled, setBorderDraftWidth, setBorderDraftHeight, setBorderDraftColor])

  const hasChanges =
    borderDraftEnabled !== borderEnabled ||
    borderDraftWidth !== borderWidth ||
    borderDraftHeight !== borderHeight ||
    borderDraftColor !== borderColor

  // Reset justApplied as soon as user makes a new change
  useEffect(() => {
    if (hasChanges) setJustApplied(false)
  }, [hasChanges])

  const applyChanges = () => {
    pushActionToast('Border applied successfully.')
    setBorderEnabled(borderDraftEnabled)
    setBorderWidth(borderDraftWidth)
    setBorderHeight(borderDraftHeight)
    setBorderColor(borderDraftColor)
    setJustApplied(true)
  }

  const resetDraft = () => {
    setBorderDraftEnabled(borderEnabled)
    setBorderDraftWidth(borderWidth)
    setBorderDraftHeight(borderHeight)
    setBorderDraftColor(borderColor)
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
            checked={borderDraftEnabled}
            onChange={e => {
              setBorderDraftEnabled(e.target.checked)
            }}
            className="accent-cyan-600"
          />
          <Square size={16} />
          <span>Enable border</span>
        </label>

        {/* Border position selection removed as requested */}

        <div className={`space-y-2 ${!borderDraftEnabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Border width</span>
            <span className="font-mono">{borderDraftWidth}px</span>
          </div>
          <input
            aria-label="Border width"
            type="range"
            min={0}
            max={300}
            step={1}
            value={borderDraftWidth}
            onChange={e => {
              const val = Number(e.target.value)
              setBorderDraftWidth(val)
            }}
            disabled={!borderDraftEnabled}
            className="w-full accent-cyan-600 h-1 disabled:opacity-50"
          />
        </div>

        <div className={`space-y-2 ${!borderDraftEnabled ? 'opacity-50' : ''}`}>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Border height</span>
            <span className="font-mono">{borderDraftHeight}px</span>
          </div>
          <input
            aria-label="Border height"
            type="range"
            min={0}
            max={300}
            step={1}
            value={borderDraftHeight}
            onChange={e => {
              const val = Number(e.target.value)
              setBorderDraftHeight(val)
            }}
            disabled={!borderDraftEnabled}
            className="w-full accent-cyan-600 h-1 disabled:opacity-50"
          />
        </div>

        <div className={`${!borderDraftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <ColorPicker
            label="Border color"
            value={borderDraftColor}
            onChange={setBorderDraftColor}
            allowTransparent={false}
            disabled={!borderDraftEnabled}
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetDraft}
          disabled={!hasChanges}
          className="flex-1 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-100 disabled:text-zinc-400 text-zinc-700 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
        >
          Reset draft
        </button>
        <button
          type="button"
          onClick={applyChanges}
          disabled={!hasChanges}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center gap-1.5 ${
            justApplied
              ? 'bg-green-500 text-white cursor-default'
              : hasChanges
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
          }`}
        >
          <CheckCircle2 size={15} />
          {justApplied ? '✓ Applied' : 'Apply border'}
        </button>
      </div>
    </div>
  )
}
