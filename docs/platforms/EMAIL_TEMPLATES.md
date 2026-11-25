# Templates de E-mail Transacionais — Axir

> **Especificação Oficial de Comunicação Transacional (v2.0 — Editorial Clean Light)**  
> Este documento reúne a arquitetura visual dual (Teal Petróleo para Não-Assinantes / Trial e Ouro Âmbar para Assinantes PRO), o código HTML canônico dos templates do **Supabase Auth (Resend SMTP)** e o catálogo dos templates programáticos das **Edge Functions (Resend HTTP API)**.

---

## 1. Visão Geral e Arquitetura Visual Dual

Os e-mails transacionais do **Axir** adotam uma estética **Editorial Light-First** congruente com os tokens do modo claro do [DESIGN_SYSTEM.md](file:///home/gabrielsales/meus_apps/financasnew/docs/design/DESIGN_SYSTEM.md), eliminando fundos escuros desconfortáveis e garantindo legibilidade AAA e compatibilidade em Gmail, Apple Mail, Outlook e clientes mobile.

### Diretrizes de Design & Identidade por Estágio do Usuário:
- **Base Comum Confortável (Light-First):**
  - Fundo Geral (Canvas): `#F4F7F9` (`--background`)
  - Superfície do Card Central: `#FFFFFF` (`--surface`) com raio `16px`
  - Tipografia Principal: `#142531` (`--foreground` — Azul Petróleo Profundo)
  - Tipografia Secundária: `#475569` (`--muted-foreground`)
  - Números, Datas e Valores Monetários: `'IBM Plex Mono', monospace`
- **Identidade 1 — Não-Assinantes, Período de Teste (Trial) e Autenticação (`themeVariant: "teal"`):**
  - **Logo no Cabeçalho:** `https://axir.com.br/brand/logo-teal-light-128.png` (`36x36px`) + Wordmark **Axir**
  - **Filete Superior do Card:** `4px solid #2A9D8F` (Teal Vital)
  - **Borda do Card:** `#D7E1E6`
  - **Badge Semântico:** Fundo `#F0FDFA`, borda `#99F6E4`, texto `#1B6B62`
  - **Botão Primário (CTA):** Fundo `#1B6B62` (`--primary-strong`) com texto `#FFFFFF`
- **Identidade 2 — Exclusiva para Assinantes Axir PRO (`themeVariant: "pro"`):**
  - **Logo no Cabeçalho:** `https://axir.com.br/brand/logo-amber-light-128.png` (`36x36px`) + Wordmark **Axir** + Pill **`PRO`** (`#FFFBEB` / `#DDA726` / `#92400E`)
  - **Filete Superior do Card:** `4px solid #DDA726` (Ouro Âmbar)
  - **Borda do Card:** `#E6D5B8`
  - **Badge Semântico:** Fundo `#FFFBEB`, borda `#FDE68A`, texto `#92400E`
  - **Botão Primário (CTA):** Fundo `#142531` com borda `#DDA726` e texto `#FFFFFF`
- **Zero Emojis e Zero Menções Legadas:** Proibido o uso de emojis, caracteres decorativos ou do nome antigo `"Áxis Finance"` / `"axis.finance"`.

### Matriz de Mapeamento no Painel Supabase (`Authentication > Email Templates`)

| Nome do Template no Supabase | Finalidade | Assunto Recomendado | Variáveis Principais |
|---|---|---|---|
| **Confirm signup** | Confirmação de novo cadastro | `Confirme seu e-mail no Axir` | `{{ .ConfirmationURL }}`, `{{ .Email }}` |
| **Reset password** | Recuperação de credencial de acesso | `Redefinição de senha - Axir` | `{{ .ConfirmationURL }}` |
| **Invite user** | Convite de acesso à plataforma | `Você recebeu um convite para o Axir` | `{{ .ConfirmationURL }}` |
| **Change email address** | Validação de troca de e-mail | `Confirme a alteração do seu e-mail no Axir` | `{{ .ConfirmationURL }}` |

---

## 2. Template 1: Confirmação de Cadastro (`Confirm signup`)

Disparado automaticamente quando um novo usuário cria sua conta com e-mail e senha. Utiliza a identidade **Teal Petróleo** em fundo claro.

### Assunto do E-mail
```text
Confirme seu e-mail no Axir
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Confirme seu e-mail no Axir</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #142531;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F4F7F9; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional Oficial Axir -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://axir.com.br/brand/logo-teal-light-128.png" alt="Axir" width="36" height="36" style="display: block; width: 36px; height: 36px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: #142531;">
                      Axir
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central Editorial Light -->
          <tr>
            <td style="background-color: #FFFFFF; border: 1px solid #D7E1E6; border-top: 4px solid #2A9D8F; border-radius: 16px; padding: 36px 32px; box-shadow: 0 2px 8px rgba(20, 37, 49, 0.05);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 12px; background-color: #F0FDFA; border: 1px solid #99F6E4; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #1B6B62; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Confirmação de Acesso
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #142531; line-height: 1.35; letter-spacing: -0.3px;">
                      Boas-vindas ao Axir
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: #475569;">
                      Obrigado por iniciar sua jornada de organização financeira e planejamento patrimonial no <strong style="color: #142531;">Axir</strong>. Para validar a titularidade da sua conta e liberar seus 30 dias de teste gratuito, clique no botão abaixo:
                    </p>

                    <!-- Botão de Ação Primária -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #1B6B62; border: 1px solid #1B6B62;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 30px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                            Confirmar Meu E-mail
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de Segurança e Validade -->
                    <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-left: 3px solid #2A9D8F; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #475569;">
                        <strong style="color: #142531;">Prazo de validade:</strong> Este link é seguro e permanecerá ativo pelas próximas 24 horas. Se você não realizou este cadastro, basta desconsiderar esta mensagem.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #F4F7F9; border: 1px solid #D7E1E6; border-radius: 10px; padding: 12px 16px;">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #475569; word-break: break-all;">
                            Se o botão acima não funcionar, copie e cole este link no navegador:<br>
                            <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">{{ .ConfirmationURL }}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #475569;">
                <strong>Axir</strong> &mdash; Clareza, controle financeiro e planejamento patrimonial.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #64748B;">
                Precisa de ajuda? Fale conosco em <a href="mailto:suporte@axir.com.br" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">suporte@axir.com.br</a>.
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

Enviado quando o usuário solicita a redefinição de senha na tela de login.

### Assunto do E-mail
```text
Redefinição de senha - Axir
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Redefinição de senha - Axir</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #142531;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F4F7F9; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional Oficial Axir -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://axir.com.br/brand/logo-teal-light-128.png" alt="Axir" width="36" height="36" style="display: block; width: 36px; height: 36px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: #142531;">
                      Axir
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central Editorial Light -->
          <tr>
            <td style="background-color: #FFFFFF; border: 1px solid #D7E1E6; border-top: 4px solid #2A9D8F; border-radius: 16px; padding: 36px 32px; box-shadow: 0 2px 8px rgba(20, 37, 49, 0.05);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 12px; background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Segurança da Conta
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #142531; line-height: 1.35; letter-spacing: -0.3px;">
                      Solicitação de nova senha
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: #475569;">
                      Recebemos uma solicitação para redefinir a senha de acesso da sua conta no <strong style="color: #142531;">Axir</strong>. Para criar uma nova senha com segurança, clique no botão abaixo:
                    </p>

                    <!-- Botão de Ação -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #1B6B62; border: 1px solid #1B6B62;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 30px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                            Criar Nova Senha
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de Alerta -->
                    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-left: 3px solid #DDA726; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #475569;">
                        <strong style="color: #142531;">Atenção à validade:</strong> Por segurança, este link é de uso único e expira em 60 minutos. Se você não solicitou a troca de senha, sua conta permanece protegida e nenhuma ação é necessária.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #F4F7F9; border: 1px solid #D7E1E6; border-radius: 10px; padding: 12px 16px;">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #475569; word-break: break-all;">
                            Se o botão acima não funcionar, copie e cole este link no navegador:<br>
                            <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">{{ .ConfirmationURL }}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #475569;">
                <strong>Axir</strong> &mdash; Clareza, controle financeiro e planejamento patrimonial.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #64748B;">
                Precisa de ajuda? Fale conosco em <a href="mailto:suporte@axir.com.br" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">suporte@axir.com.br</a>.
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

Utilizado quando um novo usuário é convidado para acessar o Axir.

### Assunto do E-mail
```text
Você recebeu um convite para o Axir
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Você recebeu um convite para o Axir</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #142531;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F4F7F9; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional Oficial Axir -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://axir.com.br/brand/logo-teal-light-128.png" alt="Axir" width="36" height="36" style="display: block; width: 36px; height: 36px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: #142531;">
                      Axir
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central Editorial Light -->
          <tr>
            <td style="background-color: #FFFFFF; border: 1px solid #D7E1E6; border-top: 4px solid #2A9D8F; border-radius: 16px; padding: 36px 32px; box-shadow: 0 2px 8px rgba(20, 37, 49, 0.05);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 12px; background-color: #F0FDFA; border: 1px solid #99F6E4; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #1B6B62; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Convite de Acesso
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #142531; line-height: 1.35; letter-spacing: -0.3px;">
                      Você foi convidado para o Axir
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: #475569;">
                      Sua conta foi preparada no <strong style="color: #142531;">Axir</strong> para que você tenha um ambiente completo de gestão financeira pessoal, controle de cartões, metas e rebalanceamento de carteira.
                    </p>

                    <!-- Botão de Ação -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #1B6B62; border: 1px solid #1B6B62;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 30px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                            Aceitar Convite e Definir Senha
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Aviso de Instrução -->
                    <div style="background-color: #F0FDFA; border: 1px solid #CCFBF1; border-left: 3px solid #2A9D8F; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #475569;">
                        <strong style="color: #142531;">Primeiro acesso:</strong> Ao clicar no botão acima, você definirá sua senha pessoal para acessar imediatamente o seu painel.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #F4F7F9; border: 1px solid #D7E1E6; border-radius: 10px; padding: 12px 16px;">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #475569; word-break: break-all;">
                            Se o botão acima não funcionar, copie e cole este link no navegador:<br>
                            <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">{{ .ConfirmationURL }}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #475569;">
                <strong>Axir</strong> &mdash; Clareza, controle financeiro e planejamento patrimonial.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #64748B;">
                Precisa de ajuda? Fale conosco em <a href="mailto:suporte@axir.com.br" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">suporte@axir.com.br</a>.
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

Acionado quando um usuário solicita a substituição do seu endereço de e-mail na aba "Minha Conta".

### Assunto do E-mail
```text
Confirme a alteração do seu e-mail no Axir
```

### Código HTML (Copiar e colar no Supabase Auth)
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Confirme a alteração do seu e-mail no Axir</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F7F9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #142531;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #F4F7F9; min-height: 100vh; padding: 36px 16px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 580px; margin: 0 auto;">
          <!-- Cabeçalho Institucional Oficial Axir -->
          <tr>
            <td align="center" style="padding-bottom: 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" style="padding-right: 10px;">
                    <img src="https://axir.com.br/brand/logo-teal-light-128.png" alt="Axir" width="36" height="36" style="display: block; width: 36px; height: 36px; border: 0; outline: none; text-decoration: none;" />
                  </td>
                  <td valign="middle">
                    <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 24px; font-weight: 800; letter-spacing: -0.4px; color: #142531;">
                      Axir
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card Central Editorial Light -->
          <tr>
            <td style="background-color: #FFFFFF; border: 1px solid #D7E1E6; border-top: 4px solid #2A9D8F; border-radius: 16px; padding: 36px 32px; box-shadow: 0 2px 8px rgba(20, 37, 49, 0.05);">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 12px; background-color: #F0FDFA; border: 1px solid #99F6E4; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #1B6B62; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px;">
                      Atualização Cadastral
                    </span>

                    <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #142531; line-height: 1.35; letter-spacing: -0.3px;">
                      Confirme seu novo endereço de e-mail
                    </h1>

                    <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.65; color: #475569;">
                      Recebemos uma solicitação para atualizar o e-mail vinculado à sua conta no <strong style="color: #142531;">Axir</strong>. Para concluir a alteração com segurança, clique no botão abaixo:
                    </p>

                    <!-- Botão de Ação -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 28px 0 24px 0;">
                      <tr>
                        <td align="center" style="border-radius: 12px; background-color: #1B6B62; border: 1px solid #1B6B62;">
                          <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 30px; font-size: 14px; font-weight: 600; color: #FFFFFF; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">
                            Confirmar Novo E-mail
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Alerta de Segurança Crítico -->
                    <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-left: 3px solid #E76F51; border-radius: 8px; padding: 14px 16px; margin: 20px 0;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.55; color: #7F1D1D;">
                        <strong style="color: #7F1D1D;">Não reconhece esta alteração?</strong> Se você não solicitou a mudança do seu e-mail no Axir, não clique no botão e entre em contato imediatamente com <a href="mailto:suporte@axir.com.br" style="color: #991B1B; font-weight: 600; text-decoration: underline;">suporte@axir.com.br</a>.
                      </p>
                    </div>

                    <!-- Link Alternativo -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 16px; background-color: #F4F7F9; border: 1px solid #D7E1E6; border-radius: 10px; padding: 12px 16px;">
                      <tr>
                        <td>
                          <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #475569; word-break: break-all;">
                            Se o botão acima não funcionar, copie e cole este link no navegador:<br>
                            <a href="{{ .ConfirmationURL }}" target="_blank" rel="noopener noreferrer" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">{{ .ConfirmationURL }}</a>
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodapé Institucional -->
          <tr>
            <td align="center" style="padding-top: 28px; padding-bottom: 20px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; line-height: 1.5; color: #475569;">
                <strong>Axir</strong> &mdash; Clareza, controle financeiro e planejamento patrimonial.
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #64748B;">
                Precisa de ajuda? Fale conosco em <a href="mailto:suporte@axir.com.br" style="color: #1B6B62; font-weight: 600; text-decoration: underline;">suporte@axir.com.br</a>.
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

## 6. Configuração de SMTP e URLs no Painel Supabase (`axir.com.br`)

1. No painel do Supabase (`Project Settings > Authentication > SMTP Settings`), ative **Enable Custom SMTP** com os parâmetros do Resend:
   - **Sender email:** `nao-responda@axir.com.br`
   - **Sender name:** `Axir`
   - **Host:** `smtp.resend.com`
   - **Port:** `465` (SSL) ou `587` (TLS)
   - **Username:** `resend`
   - **Password:** `<RESEND_API_KEY>`
2. Em **Authentication > URL Configuration**:
   - **Site URL:** `https://axir.com.br`
   - **Redirect URLs:**
     - `http://localhost:5173/**`
     - `https://axir.com.br/**`
     - `https://*.pages.dev/**`

---

## 7. Catálogo dos Templates Transacionais via Resend API (`_shared/email-templates.ts`)

Todos os e-mails disparados pelas Edge Functions utilizam `sendTransactionalEmail` (`_shared/resend.ts`) com `from: "Axir <nao-responda@axir.com.br>"` e `reply_to: "suporte@axir.com.br"`, respeitando a separação visual entre usuários **Trial / Não-Assinantes (`teal`)** e **Assinantes PRO (`pro`)**:

| Template | Função em `_shared/email-templates.ts` | Identidade Visual | Gatilho / Comportamento |
|---|---|---|---|
| `trial_welcome` | `renderTrialWelcomeEmail` | **Teal Petróleo** (`logo-teal-light-128.png`) | Boas-vindas aos 30 dias gratuitos do Trial sem necessidade de cartão. |
| `trial_card_scheduled` | `renderTrialCardScheduledEmail` | **Teal Petróleo** (`logo-teal-light-128.png`) | Cartão validado durante o Trial (`asaas-checkout`), confirmando cobrança zero hoje e data da 1ª cobrança futura. |
| `trial_ending_reminder` | `renderTrialEndingReminderEmail` | **Teal Petróleo** (`logo-teal-light-128.png`) | Lembrete de 3 dias antes do fim do Trial (`billing-lifecycle-cron`). |
| `trial_expired_read_only` | `renderTrialExpiredReadOnlyEmail` | **Teal Petróleo** (`logo-teal-light-128.png`) | Aviso de fim dos 30 dias de teste e migração para Somente Leitura com 100% dos dados preservados (`billing-lifecycle-cron`). |
| `pro_activation` (1ª assinatura) | `renderProActivationEmail({ isFirstActivation: true })` | **Ouro Âmbar PRO** (`logo-amber-light-128.png` + Badge `PRO`) | **1º pagamento confirmado** (`asaas-webhook`): recibo oficial PRO + **carta calorosa de boas-vindas, pertencimento e canal aberto de co-criação/sugestões**. |
| `pro_activation` (renovação) / `pro_cumulative_renewal` | `renderProActivationEmail({ isFirstActivation: false })` | **Ouro Âmbar PRO** (`logo-amber-light-128.png` + Badge `PRO`) | Renovação recorrente ou antecipação acumulativa via Pix (+N meses) confirmada (`asaas-webhook`). |
| `pro_plan_change_scheduled` | `renderProPlanChangeScheduledEmail` | **Ouro Âmbar PRO** (`logo-amber-light-128.png` + Badge `PRO`) | Confirmação de agendamento de troca de ciclo Mensal $\leftrightarrow$ Anual para o fim do período vigente (`asaas-manage`). |
| `payment_failed` | `renderPaymentFailedEmail` | **Ouro Âmbar PRO** + Alerta **Coral Suave** | Falha na cobrança recorrente (`asaas-webhook`), informando a pendência e botão de atualização de cartão. |
| `past_due_weekly_reminder` / `past_due_admin_*` | `renderPastDueWeeklyReminderEmail` | **Ouro Âmbar PRO** + Alerta **Âmbar/Coral** | Lembrete semanal automático (`billing-lifecycle-cron`) ou disparo oficial pelo Admin (`admin-super-action`) nos modelos `friendly`, `update_card` e `final_warning`. |
| `subscription_canceled` | `renderSubscriptionCanceledEmail` | **Ouro Âmbar PRO** (quando mantém vigência até o fim do ciclo) ou **Teal Petróleo** (estorno imediato CDC 7 dias) | Confirmação de cancelamento da assinatura (`asaas-manage`). |
| `sunday_digest` | `renderSundayDigestEmail({ isPro })` | **Adaptativo:** **Ouro Âmbar PRO** para assinantes PRO/Vitalícios e **Teal Petróleo** para usuários em Trial | Resumo financeiro dominical (`sunday-digest`). |
