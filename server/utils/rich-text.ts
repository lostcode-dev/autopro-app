import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h2',
  'h3',
  'a'
]

export function sanitizeRichTextHtml(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null
  }

  const sanitized = sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'target', 'rel']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: (_tagName: string, attribs: Record<string, string | undefined>) => ({
        tagName: 'a',
        attribs: (attribs.href
          ? {
              href: attribs.href,
              target: '_blank',
              rel: 'noopener noreferrer nofollow'
            }
          : {}) as Record<string, string>
      })
    }
  }).trim()

  const plainText = sanitizeHtml(sanitized, {
    allowedTags: [],
    allowedAttributes: {}
  }).trim()

  return plainText ? sanitized : null
}
