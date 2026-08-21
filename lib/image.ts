// スマホで撮った写真はそのままだと5〜12MBあり、店のWi-Fiではアップロードに
// 失敗したり何十秒もかかったりする。保存前に長辺を縮めてJPEGに変換する。
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.75

export async function resizeImageFile(file: File): Promise<File> {
  // 画像として読めないもの(HEICなど一部端末)は変換せず、そのまま渡す。
  if (!file.type.startsWith('image/')) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  const { width, height } = bitmap
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  if (scale === 1 && file.type === 'image/jpeg') {
    bitmap.close()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    return file
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) return file

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
}
