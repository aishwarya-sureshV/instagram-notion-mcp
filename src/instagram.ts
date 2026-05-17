import { execFile } from 'child_process'
import { promisify } from 'util'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execFileAsync = promisify(execFile)

export interface InstagramData {
  caption: string
  videoPath: string | null   // null for image-only carousels
  imagePaths: string[]       // carousel slides or thumbnail
  isCarousel: boolean
}

export async function fetchInstagramPost(url: string): Promise<InstagramData> {
  const dir = await mkdtemp(join(tmpdir(), 'ig-'))

  try {
    // Download all media + write info JSON
    await execFileAsync('yt-dlp', [
      '--no-warnings',
      '--write-info-json',
      '--write-thumbnail',
      '-o', join(dir, '%(id)s.%(ext)s'),
      url,
    ])

    const files = await readdir(dir)

    // Extract caption from info JSON
    const infoFile = files.find(f => f.endsWith('.info.json'))
    let caption = ''
    let isCarousel = false

    if (infoFile) {
      const raw = JSON.parse(await readFile(join(dir, infoFile), 'utf-8'))
      caption = raw.description ?? raw.title ?? ''
      isCarousel = raw.playlist_count > 1 || raw._type === 'playlist'
    }

    // Separate video and image files
    const videoExts = new Set(['.mp4', '.webm', '.mkv', '.mov'])
    const imageExts = new Set(['.jpg', '.jpeg', '.png', '.webp'])

    const videoPath = files
      .filter(f => videoExts.has(extOf(f)) && !f.includes('thumbnail'))
      .map(f => join(dir, f))[0] ?? null

    const imagePaths = files
      .filter(f => imageExts.has(extOf(f)))
      .map(f => join(dir, f))

    return { caption, videoPath, imagePaths, isCarousel }
  } catch (err) {
    await rm(dir, { recursive: true, force: true })
    throw err
  }
  // Note: caller is responsible for cleanup via cleanupDir()
}

export async function cleanupDir(dir: string) {
  await rm(dir, { recursive: true, force: true })
}

function extOf(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i === -1 ? '' : filename.slice(i).toLowerCase()
}
