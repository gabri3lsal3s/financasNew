import os
import sys

# Define diretório temporário para matplotlib evitar avisos de permissão
os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib-sec-audit"
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether, PageBreak, HRFlowable
)
from reportlab.pdfgen import canvas

# ==============================================================================
# CONFIGURAÇÕES E PALETA DE CORES CANÔNICA
# ==============================================================================
PRIMARY_COLOR = colors.HexColor("#0F172A")    # Slate 900
SECONDARY_COLOR = colors.HexColor("#334155")  # Slate 700
ACCENT_COLOR = colors.HexColor("#2563EB")     # Blue 600
MUTED_COLOR = colors.HexColor("#64748B")      # Slate 500
BORDER_COLOR = colors.HexColor("#E2E8F0")     # Slate 200
BG_SURFACE = colors.HexColor("#F8FAFC")       # Slate 50

COLOR_CRITICAL = colors.HexColor("#B91C1C")   # Red 700
COLOR_HIGH = colors.HexColor("#EA580C")       # Orange 600
COLOR_MEDIUM = colors.HexColor("#D97706")     # Amber 600
COLOR_LOW = colors.HexColor("#2563EB")        # Blue 600
COLOR_INFO = colors.HexColor("#64748B")       # Slate 500
COLOR_STRONG = colors.HexColor("#059669")     # Emerald 600

# ==============================================================================
# GERADOR DE GRÁFICOS (MATPLOTLIB)
# ==============================================================================
def generate_charts(output_dir="/tmp"):
    donut_path = os.path.join(output_dir, "chart_donut.png")
    bars_path = os.path.join(output_dir, "chart_bars.png")

    # 1. Gráfico de Rosca (Severidade)
    labels = ['Crítica (0)', 'Alta (0)', 'Média (2)', 'Baixa (1)', 'Info (0)']
    raw_sizes = [0, 0, 2, 1, 0]
    chart_colors = ['#B91C1C', '#EA580C', '#D97706', '#2563EB', '#64748B']

    active_labels = [labels[i] for i in range(len(raw_sizes)) if raw_sizes[i] > 0]
    active_sizes = [raw_sizes[i] for i in range(len(raw_sizes)) if raw_sizes[i] > 0]
    active_colors = [chart_colors[i] for i in range(len(raw_sizes)) if raw_sizes[i] > 0]

    fig, ax = plt.subplots(figsize=(4.2, 2.9), dpi=200)
    wedges, texts, autotexts = ax.pie(
        active_sizes,
        labels=active_labels,
        colors=active_colors,
        autopct='%1.0f%%',
        startangle=140,
        pctdistance=0.75,
        wedgeprops=dict(width=0.4, edgecolor='white', linewidth=2)
    )
    plt.setp(autotexts, size=9, weight="bold", color="white")
    plt.setp(texts, size=8, color="#334155")
    ax.set_title("Achados por Severidade", fontsize=10.5, fontweight="bold", color="#0F172A", pad=8)
    plt.tight_layout()
    plt.savefig(donut_path, transparent=True)
    plt.close()

    # 2. Gráfico de Barras (Categorias Auditadas)
    categories = [
        '1. Banco sem Tranca',
        '2. Permissão Navegador',
        '3. IDOR / Objeto',
        '4. Chaves Expostas',
        '5. Inputs / XSS'
    ]
    findings_count = [1, 1, 0, 1, 0]
    bar_colors = ['#D97706', '#D97706', '#059669', '#2563EB', '#059669']

    fig, ax = plt.subplots(figsize=(5.2, 2.9), dpi=200)
    y_pos = np.arange(len(categories))
    bars = ax.barh(y_pos, findings_count, color=bar_colors, height=0.52, edgecolor='none')
    ax.set_yticks(y_pos)
    ax.set_yticklabels(categories, fontsize=8, color="#334155")
    ax.invert_yaxis()
    ax.set_xlabel('Quantidade de Apontamentos', fontsize=8, color="#64748B")
    ax.set_title("Apontamentos por Categoria Auditada", fontsize=10.5, fontweight="bold", color="#0F172A", pad=8)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['left'].set_color('#CBD5E1')
    ax.spines['bottom'].set_color('#CBD5E1')
    ax.xaxis.grid(True, linestyle='--', alpha=0.5, color='#E2E8F0')

    for bar in bars:
        width = bar.get_width()
        ax.text(width + 0.05, bar.get_y() + bar.get_height()/2, f'{int(width)}',
                ha='left', va='center', fontsize=8, fontweight='bold', color="#0F172A")

    ax.set_xlim(0, 2.2)
    plt.tight_layout()
    plt.savefig(bars_path, transparent=True)
    plt.close()

    return donut_path, bars_path

# ==============================================================================
# NUMBERED CANVAS (PAGINAÇÃO X DE Y + CABEÇALHO/RODAPÉ)
# ==============================================================================
class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))

        if self._pageNumber > 1:
            # Cabeçalho
            self.drawString(2 * cm, 28.2 * cm, "Relatório de Auditoria de Segurança — FinancasNew")
            self.drawRightString(19 * cm, 28.2 * cm, "29/08/2026")
            self.setStrokeColor(colors.HexColor("#E2E8F0"))
            self.setLineWidth(0.5)
            self.line(2 * cm, 28.0 * cm, 19 * cm, 28.0 * cm)

            # Rodapé
            self.line(2 * cm, 1.8 * cm, 19 * cm, 1.8 * cm)
            self.drawString(2 * cm, 1.3 * cm, "CONFIDENCIAL — Uso Interno de Engenharia")
            page_text = f"Página {self._pageNumber} de {page_count}"
            self.drawRightString(19 * cm, 1.3 * cm, page_text)

        self.restoreState()

# ==============================================================================
# CONSTRUTOR DO DOCUMENTO PDF
# ==============================================================================
def build_security_audit_pdf(output_path):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=19,
        leading=23,
        textColor=PRIMARY_COLOR,
        alignment=0
    )
    subtitle_style = ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=ACCENT_COLOR,
        alignment=0
    )
    h1_style = ParagraphStyle(
        'Heading1_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12.0,
        leading=15,
        textColor=PRIMARY_COLOR,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    )
    h2_style = ParagraphStyle(
        'Heading2_Custom',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=SECONDARY_COLOR,
        spaceBefore=6,
        spaceAfter=3,
        keepWithNext=True
    )
    body_style = ParagraphStyle(
        'Body_Custom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.3,
        leading=11.4,
        textColor=PRIMARY_COLOR
    )
    body_bold = ParagraphStyle(
        'Body_Bold',
        parent=body_style,
        fontName='Helvetica-Bold'
    )
    code_style = ParagraphStyle(
        'Code_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=6.8,
        leading=8.8,
        textColor=colors.HexColor("#0F172A")
    )
    issue_code_style = ParagraphStyle(
        'IssueCode_Custom',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=5.9,
        leading=7.4,
        textColor=colors.HexColor("#0F172A")
    )

    elements = []

    # ==========================================================================
    # 1. CAPA & ESCOPO (PÁGINA 1)
    # ==========================================================================
    elements.append(Spacer(1, 0.3 * cm))
    elements.append(Paragraph("RELATÓRIO DE AUDITORIA DE SEGURANÇA", subtitle_style))
    elements.append(Spacer(1, 0.1 * cm))
    elements.append(Paragraph("FinancasNew — App de Gestão Financeira Pessoal", title_style))
    elements.append(Spacer(1, 0.1 * cm))
    elements.append(HRFlowable(width="100%", thickness=2.5, color=ACCENT_COLOR, spaceBefore=4, spaceAfter=8))
    
    meta_table_data = [
        [Paragraph("<b>Data da Auditoria:</b>", body_style), Paragraph("29 de Agosto de 2026", body_style)],
        [Paragraph("<b>Escopo Auditado:</b>", body_style), Paragraph("Repositório Completo (Frontend React/TS + Backend Supabase Postgres RLS/RPCs + Edge Functions Deno + CI/CD)", body_style)],
        [Paragraph("<b>Tipo de Análise:</b>", body_style), Paragraph("Auditoria de Código-Fonte Estática (SAST), Validação de Invariantes e Revisão de Arquitetura de Isolamento", body_style)],
        [Paragraph("<b>Status Geral:</b>", body_style), Paragraph("<font color='#059669'><b>0 Críticas | 0 Altas | 2 Médias (Hardening Residual) | 1 Baixa</b></font>", body_style)]
    ]
    t_meta = Table(meta_table_data, colWidths=[3.8 * cm, 13.2 * cm])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_SURFACE),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 4.5),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 0.3 * cm))

    # Nota Metodológica
    elements.append(Paragraph("Nota Metodológica & Detecção da Stack Tecnológica", h2_style))
    method_text = (
        "A stack do projeto foi detectada e catalogada para mapear cada uma das 5 categorias canônicas ao seu equivalente arquitetural:<br/>"
        "• <b>Frontend:</b> React 19, TypeScript estrito, Tailwind CSS v4, shadcn/ui (Radix UI), TanStack Query v5, React Router v8.<br/>"
        "• <b>Backend & Persistência:</b> Supabase (PostgreSQL 15+, Row Level Security - RLS ativo em 100% das 31 tabelas, RPCs PL/pgSQL transacionais, Triggers de integridade referencial).<br/>"
        "• <b>Mecanismo de Autenticação & RBAC:</b> Supabase Auth (JWT assinado `auth.uid()`), perfis com papéis (`user`, `admin`, `superadmin`) e estados de ciclo de vida (`pending_approval`, `active`, `suspended`, `banned`).<br/>"
        "• <b>Serverless & Infra:</b> Supabase Edge Functions (Deno/TypeScript), agendamento `pg_cron` + `pg_net`, deploy Cloudflare Pages (Git Integration nativa).<br/>"
        "• <b>Mapeamento das 5 Categorias:</b><br/>"
        "&nbsp;&nbsp;1. <i>Banco sem Tranca:</i> Cobertura total de RLS nas 31 tabelas e garantia de filtro estrito por `((select auth.uid()) = user_id and public.is_current_user_active())`.<br/>"
        "&nbsp;&nbsp;2. <i>Permissão no Navegador:</i> Validação de gates administrativos em RPCs do banco vs. UI gates (`RequireAdmin`, `useUserAccess`).<br/>"
        "&nbsp;&nbsp;3. <i>IDOR:</i> Inspeção de vínculos de chaves estrangeiras (`card_id`, `category_id`, `asset_id`, `loan_id`) em 100% dos endpoints/RPCs.<br/>"
        "&nbsp;&nbsp;4. <i>Chaves Expostas:</i> Varredura em 100% do histórico git (`git log -p`), configs, CI/CD, templates e bundles à procura de segredos hardcoded e `service_role`.<br/>"
        "&nbsp;&nbsp;5. <i>Inputs / XSS:</i> Avaliação de sanitização de fórmulas em exportações (CSV/Excel), parsers (OFX/XLSX) e injeção de scripts no DOM."
    )
    elements.append(Paragraph(method_text, body_style))
    elements.append(PageBreak())

    # ==========================================================================
    # 2. RESUMO EXECUTIVO & GRÁFICOS & PONTOS FORTES (PÁGINA 2)
    # ==========================================================================
    elements.append(Paragraph("1. Resumo Executivo", h1_style))
    exec_summary = (
        "A auditoria de segurança atestou que a arquitetura do <b>FinancasNew</b> possui maturidade excepcional de defesa em profundidade: "
        "todas as 31 tabelas do PostgreSQL estão estritamente protegidas por Row Level Security (RLS), o histórico Git encontra-se 100% livre "
        "de credenciais, o log de auditoria é imutável com expurgo restrito a superadministradores, operações administrativas são autenticadas "
        "no banco e as exportações CSV possuem blindagem contra Formula Injection (DDE).<br/>"
        "As vulnerabilidades históricas de IDOR e bypass de suspensão foram corrigidas nas migrações 0036, 0037 e 0038. Esta auditoria identificou "
        "apenas <b>3 apontamentos preventivos</b> de média e baixa severidade e melhorias de governança."
    )
    elements.append(Paragraph(exec_summary, body_style))
    elements.append(Spacer(1, 0.2 * cm))

    donut_img, bars_img = generate_charts("/tmp")

    chart_table_data = [
        [
            Image(donut_img, width=8 * cm, height=4.5 * cm),
            Image(bars_img, width=8.8 * cm, height=4.5 * cm)
        ]
    ]
    t_charts = Table(chart_table_data, colWidths=[8.5 * cm, 8.5 * cm])
    t_charts.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    elements.append(t_charts)
    elements.append(Spacer(1, 0.2 * cm))

    # Tabela de Métricas Rápidas
    metrics_data = [
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body_bold),
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body_bold),
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body_bold),
            Paragraph("<font color='#2563EB'><b>BAIXA</b></font>", body_bold),
            Paragraph("<font color='#64748B'><b>INFORMATIVA</b></font>", body_bold),
            Paragraph("<font color='#059669'><b>PONTOS FORTES</b></font>", body_bold)
        ],
        [
            Paragraph("<b>0</b>", title_style),
            Paragraph("<b>0</b>", title_style),
            Paragraph("<b>2</b>", title_style),
            Paragraph("<b>1</b>", title_style),
            Paragraph("<b>0</b>", title_style),
            Paragraph("<b>10+</b>", title_style)
        ]
    ]
    t_metrics = Table(metrics_data, colWidths=[2.8 * cm] * 6)
    t_metrics.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_SURFACE),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('PADDING', (0, 0), (-1, -1), 4.0),
    ]))
    elements.append(t_metrics)
    elements.append(Spacer(1, 0.3 * cm))

    # Pontos Fortes e Riscos Centrais
    elements.append(Paragraph("2. Pontos Fortes e Riscos Centrais", h1_style))
    strong_points = (
        "<b>Pontos Fortes Identificados (Cobertura Comprovada):</b><br/>"
        "• <b>100% de Cobertura RLS:</b> Todas as 31 tabelas no Postgres possuem Row Level Security ativo e políticas estritas de isolamento por `(select auth.uid()) = user_id`.<br/>"
        "• <b>Imutabilidade do Log de Auditoria:</b> `audit_events` permite exclusivamente `INSERT` e `SELECT` via RLS; a rotina `cleanup_old_audit_events` exige papel `superadmin` e revogou privilégios públicos.<br/>"
        "• <b>Proteção de Perfis & Auto-Promoção Bloqueada:</b> A trigger `protect_profile_security_fields` impede que usuários comuns modifiquem `role`, `status` ou metadados de aprovação.<br/>"
        "• <b>Autorização Completa no Backend:</b> Todas as 10 RPCs administrativas (`admin_list_users`, `admin_update_user_status`, `admin_set_user_role`, etc.) validam no banco `is_admin()` / `is_superadmin()`.<br/>"
        "• <b>IDOR Imunizado em Mutações:</b> Funções transacionais (`create_expense_with_debt`, `restore_backup`, `early_amortize_loan`, `import_bank_transactions`, `execute_portfolio_batch_aporte`) validam posse de `card_id`, `category_id`, `asset_id` e contratos.<br/>"
        "• <b>Proteção Ativa contra CSV/Formula Injection:</b> Sanitização regex preventiva em `src/domain/export/csv.ts` neutralizando comandos DDE (`=`, `+`, `-`, `@`, `\\t`, `\\r`).<br/>"
        "• <b>Zero XSS no Frontend:</b> Ausência total de `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `eval` ou `new Function` no bundle React.<br/>"
        "• <b>Sanitização Defensiva de Download:</b> `src/services/export-actions.ts` implementa `sanitizeFilename` prevenindo path traversal e caracteres perigosos.<br/>"
        "• <b>Repositório e Git Limpos:</b> Varredura em 100% dos commits e histórico git comprovou ausência de tokens JWT ou segredos rastreados.<br/>"
        "• <b>Validação de Startup do Env:</b> `src/lib/env.ts` rejeita variáveis ausentes e bloqueia credenciais default/placeholders.<br/><br/>"
        "<b>Riscos Centrais & Oportunidades de Hardening:</b><br/>"
        "• <b>Hardening Residual na RPC delete_card_payment:</b> A RPC `delete_card_payment` (migração 0011) executa como `SECURITY DEFINER` sem invocar `is_current_user_active()`.<br/>"
        "• <b>Feature Flags Restritas à UI:</b> Tabelas e RPCs não impedem inserções diretas caso uma feature seja desativada globalmente no painel admin."
    )
    elements.append(Paragraph(strong_points, body_style))
    elements.append(PageBreak())

    # ==========================================================================
    # 3. TABELA DE ACHADOS & RECOMENDAÇÕES (PÁGINA 3)
    # ==========================================================================
    elements.append(Paragraph("3. Tabela de Achados Detalhados por Categoria", h1_style))

    findings_table_data = [
        [
            Paragraph("<b>Sev.</b>", body_bold),
            Paragraph("<b>Categoria</b>", body_bold),
            Paragraph("<b>Arquivo : Linha</b>", body_bold),
            Paragraph("<b>Descrição do Achado e Risco</b>", body_bold)
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body_style),
            Paragraph("1. Banco sem Tranca", body_style),
            Paragraph("<code>supabase/migrations/<br/>20260101000011_delete_card_payment.sql:14-55</code>", code_style),
            Paragraph("<b>Validação Residual de Status Ativo na RPC <code>delete_card_payment</code>:</b> A RPC executa como <code>SECURITY DEFINER</code> e valida <code>user_id = auth.uid()</code>, porém não invoca <code>public.is_current_user_active()</code>. Uma conta suspensa ou banida poderia excluir pagamentos de cartão e reverter estornos via RPC.", body_style)
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body_style),
            Paragraph("2. Permissão Navegador", body_style),
            Paragraph("<code>supabase/migrations/<br/>20260101000028_access_control...sql:72-107<br/>src/state/queries/use-user-access.ts:38-52</code>", code_style),
            Paragraph("<b>Feature Flags com Enforcement Restrito à Interface (Frontend Gate):</b> As regras de desativação global (Kill-Switch) ou por usuário são consultadas pelo frontend para ocultar rotas e menus, mas as tabelas do banco não possuem triggers bloqueando INSERTs caso a flag do módulo esteja desativada.", body_style)
        ],
        [
            Paragraph("<font color='#2563EB'><b>BAIXA</b></font>", body_style),
            Paragraph("4. Chaves Expostas", body_style),
            Paragraph("<code>supabase/quotes-cron.sql:34<br/>scripts/deploy-quotes.mjs:97</code>", code_style),
            Paragraph("<b>Armazenamento de Service Role Key em Texto Claro no Agendador <code>pg_cron</code>:</b> O template de agendamento do cron de cotações embute a chave de serviço no header HTTP agendado no banco. O acesso à tabela interna <code>cron.job</code> deve ser restrito exclusivamente ao superusuário <code>postgres</code>.", body_style)
        ]
    ]

    t_findings = Table(findings_table_data, colWidths=[1.7 * cm, 3.2 * cm, 4.5 * cm, 7.6 * cm])
    t_findings.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BG_SURFACE),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('PADDING', (0, 0), (-1, -1), 4.5),
    ]))
    elements.append(t_findings)
    elements.append(Spacer(1, 0.3 * cm))

    # Recomendações Priorizadas
    elements.append(Paragraph("4. Plano de Ação & Recomendações Priorizadas", h1_style))
    recs = [
        "<b>[P1 - Curto Prazo] Atualização da RPC <code>delete_card_payment</code> com Check de Conta Ativa:</b> Adicionar a verificação <code>if not public.is_current_user_active() then raise exception ...</code> no corpo de <code>delete_card_payment</code> em migration complementar.",
        "<b>[P2 - Médio Prazo] Validação de Feature Flags no Backend:</b> Criar triggers ou funções de verificação no banco que rejeitem inserções em tabelas como <code>portfolio_assets</code>, <code>debts</code> ou <code>budgets</code> caso a respectiva feature esteja desativada para o usuário.",
        "<b>[P3 - Melhoria de Infraestrutura] Governança de Segredos no <code>pg_cron</code>:</b> Assegurar que a tabela <code>cron.job</code> tenha permissões revogadas para roles não-administrativas ou migrar a chamada do cron para o Supabase Vault."
    ]
    for r in recs:
        elements.append(Paragraph(r, body_style))
        elements.append(Spacer(1, 0.12 * cm))

    elements.append(PageBreak())

    # ==========================================================================
    # 4. ISSUES PARA O GITHUB (PÁGINA 4)
    # ==========================================================================
    elements.append(Paragraph("5. Issues Prontas para o GitHub (Markdown)", h1_style))
    elements.append(Paragraph(
        "Abaixo estão os textos completos prontos para cópia e abertura direta no GitHub Issues para os apontamentos identificados.",
        body_style
    ))
    elements.append(Spacer(1, 0.25 * cm))

    def render_issue_block(issue_text):
        content = Paragraph("<pre>" + issue_text.replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>") + "</pre>", issue_code_style)
        t_box = Table([[content]], colWidths=[17.0 * cm])
        t_box.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), BG_SURFACE),
            ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        return KeepTogether([t_box, Spacer(1, 0.2 * cm)])

    # Issue 1: Hardening de Status Ativo na RPC delete_card_payment
    issue_1_text = """--- ISSUE 1 ---
**Título:** [Segurança] Blindagem de status de conta ativa na RPC delete_card_payment
**Labels sugeridas:** security, severity:medium, backend, database

### Descrição do Problema
A RPC `delete_card_payment` (migração `20260101000011_delete_card_payment.sql`) executa como `SECURITY DEFINER` e valida a propriedade do registro (`user_id = auth.uid()`), porém não invoca a função `public.is_current_user_active()`.

### Por que é explorável?
Um usuário cuja conta foi suspensa ou banida pela administração poderia continuar excluindo pagamentos de cartão e cancelando estornos via chamada RPC direta ao Supabase, contornando a suspensão da conta nessa operação específica.

### Evidência
- **Arquivo:** `supabase/migrations/20260101000011_delete_card_payment.sql:14-55`

### Impacto
- Evasão residual do bloqueio de conta inativa/suspensa na exclusão de pagamentos e estornos de cartão de crédito.

### Sugestão de Correção
Criar uma migration complementar atualizando a função `delete_card_payment` com a verificação de conta ativa:
```sql
if not public.is_current_user_active() then
  raise exception 'Acesso negado: conta inativa, pendente de aprovação ou suspensa.';
end if;
```

### Critérios de Aceite
- [ ] RPC `delete_card_payment` rejeita execuções de usuários com status `pending_approval`, `suspended` ou `banned`.
- [ ] Teste de integração cobrindo a tentativa de exclusão por usuário inativo/suspenso.
--- FIM ISSUE 1 ---"""

    elements.append(render_issue_block(issue_1_text))

    # Issue 2: Validação de Feature Flags no Backend
    issue_2_text = """--- ISSUE 2 ---
**Título:** [Segurança] Validação de Feature Flags no nível do banco de dados (Backend Enforcement)
**Labels sugeridas:** security, severity:medium, backend, access-control

### Descrição do Problema
O controle de funcionalidades (`system_features` e `user_feature_overrides`) opera primariamente como um gate de interface no frontend (`RequireAdmin`, `useUserAccess`). No entanto, o banco de dados não valida se a funcionalidade correspondente está habilitada ao receber comandos INSERT/UPDATE diretamente nas tabelas (como `portfolio_assets`, `debts`, `budgets`).

### Por que é explorável?
Se um administrador desativar globalmente um módulo (Kill-Switch) ou revogar o acesso de um usuário a um recurso específico, o frontend ocultará os botões e páginas, mas um usuário com conhecimentos técnicos pode enviar requisições REST diretamente à API do Supabase e persistir dados no módulo desativado.

### Evidência
- **Arquivo:** `supabase/migrations/20260101000028_access_control_and_feature_flags.sql:72-107, 324-352`
- **Arquivo:** `src/state/queries/use-user-access.ts:38-52`

### Impacto
- Inconsistência entre a governança administrativa na UI e as regras de persistência no Postgres.

### Sugestão de Correção
Implementar triggers ou funções de verificação no banco (utilizando `public.is_feature_enabled(key)`) que confiram se a feature está habilitada antes de permitir inserções em tabelas de módulos específicos.

### Critérios de Aceite
- [ ] Inserções em tabelas restritas (ex.: `portfolio_assets`) são bloqueadas se a flag `investments` estiver inativa.
- [ ] Resposta amigável de erro informando que o módulo encontra-se temporariamente desativado.
--- FIM ISSUE 2 ---"""

    elements.append(render_issue_block(issue_2_text))

    # Issue 3: Hardening de pg_cron
    issue_3_text = """--- ISSUE 3 ---
**Título:** [Segurança] Hardening de segredos em jobs agendados do pg_cron
**Labels sugeridas:** security, severity:low, devops, database

### Descrição do Problema
O template de cron de cotações embute a chave `SUPABASE_SERVICE_ROLE_KEY` no header `Authorization` salvo na tabela `cron.job` do schema `cron`.

### Por que é explorável?
Se uma role não-administrativa obtiver privilégios indevidos de leitura no schema `cron`, poderá visualizar a chave de serviço em texto claro.

### Evidência
- **Arquivo:** `supabase/quotes-cron.sql:34`
- **Arquivo:** `scripts/deploy-quotes.mjs:97`

### Impacto
- Exposição potencial de credencial com bypass de RLS em caso de vazamento de leitura no schema interno `cron`.

### Sugestão de Correção
1. Garantir que apenas o role `postgres` possua privilégios de leitura e escrita no schema `cron`.
2. Alternativamente, utilizar `supabase_vault.secrets` para recuperar a chave dinamicamente durante a execução da query.

### Critérios de Aceite
- [ ] Permissões da tabela `cron.job` auditadas e restritas exclusivamente a superusuários.
- [ ] Documentação de deploy atualizada com orientações de governança do Vault.
--- FIM ISSUE 3 ---"""

    elements.append(render_issue_block(issue_3_text))

    # Constrói o PDF usando NumberedCanvas
    doc.build(elements, canvasmaker=NumberedCanvas)
    print(f"[OK] Relatório gerado com sucesso em: {output_path}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "docs/security-audit/relatorio-auditoria-seguranca.pdf"
    build_security_audit_pdf(target)

