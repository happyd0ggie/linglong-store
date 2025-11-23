/**
 * 格式化文件大小
 * @param size 文件大小（字节）
 * @returns 格式化后的字符串（带单位）
 */
export const formatFileSize = (size: string | number | undefined | null): string => {
  if (size === undefined || size === null || size === '') {
    return '--'
  }

  const numSize = Number(size)
  if (isNaN(numSize)) {
    return '--'
  }

  const KB = 1024
  const MB = KB * 1024
  const GB = MB * 1024

  if (numSize >= GB) {
    return `${(numSize / GB).toFixed(2)} GB`
  } else if (numSize >= MB) {
    return `${(numSize / MB).toFixed(2)} MB`
  }
  // 小于 1MB 的情况（包括小于 1KB），统一显示为 KB
  return `${(numSize / KB).toFixed(2)} KB`

}
