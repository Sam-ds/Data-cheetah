import DOMPurify from 'dompurify'

/** Strip all HTML from model output before rendering as text (XSS defense). */
export function sanitizeLlmText(text: string | null | undefined): string {
  if (text == null || text === '') return ''
  return DOMPurify.sanitize(String(text), {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  })
}
