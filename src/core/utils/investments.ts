/**
 * Reconhece, pela descrição do extrato, aplicações e resgates de
 * investimentos: renda fixa (CDB, RDB, LCI/LCA, Tesouro, debêntures,
 * poupança, caixinhas), renda variável (ações, FIIs, ETFs, BDRs), fundos,
 * previdência, COE, criptomoedas e Pix/TED para corretoras. Esses movimentos
 * não são despesa nem receita: o dinheiro só muda de lugar. Rendimentos,
 * juros, dividendos e proventos NÃO entram aqui — são receita de verdade.
 */
export type InvestmentMovement = 'deposit' | 'withdrawal';

/** Ganhos: continuam como receita. */
const YIELD =
  /\b(rendimentos?|rend\.?|juros|dividendos?|jcp|proventos?|remuneracao|cashback)\b/;

const WITHDRAWAL = /\b(resgate|resgatado|resg|retirada|resgatar|venda)\b/;

/** Produtos de investimento citados na descrição. */
const PRODUCT = new RegExp(
  '\\b(' +
    [
      // renda fixa
      'cdb',
      'rdb',
      'lci',
      'lca',
      'lig',
      'cri',
      'cra',
      'debentures?',
      'tesouro',
      'renda fixa',
      'poupanca',
      'caixinhas?',
      'cofrinhos?',
      'porquinhos?',
      // renda variável e fundos
      'acoes',
      'fiis?',
      'fiagro',
      'etfs?',
      'bdrs?',
      'renda variavel',
      'fundos? de investimentos?',
      'fundos? (?:di|multimercado|imobiliarios?|de acoes)',
      'aplicacao em fundos?',
      // previdência, COE, cripto
      'previdencia',
      'pgbl',
      'vgbl',
      'coe',
      'cripto(?:moedas?|ativos?)?',
      'bitcoin',
      'btc',
      'ethereum',
      'usdt',
    ].join('|') +
    ')\\b',
);

/**
 * Corretoras/plataformas de investimento: um Pix/TED para elas é aplicação,
 * e vindo delas é resgate. Nomes ambíguos (Rico, Clear, Modal, Genial, Toro,
 * Avenue, Warren) só contam junto do complemento do nome da empresa.
 */
const BROKER = new RegExp(
  '\\b(' +
    [
      'cctvm',
      'dtvm',
      'corretora de (?:titulos|valores|cambio)',
      'distribuidora de titulos',
      'xp investimentos',
      'nu ?invest',
      'easynvest',
      'btg pactual',
      'rico (?:investimentos|corretora)',
      'clear (?:corretora|ctvm)',
      'banco modal',
      'modalmais',
      'genial investimentos',
      'toro (?:investimentos|corretora)',
      'avenue securities',
      'warren (?:investimentos|brasil|corretora)',
      'orama',
      'agora investimentos',
      'inter invest',
      'c6 invest',
      'itau corretora',
      'bradesco corretora',
      'binance',
      'mercado bitcoin',
      'foxbit',
      'novadax',
      'bitpreco',
    ].join('|') +
    ')\\b',
);

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function classifyInvestmentMovement(
  description: string | null | undefined,
  type: 'income' | 'expense',
): InvestmentMovement | null {
  if (!description) return null;
  const d = normalize(description);
  if (YIELD.test(d)) return null;

  const investment = PRODUCT.test(d) || BROKER.test(d);

  if (type === 'expense') {
    if (WITHDRAWAL.test(d) && !BROKER.test(d)) return null;
    // "aplicação" sozinha já basta; "compra"/"contribuição" só com produto.
    if (investment) return 'deposit';
    return /\b(aplicacao|aplic|aplicado|aporte)\b/.test(d) ? 'deposit' : null;
  }

  // Entrada: resgate/venda de produto, dinheiro vindo de corretora, ou
  // estorno de aplicação automática (ex.: Itaú "RES APLIC AUT MAIS").
  if (investment) return 'withdrawal';
  // "Venda" sozinha não basta (venda de produto é receita comum).
  return /\b(resgate|resgatado|resg|resgatar|aplicacao|aplic|aplicado)\b/.test(
    d,
  )
    ? 'withdrawal'
    : null;
}
