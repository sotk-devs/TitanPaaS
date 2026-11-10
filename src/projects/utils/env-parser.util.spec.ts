import { describe, it, expect } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { parseEnv, formatEnv } from './env-parser.util.js';

describe('env-parser.util', () => {
  describe('parseEnv', () => {
    it('should return empty object for empty or falsy string', () => {
      expect(parseEnv('')).toEqual({});
      expect(parseEnv('   \n\n  ')).toEqual({});
      expect(parseEnv(null as unknown as string)).toEqual({});
    });

    it('should parse basic KEY=VALUE pairs', () => {
      const input = `
PORT=3000
NODE_ENV=production
APP_NAME=TitanPaaS
`;
      const result = parseEnv(input);
      expect(result).toEqual({
        PORT: '3000',
        NODE_ENV: 'production',
        APP_NAME: 'TitanPaaS',
      });
    });

    it('should ignore empty lines and comment lines', () => {
      const input = `
# This is a comment
PORT=8080

# Another comment
DEBUG=false
`;
      const result = parseEnv(input);
      expect(result).toEqual({
        PORT: '8080',
        DEBUG: 'false',
      });
    });

    it('should handle export prefix', () => {
      const input = `
export PORT=4000
export API_KEY=secret_key_123
`;
      const result = parseEnv(input);
      expect(result).toEqual({
        PORT: '4000',
        API_KEY: 'secret_key_123',
      });
    });

    it('should parse double-quoted values with escaped newlines, tabs, and quotes', () => {
      const input = `
GREETING="Hello \\"World\\""
MULTILINE_ESCAPE="line1\\nline2\\ttab"
JSON_PAYLOAD="{\\"key\\": \\"value\\"}"
`;
      const result = parseEnv(input);
      expect(result.GREETING).toBe('Hello "World"');
      expect(result.MULTILINE_ESCAPE).toBe('line1\nline2\ttab');
      expect(result.JSON_PAYLOAD).toBe('{"key": "value"}');
    });

    it('should parse single-quoted literal values', () => {
      const input = `
RAW_VAL='no\\nescape\\there'
SINGLE_QUOTE='literal value with # not a comment'
`;
      const result = parseEnv(input);
      expect(result.RAW_VAL).toBe('no\\nescape\\there');
      expect(result.SINGLE_QUOTE).toBe('literal value with # not a comment');
    });

    it('should ignore inline comments for unquoted values', () => {
      const input = `
DATABASE_PORT=5432 # Default postgres port
REDIS_HOST=localhost   # Local redis instance
`;
      const result = parseEnv(input);
      expect(result.DATABASE_PORT).toBe('5432');
      expect(result.REDIS_HOST).toBe('localhost');
    });

    it('should support empty values', () => {
      const input = `
EMPTY_ONE=
EMPTY_QUOTED=""
EMPTY_SINGLE=''
`;
      const result = parseEnv(input);
      expect(result.EMPTY_ONE).toBe('');
      expect(result.EMPTY_QUOTED).toBe('');
      expect(result.EMPTY_SINGLE).toBe('');
    });

    it('should parse multiline values across multiple lines', () => {
      const input = `
PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0
-----END RSA PRIVATE KEY-----"
AFTER_KEY=true
`;
      const result = parseEnv(input);
      expect(result.PRIVATE_KEY).toBe(
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0\n-----END RSA PRIVATE KEY-----',
      );
      expect(result.AFTER_KEY).toBe('true');
    });

    it('should throw BadRequestException on lines without equals sign', () => {
      const input = `
VALID=123
INVALID_LINE_NO_EQUALS
ANOTHER=456
`;
      expect(() => parseEnv(input)).toThrow(BadRequestException);
      expect(() => parseEnv(input)).toThrow(/se esperaba formato KEY=VALUE/);
    });

    it('should throw BadRequestException on invalid variable names', () => {
      const input = `
123_INVALID=error
`;
      expect(() => parseEnv(input)).toThrow(BadRequestException);
      expect(() => parseEnv(input)).toThrow(/inválido/);
    });

    it('should throw BadRequestException on unclosed multiline quotes', () => {
      const input = `
UNCLOSED="This never ends
`;
      expect(() => parseEnv(input)).toThrow(BadRequestException);
      expect(() => parseEnv(input)).toThrow(/Comillas no cerradas/);
    });
  });

  describe('formatEnv', () => {
    it('should return empty string for empty variables', () => {
      expect(formatEnv({})).toBe('');
    });

    it('should format simple key value pairs sorted alphabetically', () => {
      const input = {
        PORT: '3000',
        APP_NAME: 'Titan',
        DEBUG: 'true',
      };
      const result = formatEnv(input);
      expect(result).toBe('APP_NAME=Titan\nDEBUG=true\nPORT=3000\n');
    });

    it('should wrap values containing spaces, quotes, newlines or comments in double quotes', () => {
      const input = {
        COMPLEX: 'value with spaces',
        WITH_HASH: 'val#comment',
        MULTILINE: 'line1\nline2',
        WITH_QUOTES: 'say "hi"',
        EMPTY: '',
      };
      const result = formatEnv(input);
      expect(result).toContain('COMPLEX="value with spaces"');
      expect(result).toContain('WITH_HASH="val#comment"');
      expect(result).toContain('MULTILINE="line1\\nline2"');
      expect(result).toContain('WITH_QUOTES="say \\"hi\\""');
      expect(result).toContain('EMPTY=""');
    });

    it('should roundtrip parse and format successfully', () => {
      const original = {
        API_SECRET: 'my_secret_token_123',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        MULTILINE: 'First line\nSecond line',
        QUOTED_TEXT: 'Text with "quotes" and spaces',
      };

      const formatted = formatEnv(original);
      const parsed = parseEnv(formatted);
      expect(parsed).toEqual(original);
    });
  });
});
