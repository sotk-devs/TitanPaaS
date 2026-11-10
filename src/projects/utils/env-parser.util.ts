import { BadRequestException } from '@nestjs/common';

const ENV_KEY_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Parsea el contenido en texto plano de un archivo .env y retorna un diccionario clave-valor.
 *
 * Reglas soportadas:
 * - Lineas vacias y comentarios (comienzan con #) son ignorados.
 * - Soporta prefijo opcional 'export ' (e.g. 'export PORT=3000').
 * - Formato estandar KEY=VALUE.
 * - Valores entre comillas dobles ("..."): procesa secuencias de escape (\\n, \\r, \\t, \\", \\\\).
 * - Valores entre comillas simples ('...'): contenido literal sin procesar secuencias.
 * - Valores sin comillas: ignora comentarios en linea precedidos de espacio ('# comment').
 * - Valida nombres de variables segun la especificacion POSIX / standard naming.
 */
export function parseEnv(content: string): Record<string, string> {
  if (!content || typeof content !== 'string') {
    return {};
  }

  const result: Record<string, string> = {};
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let currentKey: string | null = null;
  let multilineQuote: '"' | "'" | null = null;
  let multilineBuffer: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNumber = i + 1;

    // Si estamos dentro de un valor multilínea entre comillas
    if (multilineQuote !== null) {
      const closingIndex = findClosingQuoteIndex(rawLine, multilineQuote);
      if (closingIndex !== -1) {
        multilineBuffer.push(rawLine.slice(0, closingIndex));
        const fullRawValue = multilineBuffer.join('\n');
        result[currentKey!] =
          multilineQuote === '"'
            ? unescapeDoubleQuotedString(fullRawValue)
            : fullRawValue;
        currentKey = null;
        multilineQuote = null;
        multilineBuffer = [];
      } else {
        multilineBuffer.push(rawLine);
      }
      continue;
    }

    const trimmed = rawLine.trim();

    // Ignorar líneas vacías o comentarios puros
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Quitar prefijo 'export ' si existe
    let lineToParse = trimmed;
    if (lineToParse.startsWith('export ')) {
      lineToParse = lineToParse.slice(7).trim();
    }

    const eqIndex = lineToParse.indexOf('=');
    if (eqIndex === -1) {
      throw new BadRequestException(
        `Línea ${lineNumber} inválida en archivo .env: se esperaba formato KEY=VALUE, recibido "${trimmed}"`,
      );
    }

    const key = lineToParse.slice(0, eqIndex).trim();
    const rawVal = lineToParse.slice(eqIndex + 1).trim();

    if (!ENV_KEY_REGEX.test(key)) {
      throw new BadRequestException(
        `Nombre de variable de entorno inválido "${key}" en línea ${lineNumber}. Debe coincidir con ${ENV_KEY_REGEX}`,
      );
    }

    // Caso 1: Cadena entre comillas dobles
    if (rawVal.startsWith('"')) {
      const closingIdx = findClosingQuoteIndex(rawVal.slice(1), '"');
      if (closingIdx !== -1) {
        const inner = rawVal.slice(1, closingIdx + 1);
        result[key] = unescapeDoubleQuotedString(inner);
      } else {
        // Inicia cadena multilínea con comillas dobles
        currentKey = key;
        multilineQuote = '"';
        multilineBuffer = [rawVal.slice(1)];
      }
      continue;
    }

    // Caso 2: Cadena entre comillas simples
    if (rawVal.startsWith("'")) {
      const closingIdx = findClosingQuoteIndex(rawVal.slice(1), "'");
      if (closingIdx !== -1) {
        const inner = rawVal.slice(1, closingIdx + 1);
        result[key] = inner;
      } else {
        // Inicia cadena multilínea con comillas simples
        currentKey = key;
        multilineQuote = "'";
        multilineBuffer = [rawVal.slice(1)];
      }
      continue;
    }

    // Caso 3: Valor sin comillas
    // Quitar comentarios en línea que estén precedidos de espacio o tabulación
    let unquotedVal = rawVal;
    const inlineCommentMatch = /(^|\s+)#.*$/.exec(unquotedVal);
    if (inlineCommentMatch && inlineCommentMatch.index !== undefined) {
      unquotedVal = unquotedVal.slice(0, inlineCommentMatch.index);
    }

    result[key] = unquotedVal.trim();
  }

  if (multilineQuote !== null && currentKey) {
    throw new BadRequestException(
      `Comillas no cerradas para la variable "${currentKey}" en archivo .env`,
    );
  }

  return result;
}

/**
 * Busca el índice de la comilla de cierre respetando caracteres escapados (\\").
 */
function findClosingQuoteIndex(str: string, quote: '"' | "'"): number {
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '\\' && quote === '"') {
      escaped = !escaped;
      continue;
    }
    if (char === quote && !escaped) {
      return i;
    }
    escaped = false;
  }
  return -1;
}

/**
 * Desescapa secuencias comunes en cadenas entre comillas dobles (\\n, \\r, \\t, \\", \\\\).
 */
function unescapeDoubleQuotedString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

/**
 * Serializa un diccionario de variables de entorno al formato estándar .env.
 * Las claves se ordenan alfabéticamente para asegurar reproducibilidad.
 */
export function formatEnv(variables: Record<string, string>): string {
  if (!variables || typeof variables !== 'object') {
    return '';
  }

  const keys = Object.keys(variables).sort();
  if (keys.length === 0) {
    return '';
  }

  const lines: string[] = [];

  for (const key of keys) {
    if (!ENV_KEY_REGEX.test(key)) {
      continue;
    }

    const value = variables[key] ?? '';
    const formattedVal = serializeEnvValue(value);
    lines.push(`${key}=${formattedVal}`);
  }

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

/**
 * Da formato y escapa el valor de una variable según su contenido.
 */
function serializeEnvValue(val: string): string {
  if (val === '') {
    return '""';
  }

  const needsQuotes =
    val.includes('\n') ||
    val.includes('\r') ||
    val.includes('\t') ||
    val.includes(' ') ||
    val.includes('"') ||
    val.includes("'") ||
    val.includes('#') ||
    val.includes('=') ||
    val.startsWith(' ') ||
    val.endsWith(' ');

  if (!needsQuotes) {
    return val;
  }

  const escaped = val
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');

  return `"${escaped}"`;
}
