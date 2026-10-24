# Templates de E-mail Transacionais — Áxis Finance

> **Especificação Oficial de Comunicação Transacional**  
> Este documento reúne o código HTML canônico dos 4 templates de e-mail utilizados pelo serviço de autenticação Supabase Auth, totalmente integrados à identidade visual, tipografia e tokens do Design System Áxis Finance.

---

## 1. Visão Geral e Arquitetura de Comunicação

Os e-mails transacionais do Áxis Finance foram projetados segundo padrões internacionais de entregabilidade, alta legibilidade e compatibilidade cruzada com os principais clientes de e-mail do mercado (Gmail, Apple Mail, Microsoft Outlook, Thunderbird e navegadores web móveis e desktop).

### Diretrizes de Design & Compatibilidade:
- **Tabela Estrutural Fluida:** Arquitetura tabular padrão `role="presentation"` com largura máxima de 580px centralizada.
- **Paleta de Cores e Tokens:**
  - Fundo Geral da Mensagem: `#0B0F19` (Dark Canvas Premium)
  - Superfície do Card Central: `#111827` (Card Surface)
  - Borda Perimetral Sutil: `#1F2937`
  - Tipografia Principal: `#F9FAFB` (White High Contrast)
  - Tipografia de Apoio / Neutra: `#9CA3AF` (Muted)
  - Destaque Primário (Botão CTA): `#0D9488` (Teal Oficial Áxis Finance com texto `#FFFFFF`)
  - Acento Crítico / Alertas: `#EF4444` (Critical)
- **Tipografia Universal:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` inline em todos os elementos de texto.
- **Zero Emojis e Zero Caracteres Decorativos:** Toda a hierarquia visual é estabelecida por contrastes tipográficos, espaçamentos consistentes e badges semânticos.
- **Fallback de Link Direto:** Todos os templates fornecem o link bruto em texto legível para casos em que o cliente de e-mail desative cliques em botões.

### Matriz de Mapeamento no Painel Supabase (`Authentication > Email Templates`)

| Nome do Template no Supabase | Finalidade | Assunto Recomendado | Variáveis Principais |
|---|---|---|---|
| **Confirm signup** | Confirmação de novo cadastro | `Confirme sua conta no Áxis Finance` | `{{ .ConfirmationURL }}`, `{{ .Email }}` |
| **Reset password** | Recuperação de credencial de acesso | `Redefina sua senha de acesso - Áxis Finance` | `{{ .ConfirmationURL }}` |
| **Invite user** | Convite VIP / Admissão de novo membro | `Você foi convidado para o Áxis Finance` | `{{ .ConfirmationURL }}` |
| **Change email address** | Validação de troca de e-mail | `Confirme a alteração do seu e-mail - Áxis Finance` | `{{ .ConfirmationURL }}` |

---

## 2. Template 1: Confirmação de Cadastro (`Confirm signup`)

Este template é disparado automaticamente quando um novo usuário se cadastra utilizando endereço de e-mail e senha.

### Assunto do E-mail
```text
Confirme sua conta no Áxis Finance
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme sua conta no Áxis Finance</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0B0F19; min-height: 100vh; padding: 32px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional / Marca -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      ÁXIS<span style="color: #0D9488; font-weight: 400; margin-left: 4px;">FINANCE</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">
                      Inteligência &amp; Soberania Financeira
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central de Conteúdo -->
          <tr>
            <td style="background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #14B8A6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Confirmação de Acesso
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; line-height: 1.3;">
                      Boas-vindas ao Áxis Finance
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #9CA3AF;">
                      Obrigado por iniciar sua jornada para uma gestão patrimonial de alta precisão. Para validar a titularidade da sua conta e liberar o acesso completo à plataforma, clique no botão abaixo.
                    </p>

                    <!-- Botão de Ação Primária -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #0D9488;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; border: 1px solid #0D9488; letter-spacing: 0.2px;">
                            Confirmar Meu E-mail
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de Segurança e Validade -->
                    <div style="background-color: rgba(31, 41, 55, 0.5); border-left: 3px solid #0D9488; border-radius: 8px; padding: 14px 16px; margin: 24px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9CA3AF;">
                        <strong style="color: #F9FAFB;">Prazo de validade:</strong> Este link é seguro e permanecerá ativo pelas próximas 24 horas. Se você não realizou este cadastro, desconsidere esta mensagem.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <p style="margin: 28px 0 0 0; font-size: 12px; line-height: 1.5; color: #6B7280;">
                      Caso o botão acima não funcione, copie e cole o link a seguir no seu navegador:<br>
                      <a href="{{ .ConfirmationURL }}" style="color: #14B8A6; text-decoration: underline; word-break: break-all;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; line-height: 1.5; color: #6B7280;">
                Áxis Finance — Gestão Financeira Pessoal, Dívidas, Cartões e Rebalanceamento Patrimonial.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #4B5563;">
                Mensagem gerada de forma automatizada. Por razões de segurança, não responda a este e-mail.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Template 2: Recuperação de Senha (`Reset password`)

Este template é enviado quando o usuário aciona a opção "Esqueci minha senha" na tela de login.

### Assunto do E-mail
```text
Redefina sua senha de acesso - Áxis Finance
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefina sua senha de acesso - Áxis Finance</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0B0F19; min-height: 100vh; padding: 32px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      ÁXIS<span style="color: #0D9488; font-weight: 400; margin-left: 4px;">FINANCE</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">
                      Inteligência &amp; Soberania Financeira
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central -->
          <tr>
            <td style="background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #F59E0B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Segurança da Conta
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; line-height: 1.3;">
                      Solicitação de Nova Senha
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #9CA3AF;">
                      Recebemos uma solicitação para redefinir a credencial de acesso da sua conta. Para cadastrar uma nova senha e restabelecer sua conexão com a plataforma, clique no botão abaixo.
                    </p>

                    <!-- Botão de Ação -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #0D9488;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; border: 1px solid #0D9488; letter-spacing: 0.2px;">
                            Criar Nova Senha
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de Alerta -->
                    <div style="background-color: rgba(31, 41, 55, 0.5); border-left: 3px solid #F59E0B; border-radius: 8px; padding: 14px 16px; margin: 24px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9CA3AF;">
                        <strong style="color: #F9FAFB;">Atenção à validade:</strong> Por segurança, este link é de uso único e expira em 60 minutos. Se você não solicitou a troca de senha, sua conta permanece segura e nenhuma ação é necessária.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <p style="margin: 28px 0 0 0; font-size: 12px; line-height: 1.5; color: #6B7280;">
                      Caso o botão não funcione, acesse o link de recuperação manualmente:<br>
                      <a href="{{ .ConfirmationURL }}" style="color: #14B8A6; text-decoration: underline; word-break: break-all;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; line-height: 1.5; color: #6B7280;">
                Áxis Finance — Plataforma Segura de Gestão Financeira.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #4B5563;">
                Se você não reconhece esta atividade, recomendamos alterar suas credenciais preventivamente.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 4. Template 3: Convite de Acesso (`Invite user`)

Este template é utilizado na expedição de convites diretos a membros ou clientes admitidos por administradores.

### Assunto do E-mail
```text
Você foi convidado para o Áxis Finance
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Você foi convidado para o Áxis Finance</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0B0F19; min-height: 100vh; padding: 32px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      ÁXIS<span style="color: #0D9488; font-weight: 400; margin-left: 4px;">FINANCE</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">
                      Inteligência &amp; Soberania Financeira
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central -->
          <tr>
            <td style="background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #818CF8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Convite Exclusivo
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; line-height: 1.3;">
                      Você foi convidado para a plataforma
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #9CA3AF;">
                      Você recebeu um convite especial para acessar o Áxis Finance. A partir de agora, você terá ao seu alcance um ambiente completo para controle patrimonial, inteligência de fluxo de caixa e rebalanceamento de carteira.
                    </p>

                    <!-- Botão de Ação -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #0D9488;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; border: 1px solid #0D9488; letter-spacing: 0.2px;">
                            Aceitar Convite e Ativar Conta
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de Instrução -->
                    <div style="background-color: rgba(31, 41, 55, 0.5); border-left: 3px solid #818CF8; border-radius: 8px; padding: 14px 16px; margin: 24px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #9CA3AF;">
                        <strong style="color: #F9FAFB;">Primeiro acesso:</strong> Ao clicar no botão, você definirá sua senha pessoal de acesso para iniciar a utilização imediata da sua conta.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <p style="margin: 28px 0 0 0; font-size: 12px; line-height: 1.5; color: #6B7280;">
                      Se preferir, utilize o link direto para confirmação do convite:<br>
                      <a href="{{ .ConfirmationURL }}" style="color: #14B8A6; text-decoration: underline; word-break: break-all;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; line-height: 1.5; color: #6B7280;">
                Áxis Finance — Ecossistema Integrado de Gestão e Patrimônio.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #4B5563;">
                Este convite é de uso estritamente pessoal e intransferível.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 5. Template 4: Confirmação de Alteração de E-mail (`Change email address`)

Este template é acionado quando um usuário autenticado solicita a substituição do seu endereço de e-mail atual na aba "Minha Conta" (`/configuracoes?aba=account`).

### Assunto do E-mail
```text
Confirme a alteração do seu e-mail - Áxis Finance
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirme a alteração do seu e-mail - Áxis Finance</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #0B0F19; min-height: 100vh; padding: 32px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional -->
          <tr>
            <td align="center" style="padding-bottom: 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #FFFFFF;">
                      ÁXIS<span style="color: #0D9488; font-weight: 400; margin-left: 4px;">FINANCE</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-top: 4px;">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">
                      Inteligência &amp; Soberania Financeira
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central -->
          <tr>
            <td style="background-color: #111827; border: 1px solid #1F2937; border-radius: 16px; padding: 40px 32px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(13, 148, 136, 0.15); border: 1px solid rgba(13, 148, 136, 0.3); border-radius: 9999px; font-size: 11px; font-weight: 600; color: #14B8A6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Atualização Cadastral
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #F9FAFB; line-height: 1.3;">
                      Confirme seu novo e-mail
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #9CA3AF;">
                      Recebemos uma solicitação para atualizar o endereço de e-mail associado à sua conta no Áxis Finance. Para concluir a transferência de forma segura, confirme o novo endereço clicando no botão abaixo.
                    </p>

                    <!-- Botão de Ação -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 32px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #0D9488;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; border: 1px solid #0D9488; letter-spacing: 0.2px;">
                            Confirmar Novo E-mail
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Alerta de Segurança Crítico -->
                    <div style="background-color: rgba(239, 68, 68, 0.1); border-left: 3px solid #EF4444; border-radius: 8px; padding: 14px 16px; margin: 24px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #FCA5A5;">
                        <strong style="color: #FFFFFF;">Não reconhece esta solicitação?</strong> Se você não solicitou a mudança do endereço de e-mail da sua conta, entre em contato imediatamente com a equipe de segurança para revogar a transição.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <p style="margin: 28px 0 0 0; font-size: 12px; line-height: 1.5; color: #6B7280;">
                      Caso o botão não funcione, confirme utilizando o link abaixo:<br>
                      <a href="{{ .ConfirmationURL }}" style="color: #14B8A6; text-decoration: underline; word-break: break-all;">
                        {{ .ConfirmationURL }}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 32px;">
              <p style="margin: 0 0 8px 0; font-size: 11px; line-height: 1.5; color: #6B7280;">
                Áxis Finance — Segurança, Integridade e Privacidade Financeira.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #4B5563;">
                Mensagem gerada de forma automatizada por solicitação de segurança.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 6. Procedimento de Aplicação no Painel Supabase

1. Acesse o console do seu projeto no Supabase (`https://supabase.com/dashboard/project/<PROJECT_ID>`).
2. No menu lateral de navegação, selecione **Authentication** e clique em **Email Templates**.
3. Selecione a aba correspondente:
   - Para confirmação de e-mail: selecione **Confirm signup**.
   - Para redefinição de senha: selecione **Reset password**.
   - Para convite de membro: selecione **Invite user**.
   - Para troca de e-mail: selecione **Change email address**.
4. Atualize o campo **Subject** com o assunto recomendado na tabela da Seção 1.
5. Substitua o conteúdo do editor **Message (HTML)** pelo código HTML correspondente fornecido neste documento.
6. Clique em **Save** no canto inferior direito para ativar o template em produção.

---

## 7. Guia Operacional de Configuração de Provedor SMTP Profissional

Por padrão, projetos recém-criados no Supabase utilizam um serviço compartilhado interno de e-mails sujeito a restrições severas:
- **Teto restritivo de envio:** Limite estrito de apenas **30 e-mails por hora**. Disparos adicionais são silenciosamente descartados ou retornam erro `rate_limit_exceeded`.
- **Remetente genérico:** As mensagens partem de `noreply@mail.app.supabase.io`, elevando drasticamente a taxa de direcionamento para pastas de Lixo Eletrônico / SPAM.
- **Risco de bloqueio operacional:** Campanhas de onboarding ou surtos de redefinição de senha podem bloquear novos usuários de acessar o sistema.

Para ambientes de homologação e produção SaaS, é **obrigatória** a ativação de um provedor SMTP transacional com domínio institucional configurado.

---

### 7.1 Provedor Recomendado: Resend (Moderno e Otimizado para Cloud)

O **Resend** é a solução de mensageria recomendada oficialmente pela arquitetura do Áxis Finance devido à sua latência extremamente baixa, suporte nativo a domínios transacionais e interface moderna de auditoria.

#### Passo 1: Cadastro e Adição do Domínio
1. Crie uma conta em [resend.com](https://resend.com).
2. No menu lateral esquerdo, acesse **Domains** e clique em **Add Domain**.
3. Insira o domínio ou subdomínio exclusivo de envio do Áxis Finance (ex.: `send.axis.finance` ou `axis.finance`).
4. Selecione a região primária (recomenda-se `us-east-1` ou `sa-east-1` para menor latência).

#### Passo 2: Apontamentos de DNS (Autenticação SPF, DKIM e DMARC)
Acesse a zona de DNS do seu domínio (Cloudflare, Registro.br, AWS Route53 ou similar) e insira os registros exibidos pelo Resend:

| Tipo | Nome / Host | Conteúdo / Destino | Finalidade |
|---|---|---|---|
| **TXT** | `send.axis.finance` | `v=spf1 include:amazonses.com ~all` | **SPF:** Autoriza servidores de disparo |
| **CNAME** | `resend._domainkey` | `resend._domainkey.resend.com` | **DKIM:** Assinatura criptográfica antispam |
| **MX** | `send.axis.finance` | `feedback-smtp.us-east-1.amazonses.com` (prioridade 10) | Roteamento de retornos e bounces |
| **TXT** | `_dmarc.axis.finance` | `v=DMARC1; p=none; rua=mailto:dmarc-reports@axis.finance` | **DMARC:** Proteção contra spoofing de marca |

*Aguarde a validação no painel do Resend (normalmente concluída entre 2 e 15 minutos).*

#### Passo 3: Geração da Chave de API SMTP
1. No painel do Resend, acesse **API Keys** no menu lateral.
2. Clique em **Create API Key**.
3. Nomeie a chave como `Supabase Production SMTP`.
4. Defina as permissões como **Sending access** associada ao domínio validado.
5. Copie o valor gerado (iniciado com `re_...`). Guarde este segredo com máxima confidencialidade.

#### Parâmetros de Conexão Resend:
- **Host SMTP:** `smtp.resend.com`
- **Porta:** `465` (SSL) ou `587` (TLS)
- **Usuário:** `resend`
- **Senha:** `<SUA_API_KEY_RESEND_INICIADA_COM_re_>`
- **Criptografia:** `TLS` ou `SSL`

---

### 7.2 Provedor Alternativo: Brevo (Antigo Sendinblue)

Caso opte pelo **Brevo**, a plataforma oferece plano gratuito com até 300 e-mails/dia sem limite por hora.

#### Passo 1: Cadastro e Validação
1. Registre sua conta em [brevo.com](https://www.brevo.com).
2. Acesse **Configurações > Remetentes e IPs > Domínios**.
3. Adicione o domínio institucional e configure os registros TXT / DKIM fornecidos na tabela de DNS da sua hospedagem.

#### Passo 2: Obtenção das Credenciais SMTP
1. No menu superior direito, clique no nome da conta e selecione **SMTP & API**.
2. Na aba **SMTP**, identifique o usuário de conexão (geralmente o seu e-mail de login).
3. Clique em **Generate a new SMTP key**, atribua o nome `Supabase Auth` e copie a chave gerada.

#### Parâmetros de Conexão Brevo:
- **Host SMTP:** `smtp-relay.brevo.com`
- **Porta:** `587` (TLS)
- **Usuário:** `<SEU_EMAIL_CADASTRADO_NO_BREVO>`
- **Senha:** `<SUA_SMTP_KEY_DO_BREVO>`
- **Criptografia:** `TLS`

---

### 7.3 Configuração no Painel Supabase

Com as credenciais do provedor em mãos, execute os passos a seguir:

1. Acesse o console do Supabase: `https://supabase.com/dashboard/project/<PROJECT_ID>`.
2. No menu lateral, navegue até **Project Settings** (ícone de engrenagem) e clique em **Authentication**.
3. Localize o bloco **SMTP Settings** e ative o botão seletor **Enable Custom SMTP**.
4. Preencha os campos com os valores canônicos:

| Campo do Formulário Supabase | Valor Recomendado | Descrição / Boas Práticas |
|---|---|---|
| **Sender email** | `nao-responda@axis.finance` | Deve pertencer estritamente ao domínio autenticado com SPF/DKIM |
| **Sender name** | `Áxis Finance` | Nome de exibição amigável que aparecerá na Caixa de Entrada |
| **Host** | `smtp.resend.com` | Endereço do servidor SMTP do provedor escolhido |
| **Port number** | `465` (ou `587`) | Porta segura de transmissão |
| **Minimum TLS version** | `TLS 1.2` | Padrão mínimo de conformidade e segurança criptográfica |
| **Username** | `resend` (ou e-mail Brevo) | Usuário autenticador fornecido pelo provedor |
| **Password** | `<API_KEY_OU_SENHA_SMTP>` | Chave secreta de envio |

5. Clique em **Save** na base da tela para persistir as credenciais.

---

### 7.4 Parametrização de Redirecionamento e Segurança (`URL Configuration`)

Para que os links dos e-mails transacionais direcionem o usuário com segurança e sem erros `invalid_grant` ou `redirect_uri_mismatch`:

1. No console do Supabase, acesse **Authentication > URL Configuration**.
2. No campo **Site URL**, informe a URL raiz canônica de produção:
   ```text
   https://axis.finance
   ```
3. Na seção **Redirect URLs**, registre explicitamente todos os ambientes suportados com wildcards seguros:
   ```text
   http://localhost:5173/**
   http://localhost:4173/**
   https://axis.finance/**
   https://axis.finance/redefinir-senha
   https://axis.finance/confirmar-email
   https://*.pages.dev/**
   ```
4. Clique em **Save**.

---

### 7.5 Roteiro de Teste e Homologação de Entregabilidade

Após finalizar o preenchimento:
1. No app web, acesse a tela `/entrar` e clique em **"Esqueci minha senha"**.
2. Digite um e-mail de teste sob seu controle e envie a solicitação.
3. Acesse o painel do provedor (Resend ou Brevo) no menu **Emails / Logs**:
   - Verifique se o disparo consta como **Delivered** (Entregue).
   - Confirme se os indicadores **SPF**, **DKIM** e **DMARC** constam como **Pass / Aprovados**.
4. Abra o e-mail no cliente destinatário (ex.: Gmail ou Outlook):
   - Confirme que a mensagem chegou diretamente na **Caixa de Entrada Principal** (não em SPAM ou Promoções).
   - Valide que o layout escuro premium é renderizado com alta nitidez e sem distorções visuais.
   - Clique no botão e confirme o redirecionamento seguro para a plataforma Áxis Finance.

---

### 7.6 Solução de Problemas Comuns (Troubleshooting)

| Sintoma / Erro | Causa Provável | Solução Corretiva |
|---|---|---|
| **E-mail chega na pasta SPAM** | Registros DKIM ou SPF ausentes ou não propagados | Verifique na ferramenta `mxtoolbox.com/spf.aspx` se os registros TXT/CNAME do domínio estão válidos. |
| **535 Authentication Failed** | Chave de API ou senha SMTP incorreta | Gere uma nova chave no Resend/Brevo e atualize o campo Password no painel do Supabase. |
| **Connection timeout on port 465** | Bloqueio de porta ou conflito de TLS | Alterne a porta para `587` e certifique-se de selecionar `TLS 1.2`. |
| **Link de confirmação abre página 404** | Rota não mapeada em `Redirect URLs` | Certifique-se de que `https://axis.finance/**` está incluída em **Authentication > URL Configuration > Redirect URLs**. |
| **Erro "rate_limit_exceeded"** | Custom SMTP não foi ativado com sucesso | Verifique se o seletor **Enable Custom SMTP** está com o status ligado e salvo no Supabase. |

