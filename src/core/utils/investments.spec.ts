import { classifyInvestmentMovement } from './investments';

describe('classifyInvestmentMovement', () => {
  describe('aplicações (saída da conta)', () => {
    it.each([
      // Renda fixa e bancos digitais
      'Aplicação RDB',
      'APLICACAO CDB',
      'APL APLIC AUT MAIS',
      'Aplic. CDB DI Liquidez Diária',
      'Dinheiro guardado na caixinha',
      'Transferência para poupança',
      'Compra Tesouro Selic 2029',
      'TESOURO DIRETO IPCA+ 2035',
      'Aplicação LCI 90 dias',
      'Compra de debêntures',
      // Renda variável e fundos
      'Compra de ações PETR4',
      'Aporte FII HGLG11',
      'Compra ETF BOVA11',
      'Aplicação fundo de investimento multimercado',
      'Aplicação em fundos',
      // Previdência, COE, cripto
      'Contribuição previdência privada VGBL',
      'Aporte PGBL',
      'Aplicação COE',
      'Compra de Bitcoin',
      'Compra cripto - Mercado Bitcoin',
      // Pix/TED para corretoras (o jeito mais comum de investir)
      'Transferência enviada pelo Pix - XP INVESTIMENTOS CCTVM S/A - 02.332.886/0001-04',
      'Transferência enviada pelo Pix - NU INVEST CORRETORA DE VALORES S.A.',
      'TED BTG PACTUAL',
      'Pix enviado - RICO INVESTIMENTOS',
      'Transferência enviada pelo Pix - CLEAR CORRETORA - GRUPO XP',
      'Pix enviado BINANCE',
      'Transferência - INTER DTVM LTDA',
      'Pix - GENIAL INVESTIMENTOS CVM S.A.',
      'Pix - AVENUE SECURITIES',
    ])('%s', (description) => {
      expect(classifyInvestmentMovement(description, 'expense')).toBe(
        'deposit',
      );
    });
  });

  describe('resgates (entrada na conta)', () => {
    it.each([
      'Resgate RDB',
      'RESGATE CDB',
      'RES APLIC AUT MAIS',
      'Resgate da caixinha',
      'Venda Tesouro Selic',
      'Resgate fundo de investimento',
      'Resgate previdência',
      'Transferência recebida pelo Pix - XP INVESTIMENTOS CCTVM S/A',
      'TED recebida - BTG PACTUAL',
      'Pix recebido - BINANCE',
    ])('%s', (description) => {
      expect(classifyInvestmentMovement(description, 'income')).toBe(
        'withdrawal',
      );
    });
  });

  describe('não são movimentação de investimento', () => {
    it.each([
      // Rendimentos são receita de verdade
      ['Rendimento RDB', 'income'],
      ['Rendimentos poupança', 'income'],
      ['Juros sobre capital próprio', 'income'],
      ['Dividendos ITSA4', 'income'],
      ['Proventos FII HGLG11', 'income'],
      // Falsos positivos que precisam ser evitados
      ['Supermercado Rico', 'expense'],
      ['Transferência enviada pelo Pix - RICARDO ALVES', 'expense'],
      ['Pagamento Fundo Municipal de Saúde', 'expense'],
      ['Restaurante Avenida', 'expense'],
      ['Pagamento de fatura', 'expense'],
      ['Compra no débito - SUPERMERCADO KI BARATA', 'expense'],
      ['Pix recebido Maria', 'income'],
      ['Estorno compra loja', 'income'],
      ['Venda de produto no Mercado Livre', 'income'],
      ['Netflix', 'expense'],
      ['', 'expense'],
    ] as const)('%s (%s)', (description, type) => {
      expect(classifyInvestmentMovement(description, type)).toBeNull();
    });
  });
});
