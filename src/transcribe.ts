import Groq from 'groq-sdk'
import { createReadStream } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join, dirname } from 'path'

const execFileAsync = promisify(execFile)

let groq: Groq

function getGroq(): Groq {
  if (!groq) groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  return groq
}

export async function transcribeVideo(videoPath: string): Promise<string> {
  // Extract audio as mp3 (Groq accepts mp3, smaller than raw video)
  const audioPath = videoPath.replace(/\.[^.]+$/, '.mp3')

  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vn',                  // no video
    '-ar', '16000',         // 16kHz — sufficient for speech
    '-ac', '1',             // mono
    '-b:a', '64k',
    '-y',                   // overwrite
    audioPath,
  ])

  const response = await getGroq().audio.transcriptions.create({
    file: createReadStream(audioPath),
    model: 'whisper-large-v3-turbo',
    language: 'en',
    response_format: 'text',
  })

  return typeof response === 'string' ? response : (response as any).text ?? ''
}
