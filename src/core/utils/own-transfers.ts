function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const TRANSFER_WORDS = /\b(pix|ted|doc|transferencia|transf|tef)\b/;
const NAME_PARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

function words(text: string): string[] {
  return normalize(text).split(/[^a-z]+/).filter(Boolean);
}

/**
 * Pix/TED/transferência para ou de uma pessoa do próprio workspace: exige o
 * primeiro nome e ao menos um sobrenome dela na descrição (um parente com o
 * mesmo sobrenome, mas outro nome, não conta).
 */
export function isOwnTransfer(description: string | null | undefined, memberNames: (string | null)[]): boolean {
  if (!description) return false;
  const d = normalize(description);
  if (!TRANSFER_WORDS.test(d)) return false;
  const present = new Set(words(d));

  return memberNames.some((name) => {
    if (!name) return false;
    const parts = words(name).filter((w) => !NAME_PARTICLES.has(w) && w.length >= 2);
    if (parts.length < 2) return false;
    const [first, ...surnames] = parts;
    return present.has(first) && surnames.some((s) => present.has(s));
  });
}
