import { isOwnTransfer } from './own-transfers';

const members = ['Idenilson Santos de Oliveira', 'Maria Souza'];

describe('isOwnTransfer', () => {
  it.each([
    'Transferência enviada pelo Pix - IDENILSON SANTOS DE OLIVEIRA - •••.542.329-•• - ITAÚ UNIBANCO S.A. (0341)',
    'Transferência recebida pelo Pix via Open Banking - IDENILSON SANTOS DE OLIVEIRA - PICPAY (0380)',
    'TED enviada Idenilson Oliveira',
    'PIX RECEBIDO MARIA SOUZA',
  ])('%s', (d) => expect(isOwnTransfer(d, members)).toBe(true));

  it.each([
    'Transferência enviada pelo Pix - IVETE DE LIMA - BRADESCO',
    'Transferência enviada pelo Pix - JOSE SANTOS DE OLIVEIRA', // parente: mesmo sobrenome, outro nome
    'Compra IDENILSON SANTOS LTDA', // não é transferência
    'Pix enviado - IDENILSON', // só o primeiro nome
  ])('não: %s', (d) => expect(isOwnTransfer(d, members)).toBe(false));

  it('sem nomes de membros, nunca', () => {
    expect(isOwnTransfer('Pix enviado - IDENILSON SANTOS', [null])).toBe(false);
  });
});
