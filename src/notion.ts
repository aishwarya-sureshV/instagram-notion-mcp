import { Client } from '@notionhq/client'
import type { WordPageData } from './extract-vocabulary.js'
import { buildPageBlocks } from './blocks.js'

let notion: Client

function getNotion(): Client {
  if (!notion) notion = new Client({ auth: process.env.NOTION_API_KEY })
  return notion
}

const DB_ID = () => {
  const id = process.env.NOTION_DATABASE_ID
  if (!id) throw new Error('NOTION_DATABASE_ID is not set')
  return id
}

export interface SavedWord {
  word: string
  notionPageUrl: string
}

export async function isDuplicate(word: string): Promise<boolean> {
  const response = await getNotion().databases.query({
    database_id: DB_ID(),
    filter: {
      property: 'Words',
      title: { contains: word },
    },
    page_size: 1,
  })
  return response.results.length > 0
}

export async function saveVocabularyEntry(data: WordPageData): Promise<SavedWord> {
  const wordTitle = `${data.word} (${data.pronunciation})`
  const today = new Date().toISOString().split('T')[0]

  const page = await getNotion().pages.create({
    parent: { database_id: DB_ID() },
    icon: { type: 'emoji', emoji: '✨' },
    properties: {
      Words: {
        title: [{ text: { content: wordTitle } }],
      },
      Meaning: {
        rich_text: [{ text: { content: data.meaning } }],
      },
      'Simple replacement': {
        rich_text: [{ text: { content: data.alternatives[0] ? `use ${data.word} instead of "${data.alternatives[0].instead}"` : '' }, annotations: { bold: false, italic: true, strikethrough: false, underline: false, code: false, color: 'default' } }],
      },
      Usage: {
        rich_text: [{ text: { content: '💭' }, annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'gray' } }],
      },
      Status: {
        status: { name: 'Just saved' },
      },
      Date: {
        date: { start: today },
      },
    },
    children: buildPageBlocks(data) as any,
  })

  const url = `https://notion.so/${(page.id as string).replace(/-/g, '')}`
  return { word: data.word, notionPageUrl: url }
}

export interface SearchResult {
  word: string
  meaning: string
  exampleSentences: string
  howToRemember: string
  status: string
  notionUrl: string
}

export interface WordEntry {
  pageId: string
  word: string
  meaning: string
  usage: string
  rememberEasily: string
  status: string
}

export async function getWordEntry(word: string): Promise<WordEntry | null> {
  const response = await getNotion().databases.query({
    database_id: DB_ID(),
    filter: { property: 'Words', title: { contains: word } },
    page_size: 1,
  })
  if (response.results.length === 0) return null
  const page = response.results[0] as any
  const p = page.properties
  return {
    pageId: page.id,
    word: p.Words?.title?.[0]?.text?.content ?? '',
    meaning: p.Meaning?.rich_text?.[0]?.text?.content ?? '',
    usage: p.Usage?.rich_text?.[0]?.text?.content ?? '',
    rememberEasily: p['Remember easily']?.rich_text?.[0]?.text?.content ?? '',
    status: p.Status?.status?.name ?? '',
  }
}

export async function getAllWordEntries(): Promise<WordEntry[]> {
  const results: WordEntry[] = []
  let cursor: string | undefined

  do {
    const response: any = await getNotion().databases.query({
      database_id: DB_ID(),
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    })
    for (const page of response.results as any[]) {
      const p = page.properties
      results.push({
        pageId: page.id,
        word: p.Words?.title?.[0]?.text?.content ?? '',
        meaning: p.Meaning?.rich_text?.[0]?.text?.content ?? '',
        usage: p.Usage?.rich_text?.[0]?.text?.content ?? '',
        rememberEasily: p['Remember easily']?.rich_text?.[0]?.text?.content ?? '',
        status: p.Status?.status?.name ?? '',
      })
    }
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  return results
}

export async function rebuildPageBody(pageId: string, data: WordPageData): Promise<void> {
  // Delete all existing blocks
  let cursor: string | undefined
  do {
    const response: any = await getNotion().blocks.children.list({
      block_id: pageId,
      ...(cursor ? { start_cursor: cursor } : {}),
    })
    for (const block of response.results as any[]) {
      await getNotion().blocks.delete({ block_id: block.id })
    }
    cursor = response.has_more ? response.next_cursor : undefined
  } while (cursor)

  // Append new blocks in chunks of 100
  const blocks = buildPageBlocks(data) as any[]
  for (let i = 0; i < blocks.length; i += 100) {
    await getNotion().blocks.children.append({
      block_id: pageId,
      children: blocks.slice(i, i + 100),
    })
  }

  // Update card properties too
  await getNotion().pages.update({
    page_id: pageId,
    properties: {
      Meaning: {
        rich_text: [{ text: { content: data.meaning } }],
      },
      'Simple replacement': {
        rich_text: [{ text: { content: data.alternatives[0] ? `use ${data.word} instead of "${data.alternatives[0].instead}"` : '' }, annotations: { bold: false, italic: true, strikethrough: false, underline: false, code: false, color: 'default' } }],
      },
    },
  })
}

export async function updateWordFields(
  pageId: string,
  fields: Partial<{ meaning: string; usage: string; rememberEasily: string }>,
): Promise<void> {
  const properties: Record<string, any> = {}
  if (fields.meaning !== undefined)
    properties['Meaning'] = { rich_text: [{ text: { content: fields.meaning } }] }
  if (fields.usage !== undefined)
    properties['Usage'] = { rich_text: [{ text: { content: fields.usage } }] }
  if (fields.rememberEasily !== undefined)
    properties['Remember easily'] = { rich_text: [{ text: { content: fields.rememberEasily } }] }
  await getNotion().pages.update({ page_id: pageId, properties })
}

export async function searchVocabulary(query: string): Promise<SearchResult[]> {
  const response = await getNotion().databases.query({
    database_id: DB_ID(),
    filter: {
      or: [
        { property: 'Words', title: { contains: query } },
      ],
    },
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    page_size: 20,
  })

  return response.results.map((page: any) => {
    const p = page.properties
    return {
      word: p.Words?.title?.[0]?.text?.content ?? '',
      meaning: p.Meaning?.rich_text?.[0]?.text?.content ?? '',
      exampleSentences: p.Usage?.rich_text?.[0]?.text?.content ?? '',
      howToRemember: p['Remember easily']?.rich_text?.[0]?.text?.content ?? '',
      status: p.Status?.status?.name ?? '',
      notionUrl: `https://notion.so/${page.id.replace(/-/g, '')}`,
    }
  })
}
