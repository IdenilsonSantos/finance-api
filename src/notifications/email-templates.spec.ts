import { goalCompletedTemplate, transferCreatedTemplate, workspaceInviteTemplate } from './email-templates';

describe('email templates', () => {
  const evil = '<img src=x onerror=alert(1)>';

  it('escapam textos informados pelo usuário', () => {
    const htmls = [
      goalCompletedTemplate({ goalName: evil, targetAmount: 'R$ 10,00' }),
      transferCreatedTemplate({ fromAccount: evil, toAccount: 'B', amount: 'R$ 1,00', date: '01/01/2024' }),
      workspaceInviteTemplate({ inviterName: evil, workspaceName: evil, acceptUrl: 'https://x' }),
    ];
    for (const html of htmls) {
      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    }
  });
});
