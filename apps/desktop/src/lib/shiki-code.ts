import { createCodePlugin, type HighlightResult, type ThemeInput } from '@streamdown/code'

export const SHIKI_THEMES: [ThemeInput, ThemeInput] = ['github-light-default', 'github-dark-default']

export const streamdownCodePlugin = createCodePlugin({ themes: SHIKI_THEMES })

export type { HighlightResult }
