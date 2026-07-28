import type { AskAnswer, InsightFinding, InsightReport, LlmProvider } from '../llm/types'
import { buildFinalInsightsSummaryPrompt } from '../prompts/askPrompts'
import { answerQuestion } from './answerService'
import type { FileContextBlock } from './contextBuilder'
import { generateQuestions } from './questionService'

function toFinding(probeTitle: string, answer: AskAnswer): InsightFinding {
  return {
    id: answer.questionId,
    title: probeTitle,
    sql: answer.sql,
    answer: answer.answer,
    rowCount: answer.rowCount,
    previewRows: answer.previewRows,
    columns: answer.columns,
    emptyResult: answer.emptyResult,
    error: answer.error,
  }
}

function fallbackSummary(findings: InsightFinding[]): string {
  const usable = findings.filter((f) => !f.error && !f.emptyResult && f.rowCount > 0)
  if (usable.length === 0) {
    return 'No reliable insights could be produced from the selected tables. Open Evidence below to inspect each SQL query and result, then adjust filters or regenerate.'
  }
  const bullets = usable.map((f) => `- ${f.title}: ${f.answer}`).join('\n')
  return `Executive summary\nQueries returned ${usable.length} usable result set${usable.length === 1 ? '' : 's'} across the selected tables.\n\nKey insights\n${bullets}`
}

export async function generateInsightReport(
  provider: LlmProvider,
  contexts: FileContextBlock[],
  rowLimit: number,
  onStatus?: (status: string) => void,
): Promise<InsightReport> {
  onStatus?.('Choosing useful analytical probes…')
  const probes = await generateQuestions(provider, contexts, (chunk) => {
    onStatus?.(`Planning insights… ${chunk.length} characters`)
  })

  const findings: InsightFinding[] = []
  for (const [index, probe] of probes.entries()) {
    onStatus?.(`Running query ${index + 1} of ${probes.length}: ${probe.question.slice(0, 80)}`)
    try {
      const answer = await answerQuestion(
        provider,
        contexts,
        probe.id,
        probe.question,
        rowLimit,
        (status) => onStatus?.(`Query ${index + 1}/${probes.length}: ${status}`),
      )
      findings.push(toFinding(probe.question, answer))
    } catch (err) {
      findings.push({
        id: probe.id,
        title: probe.question,
        sql: '',
        answer: '',
        rowCount: 0,
        previewRows: [],
        columns: [],
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  onStatus?.('Writing final insights summary…')
  let summary = fallbackSummary(findings)
  const usableForSummary = findings.filter((f) => f.sql || f.answer || f.error)
  if (usableForSummary.length > 0 && provider.isReady()) {
    try {
      const { system, user } = buildFinalInsightsSummaryPrompt(usableForSummary)
      const raw = await provider.complete(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { temperature: 0.2 },
      )
      const cleaned = raw.replace(/^```(?:text|markdown)?\s*/i, '').replace(/\s*```$/i, '').trim()
      if (cleaned.length > 40) summary = cleaned
    } catch {
      /* keep fallback */
    }
  }

  return {
    summary,
    findings,
    generatedAt: Date.now(),
  }
}
