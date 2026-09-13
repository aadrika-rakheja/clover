const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const currentPriority = LOG_LEVELS[currentLevel] ?? 2;

function format(level, msg, meta) {
  const ts = new Date().toISOString();
  const metaStr = meta !== undefined ? ` ${JSON.stringify(meta)}` : '';
  return `[${ts}] [${level.toUpperCase()}] ${msg}${metaStr}`;
}

export const logger = {
  error: (msg, meta) => {
    if (currentPriority >= LOG_LEVELS.error) console.error(format('error', msg, meta));
  },
  warn: (msg, meta) => {
    if (currentPriority >= LOG_LEVELS.warn) console.warn(format('warn', msg, meta));
  },
  info: (msg, meta) => {
    if (currentPriority >= LOG_LEVELS.info) console.log(format('info', msg, meta));
  },
  debug: (msg, meta) => {
    if (currentPriority >= LOG_LEVELS.debug) console.log(format('debug', msg, meta));
  },
};
