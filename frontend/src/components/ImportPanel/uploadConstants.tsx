import React from 'react'
import { SocialIcon } from 'react-social-icons'

export const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    tiktok: <SocialIcon network="tiktok" style={{ height: 18, width: 18 }} />,
    facebook: <SocialIcon network="facebook" style={{ height: 18, width: 18 }} />,
    instagram: <SocialIcon network="instagram" style={{ height: 18, width: 18 }} />,
    youtube: <SocialIcon network="youtube" style={{ height: 18, width: 18 }} />,
}

export function detectPlatform(url: string) {
    if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube'
    if (url.includes('instagram')) return 'instagram'
    if (url.includes('facebook') || url.includes('fb.com')) return 'facebook'
    if (url.includes('tiktok')) return 'tiktok'
    return null
}

export function isLikelyPublicFacebookVideo(rawUrl: string) {
    try {
        const u = new URL(rawUrl)
        const host = u.hostname.replace(/^www\./, '')
        if (host === 'fb.watch') return true
        const path = u.pathname
        if (/\/reel\/\d+/.test(path)) return true
        if (/\/videos\/\d+/.test(path)) return true
        if (path === '/watch/' && u.searchParams.get('v')) return true
        return false
    } catch {
        return false
    }
}
