'use client'

import type { SyntaxHighlighterProps } from '@assistant-ui/react-streamdown'
import type { CSSProperties, FC } from 'react'
import { Fragment, memo, useEffect, useMemo, useRef, useState } from 'react'

import {
  CodeCard,
  CodeCardBody,
  CodeCardHeader,
  CodeCardIcon,
  CodeCardSubtitle,
  CodeCardTitle
} from '@/components/chat/code-card'
import { CopyButton } from '@/components/ui/copy-button'
import { codiconForLanguage, isLikelyProseCodeBlock, sanitizeLanguageTag } from '@/lib/markdown-code'
import { type HighlightResult, SHIKI_THEMES, streamdownCodePlugin } from '@/lib/shiki-code'

/**
 * Streamdown's code adapter renders header + body as inline siblings, so we
 * own the wrapping `<CodeCard>` here and neutralize the upstream
 * `data-streamdown="code-block"` chrome from styles.css. Anything that wants
 * a card-shaped code surface should compose `CodeCard*` directly.
 *
 * The live highlighter uses Streamdown's Shiki plugin directly so an unfinished
 * fence can start highlighting before the close marker arrives. It keeps raw
 * text visible while async highlighting catches up.
 */
interface HermesSyntaxHighlighterProps extends SyntaxHighlighterProps {
  defer?: boolean
}

const LIVE_HIGHLIGHT_INTERVAL_MS = 120
const MAX_LIVE_HIGHLIGHT_CHARS = 16_000

/**
 * `github-light-default` colors comments `#6e7781` (~4.2:1 against the code
 * card background) — borderline unreadable at our 11px code size, and worst of
 * all for shell snippets where a single `#` turns the rest of the line into one
 * long comment span. Remap light-mode comments to GitHub's darker muted gray
 * (`#57606a`, ~6.4:1). Dark mode (`#8b949e`, ~6.1:1) already reads fine, so we
 * leave it untouched. Keyed per theme name so the bump only applies in light.
 */
const SHIKI_COLOR_REPLACEMENTS: Record<string, Record<string, string>> = {
  'github-light-default': { '#6e7781': '#57606a' }
}

interface HighlightSnapshot {
  code: string
  language: string
  result: HighlightResult
}

type Token = HighlightResult['tokens'][number][number]
type TokenStyle = CSSProperties & Record<`--${string}`, string | undefined>

function normalizeHighlightLanguage(language: string): string {
  return sanitizeLanguageTag(language) || 'text'
}

function useLiveHighlight(code: string, language: string, streaming: boolean): HighlightSnapshot | null {
  const [snapshot, setSnapshot] = useState<HighlightSnapshot | null>(null)
  const currentRef = useRef({ code, language })
  const lastRunAtRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  currentRef.current = { code, language }

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!code || (streaming && code.length > MAX_LIVE_HIGHLIGHT_CHARS)) {
      setSnapshot(null)

      return undefined
    }

    const requestedCode = code
    const requestedLanguage = normalizeHighlightLanguage(language)
    const now = performance.now()
    const wait = streaming ? Math.max(0, LIVE_HIGHLIGHT_INTERVAL_MS - (now - lastRunAtRef.current)) : 0

    const applyResult = (result: HighlightResult) => {
      const current = currentRef.current

      if (current.language !== language || !current.code.startsWith(requestedCode)) {
        return
      }

      setSnapshot(prev => {
        if (
          prev &&
          current.code.startsWith(prev.code) &&
          prev.language === requestedLanguage &&
          prev.code.length > requestedCode.length
        ) {
          return prev
        }

        return { code: requestedCode, language: requestedLanguage, result }
      })
    }

    const run = () => {
      timerRef.current = null
      lastRunAtRef.current = performance.now()

      const result = streamdownCodePlugin.highlight(
        {
          code: requestedCode,
          language: requestedLanguage as never,
          themes: SHIKI_THEMES
        },
        applyResult
      )

      if (result) {
        applyResult(result)
      }
    }

    timerRef.current = window.setTimeout(run, wait)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [code, language, streaming])

  return snapshot
}

function tokenColor(token: Token): string | undefined {
  const style = (token.htmlStyle ?? {}) as Record<string, string>
  const light = token.color ?? style.color
  const dark = style['--shiki-dark']
  const replacement = light ? SHIKI_COLOR_REPLACEMENTS['github-light-default']?.[light.toLowerCase()] : undefined

  if (!light && !dark) {
    return undefined
  }

  return `light-dark(${replacement ?? light ?? 'inherit'}, ${dark ?? replacement ?? light ?? 'inherit'})`
}

function tokenStyle(token: Token): TokenStyle {
  const style: TokenStyle = {}
  const color = tokenColor(token)

  if (color) {
    style.color = color
  }

  if (token.bgColor) {
    style.backgroundColor = token.bgColor
  }

  return style
}

function rawLines(code: string): Token[][] {
  return code.split('\n').map(line => [
    {
      content: line,
      offset: 0,
      color: undefined,
      bgColor: undefined,
      htmlStyle: {}
    } as Token
  ])
}

function highlightedLines(code: string, snapshot: HighlightSnapshot | null): Token[][] {
  if (!snapshot || !code.startsWith(snapshot.code)) {
    return rawLines(code)
  }

  const lines = snapshot.result.tokens.map(line => [...line])
  const suffix = code.slice(snapshot.code.length)

  if (!suffix) {
    return lines
  }

  const suffixLines = rawLines(suffix)

  if (lines.length === 0) {
    return suffixLines
  }

  const [firstSuffixLine, ...restSuffixLines] = suffixLines
  lines[lines.length - 1] = [...lines[lines.length - 1], ...firstSuffixLine]

  return [...lines, ...restSuffixLines]
}

const LiveHighlightedCode = memo(function LiveHighlightedCode({
  code,
  language,
  streaming
}: {
  code: string
  language: string
  streaming: boolean
}) {
  const cleanLanguage = normalizeHighlightLanguage(language)
  const snapshot = useLiveHighlight(code, cleanLanguage, streaming)
  const lines = useMemo(() => highlightedLines(code, snapshot), [code, snapshot])
  const highlighted = Boolean(snapshot && code.startsWith(snapshot.code))

  return (
    <code
      className="block whitespace-pre"
      data-highlighted={highlighted ? 'true' : undefined}
      data-language={cleanLanguage}
    >
      {lines.map((line, lineIndex) => (
        <Fragment key={lineIndex}>
          {line.map((token, tokenIndex) =>
            token.color || token.htmlStyle?.color ? (
              <span data-shiki-token="true" key={tokenIndex} style={tokenStyle(token)}>
                {token.content}
              </span>
            ) : (
              <span key={tokenIndex}>{token.content}</span>
            )
          )}
          {lineIndex < lines.length - 1 ? '\n' : null}
        </Fragment>
      ))}
    </code>
  )
})

export const SyntaxHighlighter: FC<HermesSyntaxHighlighterProps> = ({
  components: { Pre },
  language,
  code,
  defer = false
}) => {
  const trimmed = (code ?? '').replace(/^\n+/, '').trimEnd()

  // Streaming may hand us empty/incomplete fences — render nothing rather
  // than a transient empty card.
  if (!trimmed.trim()) {
    return null
  }

  if (isLikelyProseCodeBlock(language, trimmed)) {
    return <div className="aui-prose-fence whitespace-pre-wrap wrap-anywhere text-foreground">{trimmed}</div>
  }

  const cleanLanguage = sanitizeLanguageTag(language || '')
  const label = cleanLanguage && cleanLanguage !== 'unknown' ? cleanLanguage : ''

  return (
    <CodeCard data-streaming={defer ? 'true' : undefined}>
      <CodeCardHeader>
        <CodeCardTitle>
          <CodeCardIcon name={codiconForLanguage(label)} />
          Code
          {label && <CodeCardSubtitle> · {label}</CodeCardSubtitle>}
        </CodeCardTitle>
        <CopyButton
          appearance="inline"
          className="-mr-1 size-5 justify-center p-0 text-foreground opacity-70 hover:opacity-100"
          iconClassName="size-3"
          label="Copy code"
          showLabel={false}
          text={trimmed}
        />
      </CodeCardHeader>
      <CodeCardBody>
        <Pre className="aui-shiki m-0 overflow-hidden bg-transparent p-0">
          <LiveHighlightedCode code={trimmed} language={cleanLanguage || language || 'text'} streaming={defer} />
        </Pre>
      </CodeCardBody>
    </CodeCard>
  )
}
