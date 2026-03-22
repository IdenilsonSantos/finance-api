import { Injectable, BadRequestException } from '@nestjs/common';

export interface OFXTransaction {
  fitId: string;
  date: string;
  amountInCents: number;
  type: 'income' | 'expense';
  description: string;
}

export interface OFXAccountInfo {
  name: string | null;
  type: 'checking' | 'savings' | 'investment' | 'cash';
}

export interface OFXParseResult {
  transactions: OFXTransaction[];
  accountInfo: OFXAccountInfo | null;
}

@Injectable()
export class OFXParserService {
  parse(buffer: Buffer): OFXParseResult {
    const content = this.decodeBuffer(buffer);
    const transactions = this.extractTransactions(content);

    if (transactions.length === 0 && !/<OFX>/i.test(content)) {
      throw new BadRequestException('Arquivo inválido. Envie um arquivo OFX válido.');
    }

    return { transactions, accountInfo: this.extractAccountInfo(content) };
  }

  private decodeBuffer(buffer: Buffer): string {
    // Detecta encoding pelo header OFX (primeiros 500 bytes em ASCII)
    const preview = buffer.toString('ascii', 0, Math.min(500, buffer.length));
    if (/ENCODING:UTF-8/i.test(preview)) {
      return buffer.toString('utf8');
    }
    // Windows-1252 / Latin-1 é o padrão dos bancos brasileiros
    return buffer.toString('latin1');
  }

  private extractTransactions(content: string): OFXTransaction[] {
    // Suporte a OFX SGML (sem closing tags em leaf elements) e OFX XML
    const blocks = content.split(/<STMTTRN>/gi);
    blocks.shift(); // remove conteúdo antes do primeiro bloco

    return blocks
      .map((block) => {
        const body = block.split(/<\/STMTTRN>/i)[0];
        return this.parseBlock(body);
      })
      .filter((t): t is OFXTransaction => t !== null);
  }

  private parseBlock(block: string): OFXTransaction | null {
    const fitId = this.extractTag(block, 'FITID');
    const dateStr = this.extractTag(block, 'DTPOSTED');
    const amountStr = this.extractTag(block, 'TRNAMT');
    const memo = this.extractTag(block, 'MEMO') ?? '';
    const name = this.extractTag(block, 'NAME') ?? '';

    if (!fitId || !dateStr || !amountStr) return null;

    // OFX usa vírgula em alguns bancos BR, ponto no padrão
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount)) return null;

    const type: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense';
    const amountInCents = Math.round(Math.abs(amount) * 100);

    const description = memo || name || 'Importado via extrato';

    return {
      fitId,
      date: this.parseDate(dateStr),
      amountInCents,
      type,
      description,
    };
  }

  private extractAccountInfo(content: string): OFXAccountInfo | null {
    const org = this.extractTag(content, 'ORG');
    const acctId = this.extractTag(content, 'ACCTID');
    const acctType = this.extractTag(content, 'ACCTTYPE')?.toUpperCase();

    const typeMap: Record<string, OFXAccountInfo['type']> = {
      CHECKING: 'checking',
      SAVINGS: 'savings',
      MONEYMRKT: 'savings',
      CREDITLINE: 'checking',
    };

    const type: OFXAccountInfo['type'] = typeMap[acctType ?? ''] ?? 'checking';

    let name: string | null = null;
    if (org) {
      name = acctId ? `${org} ****${acctId.slice(-4)}` : org;
    } else if (acctId) {
      name = `Conta ****${acctId.slice(-4)}`;
    }

    if (!name && !acctType) return null;

    return { name, type };
  }

  private extractTag(content: string, tag: string): string | undefined {
    const match = content.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'));
    return match?.[1]?.trim();
  }

  private parseDate(dateStr: string): string {
    const clean = dateStr.replace(/\[.*\]/, '').trim();
    const year = clean.slice(0, 4);
    const month = clean.slice(4, 6);
    const day = clean.slice(6, 8);
    return `${year}-${month}-${day}`;
  }
}
