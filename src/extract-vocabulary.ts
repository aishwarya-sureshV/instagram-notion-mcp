import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExtractedWord {
  word: string
  pronunciation: string  // e.g. "FOR-mih-duh-bul"
}

export interface WordPageData {
  word: string
  pronunciation: string
  meaning: string
  howToRemember: {
    rootHook: string
    secondHook: string
  }
  wordFamily: Array<{ form: string; word: string; example: string }>
  whenToUse: Array<{ situation: string; example: string }>
  speakingTips: Array<{
    emoji: string
    title: string
    example: string
    explanation: string
    isMagicPhrase: boolean
  }>
  alternatives: Array<{ instead: string; useWhen: string }>
  alternativesParagraph: string
  takeaway: {
    useIt: string
    startWith: string
    levelUp: string
    powerMove: string
    replacePhrase: string
  }
  nextWords: Array<{ word: string; howDifferent: string; example: string }>
  collocations: Array<{ phrase: string; meaning: string }>
  commonMistakes: string[]
}

// ── Client ────────────────────────────────────────────────────────────────────

let client: Anthropic

function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return client
}

const MODEL = 'claude-sonnet-4-6'

async function ask(system: string, user: string, maxTokens: number): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : ''
}

// ── Step 1: Extract words from reel content ───────────────────────────────────

export async function extractWords(
  caption: string,
  transcript: string,
  ocrText: string,
): Promise<ExtractedWord[]> {
  const combinedText = [
    caption && `[Caption]\n${caption}`,
    transcript && `[Audio Transcript]\n${transcript}`,
    ocrText && `[Slide Text]\n${ocrText}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  if (!combinedText.trim()) return []

  const raw = await ask(
    `Extract English vocabulary words worth learning from Instagram content.

INCLUDE: advanced, nuanced, or uncommon words that feel natural in everyday conversation, professional speech, social situations, or thoughtful speaking.
EXCLUDE: basic words (good, nice, go, said, very) AND words that are mainly poetic, literary, archaic, overly academic, ceremonial, or unnatural in spoken English. No dictionary-showoff words.

Return ONLY a JSON array:
[{ "word": "the word", "pronunciation": "phonetic syllable breakdown with stress in CAPS — use actual sounds not spelling, e.g. coveted→KUV-ih-tid, formidable→FOR-mih-duh-bul, ephemeral→ih-FEM-er-ul" }]

If no words worth saving, return [].`,
    combinedText,
    500,
  )

  try {
    const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
    return JSON.parse(jsonrepair(json)) as ExtractedWord[]
  } catch {
    return []
  }
}

// ── Step 1b: Get pronunciation for a manually provided word ──────────────────

export async function getPronunciation(word: string): Promise<string> {
  const raw = await ask(
    `Generate the correct phonetic pronunciation of the given English word using syllable-stress notation (CAPS = stressed syllable).

Rules:
- Use actual phonetic sounds, NOT spelling patterns
- Short vowels: "cup"→UH, "bit"→IH, "bet"→EH, "hot"→AH, "foot"→UU
- Long vowels: "cape"→AY, "feet"→EE, "kite"→Y, "rope"→OH, "cute"→YOO
- Common traps: "cov" sounds like UH (cover), not OH; "ou" in "touch" = UH; "ea" in "bread" = EH
- Break into natural spoken syllables, not dictionary syllables
- Examples: "coveted"→KUV-ih-tid, "formidable"→FOR-mih-duh-bul, "ephemeral"→ih-FEM-er-ul, "egregious"→ih-GREE-jus

Return ONLY the pronunciation, nothing else.`,
    word,
    50,
  )
  return raw.trim() || word
}

// ── Step 2: Generate full 7-section page content for one word ─────────────────

export async function generateWordPageContent(
  word: string,
  pronunciation: string,
  sourceContext: string,
): Promise<WordPageData> {
  const raw = await ask(
    `You are an expert English vocabulary teacher using Norman Lewis's Word Power Made Easy method.
Generate a complete, rich vocabulary page for the given word.

Return ONLY valid JSON matching this exact structure:
{
  "meaning": "1-2 sentence expanded definition — more detailed than a dictionary entry",

  "howToRemember": {
    "rootHook": "Latin/Greek root breakdown — what each part means and how it maps to the word's meaning. 2-3 sentences.",
    "secondHook": "A sound hook, anchor, or vivid scene — e.g. a courtroom anchor, a sound-alike, a memorable image. 1-2 sentences."
  },

  "wordFamily": [
    { "form": "Adjective", "word": "adjective form", "example": "natural example sentence" },
    { "form": "Adverb", "word": "adverb form", "example": "natural example sentence" },
    { "form": "Noun", "word": "noun form", "example": "natural example sentence" },
    { "form": "Opposite", "word": "opposite/antonym", "example": "natural example sentence" }
  ],

  "whenToUse": [
    { "situation": "emoji + situation most natural for this word", "example": "short example phrase" },
    { "situation": "emoji + second distinct situation", "example": "short example phrase" },
    { "situation": "emoji + third distinct situation", "example": "short example phrase" },
    { "situation": "emoji + fourth distinct situation", "example": "short example phrase" }
  ],

  "speakingTips": [
    { "emoji": "🏆", "title": "first practical tip title", "example": "example sentence showing the word in use", "explanation": "one line on why/when to use it this way", "isMagicPhrase": false },
    { "emoji": "💼", "title": "second practical tip title", "example": "example sentence", "explanation": "one line explanation", "isMagicPhrase": false },
    { "emoji": "⚡", "title": "The magic phrase to memorize first:", "example": "the single most memorable key phrase using this word", "explanation": "one line on why this phrase works and when to deploy it", "isMagicPhrase": true }
  ],

  "alternatives": [
    { "instead": "most common everyday word people use instead", "useWhen": "when to use this simpler word instead" },
    { "instead": "second common alternative", "useWhen": "when this works better" },
    { "instead": "third common alternative", "useWhen": "when this works better" },
    { "instead": "fourth common alternative", "useWhen": "when this works better" }
  ],

  "alternativesParagraph": "One paragraph explaining exactly when to choose this word over the simpler alternatives — what does it add that the simpler words don't?",

  "takeaway": {
    "useIt": "brief note on how common/versatile the word is and in what contexts it shines",
    "startWith": "\\"key phrase 1\\" or \\"key phrase 2\\"",
    "levelUp": "the adverb form, opposite, or a closely related word worth learning next",
    "powerMove": "a short quotable contrast sentence using format: '[Subject] is [word] by [group A], but [contrasting action] by [group B]' — under 15 words, stage-worthy, memorable",
    "replacePhrase": "if this word can replace a common everyday phrase, give that phrase (e.g. 'changes very quickly and unpredictably' for volatile). If no natural phrase fits, return empty string."
  },

  "nextWords": [
    { "word": "related word 1", "howDifferent": "one line on how it differs from the main word", "example": "natural example sentence" },
    { "word": "related word 2", "howDifferent": "one line on how it differs", "example": "natural example sentence" },
    { "word": "related word 3", "howDifferent": "one line on how it differs", "example": "natural example sentence" }
  ],

  "collocations": [
    { "phrase": "most natural collocation 1", "meaning": "short meaning or sample phrase" },
    { "phrase": "most natural collocation 2", "meaning": "short meaning" },
    { "phrase": "most natural collocation 3", "meaning": "short meaning" },
    { "phrase": "most natural collocation 4", "meaning": "short meaning" },
    { "phrase": "most natural collocation 5", "meaning": "short meaning" }
  ],

  "commonMistakes": [
    "Don't [specific mistake] — [brief reason]. Where helpful add: ✅ correct use / ❌ wrong use as a short inline example.",
    "Don't [specific mistake about context, tone, or register] — [brief reason with example if useful].",
    "Don't [specific mistake about collocation, grammar, or overuse] — [brief reason].",
    "Don't [specific mistake unique to this word's common misuse] — [brief reason].",
    "Don't [fifth mistake if genuinely useful, otherwise omit] — [brief reason]."
  ]
}`,
    `Word: ${word} (${pronunciation})\n\nSource context (from Instagram reel):\n${sourceContext}`,
    4000,
  )

  const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  const data = JSON.parse(jsonrepair(json))
  return { word, pronunciation, ...data } as WordPageData
}

// ── Kept for modify_vocabulary_entry tool ─────────────────────────────────────

export interface RewrittenFields {
  meaning: string
  usage: string
  howToRemember: string
}

export async function rewriteWordEntry(
  entry: { word: string; meaning: string; usage: string; rememberEasily: string },
  instruction: string,
  referenceEntry?: { word: string; meaning: string; usage: string; rememberEasily: string },
): Promise<RewrittenFields> {
  const referenceSection = referenceEntry
    ? `\n\nUse this entry as your style/format reference:\n${JSON.stringify(referenceEntry, null, 2)}`
    : ''

  const raw = await ask(
    `You are an expert English vocabulary teacher. Modify the given vocabulary entry per the instruction.${referenceSection}

Return ONLY valid JSON:
{ "meaning": "...", "usage": "...", "howToRemember": "..." }`,
    `Entry:\n${JSON.stringify(entry, null, 2)}\n\nInstruction: ${instruction}`,
    1500,
  )

  const json = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()
  return JSON.parse(jsonrepair(json)) as RewrittenFields
}
