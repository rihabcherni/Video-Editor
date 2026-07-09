#!/usr/bin/env node
const fs = require('fs')

const file = process.argv[2]
if (!file) {
  console.error('Usage: node validate_cookies.js /path/to/ytdlp_cookies.txt')
  process.exit(1)
}

try {
  const text = fs.readFileSync(file, 'utf8')
  const firstLine = text.split(/\r?\n/, 1)[0]?.trim() || ''
  const okHeader = firstLine === '# Netscape HTTP Cookie File' || firstLine === '# HTTP Cookie File'
  if (!okHeader) {
    console.error('Invalid cookies file format. First line must be "# Netscape HTTP Cookie File".')
    process.exit(2)
  }
  if (text.includes('\r') && !text.includes('\r\n')) {
    console.error('Invalid cookies file newlines. Please use CRLF or LF.')
    process.exit(3)
  }
  console.log('Cookies file looks valid.')
} catch (e) {
  console.error(`Cannot read cookies file: ${e.message}`)
  process.exit(4)
}
