import { useState } from 'react'
import {
  Square, Youtube, Instagram, Facebook, Linkedin, Twitter, Music2, Image as ImageIcon, CheckCircle2, Monitor
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export default function AspectRatioPanel() {
  const { exportAspectRatio, setExportAspectRatio, pushActionToast } = useStore()
  const [justApplied, setJustApplied] = useState(false)

  const ratios = [
    {
      id: 'original',
      ratioLabel: 'Original',
      label: 'Original',
      description: 'Keep source dimensions',
      icons: [{ node: <Monitor size={12} className="text-white" />, className: 'bg-zinc-700' }],
    },
    {
      id: '16:9',
      ratioLabel: '16:9',
      label: 'Standard Widescreen',
      description: 'YouTube, Landscape videos',
      icons: [
        { node: <Youtube size={12} className="text-white" />, className: 'bg-[#FF0000]' },
        { node: <Linkedin size={12} className="text-white" />, className: 'bg-[#0A66C2]' },
        { node: <Twitter size={12} className="text-white" />, className: 'bg-zinc-900' },
      ],
    },
    {
      id: '9:16',
      ratioLabel: '9:16',
      label: 'Reels / Shorts / TikTok',
      description: 'Vertical smartphone format',
      icons: [
        { node: <Music2 size={12} className="text-white" />, className: 'bg-black' },
        { node: <Instagram size={12} className="text-white" />, className: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400' },
        { node: <Facebook size={12} className="text-white" />, className: 'bg-[#1877F2]' },
        { node: <Youtube size={12} className="text-white" />, className: 'bg-[#FF0000]' },
      ],
    },
    {
      id: '4:5',
      ratioLabel: '4:5',
      label: 'Instagram Feed (Portrait)',
      description: 'Optimized for mobile feed',
      icons: [
        { node: <Instagram size={12} className="text-white" />, className: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400' },
        { node: <Facebook size={12} className="text-white" />, className: 'bg-[#1877F2]' },
      ],
    },
    {
      id: '1:1',
      ratioLabel: '1:1',
      label: 'Square Feed',
      description: 'Classic post format',
      icons: [
        { node: <Facebook size={12} className="text-white" />, className: 'bg-[#1877F2]' },
        { node: <Instagram size={12} className="text-white" />, className: 'bg-gradient-to-br from-fuchsia-500 via-rose-500 to-amber-400' },
      ],
    },
    {
      id: '5:4',
      ratioLabel: '5:4',
      label: 'Classic (Desktop)',
      description: 'Landscape desktop format',
      icons: [
        { node: <Square size={12} className="text-white" />, className: 'bg-zinc-600' },
      ],
    },
    {
      id: '4:3',
      ratioLabel: '4:3',
      label: 'Classic TV / Monitor',
      description: 'Retro 4:3 frame ratio',
      icons: [
        { node: <Square size={12} className="text-white" />, className: 'bg-zinc-700' },
      ],
    },
    {
      id: '3:2',
      ratioLabel: '3:2',
      label: 'DSLR Photo',
      description: 'Camera photo ratio',
      icons: [
        { node: <ImageIcon size={12} className="text-white" />, className: 'bg-zinc-700' },
      ],
    },
  ] as const

  const handleSelectRatio = (ratioId: typeof exportAspectRatio) => {
    setExportAspectRatio(ratioId)
    pushActionToast(`Aspect ratio set to ${ratioId}.`)
    setJustApplied(true)
    setTimeout(() => setJustApplied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 mb-1">Aspect Ratio</h2>
        <p className="text-xs text-zinc-500">
          Choose the final target format & video size.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3">
        {ratios.map(r => {
          const isSelected = exportAspectRatio === r.id
          return (
            <button
              type="button"
              key={r.id}
              onClick={() => handleSelectRatio(r.id as typeof exportAspectRatio)}
              className={`p-5 rounded-2xl text-left transition-all border flex items-center justify-between gap-5 ${
                isSelected
                  ? 'bg-green-500 text-white border-green-700 shadow-[0_8px_20px_rgba(8,145,178,0.25)]'
                  : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold border transition-colors ${
                    r.id === '16:9'
                      ? 'w-12 h-7'
                      : r.id === '9:16'
                      ? 'w-7 h-12'
                      : r.id === '4:5'
                      ? 'w-8 h-10'
                      : r.id === '1:1'
                      ? 'w-9 h-9'
                      : 'w-10 h-8'
                  } ${
                    isSelected
                      ? 'border-white/30 bg-white/20 text-white'
                      : 'border-zinc-200 bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {r.ratioLabel}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                    {r.label}
                  </div>
                  <div className={`text-xs truncate ${isSelected ? 'text-green-100' : 'text-zinc-400'}`}>
                    {r.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex -space-x-1">
                  {r.icons.map((icon, idx) => (
                    <span
                      key={idx}
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full ring-2 ${
                        isSelected ? 'ring-cyan-600' : 'ring-white'
                      } ${icon.className}`}
                    >
                      {icon.node}
                    </span>
                  ))}
                </div>
                {isSelected && (
                  <CheckCircle2 size={18} className="text-white ml-1 shrink-0" />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {justApplied && (
        <div className="p-2.5 bg-green-500/10 border border-green-500/30 rounded-xl text-green-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={15} />
          Aspect ratio updated live across all player views!
        </div>
      )}
    </div>
  )
}
