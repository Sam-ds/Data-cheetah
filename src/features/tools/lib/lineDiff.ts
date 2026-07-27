export type DiffKind = 'same' | 'add' | 'remove' | 'change'

export interface DiffLine {
  type: DiffKind
  left?: string
  right?: string
  leftLine?: number
  rightLine?: number
}

/** Simple LCS line diff for side-by-side display. */
export function diffLines(leftText: string, rightText: string): DiffLine[] {
  const left = leftText.length === 0 ? [] : leftText.split('\n')
  const right = rightText.length === 0 ? [] : rightText.split('\n')
  const n = left.length
  const m = right.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: DiffLine[] = []
  let i = 0
  let j = 0
  let leftLine = 1
  let rightLine = 1

  while (i < n && j < m) {
    if (left[i] === right[j]) {
      rows.push({
        type: 'same',
        left: left[i],
        right: right[j],
        leftLine: leftLine++,
        rightLine: rightLine++,
      })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ type: 'remove', left: left[i], leftLine: leftLine++ })
      i++
    } else {
      rows.push({ type: 'add', right: right[j], rightLine: rightLine++ })
      j++
    }
  }

  while (i < n) {
    rows.push({ type: 'remove', left: left[i++], leftLine: leftLine++ })
  }
  while (j < m) {
    rows.push({ type: 'add', right: right[j++], rightLine: rightLine++ })
  }

  const collapsed: DiffLine[] = []
  for (let k = 0; k < rows.length; k++) {
    const cur = rows[k]
    const next = rows[k + 1]
    if (cur.type === 'remove' && next?.type === 'add') {
      collapsed.push({
        type: 'change',
        left: cur.left,
        right: next.right,
        leftLine: cur.leftLine,
        rightLine: next.rightLine,
      })
      k++
    } else {
      collapsed.push(cur)
    }
  }

  return collapsed
}
