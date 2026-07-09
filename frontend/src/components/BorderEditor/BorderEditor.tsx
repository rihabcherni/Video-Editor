import { useEffect, useState } from 'react'
import { Square, CheckCircle2, Check } from 'lucide-react'
import { useStore } from '../../store/useStore'

const PRINCIPAL_COLORS = [
  { hex: '#ffffff', name: 'White', darkCheck: true },
  { hex: '#000000', name: 'Black', darkCheck: false },
  { hex: '#EF4444', name: 'Red', darkCheck: false },
  { hex: '#F97316', name: 'Orange', darkCheck: false },
  { hex: '#FBBF24', name: 'Yellow', darkCheck: true },
  { hex: '#10B981', name: 'Green', darkCheck: false },
  { hex: '#06B6D4', name: 'Cyan', darkCheck: false },
  { hex: '#3B82F6', name: 'Blue', darkCheck: false },
  { hex: '#6366F1', name: 'Indigo', darkCheck: false },
  { hex: '#8B5CF6', name: 'Purple', darkCheck: false },
  { hex: '#EC4899', name: 'Pink', darkCheck: false },
  { hex: '#6B7280', name: 'Gray', darkCheck: false },
]

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
    setPendingPreviewAction,
  } = useStore()

  const [draftEnabled, setDraftEnabled] = useState(borderEnabled)
  const [draftWidth, setDraftWidth] = useState(borderWidth)
  const [draftHeight, setDraftHeight] = useState(borderHeight)
  const [draftColor, setDraftColor] = useState(borderColor)

  useEffect(() => {
    setDraftEnabled(borderEnabled)
    setDraftWidth(borderWidth)
    setDraftHeight(borderHeight)
    setDraftColor(borderColor)

    setBorderDraftEnabled(borderEnabled)
    setBorderDraftWidth(borderWidth)
    setBorderDraftHeight(borderHeight)
    setBorderDraftColor(borderColor)
  }, [borderEnabled, borderWidth, borderHeight, borderColor, setBorderDraftEnabled, setBorderDraftWidth, setBorderDraftHeight, setBorderDraftColor])

  const hasChanges =
    draftEnabled !== borderEnabled ||
    draftWidth !== borderWidth ||
    draftHeight !== borderHeight ||
    draftColor !== borderColor

  const applyChanges = () => {
    setPendingPreviewAction('Border applied successfully.')
    setBorderEnabled(draftEnabled)
    setBorderWidth(draftWidth)
    setBorderHeight(draftHeight)
    setBorderColor(draftColor)
  }

  const resetDraft = () => {
    setDraftEnabled(borderEnabled)
    setDraftWidth(borderWidth)
    setDraftHeight(borderHeight)
    setDraftColor(borderColor)

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
            checked={draftEnabled}
            onChange={e => {
              setDraftEnabled(e.target.checked)
              setBorderDraftEnabled(e.target.checked)
            }}
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
            onChange={e => {
              const val = Number(e.target.value)
              setDraftWidth(val)
              setBorderDraftWidth(val)
            }}
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
            onChange={e => {
              const val = Number(e.target.value)
              setDraftHeight(val)
              setBorderDraftHeight(val)
            }}
            disabled={!draftEnabled}
            className="w-full accent-cyan-600 h-1 disabled:opacity-50"
          />
        </div>

        <div className={`space-y-2 ${!draftEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex justify-between items-center text-xs text-zinc-500 mb-1">
            <span>Border color</span>
            <span className="font-mono text-[10px] uppercase">
              {PRINCIPAL_COLORS.find(c => c.hex.toLowerCase() === draftColor.toLowerCase())?.name || draftColor}
            </span>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {PRINCIPAL_COLORS.map(color => {
              const isSelected = draftColor.toLowerCase() === color.hex.toLowerCase()
              return (
                <button
                  key={color.hex}
                  type="button"
                  title={color.name}
                  onClick={() => {
                    if (draftEnabled) {
                      setDraftColor(color.hex)
                      setBorderDraftColor(color.hex)
                    }
                  }}
                  disabled={!draftEnabled}
                  className={`relative w-8 h-8 rounded-full border transition-all flex items-center justify-center focus:outline-none ${
                    color.hex === '#ffffff' ? 'border-zinc-300' : 'border-transparent'
                  } ${
                    isSelected
                      ? 'ring-2 ring-offset-2 ring-cyan-600 scale-105'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {isSelected && (
                    <Check
                      size={14}
                      className={color.darkCheck ? 'text-zinc-900' : 'text-white'}
                    />
                  )}
                </button>
              )
            })}
          </div>
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
          className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 size={15} />
          Apply border
        </button>
      </div>
    </div>
  )
}
