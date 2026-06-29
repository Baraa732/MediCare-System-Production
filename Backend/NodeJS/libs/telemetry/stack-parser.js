'use strict';

function compactFrame(line) {
  const trimmed = String(line).trim().replace(/^at\s+/, '');
  const parenMatch = trimmed.match(/^(.+?)\s+\((.+):(\d+):\d+\)$/);
  if (parenMatch) {
    const fn = parenMatch[1].replace(/^async\s+/, '');
    return `${fn}:${parenMatch[3]}`;
  }
  const bareMatch = trimmed.match(/^(.+):(\d+):\d+$/);
  if (bareMatch) {
    return `${bareMatch[1]}:${bareMatch[2]}`;
  }
  return trimmed;
}

function parseStackTrace(stack, errorMessage) {
  if (!stack || typeof stack !== 'string') {
    return {
      stack_summary: errorMessage ? String(errorMessage) : null,
      stack_frames: [],
      raw_stack: null,
    };
  }

  const lines = stack.split('\n').map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] ?? '';
  const stackSummary =
    firstLine.replace(/^(?:\w+Error|Error):\s*/i, '').trim() ||
    (errorMessage ? String(errorMessage) : firstLine);

  const stackFrames = lines
    .slice(1)
    .filter((line) => line.startsWith('at '))
    .slice(0, 12)
    .map(compactFrame);

  return {
    stack_summary: stackSummary,
    stack_frames: stackFrames,
    raw_stack: stack,
  };
}

module.exports = { parseStackTrace, compactFrame };
