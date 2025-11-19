/**
 * 比较两个版本号
 * @param v1 版本号1
 * @param v2 版本号2
 * @returns 1: v1 > v2, -1: v1 < v2, 0: v1 == v2
 */
export const compareVersions = (v1: string, v2: string): number => {
  const v1Parts = v1.split('.').map(Number)
  const v2Parts = v2.split('.').map(Number)
  const len = Math.max(v1Parts.length, v2Parts.length)

  for (let i = 0; i < len; i++) {
    const p1 = v1Parts[i] || 0
    const p2 = v2Parts[i] || 0
    if (p1 > p2) {
      return 1
    }
    if (p1 < p2) {
      return -1
    }
  }
  return 0
}

/**
 * 检查是否有更新
 * @param currentVersion 当前版本
 * @param remoteVersion 远程版本
 * @returns 1: 需要更新 (remote > current), 0: 不需要更新
 */
export const hasUpdateVersion = (currentVersion: string, remoteVersion: string): number => {
  return compareVersions(remoteVersion, currentVersion) === 1 ? 1 : 0
}

export default hasUpdateVersion
