import { diffLines, type DiffLine } from '../lib/lineDiff'

export type { DiffLine }

export function compareText(left: string, right: string): DiffLine[] {
  return diffLines(left, right)
}
