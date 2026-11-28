export const ADMIN_PAGE_GUIDES = {
  dashboard: {
    title: "Guia da Visão geral",
    steps: [
      "Comece pelas aprovações, pelos chamados pendentes e pelas assinaturas em atraso. Os links levam à fila correspondente.",
      "Confira os indicadores do serviço para acompanhar contas e convites.",
      "Veja os módulos mais usados nos últimos 30 dias.",
    ],
  },
  users: {
    title: "Guia de Usuários",
    steps: [
      "Busque por nome ou e-mail e use os filtros de status e cargo.",
      "Abra uma conta para consultar o plano, mudar o status ou ajustar o acesso aos módulos, conforme seu cargo.",
    ],
  },
  tickets: {
    title: "Guia de Chamados e Comunicados",
    steps: [
      "Em Chamados, abra uma solicitação para responder, registrar uma nota interna ou atualizar o status.",
      "Em Comunicados, revise o texto e o público antes de enviar. Consulte o histórico para acompanhar ou encerrar avisos.",
    ],
  },
  billing: {
    title: "Guia de Faturamento",
    steps: [
      "Confira a estimativa de receita mensal, as assinaturas ativas e os períodos de teste.",
      "Use a lista de inadimplência para revisar cobranças em atraso e confirme a situação no Asaas antes de agir.",
    ],
  },
  invites: {
    title: "Guia de Convites",
    steps: [
      "Crie um convite com o plano, a validade e o limite de usos adequados ao público.",
      "Confira os convites existentes para acompanhar seu uso e sua validade antes de emitir outro.",
    ],
  },
  security: {
    title: "Guia de Auditoria",
    steps: [
      "Filtre os eventos por ação, tipo de registro ou período para investigar uma mudança.",
      "Exporte os registros exibidos em CSV ou JSON quando precisar documentar a análise.",
    ],
  },
  settings: {
    title: "Guia de Configurações",
    steps: [
      "Use Módulos para controlar a disponibilidade de recursos e APK Beta para ajustar o acesso ao app Android.",
      "Em Telegram, revise a integração com o bot. Em Layouts de fatura, avalie os modelos antes de liberá-los para uso global.",
    ],
  },
} as const;

export type AdminPageGuideId = keyof typeof ADMIN_PAGE_GUIDES;
