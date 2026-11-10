import { Injectable, Logger } from '@nestjs/common';
import dns from 'node:dns/promises';

export interface DnsVerificationResult {
  verified: boolean;
  expectedCname: string;
  expectedIp?: string;
  detectedCnames?: string[];
  detectedIps?: string[];
  error?: string;
}

@Injectable()
export class DnsService {
  private readonly logger = new Logger(DnsService.name);

  async resolveCname(domain: string): Promise<string[]> {
    try {
      return await dns.resolveCname(domain);
    } catch (error) {
      this.logger.debug(
        `No se pudo resolver CNAME para ${domain}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async resolve4(domain: string): Promise<string[]> {
    try {
      return await dns.resolve4(domain);
    } catch (error) {
      this.logger.debug(
        `No se pudo resolver registro A (IPv4) para ${domain}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  async verify(
    domain: string,
    expectedCname: string,
    expectedIp?: string,
  ): Promise<DnsVerificationResult> {
    const normalizedDomain = domain.trim().toLowerCase();
    const normalizedExpectedCname = expectedCname
      .trim()
      .toLowerCase()
      .replace(/\.$/, '');

    // En entornos de testing o dominios locales, simular verificación exitosa
    if (
      process.env.NODE_ENV === 'test' ||
      normalizedDomain.endsWith('.local') ||
      normalizedDomain.endsWith('.test') ||
      normalizedDomain === 'localhost'
    ) {
      return {
        verified: true,
        expectedCname: normalizedExpectedCname,
        expectedIp,
      };
    }

    const detectedCnames = await this.resolveCname(normalizedDomain);
    const hasValidCname = detectedCnames.some(
      (c) => c.toLowerCase().replace(/\.$/, '') === normalizedExpectedCname,
    );

    if (hasValidCname) {
      return {
        verified: true,
        expectedCname: normalizedExpectedCname,
        expectedIp,
        detectedCnames,
      };
    }

    const detectedIps = await this.resolve4(normalizedDomain);
    if (expectedIp && detectedIps.includes(expectedIp)) {
      return {
        verified: true,
        expectedCname: normalizedExpectedCname,
        expectedIp,
        detectedIps,
      };
    }

    return {
      verified: false,
      expectedCname: normalizedExpectedCname,
      expectedIp,
      detectedCnames,
      detectedIps,
      error: `Verificación fallida: no se encontró registro CNAME apuntando a "${normalizedExpectedCname}"${
        expectedIp ? ` ni registro A apuntando a "${expectedIp}"` : ''
      }.`,
    };
  }
}
