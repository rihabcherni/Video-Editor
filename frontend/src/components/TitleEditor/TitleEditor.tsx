import { useEffect, useState } from 'react'
import { Type, CheckCircle2 } from 'lucide-react'
import { useStore } from '../../store/useStore'

const fonts = [
  'Arial',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Impact'
]

export default function TitleEditor() {
  const {
    titleText, setTitleText,
    titleDraftText, setTitleDraftText,
    titleFont, setTitleFont,
    titleDraftFont, setTitleDraftFont,
    titleSize, setTitleSize,
    titleDraftSize, setTitleDraftSize,
    titleColor, setTitleColor,
    titleDraftColor, setTitleDraftColor,
    titleBgColor, setTitleBgColor,
    titleDraftBgColor, setTitleDraftBgColor,
    titleBorderColor, setTitleBorderColor,
    titleDraftBorderColor, setTitleDraftBorderColor,
    titleBorderWidth, setTitleBorderWidth,
    titleDraftBorderWidth, setTitleDraftBorderWidth,
    titleFrameColor, setTitleFrameColor,
    titleDraftFrameColor, setTitleDraftFrameColor,
    titleFrameWidth, setTitleFrameWidth,
    titleDraftFrameWidth, setTitleDraftFrameWidth,
    titlePadding, setTitlePadding,
    titleDraftPadding, setTitleDraftPadding,
    titleLineSpacing, setTitleLineSpacing,
    titleDraftLineSpacing, setTitleDraftLineSpacing,
    titleAlign, setTitleAlign,
    titleDraftAlign, setTitleDraftAlign,
    titleX, titleY, setTitleXY,
    titleDraftX, titleDraftY, setTitleDraftXY,
    isApplyingTitle, setIsApplyingTitle,
    previewLoading,
    setPendingPreviewAction,
  } = useStore()

  const [draftText, setDraftText] = useState(titleDraftText || titleText)
  const [draftFont, setDraftFont] = useState(titleDraftFont || titleFont)
  const [draftSize, setDraftSize] = useState(titleDraftSize)
  const [draftColor, setDraftColor] = useState(titleDraftColor || titleColor)
  const [draftBgColor, setDraftBgColor] = useState(titleDraftBgColor || titleBgColor)
  const [draftBorderColor, setDraftBorderColor] = useState(titleDraftBorderColor || titleBorderColor)
  const [draftBorderWidth, setDraftBorderWidth] = useState(titleDraftBorderWidth)
  const [draftFrameColor, setDraftFrameColor] = useState(titleDraftFrameColor || titleFrameColor)
  const [draftFrameWidth, setDraftFrameWidth] = useState(titleDraftFrameWidth)
  const [draftPadding, setDraftPadding] = useState(titleDraftPadding)
  const [draftLineSpacing, setDraftLineSpacing] = useState(titleDraftLineSpacing)
  const [draftAlign, setDraftAlign] = useState(titleDraftAlign || titleAlign)
  const [draftX, setDraftX] = useState(titleDraftX ?? titleX)
  const [draftY, setDraftY] = useState(titleDraftY ?? titleY)

  useEffect(() => {
    setDraftText(titleDraftText || titleText)
    setDraftFont(titleDraftFont || titleFont)
    setDraftSize(titleDraftSize)
    setDraftColor(titleDraftColor || titleColor)
    setDraftBgColor(titleDraftBgColor || titleBgColor)
    setDraftBorderColor(titleDraftBorderColor || titleBorderColor)
    setDraftBorderWidth(titleDraftBorderWidth)
    setDraftFrameColor(titleDraftFrameColor || titleFrameColor)
    setDraftFrameWidth(titleDraftFrameWidth)
    setDraftPadding(titleDraftPadding)
    setDraftLineSpacing(titleDraftLineSpacing)
    setDraftAlign(titleDraftAlign || titleAlign)
    setDraftX(titleDraftX ?? titleX)
    setDraftY(titleDraftY ?? titleY)
  }, [titleText, titleDraftText, titleFont, titleDraftFont, titleSize, titleDraftSize, titleColor, titleDraftColor, titleBgColor, titleDraftBgColor, titleBorderColor, titleDraftBorderColor, titleBorderWidth, titleDraftBorderWidth, titleFrameColor, titleDraftFrameColor, titleFrameWidth, titleDraftFrameWidth, titlePadding, titleDraftPadding, titleLineSpacing, titleDraftLineSpacing, titleAlign, titleDraftAlign, titleDraftX, titleDraftY, titleX, titleY])

  const hasChanges =
    draftText !== titleText ||
    draftFont !== titleFont ||
    draftSize !== titleSize ||
    draftColor !== titleColor ||
    draftBgColor !== titleBgColor ||
    draftBorderColor !== titleBorderColor ||
    draftBorderWidth !== titleBorderWidth ||
    draftFrameColor !== titleFrameColor ||
    draftFrameWidth !== titleFrameWidth ||
    draftPadding !== titlePadding ||
    draftLineSpacing !== titleLineSpacing ||
    draftAlign !== titleAlign ||
    draftX !== titleX ||
    draftY !== titleY

  const applyChanges = () => {
    if (isApplyingTitle || previewLoading) return
    setIsApplyingTitle(true)
    setPendingPreviewAction('Title applied successfully.')
    setTitleText(draftText)
    setTitleDraftText(draftText)
    setTitleFont(draftFont)
    setTitleDraftFont(draftFont)
    setTitleSize(draftSize)
    setTitleDraftSize(draftSize)
    setTitleColor(draftColor)
    setTitleDraftColor(draftColor)
    setTitleBgColor(draftBgColor)
    setTitleDraftBgColor(draftBgColor)
    setTitleBorderColor(draftBorderColor)
    setTitleDraftBorderColor(draftBorderColor)
    setTitleBorderWidth(draftBorderWidth)
    setTitleDraftBorderWidth(draftBorderWidth)
    setTitleFrameColor(draftFrameColor)
    setTitleDraftFrameColor(draftFrameColor)
    setTitleFrameWidth(draftFrameWidth)
    setTitleDraftFrameWidth(draftFrameWidth)
    setTitlePadding(draftPadding)
    setTitleDraftPadding(draftPadding)
    setTitleLineSpacing(draftLineSpacing)
    setTitleDraftLineSpacing(draftLineSpacing)
    setTitleAlign(draftAlign)
    setTitleDraftAlign(draftAlign)
    setTitleXY(draftX ?? null, draftY ?? null)
    setTitleDraftXY(draftX ?? null, draftY ?? null)
    window.setTimeout(() => setIsApplyingTitle(false), 0)
  }

  const resetDraft = () => {
    setDraftText(titleText)
    setDraftFont(titleFont)
    setDraftSize(titleSize)
    setDraftColor(titleColor)
    setDraftBgColor(titleBgColor)
    setDraftBorderColor(titleBorderColor)
    setDraftBorderWidth(titleBorderWidth)
    setDraftFrameColor(titleFrameColor)
    setDraftFrameWidth(titleFrameWidth)
    setDraftPadding(titlePadding)
    setDraftLineSpacing(titleLineSpacing)
    setDraftAlign(titleAlign)
    setDraftX(titleX)
    setDraftY(titleY)

    setTitleDraftText(titleText)
    setTitleDraftFont(titleFont)
    setTitleDraftSize(titleSize)
    setTitleDraftColor(titleColor)
    setTitleDraftBgColor(titleBgColor)
    setTitleDraftBorderColor(titleBorderColor)
    setTitleDraftBorderWidth(titleBorderWidth)
    setTitleDraftFrameColor(titleFrameColor)
    setTitleDraftFrameWidth(titleFrameWidth)
    setTitleDraftPadding(titlePadding)
    setTitleDraftLineSpacing(titleLineSpacing)
    setTitleDraftAlign(titleAlign)
    setTitleDraftXY(titleX, titleY)
  }

  return (
    <div className="space-y-2">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900">Title</h2>
        <p className="text-xs text-zinc-500 mb-1">Add a text title with font, size, color, and position</p>
      </div>
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-3 pt-2 pb-1 space-y-1">
        <label htmlFor="title-text" className="text-[12px] font-medium text-zinc-700 flex items-center gap-1.5">
          <Type size={14} /> Title text
        </label>
        <textarea
          id="title-text"
          value={draftText}
          onChange={e => {
            setDraftText(e.target.value)
            setTitleDraftText(e.target.value)
          }}
          placeholder="Write your title here"
          rows={3}
          className="w-full resize-none bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-cyan-400"
        />
      </div>
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 px-3 py-2 space-y-2">
        <div className="flex items-center gap-3">
          <label htmlFor="title-font" className="text-[11px] text-zinc-500 shrink-0">Font</label>
          <div className="flex-1 min-w-0">
            <select
              id="title-font"
              value={draftFont}
              onChange={e => {
                setDraftFont(e.target.value)
                setTitleDraftFont(e.target.value)
              }}
              className="w-full bg-white border border-zinc-200 rounded-lg px-2 py-1.5 text-xs text-zinc-700"
            >
              {fonts.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="w-24 self-center">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Size</span>
              <span className="font-mono">{draftSize}px</span>
            </div>
            <input
              type="range" min={12} max={120} step={1}
              value={draftSize}
              onChange={e => {
                const value = Number(e.target.value)
                setDraftSize(value)
                setTitleDraftSize(value)
              }}
              aria-label="Title font size"
              className="w-full -mt-1 accent-cyan-600 h-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-zinc-500 shrink-0">Alignment</label>
          <div className="flex flex-1 gap-1.5 p-1 bg-white border border-zinc-200 rounded-xl min-w-0">
            {(['left', 'center', 'right'] as const).map(align => (
              <button
                key={align}
                type="button"
                onClick={() => {
                  setDraftAlign(align)
                  setTitleDraftAlign(align)
                }}
                className={`flex-1 min-w-0 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${draftAlign === align
                  ? 'bg-zinc-900 text-white'
                  : 'bg-transparent text-zinc-500 hover:bg-zinc-50'
                  }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-zinc-500 shrink-0">Line spacing</label>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Between lines</span>
              <span className="font-mono">{draftLineSpacing}px</span>
            </div>
            <input
              type="range" min={0} max={40} step={1}
              value={draftLineSpacing}
              onChange={e => {
                const value = Number(e.target.value)
                setDraftLineSpacing(value)
                setTitleDraftLineSpacing(value)
              }}
              aria-label="Title line spacing"
              className="w-full -mt-1 accent-cyan-600 h-1"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <label className="text-[11px] text-zinc-500 w-8 shrink-0">Color</label>
            <input
              type="color"
              value={draftColor}
              onChange={e => {
                setDraftColor(e.target.value)
                setTitleDraftColor(e.target.value)
              }}
              aria-label="Title text color"
              className="w-6 h-6 shrink-0 p-0 border border-zinc-200 rounded bg-white"
            />
            <input
              value={draftColor}
              onChange={e => {
                setDraftColor(e.target.value)
                setTitleDraftColor(e.target.value)
              }}
              aria-label="Title text color value"
              className="min-w-0 flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-mono text-zinc-600"
            />
          </div>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <label className="text-[11px] text-zinc-500 w-16 shrink-0">Background</label>
            <input
              type="color"
              value={draftBgColor}
              onChange={e => {
                setDraftBgColor(e.target.value)
                setTitleDraftBgColor(e.target.value)
              }}
              aria-label="Title background color"
              className="w-6 h-6 shrink-0 p-0 border border-zinc-200 rounded bg-white"
            />
            <input
              value={draftBgColor}
              onChange={e => {
                setDraftBgColor(e.target.value)
                setTitleDraftBgColor(e.target.value)
              }}
              aria-label="Title background color value"
              className="min-w-0 flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-mono text-zinc-600"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="text-[11px] text-zinc-500 sm:w-16 sm:shrink-0">Text border</label>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <input
              type="color"
              value={draftBorderColor}
              onChange={e => {
                setDraftBorderColor(e.target.value)
                setTitleDraftBorderColor(e.target.value)
              }}
              aria-label="Title text border color"
              className="w-6 h-6 shrink-0 p-0 border border-zinc-200 rounded bg-white"
            />
            <input
              value={draftBorderColor}
              onChange={e => {
                setDraftBorderColor(e.target.value)
                setTitleDraftBorderColor(e.target.value)
              }}
              aria-label="Title text border color value"
              className="min-w-0 flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-mono text-zinc-600"
            />
            <div className="w-24 shrink-0 self-center">
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>Size</span>
                <span className="font-mono">{draftBorderWidth}px</span>
              </div>
              <input type="range" min={0} max={16} step={1} value={draftBorderWidth} onChange={e => {
                const value = Number(e.target.value)
                setDraftBorderWidth(value)
                setTitleDraftBorderWidth(value)
              }}
                aria-label="Title text border width" className="w-full -mt-1 accent-cyan-600 h-1"
              />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <label className="text-[11px] text-zinc-500 sm:w-16 sm:shrink-0">Background frame</label>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <input type="color" value={draftFrameColor} onChange={e => {
              setDraftFrameColor(e.target.value)
              setTitleDraftFrameColor(e.target.value)
            }}
              aria-label="Title background frame color" className="w-6 h-6 shrink-0 p-0 border border-zinc-200 rounded bg-white"
            />
            <input value={draftFrameColor} onChange={e => {
              setDraftFrameColor(e.target.value)
              setTitleDraftFrameColor(e.target.value)
            }}
              aria-label="Title background frame color value"
              className="min-w-0 flex-1 bg-white border border-zinc-200 rounded-lg px-2 py-1 text-xs font-mono text-zinc-600"
            />
            <div className="w-24 shrink-0 self-center">
              <div className="flex justify-between text-[11px] text-zinc-500">
                <span>Size</span>
                <span className="font-mono">{draftFrameWidth}px</span>
              </div>
              <input type="range" min={0} max={24} step={1} value={draftFrameWidth}
                onChange={e => {
                  const value = Number(e.target.value)
                  setDraftFrameWidth(value)
                  setTitleDraftFrameWidth(value)
                }} aria-label="Title background frame width"
                className="w-full -mt-1 accent-cyan-600 h-1"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] text-zinc-500 w-16">Padding</label>
          <div className="flex-1">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Inner</span>
              <span className="font-mono">{draftPadding}px</span>
            </div>
            <input type="range" min={0} max={24} step={1} value={draftPadding} onChange={e => {
              const value = Number(e.target.value)
              setDraftPadding(value)
              setTitleDraftPadding(value)
            }}
              aria-label="Title padding" className="w-full -mt-1 accent-cyan-600 h-1"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <div className="text-[11px] text-zinc-500">Position</div>
            <div className="flex-1 text-xs text-zinc-500">
              Move the text directly on the video (drag &amp; drop).
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={resetDraft}
          disabled={!hasChanges || isApplyingTitle || previewLoading}
          className="flex-1 py-2 bg-white hover:bg-zinc-100 disabled:bg-zinc-100 disabled:text-zinc-400 text-zinc-700 rounded-xl text-sm font-medium transition-colors border border-zinc-200"
        >
          Reset draft
        </button>
        <button type="button" onClick={applyChanges} disabled={!hasChanges || isApplyingTitle || previewLoading}
          className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 size={15} />
          {isApplyingTitle || previewLoading ? 'Applying...' : 'Apply title'}
        </button>
      </div>
    </div>
  )
}
