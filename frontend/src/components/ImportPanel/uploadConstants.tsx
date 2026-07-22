export const PLATFORM_ICONS = {
  youtube: { name: 'YouTube', color: '#FF0000', icon: 'youtube' },
  facebook: { name: 'Facebook', color: '#1877F2', icon: 'facebook' },
  instagram: { name: 'Instagram', color: '#E4405F', icon: 'instagram' },
  tiktok: { name: 'TikTok', color: '#000000', icon: 'tiktok' },
  twitter: { name: 'Twitter/X', color: '#1DA1F2', icon: 'twitter' },
  vimeo: { name: 'Vimeo', color: '#1AB7EA', icon: 'vimeo' },
  dailymotion: { name: 'Dailymotion', color: '#00AAFF', icon: 'dailymotion' },
  twitch: { name: 'Twitch', color: '#9146FF', icon: 'twitch' },
  soundcloud: { name: 'SoundCloud', color: '#FF5500', icon: 'soundcloud' },
  spotify: { name: 'Spotify', color: '#1DB954', icon: 'spotify' },
  generic: { name: 'Video', color: '#6B7280', icon: 'video' },
}

export function detectPlatform(url: string): keyof typeof PLATFORM_ICONS {
  const lowerUrl = url.toLowerCase()
  
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube'
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) return 'facebook'
  if (lowerUrl.includes('instagram.com')) return 'instagram'
  if (lowerUrl.includes('tiktok.com')) return 'tiktok'
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return 'twitter'
  if (lowerUrl.includes('vimeo.com')) return 'vimeo'
  if (lowerUrl.includes('dailymotion.com')) return 'dailymotion'
  if (lowerUrl.includes('twitch.tv')) return 'twitch'
  if (lowerUrl.includes('soundcloud.com')) return 'soundcloud'
  if (lowerUrl.includes('spotify.com')) return 'spotify'
  
  return 'generic'
}

export function isLikelyPublicFacebookVideo(url: string): boolean {
  const lowerUrl = url.toLowerCase()
  return lowerUrl.includes('facebook.com') && 
         (lowerUrl.includes('/videos/') || lowerUrl.includes('/watch/'))
}
