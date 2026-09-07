const BASE_URL = process.env.APP_URL ?? 'https://financeapp.com';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />

  <title>Contaê</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background-color:#F4F5F7;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color:#252832;
  "
>

  <!-- Fundo -->
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    style="
      width:100%;
      background-color:#F4F5F7;
    "
  >
    <tr>
      <td
        align="center"
        style="
          padding:48px 16px;
        "
      >

        <!-- Container principal -->
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            width:100%;
            max-width:580px;
          "
        >

          <!-- ========================================= -->
          <!-- HEADER                                    -->
          <!-- ========================================= -->

          <tr>
            <td
              align="center"
              style="
                background-color:#868A94;
                padding:30px 40px;
                border-radius:14px 14px 0 0;
              "
            >

              <div
                style="
                  font-size:21px;
                  line-height:28px;
                  font-weight:700;
                  letter-spacing:-0.5px;
                  color:#FFFFFF;
                "
              >
                Finance App
              </div>

            </td>
          </tr>


          <!-- ========================================= -->
          <!-- CONTEÚDO                                  -->
          <!-- ========================================= -->

          <tr>
            <td
              style="
                background-color:#FFFFFF;
                padding:42px 44px 36px;
                border-radius:0 0 14px 14px;
              "
            >

              <!--
                ==================================================
                CONTEÚDO DINÂMICO
                ==================================================

                O conteúdo específico da notificação será
                inserido aqui através da variável ${content}.
              -->

              ${content}


              <!-- ========================================= -->
              <!-- DIVISÓRIA                                  -->
              <!-- ========================================= -->

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  margin-top:36px;
                "
              >
                <tr>
                  <td
                    style="
                      border-top:1px solid #E5E7EB;
                      font-size:0;
                      line-height:0;
                    "
                  >
                    &nbsp;
                  </td>
                </tr>
              </table>


              <!-- ========================================= -->
              <!-- RODAPÉ                                    -->
              <!-- ========================================= -->

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  width:100%;
                  margin-top:24px;
                "
              >
                <tr>
                  <td
                    align="center"
                    style="
                      font-size:12px;
                      line-height:19px;
                      color:#9CA3AF;
                    "
                  >

                    Você recebeu este e-mail porque possui
                    notificações ativadas no Finance App.

                    <br />

                    <a
                      href="${BASE_URL}/settings"
                      style="
                        color:#6B7280;
                        text-decoration:underline;
                        font-weight:500;
                      "
                    >
                      Gerenciar preferências
                    </a>

                  </td>
                </tr>
              </table>

            </td>
          </tr>


          <!-- ========================================= -->
          <!-- ASSINATURA                                 -->
          <!-- ========================================= -->

          <tr>
            <td
              align="center"
              style="
                padding:22px 20px 0;
                font-size:11px;
                line-height:18px;
                color:#AEB3BC;
              "
            >
              Finance App
            </td>
          </tr>


        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

function badge(color: string, bg: string, icon: string, text: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:6px;background-color:${bg};color:${color};font-size:11px;font-weight:600;padding:4px 10px;border-radius:99px;text-transform:uppercase;letter-spacing:0.5px;">
    ${icon}&nbsp;${text}
  </span>`;
}

function heading(text: string): string {
  return `<h1 style="margin:16px 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.4px;">${text}</h1>`;
}

function subtext(text: string): string {
  return `<p style="margin:0 0 24px;font-size:15px;color:#6B7280;line-height:1.6;">${text}</p>`;
}

function infoCard(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:12px 16px;font-size:13px;color:#6B7280;font-weight:500;width:50%;border-bottom:1px solid #F3F4F6;">${r.label}</td>
        <td style="padding:12px 16px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #F3F4F6;text-align:right;">${r.value}</td>
      </tr>`,
    )
    .join('');

  return `<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9FAFB;border-radius:12px;overflow:hidden;margin-bottom:28px;">
    <tbody>${cells}</tbody>
  </table>`;
}

function ctaButton(text: string, href: string): string {
  return `<div style="text-align:center;margin-top:8px;">
    <a href="${href}" style="display:inline-block;background-color:#1E1E2D;color:#ffffff;font-size:14px;font-weight:600;padding:13px 28px;border-radius:10px;text-decoration:none;letter-spacing:-0.2px;">${text}</a>
  </div>`;
}

export function transferCreatedTemplate(params: {
  fromAccount: string;
  toAccount: string;
  amount: string;
  date: string;
}): string {
  return layout(`
    ${badge('#0369A1', '#E0F2FE', '↔', 'Transferência')}
    ${heading('Transferência realizada')}
    ${subtext(`Uma transferência entre suas contas foi concluída com sucesso.`)}
    ${infoCard([
      { label: 'De', value: params.fromAccount },
      { label: 'Para', value: params.toAccount },
      { label: 'Valor', value: params.amount },
      { label: 'Data', value: params.date },
    ])}
    ${ctaButton('Ver extrato', `${BASE_URL}/transactions`)}
  `);
}

export function scheduledTransactionExecutedTemplate(params: {
  description: string;
  amount: string;
  type: 'income' | 'expense';
  date: string;
}): string {
  const isIncome = params.type === 'income';
  const typeLabel = isIncome ? 'Receita' : 'Despesa';
  const typeColor = isIncome ? '#065F46' : '#991B1B';
  const typeBg = isIncome ? '#D1FAE5' : '#FEE2E2';
  const typeIcon = isIncome ? '↑' : '↓';

  return layout(`
    ${badge(typeColor, typeBg, typeIcon, typeLabel)}
    ${heading('Transação agendada executada')}
    ${subtext(`Sua transação agendada foi processada automaticamente.`)}
    ${infoCard([
      { label: 'Descrição', value: params.description },
      { label: 'Tipo', value: typeLabel },
      { label: 'Valor', value: `<span style="color:${typeColor};font-weight:700;">${isIncome ? '+' : '-'}${params.amount}</span>` },
      { label: 'Data', value: params.date },
    ])}
    ${ctaButton('Ver transações', `${BASE_URL}/transactions`)}
  `);
}

export function goalCompletedTemplate(params: {
  goalName: string;
  targetAmount: string;
}): string {
  return layout(`
    ${badge('#065F46', '#D1FAE5', '🎯', 'Meta atingida')}
    ${heading(`Parabéns! Você atingiu sua meta.`)}
    ${subtext(`Você alcançou o valor alvo da meta <strong style="color:#111827;">${params.goalName}</strong>. Continue assim!`)}
    ${infoCard([
      { label: 'Meta', value: params.goalName },
      { label: 'Valor alcançado', value: `<span style="color:#065F46;font-weight:700;">${params.targetAmount}</span>` },
    ])}
    ${ctaButton('Ver minhas metas', `${BASE_URL}/goals`)}
  `);
}

export function goalDeadlineReminderTemplate(params: {
  goalName: string;
  deadline: string;
  targetAmount: string;
  currentAmount: string;
  percentDone: number;
}): string {
  const remaining = `Faltam ${(100 - params.percentDone).toFixed(0)}% para concluir`;
  const barColor = params.percentDone >= 75 ? '#16A34A' : params.percentDone >= 40 ? '#D97706' : '#DC2626';

  const progressBar = `
    <div style="margin-bottom:28px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;color:#6B7280;font-weight:500;">Progresso</span>
        <span style="font-size:13px;color:#111827;font-weight:700;">${params.percentDone}%</span>
      </div>
      <div style="background-color:#F3F4F6;border-radius:99px;height:8px;overflow:hidden;">
        <div style="background-color:${barColor};height:8px;width:${params.percentDone}%;border-radius:99px;"></div>
      </div>
      <p style="margin:8px 0 0;font-size:12px;color:#9CA3AF;">${remaining}</p>
    </div>`;

  return layout(`
    ${badge('#92400E', '#FEF3C7', '⏰', 'Prazo se aproximando')}
    ${heading(`Sua meta vence em breve`)}
    ${subtext(`A meta <strong style="color:#111827;">${params.goalName}</strong> está próxima do prazo. Confira seu progresso.`)}
    ${progressBar}
    ${infoCard([
      { label: 'Meta', value: params.goalName },
      { label: 'Prazo', value: params.deadline },
      { label: 'Valor alvo', value: params.targetAmount },
      { label: 'Valor atual', value: params.currentAmount },
    ])}
    ${ctaButton('Ver meta', `${BASE_URL}/goals`)}
  `);
}

export function workspaceInviteTemplate(params: {
  inviterName: string;
  workspaceName: string;
  acceptUrl: string;
}): string {
  return layout(`
    ${badge('#4F46E5', '#EEF2FF', '✉', 'Convite')}
    ${heading('Você foi convidado!')}
    ${subtext(`<strong style="color:#111827;">${params.inviterName}</strong> convidou você para colaborar no workspace <strong style="color:#111827;">${params.workspaceName}</strong>.`)}
    ${ctaButton('Aceitar convite', params.acceptUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">Link válido por 7 dias.</p>
  `);
}

export function passwordResetTemplate(params: { resetUrl: string }): string {
  return layout(`
    ${badge('#1D4ED8', '#DBEAFE', '🔐', 'Segurança')}
    ${heading('Redefinir sua senha')}
    ${subtext(`Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. Este link expira em <strong style="color:#111827;">1 hora</strong>.`)}
    ${ctaButton('Redefinir senha', params.resetUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanecerá a mesma.</p>
  `);
}

export function emailVerificationTemplate(params: { verifyUrl: string }): string {
  return layout(`
    ${badge('#065F46', '#D1FAE5', '✔', 'Verificação')}
    ${heading('Confirme seu e-mail')}
    ${subtext(`Obrigado por se cadastrar no Finance App! Clique no botão abaixo para confirmar seu endereço de e-mail e ativar sua conta. Este link expira em <strong style="color:#111827;">24 horas</strong>.`)}
    ${ctaButton('Verificar e-mail', params.verifyUrl)}
    <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;">Se você não criou uma conta, ignore este e-mail.</p>
  `);
}

export function budgetAlertTemplate(params: {
  category: string;
  percent: number;
  spentAmount: string;
  budgetAmount: string;
  month: string;
}): string {
  const isExceeded = params.percent >= 100;
  const badgeColor = isExceeded ? '#991B1B' : '#92400E';
  const badgeBg = isExceeded ? '#FEE2E2' : '#FEF3C7';
  const badgeIcon = isExceeded ? '🚨' : '⚠️';
  const badgeText = isExceeded ? 'Orçamento esgotado' : 'Alerta de orçamento';
  const barColor = isExceeded ? '#DC2626' : '#D97706';
  const barWidth = Math.min(params.percent, 100);

  const progressBar = `
    <div style="margin-bottom:28px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:13px;color:#6B7280;font-weight:500;">Consumo do orçamento</span>
        <span style="font-size:13px;color:${barColor};font-weight:700;">${params.percent}%</span>
      </div>
      <div style="background-color:#F3F4F6;border-radius:99px;height:8px;overflow:hidden;">
        <div style="background-color:${barColor};height:8px;width:${barWidth}%;border-radius:99px;"></div>
      </div>
    </div>`;

  const message = isExceeded
    ? `O orçamento da categoria <strong style="color:#111827;">${params.category}</strong> foi esgotado em <strong>${params.month}</strong>.`
    : `O orçamento da categoria <strong style="color:#111827;">${params.category}</strong> atingiu ${params.percent}% em <strong>${params.month}</strong>.`;

  return layout(`
    ${badge(badgeColor, badgeBg, badgeIcon, badgeText)}
    ${heading(isExceeded ? 'Orçamento esgotado!' : 'Atenção com seu orçamento')}
    ${subtext(message)}
    ${progressBar}
    ${infoCard([
      { label: 'Categoria', value: params.category },
      { label: 'Mês', value: params.month },
      { label: 'Gasto', value: `<span style="color:${barColor};font-weight:700;">${params.spentAmount}</span>` },
      { label: 'Orçamento', value: params.budgetAmount },
    ])}
    ${ctaButton('Ver orçamentos', `${BASE_URL}/transactions`)}
  `);
}
