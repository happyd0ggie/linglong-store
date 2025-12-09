/**
 * 比较两个版本号
 * @param v1 - 第一个版本号
 * @param v2 - 第二个版本号
 * @returns 比较结果：1(v1>v2), -1(v1<v2), 0(v1=v2)
 */
const compareVersions = (v1: string, v2: string): number => {
  // 将版本号分割为数字和字符串部分
  const a = String(v1).split(/[._-]/).map(s => (s === '' ? 0 : (Number.isNaN(Number(s)) ? s : Number(s))))
  const b = String(v2).split(/[._-]/).map(s => (s === '' ? 0 : (Number.isNaN(Number(s)) ? s : Number(s))))
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    // 使用类型 string | number 替代 any
    const aa: string | number = a[i] ?? 0
    const bb: string | number = b[i] ?? 0
    if (typeof aa === 'number' && typeof bb === 'number') {
      if (aa > bb) {
        return 1
      }
      if (aa < bb) {
        return -1
      }
    } else {
      const sa = String(aa)
      const sb = String(bb)
      if (sa > sb) {
        return 1
      }
      if (sa < sb) {
        return -1
      }
    }
  }
  return 0
}
export default compareVersions
