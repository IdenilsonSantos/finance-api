import { OFXParserService } from './ofx-parser.service';

function ofx(body: string): Buffer {
  return Buffer.from(
    `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:UTF-8\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX>${body}</OFX>`,
    'utf8',
  );
}

const STATEMENT_WITH_PERIOD_AND_BALANCE = ofx(`
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKACCTFROM>
<BANKID>001</BANKID>
<ACCTID>12345-6</ACCTID>
<ACCTTYPE>CHECKING</ACCTTYPE>
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801000000
<DTEND>20260831235959
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260805
<TRNAMT>1000.00
<FITID>TX1
<MEMO>Salário
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260810
<TRNAMT>-410.00
<FITID>TX2
<MEMO>Aluguel
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>600.00
<DTASOF>20260831235959
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
`);

describe('OFXParserService', () => {
  let service: OFXParserService;

  beforeEach(() => {
    service = new OFXParserService();
  });

  it('extrai as transações do extrato', () => {
    const { transactions } = service.parse(STATEMENT_WITH_PERIOD_AND_BALANCE);

    expect(transactions).toHaveLength(2);
    expect(transactions[0]).toMatchObject({
      fitId: 'TX1',
      date: '2026-08-05',
      amountInCents: 100000,
      type: 'income',
    });
    expect(transactions[1]).toMatchObject({
      fitId: 'TX2',
      date: '2026-08-10',
      amountInCents: 41000,
      type: 'expense',
    });
  });

  it('extrai o período (DTSTART/DTEND) do BANKTRANLIST', () => {
    const { period } = service.parse(STATEMENT_WITH_PERIOD_AND_BALANCE);

    expect(period).toEqual({ start: '2026-08-01', end: '2026-08-31' });
  });

  it('extrai o saldo final (LEDGERBAL) sem confundi-lo com uma transação', () => {
    const { ledgerBalance, transactions } = service.parse(
      STATEMENT_WITH_PERIOD_AND_BALANCE,
    );

    expect(ledgerBalance).toEqual({
      amountInCents: 60000,
      asOf: '2026-08-31',
    });
    // O saldo não deve aparecer como uma transação importável
    expect(transactions.some((t) => t.amountInCents === 60000)).toBe(false);
  });

  it('retorna period e ledgerBalance nulos quando o extrato não os informa', () => {
    const minimal = ofx(`
<BANKTRANLIST>
<STMTTRN>
<DTPOSTED>20260805
<TRNAMT>100.00
<FITID>TX1
</STMTTRN>
</BANKTRANLIST>
`);

    const { period, ledgerBalance } = service.parse(minimal);

    expect(period).toBeNull();
    expect(ledgerBalance).toBeNull();
  });
});
