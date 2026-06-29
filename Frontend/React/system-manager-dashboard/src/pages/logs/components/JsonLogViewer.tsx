import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import { Braces, Check, Copy } from 'lucide-react'

interface JsonLogViewerProps {
  value: string
  title?: string
  isNativeJson?: boolean
}

const LINE_HEIGHT = 20
const EDITOR_PADDING = 24

export default function JsonLogViewer({
  value,
  title = 'JSON Payload',
  isNativeJson = true,
}: JsonLogViewerProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [copied, setCopied] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const editorBg = theme.palette.background.default
  const gutterBg = theme.palette.background.paper

  const lineCount = useMemo(() => Math.max(value.split('\n').length, 1), [value])
  const editorHeight = lineCount * LINE_HEIGHT + EDITOR_PADDING

  const handleMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: false,
      allowComments: true,
      schemas: [],
      enableSchemaRequest: false,
    })

    const themeName = isDark ? 'medicare-json-dark' : 'medicare-json-light'
    monaco.editor.defineTheme('medicare-json-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '06b6d4', fontStyle: 'bold' },
        { token: 'string.value.json', foreground: '10b981' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'keyword.json', foreground: 'ec4899' },
        { token: 'delimiter.json', foreground: '8b93a8' },
      ],
      colors: {
        'editor.background': '#0f1117',
        'editor.lineHighlightBackground': '#06b6d410',
        'editorLineNumber.foreground': '#4d566b',
        'editorLineNumber.activeForeground': '#06b6d4',
        'editor.selectionBackground': '#06b6d438',
        'editor.inactiveSelectionBackground': '#06b6d420',
        'editorCursor.foreground': '#00000000',
        'editorGutter.background': '#161b27',
        'editorOverviewRuler.border': '#00000000',
        'editorError.foreground': '#00000000',
        'editorWarning.foreground': '#00000000',
      },
    })
    monaco.editor.defineTheme('medicare-json-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'string.key.json', foreground: '0891b2', fontStyle: 'bold' },
        { token: 'string.value.json', foreground: '059669' },
        { token: 'number', foreground: 'd97706' },
        { token: 'keyword.json', foreground: 'db2777' },
        { token: 'delimiter.json', foreground: '6b7280' },
      ],
      colors: {
        'editor.background': '#f9fafb',
        'editor.lineHighlightBackground': '#0891b210',
        'editorLineNumber.foreground': '#9ca3af',
        'editorLineNumber.activeForeground': '#0891b2',
        'editor.selectionBackground': '#0891b230',
        'editor.inactiveSelectionBackground': '#0891b218',
        'editorCursor.foreground': '#00000000',
        'editorGutter.background': '#ffffff',
        'editorOverviewRuler.border': '#00000000',
        'editorError.foreground': '#00000000',
        'editorWarning.foreground': '#00000000',
      },
    })
    monaco.editor.setTheme(themeName)

    editorInstance.updateOptions({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 12,
      lineHeight: LINE_HEIGHT,
      fontFamily: theme.typography.mono?.fontFamily ?? 'JetBrains Mono, monospace',
      padding: { top: 12, bottom: 12 },
      renderLineHighlight: 'none',
      folding: true,
      lineNumbers: 'on',
      glyphMargin: false,
      overviewRulerLanes: 0,
      hideCursorInOverviewRuler: true,
      occurrencesHighlight: 'off',
      selectionHighlight: false,
      renderValidationDecorations: 'off',
      cursorStyle: 'line-thin',
      cursorBlinking: 'solid',
      bracketPairColorization: { enabled: true },
      guides: { indentation: false },
      contextmenu: true,
      scrollbar: {
        vertical: 'hidden',
        horizontal: 'hidden',
        handleMouseWheel: false,
        verticalScrollbarSize: 0,
        horizontalScrollbarSize: 0,
      },
    })

    const model = editorInstance.getModel()
    if (model) {
      monaco.editor.setModelMarkers(model, 'json', [])
    }
  }, [isDark, theme.typography.mono?.fontFamily])

  useEffect(() => {
    editorRef.current?.layout()
  }, [editorHeight, value])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // ignore
    }
  }

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: '6px',
        overflow: 'visible',
        bgcolor: editorBg,
        position: 'relative',
        '& .monaco-editor, & .monaco-editor *': {
          cursor: 'text !important',
        },
        '& .monaco-editor .cursors-layer, & .monaco-editor .cursor': {
          display: 'none !important',
        },
        '& .monaco-editor .squiggly-error, & .monaco-editor .squiggly-warning': {
          display: 'none !important',
        },
        '& .monaco-editor .margin-view-overlays .line-numbers': {
          cursor: 'text !important',
        },
        '& .monaco-scrollable-element > .scrollbar': {
          display: 'none !important',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.25,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: gutterBg,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: '4px',
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <Braces size={13} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, color: 'text.primary' }}>{title}</Typography>
            <Typography sx={{ fontSize: 10, color: 'text.disabled', lineHeight: 1.2 }}>
              {isNativeJson ? 'Parsed JSON' : 'Structured view'} · {lineCount} lines · select text to copy
            </Typography>
          </Box>
        </Box>

        <Tooltip title={copied ? 'Copied!' : 'Copy all'}>
          <IconButton size="small" onClick={() => void handleCopy()} sx={{ color: copied ? 'success.main' : 'text.secondary' }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ position: 'relative', overflow: 'visible' }}>
        <Editor
          height={editorHeight}
          defaultLanguage="json"
          value={value}
          onMount={handleMount}
          loading={
            <Box sx={{ height: editorHeight, display: 'grid', placeItems: 'center', bgcolor: editorBg }}>
              <Typography variant="caption2" sx={{ color: 'text.disabled' }}>Loading JSON viewer…</Typography>
            </Box>
          }
          options={{
            readOnly: true,
            domReadOnly: true,
            renderValidationDecorations: 'off',
            scrollbar: {
              vertical: 'hidden',
              horizontal: 'hidden',
              handleMouseWheel: false,
              verticalScrollbarSize: 0,
              horizontalScrollbarSize: 0,
            },
          }}
        />
      </Box>
    </Box>
  )
}
