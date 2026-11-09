import { describe, expect, it } from "vitest";
import { TOUR_TRACK_METAS } from "./tour-catalog";
import {
  cleanPathWithoutInvasiveParams,
  getTourHandoffDestination,
  INVASIVE_QUERY_PARAMS,
  isCompleteTourTrack,
} from "./handoff";
import type { AnyTourTrackId } from "./types";

describe("cleanPathWithoutInvasiveParams", () => {
  it("retorna '/' quando a rota de entrada for vazia, nula ou undefined", () => {
    expect(cleanPathWithoutInvasiveParams(undefined)).toBe("/");
    expect(cleanPathWithoutInvasiveParams("")).toBe("/");
    expect(cleanPathWithoutInvasiveParams("   ")).toBe("/");
  });

  it("mantém rotas limpas sem parâmetros inalteradas", () => {
    expect(cleanPathWithoutInvasiveParams("/")).toBe("/");
    expect(cleanPathWithoutInvasiveParams("/cartoes")).toBe("/cartoes");
    expect(cleanPathWithoutInvasiveParams("/orcamentos")).toBe("/orcamentos");
    expect(cleanPathWithoutInvasiveParams("/investments")).toBe("/investments");
  });

  it("remove parâmetros invasivos de modais (?novo, ?modo, ?forma)", () => {
    expect(cleanPathWithoutInvasiveParams("/transacoes?novo=despesa")).toBe("/transacoes");
    expect(cleanPathWithoutInvasiveParams("/cartoes?novo=cartao")).toBe("/cartoes");
    expect(cleanPathWithoutInvasiveParams("/investments?novo=investimento")).toBe("/investments");
    expect(cleanPathWithoutInvasiveParams("/?novo=transacao&modo=rapido")).toBe("/");
    expect(cleanPathWithoutInvasiveParams("/transacoes?novo=pix&forma=pix")).toBe("/transacoes");
  });

  it("preserva parâmetros legítimos de visualização e abas (tab, month, category)", () => {
    expect(cleanPathWithoutInvasiveParams("/cartoes?tab=fatura")).toBe("/cartoes?tab=fatura");
    expect(cleanPathWithoutInvasiveParams("/investments?tab=aporte")).toBe("/investments?tab=aporte");
    expect(cleanPathWithoutInvasiveParams("/investments?tab=metas")).toBe("/investments?tab=metas");
    expect(cleanPathWithoutInvasiveParams("/transacoes?month=2026-11")).toBe("/transacoes?month=2026-11");
  });

  it("expurga apenas os parâmetros invasivos preservando os legítimos em URLs compostas", () => {
    expect(cleanPathWithoutInvasiveParams("/cartoes?tab=fatura&novo=cartao")).toBe("/cartoes?tab=fatura");
    expect(cleanPathWithoutInvasiveParams("/investments?tab=aporte&novo=investimento")).toBe(
      "/investments?tab=aporte",
    );
  });
});

describe("isCompleteTourTrack", () => {
  it("identifica corretamente as trilhas que são Tours Completos consolidados", () => {
    expect(isCompleteTourTrack("finances")).toBe(true);
    expect(isCompleteTourTrack("investments")).toBe(true);
    expect(isCompleteTourTrack("settings")).toBe(true);
    expect(isCompleteTourTrack("settings_support")).toBe(true);
  });

  it("retorna false para micro-tours individuais e valores nulos", () => {
    expect(isCompleteTourTrack("finances_overview")).toBe(false);
    expect(isCompleteTourTrack("finances_wizard")).toBe(false);
    expect(isCompleteTourTrack("finances_cards")).toBe(false);
    expect(isCompleteTourTrack("finances_budgets")).toBe(false);
    expect(isCompleteTourTrack("finances_insights")).toBe(false);
    expect(isCompleteTourTrack("investments_overview")).toBe(false);
    expect(isCompleteTourTrack("investments_assets")).toBe(false);
    expect(isCompleteTourTrack("investments_targets")).toBe(false);
    expect(isCompleteTourTrack("investments_aporte")).toBe(false);
    expect(isCompleteTourTrack("app_native_apk")).toBe(false);
    expect(isCompleteTourTrack(null)).toBe(false);
    expect(isCompleteTourTrack(undefined)).toBe(false);
  });
});

describe("getTourHandoffDestination", () => {
  describe("Tours Completos (Abertura Guiada de Modais e Fluxos Principais)", () => {
    it("No Tour Completo de Finanças ('finances'), direciona para /?novo=despesa abrindo o LaunchWizard", () => {
      expect(getTourHandoffDestination("finances", "/")).toBe("/?novo=despesa");
      expect(getTourHandoffDestination("finances", "/relatorios")).toBe("/?novo=despesa");
      expect(getTourHandoffDestination("finances", "/cartoes")).toBe("/?novo=despesa");
      expect(getTourHandoffDestination("finances", undefined)).toBe("/?novo=despesa");
    });

    it("No Tour Completo de Investimentos ('investments'), direciona para /investments?novo=investimento", () => {
      expect(getTourHandoffDestination("investments", "/investments")).toBe(
        "/investments?novo=investimento",
      );
      expect(getTourHandoffDestination("investments", "/investments?tab=proventos")).toBe(
        "/investments?novo=investimento",
      );
      expect(getTourHandoffDestination("investments", "/")).toBe(
        "/investments?novo=investimento",
      );
      expect(getTourHandoffDestination("investments", undefined)).toBe(
        "/investments?novo=investimento",
      );
    });

    it("No Tour Completo de Configurações e Suporte ('settings' / 'settings_support'), direciona para /configuracoes?tab=suporte", () => {
      expect(getTourHandoffDestination("settings", "/configuracoes")).toBe(
        "/configuracoes?tab=suporte",
      );
      expect(getTourHandoffDestination("settings_support", "/configuracoes")).toBe(
        "/configuracoes?tab=suporte",
      );
      expect(getTourHandoffDestination("settings_support", "/")).toBe(
        "/configuracoes?tab=suporte",
      );
      expect(getTourHandoffDestination("settings_support", undefined)).toBe(
        "/configuracoes?tab=suporte",
      );
    });

    it("No Tour Completo de Finanças Compartilhadas ('shared_finances'), direciona para /familia", () => {
      expect(getTourHandoffDestination("shared_finances", "/")).toBe("/familia");
      expect(getTourHandoffDestination("shared_finances", "/transacoes")).toBe("/familia");
      expect(getTourHandoffDestination("shared_finances", "/familia")).toBe("/familia");
      expect(getTourHandoffDestination("shared_finances", undefined)).toBe("/familia");
    });
  });

  describe("Micro-Tours Individuais (Regra de Ouro: Zero Interrupção / Zero Modais Invasivos)", () => {
    it("finances_overview: encerra sem modal, permanecendo na rota limpa", () => {
      expect(getTourHandoffDestination("finances_overview", "/")).toBe("/");
      expect(getTourHandoffDestination("finances_overview", "/?novo=despesa")).toBe("/");
    });

    it("finances_wizard: encerra sem modal, sanitizando a URL para /transacoes", () => {
      expect(getTourHandoffDestination("finances_wizard", "/transacoes?novo=despesa")).toBe(
        "/transacoes",
      );
      expect(getTourHandoffDestination("finances_wizard", "/transacoes")).toBe("/transacoes");
    });

    it("finances_cards: encerra sem modal em /cartoes, preservando abas como ?tab=fatura e expurgando ?novo=cartao", () => {
      expect(getTourHandoffDestination("finances_cards", "/cartoes")).toBe("/cartoes");
      expect(getTourHandoffDestination("finances_cards", "/cartoes?tab=fatura")).toBe(
        "/cartoes?tab=fatura",
      );
      expect(getTourHandoffDestination("finances_cards", "/cartoes?novo=cartao")).toBe(
        "/cartoes",
      );
    });

    it("finances_budgets: encerra sem modal em /orcamentos (não injeta modal de categoria)", () => {
      expect(getTourHandoffDestination("finances_budgets", "/orcamentos")).toBe("/orcamentos");
      expect(
        getTourHandoffDestination("finances_budgets", "/orcamentos?novo=categoria"),
      ).toBe("/orcamentos");
    });

    it("finances_insights: encerra sem modal em /relatorios", () => {
      expect(getTourHandoffDestination("finances_insights", "/relatorios")).toBe("/relatorios");
    });

    it("investments_overview: encerra sem modal em /investments", () => {
      expect(getTourHandoffDestination("investments_overview", "/investments")).toBe(
        "/investments",
      );
    });

    it("investments_assets: encerra sem modal em /investments (não abre cadastro de ativo)", () => {
      expect(getTourHandoffDestination("investments_assets", "/investments")).toBe(
        "/investments",
      );
      expect(
        getTourHandoffDestination("investments_assets", "/investments?novo=investimento"),
      ).toBe("/investments");
    });

    it("investments_targets: encerra sem modal preservando a aba /investments?tab=metas", () => {
      expect(
        getTourHandoffDestination("investments_targets", "/investments?tab=metas"),
      ).toBe("/investments?tab=metas");
    });

    it("investments_aporte: encerra sem modal preservando a aba /investments?tab=aporte", () => {
      expect(
        getTourHandoffDestination("investments_aporte", "/investments?tab=aporte"),
      ).toBe("/investments?tab=aporte");
    });

    it("app_native_apk: encerra sem modal na raiz /", () => {
      expect(getTourHandoffDestination("app_native_apk", "/")).toBe("/");
    });
  });

  describe("Encerramento Exploratório sem Trilha (track === null ou undefined)", () => {
    it("retorna a rota atual limpa sem abrir modais", () => {
      expect(getTourHandoffDestination(null, "/cartoes")).toBe("/cartoes");
      expect(getTourHandoffDestination(null, "/cartoes?novo=cartao")).toBe("/cartoes");
      expect(getTourHandoffDestination(null, "/investments")).toBe("/investments");
      expect(getTourHandoffDestination(null, "/orcamentos")).toBe("/orcamentos");
      expect(getTourHandoffDestination(null, "/")).toBe("/");
      expect(getTourHandoffDestination(null, undefined)).toBe("/");
    });
  });

  describe("Testar Conclusão Limpa de Todos os Tours (Fase 8 — Tarefa 8.11)", () => {
    const allTrackIds = Object.keys(TOUR_TRACK_METAS) as AnyTourTrackId[];

    const microTours = allTrackIds.filter((t) => !isCompleteTourTrack(t));
    const completeTours = allTrackIds.filter((t) => isCompleteTourTrack(t));

    it("valida que todos os micro-tours (15 trilhas) encerram com URL 100% limpa sem nenhum parâmetro invasivo", () => {
      expect(microTours).toHaveLength(15);

      const dirtyQueryString = INVASIVE_QUERY_PARAMS.map((param, i) => `${param}=val_${i}`).join("&");
      const sampleDirtyUrl = `/painel?tab=geral&${dirtyQueryString}`;

      for (const trackId of microTours) {
        const destination = getTourHandoffDestination(trackId, sampleDirtyUrl);

        // Deve preservar o pathname e query params legítimos (tab=geral)
        expect(destination.startsWith("/painel")).toBe(true);
        expect(destination).toContain("tab=geral");

        // NENHUM parâmetro invasivo deve restar na URL de destino
        for (const invasiveKey of INVASIVE_QUERY_PARAMS) {
          expect(destination).not.toContain(`${invasiveKey}=`);
        }
      }
    });

    it("valida que todos os tours completos (4 trilhas) direcionam para seus modais de partida de conta real", () => {
      expect(completeTours).toHaveLength(4);

      for (const trackId of completeTours) {
        const destination = getTourHandoffDestination(trackId, "/qualquer-rota-previa");

        if (trackId === "finances") {
          expect(destination).toBe("/?novo=despesa");
        } else if (trackId === "shared_finances") {
          expect(destination).toBe("/familia");
        } else if (trackId === "investments") {
          expect(destination).toBe("/investments?novo=investimento");
        } else if (trackId === "settings_support") {
          expect(destination).toBe("/configuracoes?tab=suporte");
        }
      }
    });

    it("assegura que 100% das 19 trilhas do catálogo possuem tratamento determinístico em getTourHandoffDestination", () => {
      expect(allTrackIds).toHaveLength(19);

      for (const trackId of allTrackIds) {
        const destFromRoot = getTourHandoffDestination(trackId, "/");
        expect(typeof destFromRoot).toBe("string");
        expect(destFromRoot.startsWith("/")).toBe(true);
      }
    });
  });
});
