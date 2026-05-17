import type { WordPageData } from './extract-vocabulary.js'

// ── Rich text helpers ─────────────────────────────────────────────────────────

const plain = (content: string) => ({ type: 'text' as const, text: { content } })
const bold = (content: string) => ({ type: 'text' as const, text: { content }, annotations: { bold: true } as const })
const italic = (content: string) => ({ type: 'text' as const, text: { content }, annotations: { italic: true } as const })
const boldItalic = (content: string) => ({ type: 'text' as const, text: { content }, annotations: { bold: true, italic: true } as const })

// ── Block builders ────────────────────────────────────────────────────────────

const h2 = (text: string) => ({
  type: 'heading_2' as const,
  heading_2: { rich_text: [plain(text)] },
})

const paragraph = (richText: any[]) => ({
  type: 'paragraph' as const,
  paragraph: { rich_text: richText },
})

const bullet = (richText: any[]) => ({
  type: 'bulleted_list_item' as const,
  bulleted_list_item: { rich_text: richText },
})

const quote = (richText: any[]) => ({
  type: 'quote' as const,
  quote: { rich_text: richText },
})

const divider = () => ({ type: 'divider' as const, divider: {} })

const table = (width: number, rows: any[][]) => ({
  type: 'table' as const,
  table: {
    table_width: width,
    has_column_header: true,
    has_row_header: false,
    children: rows.map(cells => ({
      type: 'table_row' as const,
      table_row: { cells },
    })),
  },
})

const cell = (...parts: any[]) => parts

// ── Page block builder ────────────────────────────────────────────────────────

export function buildPageBlocks(data: WordPageData): any[] {
  return [

    // ── 1. Meaning ──────────────────────────────────────────────────────────
    h2('Meaning'),
    paragraph([plain(data.meaning)]),

    // ── 2. How to Remember It ───────────────────────────────────────────────
    h2('How to Remember It'),
    bullet([plain(`Root hook: ${data.howToRemember.rootHook}`)]),
    bullet([plain(data.howToRemember.secondHook)]),
    divider(),

    // ── 3. Word Family ──────────────────────────────────────────────────────
    h2('👨‍👩‍👧 Word Family'),
    table(3, [
      // header row
      [cell(plain('Form')), cell(plain('Word')), cell(plain('Example'))],
      // data rows
      ...data.wordFamily.map(row => [
        cell(plain(row.form)),
        cell(bold(row.word)),
        cell(italic(row.example)),
      ]),
    ]),
    divider(),

    // ── 4. When to Use It ───────────────────────────────────────────────────
    h2('⏰ When to Use It'),
    table(2, [
      [cell(plain('Situation')), cell(plain('Example'))],
      ...data.whenToUse.map(row => [
        cell(plain(row.situation)),
        cell(italic(row.example)),
      ]),
    ]),
    divider(),

    // ── 5. Speaking Tips ────────────────────────────────────────────────────
    h2('💡 Speaking Tips — How to Actually Use This Word'),
    ...data.speakingTips.flatMap((tip, i) => {
      const num = `${i + 1}. `
      if (tip.isMagicPhrase) {
        return [
          paragraph([bold(`${num}${tip.emoji} ${tip.title}`)]),
          quote([boldItalic(`"${tip.example}"`)]),
          paragraph([plain(tip.explanation)]),
        ]
      }
      return [
        paragraph([bold(`${num}${tip.emoji} ${tip.title}`)]),
        quote([italic(`"${tip.example}"`)]),
        paragraph([plain(tip.explanation)]),
      ]
    }),
    divider(),

    // ── 6. Everyday Alternatives ────────────────────────────────────────────
    h2('🔄 Everyday Alternatives'),
    table(2, [
      [cell(plain(`Instead of ${data.word}`)), cell(plain('Use when…'))],
      ...data.alternatives.map(row => [
        cell(italic(`"${row.instead}"`)),
        cell(plain(row.useWhen)),
      ]),
    ]),
    paragraph([bold('When to use this word to elevate your speaking:')]),
    paragraph([plain(data.alternativesParagraph)]),
    divider(),

    // ── 7. Takeaway ─────────────────────────────────────────────────────────
    h2('🏁 Takeaway'),
    quote([plain('✅ '), bold('Use it actively'), plain(` — ${data.takeaway.useIt}`)]),
    quote([plain('🎯 '), bold('Start with: '), italic(data.takeaway.startWith)]),
    quote([plain('🚀 '), bold('Level up: '), plain(data.takeaway.levelUp)]),

  ]
}
