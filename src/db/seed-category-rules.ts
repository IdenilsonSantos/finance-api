import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

const RULES: { category: string; keywords: string[] }[] = [
  {
    category: 'salary',
    keywords: [
      'salario', 'salário', 'folha', 'holerite', 'remuneracao', 'remuneração',
      'vale', 'adiantamento', 'pagamento de salario',
    ],
  },
  {
    category: 'investment',
    keywords: [
      'aplicacao', 'aplicação', 'resgate', 'investimento', 'rendimento',
      'cdb', 'lci', 'lca', 'tesouro', 'fundo', 'dividendo',
      'juros sobre capital', 'rdb', 'poupança', 'poupanca',
    ],
  },
  {
    category: 'freelance',
    keywords: [
      'freelance', 'honorario', 'honorário', 'servico prestado', 'serviço prestado',
      'autonomo', 'autônomo', 'consultoria', 'recebimento pix',
    ],
  },
  {
    category: 'food',
    keywords: [
      'mercado', 'supermercado', 'hipermercado', 'padaria', 'panificadora',
      'restaurante', 'lanchonete', 'hamburguer', 'pizza', 'sushi',
      'ifood', 'rappi', 'uber eats', 'delivery', 'açougue', 'acougue',
      'hortifruti', 'sacolão', 'sacolao', 'pão de açúcar', 'pao de acucar',
      'carrefour', 'extra', 'walmart', 'atacadao', 'atacadão', 'assaí', 'assai',
      'sonda', 'covabra', 'conveniencia', 'conveniência',
      'snack', 'cafe', 'cafeteria', 'sorveteria', 'doceria', 'confeitaria',
    ],
  },
  {
    category: 'transport',
    keywords: [
      'uber', '99pop', '99 pop', 'cabify', 'taxi', 'táxi', 'mototaxi',
      'combustivel', 'combustível', 'gasolina', 'etanol', 'diesel', 'posto',
      'shell', 'ipiranga', 'br distribuidora', 'ale combustiveis',
      'estacionamento', 'parking', 'pedagio', 'pedágio',
      'metro', 'metrô', 'onibus', 'ônibus', 'bilhete unico', 'bilhete único',
      'passagem', 'latam', 'gol linhas', 'azul', 'decolar',
      'locadora', 'aluguel de carro', 'detran', 'ipva', 'dpvat',
    ],
  },
  {
    category: 'health',
    keywords: [
      'farmacia', 'farmácia', 'drogaria', 'droga', 'ultrafarma', 'pacheco',
      'hospital', 'clinica', 'clínica', 'consultorio', 'consultório',
      'medico', 'médico', 'dentista', 'odonto', 'plano de saude', 'plano de saúde',
      'amil', 'unimed', 'bradesco saude', 'sulamerica', 'exame', 'laboratorio',
      'laboratório', 'fisioterapia', 'academia', 'psicologo', 'psicólogo',
    ],
  },
  {
    category: 'education',
    keywords: [
      'escola', 'colegio', 'colégio', 'faculdade', 'universidade',
      'curso', 'mensalidade', 'matricula', 'matrícula', 'apostila',
      'udemy', 'alura', 'coursera', 'livraria', 'amazon kindle',
      'duolingo', 'estacio', 'estácio', 'anhanguera', 'kroton', 'pearson',
    ],
  },
  {
    category: 'entertainment',
    keywords: [
      'netflix', 'spotify', 'amazon prime', 'disney', 'hbo', 'globoplay',
      'apple tv', 'paramount', 'twitch', 'youtube premium',
      'cinema', 'ingresso', 'teatro', 'show', 'evento',
      'steam', 'playstation', 'xbox', 'nintendo', 'game', 'jogos',
    ],
  },
  {
    category: 'clothing',
    keywords: [
      'vestuario', 'vestuário', 'camiseta', 'sapato', 'tenis', 'tênis',
      'sandalia', 'sandália', 'bolsa', 'renner', 'c&a', 'riachuelo',
      'marisa', 'hering', 'zara', 'forever 21', 'nike', 'adidas',
      'puma', 'shein', 'dafiti',
    ],
  },
  {
    category: 'housing',
    keywords: [
      'aluguel', 'condominio', 'condomínio', 'iptu',
      'financiamento imovel', 'financiamento imóvel',
      'caixa economica', 'caixa econômica',
      'habitacao', 'habitação', 'credito imobiliario', 'crédito imobiliário',
    ],
  },
  {
    category: 'utilities',
    keywords: [
      'energia', 'eletricidade', 'cpfl', 'enel', 'cemig', 'elektro',
      'sabesp', 'cedae', 'sanepar', 'embasa',
      'comgas', 'comgás',
      'internet', 'telefone', 'celular', 'telefonia',
      'tim', 'claro', 'vivo', 'nextel',
      'seguro', 'porto seguro', 'bradesco seguros',
    ],
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  const rows = RULES.flatMap(({ category, keywords }) =>
    keywords.map((keyword) => ({ category, keyword })),
  );

  await db.insert(schema.categoryRule).values(rows).onConflictDoNothing();

  console.log(`Inserted ${rows.length} category rules.`);
  await pool.end();
}

main().catch(console.error);
