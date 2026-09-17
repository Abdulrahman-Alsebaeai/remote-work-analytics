import { LoggerService } from '@nestjs/common';

export class JsonLogger implements LoggerService {
  log(message: unknown, ...details: unknown[]) { this.write('info', message, details); }
  error(message: unknown, ...details: unknown[]) { this.write('error', message, details); }
  warn(message: unknown, ...details: unknown[]) { this.write('warn', message, details); }
  debug(message: unknown, ...details: unknown[]) { this.write('debug', message, details); }
  verbose(message: unknown, ...details: unknown[]) { this.write('trace', message, details); }
  private write(level: string, message: unknown, details: unknown[]) {
    const entry = { timestamp: new Date().toISOString(), level, message: message instanceof Error ? message.message : message, ...(details.length ? { details: details.map(value => value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value) } : {}) };
    const target = level === 'error' ? process.stderr : process.stdout; try { target.write(`${JSON.stringify(entry, (_key, value) => typeof value === 'bigint' ? value.toString() : value)}\n`); } catch { target.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', message: 'Logger serialization failed' })}\n`); }
  }
}
