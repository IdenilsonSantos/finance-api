import { StatementImportService } from './statement-import.service';
import { OFXParserService } from './ofx-parser.service';
import { NotFoundException } from '@nestjs/common';

function ofx(body: string): Buffer {
  return Buffer.from(
    `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:UTF-8\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS>${body}</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`,
    'utf8',
  );
}

function statement(opts: {
  start: string;
  end: string;
  ledgerBalance?: string;
  ledgerAsOf?: string;
  transactions: { fitId: string; date: string; amount: string; memo: string }[];
}): Buffer {
  const trns = opts.transactions
    .map(
      (t) => `
<STMTTRN>
<DTPOSTED>${t.date}
<TRNAMT>${t.amount}
<FITID>${t.fitId}
<MEMO>${t.memo}
</STMTTRN>`,
    )
    .join('');

  const ledger =
    opts.ledgerBalance !== undefined
      ? `
<LEDGERBAL>
<BALAMT>${opts.ledgerBalance}
<DTASOF>${opts.ledgerAsOf}
</LEDGERBAL>`
      : '';

  return ofx(`
<BANKTRANLIST>
<DTSTART>${opts.start}
<DTEND>${opts.end}
${trns}
</BANKTRANLIST>${ledger}`);
}

/** Cria um mock mínimo do NodePgDatabase para as consultas feitas diretamente pelo service. */
function createDbMock(selectResults: unknown[][] = []) {
  let call = 0;
  const db: any = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => {
          const limit = jest.fn(() => Promise.resolve(selectResults[call++] ?? []));
          // Suporta tanto .where().limit() quanto .where().orderBy().limit()
          return { limit, orderBy: jest.fn(() => ({ limit })) };
        }),
      })),
    })),
    insert: jest.fn(() => ({ values: jest.fn().mockResolvedValue(undefined) })),
    transaction: jest.fn(async (cb: (trx: any) => Promise<void>) => cb(db)),
  };
  return db;
}

describe('StatementImportService', () => {
  const workspaceId = 'ws-1';
  const bankAccountId = 'acc-1';

  let bankAccountRepository: any;
  let transactionRepository: any;
  let categoryInference: any;
  let db: any;
  let service: StatementImportService;

  beforeEach(() => {
    bankAccountRepository = {
      findById: jest.fn().mockResolvedValue({
        id: bankAccountId,
        workspaceId,
        name: 'Conta Corrente',
        type: 'checking',
        balance: 0,
      }),
      create: jest.fn(),
      update: jest.fn(),
      updateBalance: jest.fn().mockResolvedValue({}),
      advanceBalanceAsOf: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };

    transactionRepository = {
      findById: jest.fn(),
      findAllByWorkspace: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn(),
      delete: jest.fn(),
      countByWorkspaceAndMonth: jest.fn().mockResolvedValue(0),
      findExternalIdsByBankAccount: jest.fn().mockResolvedValue([]),
      findByBankAccountInDateRange: jest.fn().mockResolvedValue([]),
      sumBalanceByBankAccountUpToDate: jest.fn().mockResolvedValue(0),
      findEarliestDateByBankAccount: jest.fn().mockResolvedValue(null),
    };

    categoryInference = { infer: jest.fn().mockReturnValue('other') };
    db = createDbMock([[]]); // primeira query = checagem de fileHash já importado

    service = new StatementImportService(
      new OFXParserService(),
      categoryInference,
      bankAccountRepository,
      transactionRepository,
      db,
    );
  });

  it('lança NotFoundException quando a conta informada não existe', async () => {
    bankAccountRepository.findById.mockResolvedValue(null);
    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      transactions: [{ fitId: 'TX1', date: '20260805', amount: '100.00', memo: 'x' }],
    });

    await expect(service.importOFX(bankAccountId, workspaceId, file)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('não conta novamente uma transação já existente com o mesmo FITID', async () => {
    transactionRepository.findExternalIdsByBankAccount.mockResolvedValue(['TX1']);
    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      transactions: [
        { fitId: 'TX1', date: '20260805', amount: '1000.00', memo: 'Salário' },
        { fitId: 'TX2', date: '20260810', amount: '-410.00', memo: 'Aluguel' },
      ],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file);

    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'TX2' }),
      db,
    );
  });

  it('detecta duplicidade por (data, valor, tipo) quando o FITID é diferente do já importado', async () => {
    // Mesma movimentação já existe na aplicação (ex: reimportação de período
    // sobreposto em que o banco reemitiu um FITID diferente).
    transactionRepository.findByBankAccountInDateRange.mockResolvedValue([
      { date: '2026-08-05', amount: 100000, type: 'income', externalId: 'OLD-ID' },
    ]);
    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      transactions: [
        { fitId: 'NEW-ID', date: '20260805', amount: '1000.00', memo: 'Salário' },
      ],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file);

    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(1);
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(bankAccountRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('aplica a importação quando o saldo recalculado bate com o LEDGERBAL do banco', async () => {
    // Exemplo do relato: saldo anterior R$10 + entradas R$1000 - saídas R$410 = R$600
    bankAccountRepository.findById.mockResolvedValue({
      id: bankAccountId,
      workspaceId,
      name: 'Conta Corrente',
      type: 'checking',
      balance: 1000, // R$10,00 (não usado diretamente na conciliação, ver abaixo)
    });
    transactionRepository.sumBalanceByBankAccountUpToDate.mockResolvedValue(1000); // R$10,00

    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      ledgerBalance: '600.00',
      ledgerAsOf: '20260831235959',
      transactions: [
        { fitId: 'TX1', date: '20260805', amount: '1000.00', memo: 'Salário' },
        { fitId: 'TX2', date: '20260810', amount: '-410.00', memo: 'Aluguel' },
      ],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file);

    expect(result.reconciled).toBe(true);
    expect(result.calculatedBalance).toBe(60000);
    expect(result.bankBalance).toBe(60000);
    expect(result.divergence).toBe(0);
    expect(result.imported).toBe(2);
    expect(bankAccountRepository.updateBalance).toHaveBeenCalledWith(
      bankAccountId,
      59000,
      db,
    );
  });

  it('bloqueia a importação e não altera nada quando o saldo recalculado diverge do LEDGERBAL', async () => {
    // Saldo já registrado de R$200, extrato diz R$600, mas as transações não sustentam isso.
    transactionRepository.sumBalanceByBankAccountUpToDate.mockResolvedValue(20000); // R$200,00

    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      ledgerBalance: '600.00',
      ledgerAsOf: '20260831235959',
      transactions: [
        { fitId: 'TX1', date: '20260805', amount: '200.00', memo: 'Entrada parcial' },
      ],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file);

    expect(result.reconciled).toBe(false);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.calculatedBalance).toBe(40000); // 20000 + 20000, nunca 20000+60000
    expect(result.bankBalance).toBe(60000);
    expect(result.divergence).toBe(-20000);
    expect(result.imported).toBe(0);

    // Nada deve ter sido persistido
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(bankAccountRepository.updateBalance).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('permite confirmar a importação mesmo com divergência quando force=true', async () => {
    transactionRepository.sumBalanceByBankAccountUpToDate.mockResolvedValue(20000);
    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      ledgerBalance: '600.00',
      ledgerAsOf: '20260831235959',
      transactions: [
        { fitId: 'TX1', date: '20260805', amount: '200.00', memo: 'Entrada parcial' },
      ],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file, undefined, true);

    expect(result.reconciled).toBe(false);
    expect(result.imported).toBe(1);
    expect(transactionRepository.create).toHaveBeenCalledTimes(1);
    expect(bankAccountRepository.updateBalance).toHaveBeenCalledWith(
      bankAccountId,
      20000,
      db,
    );
  });

  it('é idempotente: reimportar o mesmo arquivo não altera o saldo novamente', async () => {
    const importedAt = new Date('2026-08-01T00:00:00Z');
    db = createDbMock([[{ id: 'imp-1', createdAt: importedAt }]]);
    service = new StatementImportService(
      new OFXParserService(),
      categoryInference,
      bankAccountRepository,
      transactionRepository,
      db,
    );

    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      transactions: [{ fitId: 'TX1', date: '20260805', amount: '100.00', memo: 'x' }],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file);

    expect(result.alreadyImported).toBe(true);
    expect(result.previousImportAt).toBe(importedAt.toISOString());
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(bankAccountRepository.updateBalance).not.toHaveBeenCalled();
  });

  it('avisa sobre ajustes de conciliação possivelmente redundantes ao importar um extrato retroativo', async () => {
    // Setembro foi importado primeiro e recebeu um ajuste; agosto (período
    // anterior) chega depois e pode explicar o mesmo saldo às cegas.
    transactionRepository.findEarliestDateByBankAccount.mockResolvedValue('2026-09-01');
    transactionRepository.findByBankAccountInDateRange.mockImplementation(
      (_accountId: string, start: string, end: string) => {
        if (start === '2026-08-01' && end === '2026-08-31') return Promise.resolve([]);
        if (start === '2026-08-31' && end === '2026-09-11') {
          return Promise.resolve([
            {
              id: 'adj-1',
              date: '2026-09-11',
              amount: 1569,
              type: 'income',
              category: 'adjustment',
              description: 'Ajuste de conciliação (diferença com o extrato bancário)',
            },
          ]);
        }
        return Promise.resolve([]);
      },
    );
    // fileHash check (vazio) + consulta do próximo statementImport já registrado
    db = createDbMock([[], [{ periodEnd: '2026-09-11' }]]);
    service = new StatementImportService(
      new OFXParserService(),
      categoryInference,
      bankAccountRepository,
      transactionRepository,
      db,
    );

    const file = statement({
      start: '20260801000000',
      end: '20260831235959',
      transactions: [
        { fitId: 'AGO1', date: '20260805', amount: '15.43', memo: 'Movimentação de agosto' },
      ],
    });

    const result = await service.importOFX(bankAccountId, workspaceId, file);

    expect(result.possibleRedundantAdjustments).toEqual([
      expect.objectContaining({ id: 'adj-1', amount: 1569, type: 'income' }),
    ]);
  });
});
