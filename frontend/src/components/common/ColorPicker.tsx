import React from 'react'
import { Check, Ban } from 'lucide-react'

export const PALETTE_COLORS = [
  { hex: 'transparent', name: 'Transparent', darkCheck: true, isTransparent: true },
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

interface ColorPickerProps {
  label?: string
  value: string
  onChange: (color: string) => void
  allowTransparent?: boolean
  disabled?: boolean
}

export default function ColorPicker({
  label,
  value,
  onChange,
  allowTransparent = true,
  disabled = false,
}: ColorPickerProps) {
  const colors = allowTransparent ? PALETTE_COLORS : PALETTE_COLORS.filter(c => !c.isTransparent)
  const isTransparentSelected = value === 'transparent' || value === 'rgba(0,0,0,0)'
  const colorName = isTransparentSelected
    ? 'Transparent'
    : colors.find(c => c.hex.toLowerCase() === value.toLowerCase())?.name || value

  return (
    <div className={`space-y-1.5 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {label && (
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{label}</span>
          <span className="font-mono text-[10px] uppercase font-semibold text-zinc-700">
            {colorName}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {colors.map(color => {
          const isSelected =
            (color.isTransparent && isTransparentSelected) ||
            (!color.isTransparent && value.toLowerCase() === color.hex.toLowerCase())

          return (
            <button
              key={color.hex}
              type="button"
              title={color.name}
              disabled={disabled}
              onClick={() => onChange(color.hex)}
              className={`relative w-7 h-7 rounded-full border transition-all flex items-center justify-center focus:outline-none shrink-0 ${
                color.isTransparent
                  ? 'border-zinc-300 bg-zinc-100 overflow-hidden'
                  : color.hex === '#ffffff'
                  ? 'border-zinc-300'
                  : 'border-transparent'
              } ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-cyan-600 scale-105 shadow-sm'
                  : 'hover:scale-105'
              }`}
              style={color.isTransparent ? undefined : { backgroundColor: color.hex }}
            >
              {color.isTransparent ? (
                <div className="w-full h-full relative flex items-center justify-center bg-[conic-gradient(#d4d4d8_90deg,#ffffff_90deg_180deg,#d4d4d8_180deg_270deg,#ffffff_270deg)] bg-[size:6px_6px]">
                  <Ban size={12} className="text-red-500 relative z-10" />
                </div>
              ) : isSelected ? (
                <Check
                  size={12}
                  className={color.darkCheck ? 'text-zinc-900' : 'text-white'}
                />
              ) : null}
            </button>
          )
        })}

        <div className="relative flex items-center shrink-0">
          <input
            type="color"
            value={value.startsWith('#') ? value : '#000000'}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            title="Custom color picker"
            className="w-7 h-7 p-0 border border-zinc-200 rounded-full cursor-pointer bg-white overflow-hidden shadow-xs hover:scale-105 transition-transform"
          />
        </div>
      </div>
    </div>
  )
}
