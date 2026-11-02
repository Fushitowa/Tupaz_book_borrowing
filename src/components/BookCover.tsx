import { useEffect, useRef, useState } from 'react'
import type { Book } from '../types/library'

const palettes = [
  { base: '#183b68', light: '#4e78a8', accent: '#e2c08a', ink: '#f8f4e9' },
  { base: '#315b50', light: '#718b70', accent: '#e8d5a6', ink: '#f8f5e9' },
  { base: '#8a493c', light: '#bd8060', accent: '#e6c88e', ink: '#fff4df' },
  { base: '#4c496e', light: '#8581a2', accent: '#d9c7a0', ink: '#f7f3ee' },
  { base: '#43596b', light: '#8297a2', accent: '#d9ad82', ink: '#f6f3e9' },
]

type SearchBook = { title?: string; author_name?: string[]; cover_i?: number }
const coverLookups = new Map<string, Promise<string | null>>()

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function scoreMatch(book: Book, result: SearchBook) {
  if (!result.title || !result.cover_i) return 0
  const wantedTitle = normalize(book.title)
  const resultTitle = normalize(result.title)
  const wantedWords = wantedTitle.split(/\s+/).filter((word) => word.length > 1)
  const overlap = wantedWords.filter((word) => resultTitle.includes(word)).length
  const titleScore = resultTitle === wantedTitle
    ? 5
    : resultTitle.includes(wantedTitle) || wantedTitle.includes(resultTitle)
      ? 4
      : wantedWords.length > 0 && overlap / wantedWords.length >= 0.6
        ? 2
        : 0
  if (!titleScore) return 0

  const wantedAuthor = normalize(book.author)
  const resultAuthors = normalize((result.author_name || []).join(' '))
  const authorScore = wantedAuthor && resultAuthors.includes(wantedAuthor) ? 2 : 0
  return titleScore + authorScore
}

function lookupCover(book: Book) {
  const key = `${normalize(book.title)}|${normalize(book.author)}|${book.isbn || ''}`
  const cached = coverLookups.get(key)
  if (cached) return cached

  const request = (async () => {
    try {
      if (book.isbn) {
        const isbn = new URLSearchParams({
          isbn: book.isbn.replace(/[^0-9Xx]/g, ''),
          fields: 'title,author_name,cover_i',
          limit: '5',
        })
        const isbnResponse = await fetch(`https://openlibrary.org/search.json?${isbn}`)
        if (isbnResponse.ok) {
          const isbnData = await isbnResponse.json() as { docs?: SearchBook[] }
          const isbnMatch = (isbnData.docs || []).find((result) => result.cover_i)
          if (isbnMatch?.cover_i) return `https://covers.openlibrary.org/b/id/${isbnMatch.cover_i}-L.jpg?default=false`
        }
      }

      const parameters = new URLSearchParams({
        title: book.title,
        author: book.author,
        fields: 'title,author_name,cover_i',
        limit: '10',
      })
      const response = await fetch(`https://openlibrary.org/search.json?${parameters}`)
      if (!response.ok) return null
      const data = await response.json() as { docs?: SearchBook[] }
      const best = (data.docs || [])
        .map((result) => ({ result, score: scoreMatch(book, result) }))
        .filter((candidate) => candidate.score >= 2)
        .sort((left, right) => right.score - left.score)[0]
      return best ? `https://covers.openlibrary.org/b/id/${best.result.cover_i}-L.jpg?default=false` : null
    } catch {
      return null
    }
  })()

  coverLookups.set(key, request)
  return request
}

function escapeXml(value: string) {
  const entities: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;',
  }
  return value.replace(/[<>&"']/g, (character) => entities[character] || character)
}

function wrapTitle(title: string) {
  const words = title.trim().split(/\s+/)
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    if (line && `${line} ${word}`.length > 17 && lines.length < 2) {
      lines.push(line)
      line = word
    } else {
      line = line ? `${line} ${word}` : word
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 3)
}

function makeFallbackCover(book: Book) {
  const seed = `${book.title}${book.author}`.split('').reduce((total, character) => total + character.charCodeAt(0), 0)
  const colors = palettes[seed % palettes.length]
  const title = wrapTitle(book.title)
  const titleText = title.map((line, index) =>
    `<text x="54" y="${212 + index * 43}" class="title">${escapeXml(line)}</text>`,
  ).join('')
  const category = escapeXml((book.categories?.name || 'A NIZEL LIBRARY EDITION').toUpperCase())
  const author = escapeXml(book.author)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
    <defs><linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${colors.light}"/><stop offset="1" stop-color="${colors.base}"/></linearGradient><pattern id="grain" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M0 23.5H24" stroke="#fff" stroke-opacity=".035"/></pattern></defs>
    <rect width="360" height="480" fill="url(#paper)"/><rect width="360" height="480" fill="url(#grain)"/>
    <path d="M0 0h23v480H0z" fill="#091c30" fill-opacity=".17"/><path d="M31 0v480" stroke="#fff" stroke-opacity=".16"/>
    <circle cx="278" cy="128" r="88" fill="none" stroke="${colors.accent}" stroke-opacity=".58" stroke-width="1.4"/><circle cx="278" cy="128" r="65" fill="none" stroke="${colors.accent}" stroke-opacity=".38"/><path d="M208 198 342 64M206 60l140 136" stroke="${colors.accent}" stroke-opacity=".22"/>
    <rect x="40" y="39" width="280" height="402" rx="2" fill="none" stroke="${colors.ink}" stroke-opacity=".34"/>
    <text x="54" y="80" class="label">${category}</text><path d="M54 104h66" stroke="${colors.accent}" stroke-width="2"/>
    ${titleText}
    <text x="54" y="368" class="author">${author}</text><path d="M54 390h250" stroke="${colors.ink}" stroke-opacity=".32"/>
    <text x="54" y="417" class="imprint">NIZEL LIBRARY</text><text x="305" y="417" class="imprint" text-anchor="end">EST. 2024</text>
    <style>.label,.imprint{font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:2px;fill:${colors.ink}}.title{font-family:Georgia,serif;font-size:34px;font-weight:700;fill:${colors.ink}}.author{font-family:Arial,sans-serif;font-size:14px;letter-spacing:.6px;fill:${colors.ink};fill-opacity:.88}</style>
  </svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export default function BookCover({ book, variant = 0 }: { book: Book; variant?: number }) {
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)
  const [lookupUrl, setLookupUrl] = useState<string | null>(null)
  const coverElement = useRef<HTMLDivElement>(null)
  const fallback = makeFallbackCover(book)
  const preferredUrl = book.cover_url || lookupUrl
  const imageUrl = preferredUrl && brokenUrl !== preferredUrl ? preferredUrl : fallback

  useEffect(() => {
    const element = coverElement.current
    if (book.cover_url || lookupUrl || !element) return

    let active = true
    const findCover = () => {
      void lookupCover(book).then((url) => {
        if (active && url) setLookupUrl(url)
      })
    }

    if (typeof IntersectionObserver === 'undefined') {
      findCover()
      return () => { active = false }
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect()
        findCover()
      }
    }, { rootMargin: '180px' })
    observer.observe(element)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [book, lookupUrl])

  function useFallback() {
    if (preferredUrl && imageUrl !== fallback) setBrokenUrl(preferredUrl)
  }

  return (
    <div ref={coverElement} className={`book-cover cover-${variant % palettes.length}`}>
      <img src={imageUrl} alt={`Cover of ${book.title} by ${book.author}`} loading="lazy" decoding="async" onError={useFallback} />
    </div>
  )
}
