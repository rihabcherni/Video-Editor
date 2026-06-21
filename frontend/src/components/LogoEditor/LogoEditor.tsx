import { useEffect, useRef, useState } from 'react'
import { Image as ImageIcon, X, CheckCircle2 } from 'lucide-react'
import { uploadImage } from '../../api/client'
import { useStore } from '../../store/useStore'

export default function LogoEditor() {
  const {
    logoImage, setLogoImage,
    logoSize, setLogoSize,
    logoDraftImage, setLogoDraftImage,
    logoDraftSize, setLogoDraftSize,
    logoDraftX, logoDraftY, setLogoDraftXY,
    logoX, logoY, setLogoXY,
    isApplyingLogo, setIsApplyingLogo,
    previewLoading,
    setPendingPreviewAction,
  } = useStore()

  const [logoUploading, setLogoUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const logoFileRef = useRef<HTMLInputElement>(null)
  const logoFileInputId = 'logo-file-input'
  const logoSizeInputId = 'logo-size-input'

  const hasLogo = !!logoDraftImage
  const hasChanges =
    (logoDraftImage?.id || null) !== (logoImage?.id || null) ||
    logoDraftSize !== logoSize ||
    logoDraftX !== logoX ||
    logoDraftY !== logoY

  useEffect(() => {
    setLogoDraftImage(logoImage)
    setLogoDraftSize(logoSize)
    setLogoDraftXY(logoX, logoY)
  }, [logoImage, logoSize, logoX, logoY, setLogoDraftImage, setLogoDraftSize, setLogoDraftXY])

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG/JPG/SVG).')
      return
    }
    setLogoUploading(true)
    setError(null)
    try {
      const res = await uploadImage(file)
      setLogoDraftImage(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Logo upload failed')
    } finally {
      setLogoUploading(false)
    }
  }

  const applyLogo = () => {
    if (isApplyingLogo || previewLoading) return
    setIsApplyingLogo(true)
    setPendingPreviewAction('Logo applied successfully.')
    setLogoImage(logoDraftImage)
    setLogoSize(logoDraftSize)
    setLogoXY(logoDraftX ?? null, logoDraftY ?? null)
    window.setTimeout(() => setIsApplyingLogo(false), 0)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Logo</h2>
        <p className="text-xs text-zinc-500">Upload a logo/watermark and choose its size and position</p>
      </div>

      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3">
        <label htmlFor={logoFileInputId} className="text-sm font-medium text-zinc-700 flex items-center gap-2">
          <ImageIcon size={16} /> Logo file
        </label>
        <div className="flex items-center gap-3">
          <input
            ref={logoFileRef}
            id={logoFileInputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          />
          <button type="button"
            onClick={() => logoFileRef.current?.click()}
            disabled={logoUploading}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 disabled:bg-zinc-200 disabled:text-zinc-400 transition-colors"
          >
            {logoUploading ? 'Uploading...' : (hasLogo ? 'Replace logo' : 'Upload logo')}
          </button>
          {hasLogo && (
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <img src={logoDraftImage!.url} alt="" className="w-10 h-10 rounded-md object-contain bg-white border border-zinc-200" />
              <span className="truncate max-w-[160px]">{logoDraftImage!.filename}</span>
              <button type="button"
                onClick={() => {
                  setLogoImage(null)
                  setLogoDraftImage(null)
                  setLogoXY(null, null)
                  setLogoDraftXY(null, null)
                }}
                className="text-zinc-400 hover:text-zinc-600"
                aria-label="Remove logo"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <label htmlFor={logoSizeInputId}>Size ({logoDraftSize}% of video width)</label>
            <span className="font-mono">{logoDraftSize}%</span>
          </div>
          <input
            id={logoSizeInputId}
            type="range"
            min={5}
            max={60}
            step={1}
            value={logoDraftSize}
            onChange={e => setLogoDraftSize(Number(e.target.value))}
            disabled={!hasLogo}
            className="w-full accent-cyan-600 h-1 disabled:opacity-50"
          />
        </div>

        <div className="space-y-2">
          <div className="text-xs text-zinc-500">Position</div>
          <div className="text-xs text-zinc-500">
            Move the logo directly on the video (drag &amp; drop). The position will be applied after "Apply logo".
          </div>
        </div>
      </div>

      <button type="button"
        onClick={applyLogo}
        disabled={!hasLogo || !hasChanges || logoUploading || isApplyingLogo || previewLoading}
        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <CheckCircle2 size={16} />
        {previewLoading || isApplyingLogo ? 'Applying...' : 'Apply logo'}
      </button>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
