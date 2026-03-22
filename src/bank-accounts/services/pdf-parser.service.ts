import { Injectable, BadRequestException } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { OFXTransaction } from './ofx-parser.service';

interface BankParser {
  name: string;
  detect: (text: string) => boolean;
  parse: (text: string) => OFXTransaction[];
}

function parseAmountBR(raw: string): number | null {
  const clean = raw.replace(/\./g, '').replace(',', '.').replace(/\s/g, '');
  const val = parseFloat(clean);
  return isNaN(val) ? null : val;
}

function parseDateBR(raw: string): string | null {
  const match = raw.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (!match) return null;
  const [, d, m, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${m}-${d}`;
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const PARSERS: BankParser[] = [
  {
    name: 'Nubank',
    detect: (t) => /nubank/i.test(t),
    parse: (text) => {
      const results: OFXTransaction[] = [];
      // Nubank fatura: "15 MAR  Descrição  150,00"
      const months: Record<string, string> = {
        JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06',
        JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12',
      };
      const yearMatch = text.match(/(\d{4})/);
      const year = yearMatch?.[1] ?? new Date().getFullYear().toString();

      const re = /(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(.+?)\s+([\d.,]+)\s*$/gim;
      for (const m of text.matchAll(re)) {
        const [, day, mon, desc, amtRaw] = m;
        const month = months[mon.toUpperCase()];
        if (!month) continue;
        const amount = parseAmountBR(amtRaw);
        if (!amount) continue;
        results.push({
          fitId: uid(),
          date: `${year}-${month}-${day.padStart(2, '0')}`,
          amountInCents: Math.round(amount * 100),
          type: 'expense',
          description: desc.trim(),
        });
      }
      return results;
    },
  },
  {
    name: 'Itaú',
    detect: (t) => /ita[uú]/i.test(t) && /extrato|fatura/i.test(t),
    parse: (text) => {
      const results: OFXTransaction[] = [];
      // Itaú extrato: "15/03/2024  Descrição  -150,00" ou "+150,00"
      const re = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([+-]?[\d.]+,\d{2})\s*$/gim;
      for (const m of text.matchAll(re)) {
        const [, dateRaw, desc, amtRaw] = m;
        const date = parseDateBR(dateRaw);
        if (!date) continue;
        const amount = parseAmountBR(amtRaw.replace(/^[+-]/, ''));
        if (!amount) continue;
        const type = amtRaw.startsWith('+') || !amtRaw.startsWith('-') ? 'income' : 'expense';
        results.push({
          fitId: uid(),
          date,
          amountInCents: Math.round(amount * 100),
          type,
          description: desc.trim(),
        });
      }
      return results;
    },
  },
  {
    name: 'Bradesco',
    detect: (t) => /bradesco/i.test(t),
    parse: (text) => {
      const results: OFXTransaction[] = [];
      const re = /(\d{2}\/\d{2})\s+(.+?)\s+([\d.]+,\d{2})\s+(C|D)\b/gim;
      const yearMatch = text.match(/(\d{4})/);
      const year = yearMatch?.[1] ?? new Date().getFullYear().toString();
      for (const m of text.matchAll(re)) {
        const [, dateRaw, desc, amtRaw, cd] = m;
        const date = parseDateBR(`${dateRaw}/${year}`);
        if (!date) continue;
        const amount = parseAmountBR(amtRaw);
        if (!amount) continue;
        results.push({
          fitId: uid(),
          date,
          amountInCents: Math.round(amount * 100),
          type: cd.toUpperCase() === 'C' ? 'income' : 'expense',
          description: desc.trim(),
        });
      }
      return results;
    },
  },
  {
    name: 'Banco do Brasil',
    detect: (t) => /banco do brasil|bb\.com\.br/i.test(t),
    parse: (text) => {
      const results: OFXTransaction[] = [];
      const re = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([+-]?[\d.]+,\d{2})/gim;
      for (const m of text.matchAll(re)) {
        const [, dateRaw, desc, amtRaw] = m;
        const date = parseDateBR(dateRaw);
        if (!date) continue;
        const amount = parseAmountBR(amtRaw.replace(/^[+-]/, ''));
        if (!amount) continue;
        const type = amtRaw.startsWith('-') ? 'expense' : 'income';
        results.push({
          fitId: uid(),
          date,
          amountInCents: Math.round(amount * 100),
          type,
          description: desc.trim(),
        });
      }
      return results;
    },
  },
  {
    name: 'Santander',
    detect: (t) => /santander/i.test(t),
    parse: (text) => {
      const results: OFXTransaction[] = [];
      const re = /(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d.]+,\d{2})\s+(Cr[eé]dito|D[eé]bito)/gim;
      for (const m of text.matchAll(re)) {
        const [, dateRaw, desc, amtRaw, tipo] = m;
        const date = parseDateBR(dateRaw);
        if (!date) continue;
        const amount = parseAmountBR(amtRaw);
        if (!amount) continue;
        results.push({
          fitId: uid(),
          date,
          amountInCents: Math.round(amount * 100),
          type: /cr[eé]dito/i.test(tipo) ? 'income' : 'expense',
          description: desc.trim(),
        });
      }
      return results;
    },
  },
];

const GENERIC_PARSER: BankParser = {
  name: 'Genérico',
  detect: () => true,
  parse: (text) => {
    const results: OFXTransaction[] = [];
    // Tenta padrão: data (dd/mm/aaaa ou dd/mm/aa) + texto + valor BR
    const re = /(\d{2}\/\d{2}\/\d{2,4})\s+(.+?)\s+([+-]?[\d.]+,\d{2})\s*$/gim;
    for (const m of text.matchAll(re)) {
      const [, dateRaw, desc, amtRaw] = m;
      const date = parseDateBR(dateRaw);
      if (!date) continue;
      const amount = parseAmountBR(amtRaw.replace(/^[+-]/, ''));
      if (!amount || amount > 1_000_000) continue;
      const type = amtRaw.startsWith('-') ? 'expense' : 'income';
      results.push({
        fitId: uid(),
        date,
        amountInCents: Math.round(amount * 100),
        type,
        description: desc.trim(),
      });
    }
    return results;
  },
};

@Injectable()
export class PDFParserService {
  async parse(buffer: Buffer): Promise<{ transactions: OFXTransaction[]; bankName: string }> {
    let text: string;

    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      text = result.text;
    } catch (err) {
      console.error('[PDFParser] Error reading PDF:', err);
      throw new BadRequestException('Não foi possível ler o PDF. Verifique se o arquivo não está protegido por senha.');
    }

    if (!text?.trim()) {
      throw new BadRequestException('O PDF não contém texto legível. PDFs escaneados (imagem) não são suportados.');
    }

    const parser = PARSERS.find((p) => p.detect(text)) ?? GENERIC_PARSER;
    const transactions = parser.parse(text);

    if (transactions.length === 0) {
      throw new BadRequestException(
        `Não foi possível identificar transações no PDF${parser.name !== 'Genérico' ? ` do ${parser.name}` : ''}. ` +
        `Verifique se é um extrato bancário válido ou tente exportar no formato OFX.`,
      );
    }

    return { transactions, bankName: parser.name };
  }
}
