import { MCPServer } from 'mcp-use/server'
import { z } from 'zod'
import { fetchInstagramPost } from './instagram.js'
import { transcribeVideo } from './transcribe.js'
import { extractTextFromImages } from './ocr.js'
import { extractWords, generateWordPageContent, getPronunciation, rewriteWordEntry } from './extract-vocabulary.js'
import { isDuplicate, saveVocabularyEntry, searchVocabulary, getWordEntry, getAllWordEntries, updateWordFields } from './notion.js'

const server = new MCPServer({
  name: 'instagram-vocabulary',
  version: '1.0.0',
})

// ── Tool 1: process_instagram_vocabulary ─────────────────────────────────────

server.tool(
  {
    name: 'process_instagram_vocabulary',
    description:
      'Download an Instagram reel or carousel, extract English vocabulary words from the audio and text, and save them to your Notion vocabulary bank with full rich page content.',
    schema: z.object({
      url: z.string().url().describe('Instagram reel or carousel URL'),
    }),
  },
  async ({ url }) => {
    const steps: string[] = []

    // 1. Download
    steps.push('Downloading post...')
    const post = await fetchInstagramPost(url)
    steps.push(`caption(${post.caption.length}c) video(${post.videoPath ? '✓' : '✗'}) images(${post.imagePaths.length})`)

    // 2. Transcribe audio
    let transcript = ''
    if (post.videoPath) {
      steps.push('Transcribing audio...')
      transcript = await transcribeVideo(post.videoPath)
    }

    // 3. OCR carousel images
    let ocrText = ''
    if (post.imagePaths.length > 0) {
      steps.push(`OCR on ${post.imagePaths.length} image(s)...`)
      ocrText = await extractTextFromImages(post.imagePaths)
    }

    // 4. Extract words (fast, lightweight)
    steps.push('Extracting vocabulary...')
    const words = await extractWords(post.caption, transcript, ocrText)

    if (words.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No new vocabulary words found in this post.\n\nPipeline: ${steps.join(' → ')}`,
        }],
      }
    }

    // 5. Generate full page content + save (skip duplicates)
    const sourceContext = [
      post.caption && `[Caption]\n${post.caption}`,
      transcript && `[Audio]\n${transcript}`,
      ocrText && `[Slides]\n${ocrText}`,
    ].filter(Boolean).join('\n\n')

    const saved: string[] = []
    const skipped: string[] = []

    for (const { word, pronunciation } of words) {
      const alreadySaved = await isDuplicate(word)
      if (alreadySaved) {
        skipped.push(word)
        continue
      }

      steps.push(`Generating page for "${word}"...`)
      const pageData = await generateWordPageContent(word, pronunciation, sourceContext)
      const result = await saveVocabularyEntry(pageData)
      saved.push(`• **${result.word}** → ${result.notionPageUrl}`)
    }

    const lines = [
      `Saved **${saved.length}** word(s) to your Notion Vocabulary Bank${skipped.length > 0 ? ` (skipped ${skipped.length} duplicate(s): ${skipped.join(', ')})` : ''}.`,
      '',
      ...saved,
      '',
      `Source: ${url}`,
    ]

    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }],
    }
  },
)

// ── Tool 2: add_word_to_vocabulary ────────────────────────────────────────────

server.tool(
  {
    name: 'add_word_to_vocabulary',
    description:
      'Manually add a specific English word to your Notion vocabulary bank with a full rich page (all 7 sections). Use this when the user says "add X to vocabulary" or "save X to my vocabulary bank".',
    schema: z.object({
      word: z.string().min(1).describe('The English word to add'),
      pronunciation: z.string().optional().describe('Pronunciation hint (e.g. "FOR-mih-duh-bul"). Auto-generated if not provided.'),
      context: z.string().optional().describe('Optional context about the word — where you heard it, how it was used, etc.'),
    }),
  },
  async ({ word, pronunciation, context }) => {
    const alreadySaved = await isDuplicate(word)
    if (alreadySaved) {
      return {
        content: [{ type: 'text' as const, text: `"${word}" is already in your vocabulary bank.` }],
      }
    }

    const pron = pronunciation ?? await getPronunciation(word)
    const pageData = await generateWordPageContent(word, pron, context ?? '')
    const result = await saveVocabularyEntry(pageData)

    return {
      content: [{
        type: 'text' as const,
        text: `Added **${result.word}** to your Notion Vocabulary Bank.\n\n${result.notionPageUrl}`,
      }],
    }
  },
)

// ── Tool 4: search_vocabulary ─────────────────────────────────────────────────

server.tool(
  {
    name: 'search_vocabulary',
    description:
      'Search your Notion vocabulary bank by word.',
    schema: z.object({
      query: z.string().min(1).describe('Search term — word or phrase'),
    }),
  },
  async ({ query }) => {
    const results = await searchVocabulary(query)

    if (results.length === 0) {
      return {
        content: [{ type: 'text' as const, text: `No vocabulary words found matching "${query}".` }],
      }
    }

    const lines = results.map(r =>
      [
        `**${r.word}**`,
        r.status ? `Status: ${r.status}` : '',
        `[Open in Notion](${r.notionUrl})`,
      ]
        .filter(Boolean)
        .join('\n'),
    )

    return {
      content: [{
        type: 'text' as const,
        text: `Found **${results.length}** result(s) for "${query}":\n\n${lines.join('\n\n---\n\n')}`,
      }],
    }
  },
)

// ── Tool 5: modify_vocabulary_entry ──────────────────────────────────────────

server.tool(
  {
    name: 'modify_vocabulary_entry',
    description: 'Modify one word or reformat all words in the database to match a reference word\'s style.',
    schema: z.object({
      target: z.string().describe('Word to modify, or "all" to update every entry'),
      instruction: z.string().describe('What to change or how to reformat'),
      reference_word: z.string().optional().describe('Use this word\'s entry as the style template (used when target is "all")'),
    }),
  },
  async ({ target, instruction, reference_word }) => {
    const referenceEntry = reference_word
      ? (await getWordEntry(reference_word)) ?? undefined
      : undefined

    if (reference_word && !referenceEntry) {
      return {
        content: [{ type: 'text' as const, text: `Reference word "${reference_word}" not found in your vocabulary bank.` }],
      }
    }

    if (target.toLowerCase() !== 'all') {
      const entry = await getWordEntry(target)
      if (!entry) {
        return {
          content: [{ type: 'text' as const, text: `Word "${target}" not found in your vocabulary bank.` }],
        }
      }

      const rewritten = await rewriteWordEntry(entry, instruction, referenceEntry ?? undefined)
      await updateWordFields(entry.pageId, {
        meaning: rewritten.meaning,
        usage: rewritten.usage,
        rememberEasily: rewritten.howToRemember,
      })

      return {
        content: [{ type: 'text' as const, text: `Updated "${entry.word}" successfully.\n\nNew meaning: ${rewritten.meaning}` }],
      }
    }

    const allEntries = await getAllWordEntries()
    const skip = referenceEntry?.word.toLowerCase()

    const updated: string[] = []
    const failed: string[] = []

    for (const entry of allEntries) {
      if (skip && entry.word.toLowerCase().includes(skip)) continue
      try {
        const rewritten = await rewriteWordEntry(entry, instruction, referenceEntry ?? undefined)
        await updateWordFields(entry.pageId, {
          meaning: rewritten.meaning,
          usage: rewritten.usage,
          rememberEasily: rewritten.howToRemember,
        })
        updated.push(entry.word)
      } catch {
        failed.push(entry.word)
      }
    }

    const lines = [
      `Updated **${updated.length}** word(s).`,
      failed.length > 0 ? `Failed: ${failed.join(', ')}` : '',
    ].filter(Boolean)

    return {
      content: [{ type: 'text' as const, text: lines.join('\n') }],
    }
  },
)

// ── Start ─────────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3000)
await server.listen(port)
console.log(`instagram-vocabulary MCP server running on port ${port}`)
