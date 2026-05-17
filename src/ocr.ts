import { createWorker } from 'tesseract.js'

export async function extractTextFromImages(imagePaths: string[]): Promise<string> {
  if (imagePaths.length === 0) return ''

  const worker = await createWorker('eng')

  const results: string[] = []

  for (const imgPath of imagePaths) {
    const { data } = await worker.recognize(imgPath)
    const text = data.text.trim()
    if (text) results.push(text)
  }

  await worker.terminate()

  return results.join('\n\n')
}
