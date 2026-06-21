import { Crop as CropIcon, RotateCcw, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/useStore'

const MAX_SINGLE_SIDE = 45

function clampPercent(value: number, opposite: number) {
  const maxAllowed = Math.max(0, Math.min(MAX_SINGLE_SIDE, 99 - opposite))
  return Math.min(maxAllowed, Math.max(0, value))
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export default function CropEditor() {
  const { cropEnabled, cropDraftEnabled, setCropDraftEnabled, crop, cropDraft, setCropDraftTop, setCropDraftBottom, setCropDraftLeft, setCropDraftRight, resetCrop, applyCropDraft, previewLoading, processedUrl, setProcessedUrl, setPendingPreviewAction } = useStore()
  const cropTopPct = Math.round(cropDraft.top * 100)
  const cropBottomPct = Math.round(cropDraft.bottom * 100)
  const cropLeftPct = Math.round(cropDraft.left * 100)
  const cropRightPct = Math.round(cropDraft.right * 100)
  const hasDraftCrop = cropDraft.top > 0 || cropDraft.bottom > 0 || cropDraft.left > 0 || cropDraft.right > 0
  const hasChanges = cropDraftEnabled !== cropEnabled ||
    cropDraft.top !== crop.top ||
    cropDraft.bottom !== crop.bottom ||
    cropDraft.left !== crop.left ||
    cropDraft.right !== crop.right
  const canApply = cropDraftEnabled && hasDraftCrop && hasChanges

  const updateDraft = (updater: () => void) => {
    updater()
  }

  const handleApplyCrop = () => {
    if (previewLoading || !canApply) return
    setPendingPreviewAction('Crop applied successfully.')
    applyCropDraft()
  }

  const handleResetCrop = () => {
    if (previewLoading) return
    resetCrop()
    if (processedUrl) setProcessedUrl(null)
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Rogner</h2>
        <p className="text-xs text-zinc-500">
          Trim the visible frame from the top, bottom, left, or right without changing video duration.
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-[linear-gradient(180deg,#f3fff8_0%,#fbfffd_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <CropIcon size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-900">Spatial crop</div>
              <div className="text-xs text-zinc-500">Enable crop, adjust the frame, then click Rogner to apply it.</div>
            </div>
          </div>
          <button type="button"
            onClick={handleResetCrop}
            disabled={previewLoading || (!cropDraftEnabled && !hasDraftCrop)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw size={13} />
            Reset
          </button>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm font-medium text-zinc-700">
          <input
            id="crop-enabled"
            type="checkbox"
            checked={cropDraftEnabled}
            onChange={e => updateDraft(() => setCropDraftEnabled(e.target.checked))}
            disabled={previewLoading}
            className="accent-emerald-600"
          />
          <span>Enable crop</span>
        </label>

        <div className={`mt-4 grid grid-cols-2 gap-3 ${!cropDraftEnabled ? 'opacity-50' : ''}`}>
          <CropControl
            label="Top"
            value={cropTopPct}
            disabled={previewLoading || !cropDraftEnabled}
            onChange={(value) => updateDraft(() => setCropDraftTop(clampPercent(value, cropBottomPct) / 100))}
          />
          <CropControl
            label="Bottom"
            value={cropBottomPct}
            disabled={previewLoading || !cropDraftEnabled}
            onChange={(value) => updateDraft(() => setCropDraftBottom(clampPercent(value, cropTopPct) / 100))}
          />
          <CropControl
            label="Left"
            value={cropLeftPct}
            disabled={previewLoading || !cropDraftEnabled}
            onChange={(value) => updateDraft(() => setCropDraftLeft(clampPercent(value, cropRightPct) / 100))}
          />
          <CropControl
            label="Right"
            value={cropRightPct}
            disabled={previewLoading || !cropDraftEnabled}
            onChange={(value) => updateDraft(() => setCropDraftRight(clampPercent(value, cropLeftPct) / 100))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Vertical keep" value={formatPercent(1 - cropDraft.top - cropDraft.bottom)} />
        <MetricCard label="Horizontal keep" value={formatPercent(1 - cropDraft.left - cropDraft.right)} />
      </div>

      <button type="button"
        onClick={handleApplyCrop}
        disabled={!canApply || previewLoading}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <CheckCircle2 size={16} />
        {previewLoading ? 'Applying...' : 'Rogner'}
      </button>
    </div>
  )
}

function CropControl(props: {
  label: string
  value: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const { label, value, disabled = false, onChange } = props

  return (
    <label className="rounded-xl border border-white/80 bg-white/90 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        <span className="font-mono text-xs text-emerald-700">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={MAX_SINGLE_SIDE}
        step={1}
        value={value}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value))}
        className="h-2 w-full accent-emerald-600 disabled:opacity-50"
      />
    </label>
  )
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3">
      <div className="text-[11px] font-bold text-zinc-500">{props.label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-900">{props.value}</div>
    </div>
  )
}
