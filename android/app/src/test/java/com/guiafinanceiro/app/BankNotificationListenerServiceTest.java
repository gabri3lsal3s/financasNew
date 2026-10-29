package com.guiafinanceiro.app;

import static org.junit.Assert.*;

import org.junit.Test;

public class BankNotificationListenerServiceTest {

    @Test
    public void testExtractAmountText_validAmounts() {
        // R$ com espaço
        assertEquals("R$ 38,00", BankNotificationListenerService.extractAmountText("Nubank", "Compra de R$ 38,00 aprovada no cartão"));
        
        // R$ sem espaço
        assertEquals("R$150,50", BankNotificationListenerService.extractAmountText("Inter", "Pix recebido de R$150,50"));
        
        // Formato com milhar
        assertEquals("R$ 1.500,00", BankNotificationListenerService.extractAmountText("Bradesco", "Transferência de R$ 1.500,00 enviada"));
        
        // US$ / USD
        assertEquals("US$ 45,00", BankNotificationListenerService.extractAmountText("Nomad", "Compra internacional US$ 45,00"));
        assertEquals("USD 20,00", BankNotificationListenerService.extractAmountText("Wise", "Conversão de USD 20,00 concluída"));
    }

    @Test
    public void testExtractAmountText_returnsNullForPromotionsAndNonMonetary() {
        // TRAVA 1 (F35 / Tarefa 10.1): Descarta anúncios e notificações institucionais sem quantia
        assertNull(BankNotificationListenerService.extractAmountText("Nubank", "Você tem um limite pré-aprovado disponível. Saiba mais!"));
        assertNull(BankNotificationListenerService.extractAmountText("Inter", "Dica: descubra como organizar seus investimentos no Super App"));
        assertNull(BankNotificationListenerService.extractAmountText("C6 Bank", "Novo informe de rendimentos disponível para download"));
        assertNull(BankNotificationListenerService.extractAmountText("Itaú", "Segurança: confirmamos o acesso em seu novo dispositivo"));
        assertNull(BankNotificationListenerService.extractAmountText("Santander", "Aproveite 10% de cashback no shopping Santander"));
        assertNull(BankNotificationListenerService.extractAmountText("", ""));
        assertNull(BankNotificationListenerService.extractAmountText(null, null));
    }

    @Test
    public void testIsBlacklistedNotification_blocksOffersEvenWithMoneyAmount() {
        // TRAVA 2 (F35 / Tarefa 10.2): Blacklist semântica anti-marketing bloqueia ofertas com valor monetário
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Você tem um empréstimo de R$ 5.000,00 pré-aprovado! Aproveite", "Nubank"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Crédito pré-aprovado de R$ 10.000,00 liberado na sua conta", "Inter"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Aproveite seu limite especial de R$ 2.000,00", "Itaú"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Seu novo limite aprovado é de R$ 3.500,00", "Bradesco"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Ganhe 5% de cashback nas compras do shopping Santander", "Santander"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Sua fatura fechou no valor de R$ 850,20", "Nubank"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Resumo da fatura: R$ 420,00. Pague o valor mínimo", "C6 Bank"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Saldo insuficiente para transferência de R$ 100,00", "Banco do Brasil"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Compra negada de R$ 50,00: cartão bloqueado", "Caixa"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Seu token de segurança é 849201", "Inter"));
        assertTrue(BankNotificationListenerService.isBlacklistedNotification("Conheça as novas opções de seguro de vida", "Bradesco"));
    }

    @Test
    public void testIsBlacklistedNotification_allowsGenuineFinancialTransactions() {
        // Transações reais legítimas NÃO são bloqueadas pela blacklist
        assertFalse(BankNotificationListenerService.isBlacklistedNotification("Compra de R$ 38,00 no cartão de crédito aprovada em Padaria", "Nubank"));
        assertFalse(BankNotificationListenerService.isBlacklistedNotification("Pix recebido de R$ 150,50 de Maria Silva", "Inter"));
        assertFalse(BankNotificationListenerService.isBlacklistedNotification("Transferência enviada de R$ 500,00 para Pedro Santos", "Itaú"));
        assertFalse(BankNotificationListenerService.isBlacklistedNotification("Pagamento de boleto de R$ 250,00 realizado com sucesso", "Bradesco"));
        assertFalse(BankNotificationListenerService.isBlacklistedNotification("", ""));
        assertFalse(BankNotificationListenerService.isBlacklistedNotification(null, null));
    }

    @Test
    public void testHasFinancialSignal() {
        // 1. Verbos e termos de fato consumado (F35 / Tarefa 10.3)
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Compra aprovada no cartão final 1234", "Nubank"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Pix recebido de João da Silva", "Inter"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Transferência enviada com sucesso", "Itaú"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Você enviou um Pix para Maria", "C6 Bank"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Boleto pago com sucesso", "Bradesco"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Ordem executada com sucesso", "BTG Pactual"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Rendimento creditado em conta", "XP"));

        // 2. Quantia monetária explícita combinada com canal financeiro concreto
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Despesa de R$ 85,00 no débito", "Nubank"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Pagamento via TED de R$ 500,00", "Santander"));

        // 3. Notificações sintéticas de Carteiras Digitais (Google Wallet / Samsung Pay - Tarefa 1.2)
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Padaria Estrela · R$ 35,50 com Nubank •••• 1234", "Google Pay"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("R$ 42,00 em Starbucks", "Samsung Pay"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("R$ 18,90 · Droga Raia", "Samsung Wallet"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Compra de R$ 12,00 no débito", "Carteira Google"));

        // 4. Vocabulário moderno de transações (utilizado, cobrado, autorizada, debitado, nfc, aproximação - Tarefa 1.2)
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Cartão final 1234 utilizado com sucesso", "Nubank"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Valor de R$ 50,00 cobrado na sua fatura", "Itaú"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Transação autorizada no valor de R$ 90,00", "C6 Bank"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Transação aprovada de R$ 33,00", "Bradesco"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("R$ 45,00 debitado da sua conta", "Inter"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Você pagou R$ 35,00 para Restaurante", "PicPay"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Pagamento por aproximação de R$ 22,00", "Santander"));
        assertTrue(BankNotificationListenerService.hasFinancialSignal("Pagamento via NFC aprovado de R$ 15,00", "Caixa"));

        // 5. Rejeição imediata de construções no gerúndio ou tom instrutivo/promocional
        assertFalse(BankNotificationListenerService.hasFinancialSignal("Economize tempo fazendo Pix e pagando boletos pelo app", "Nubank"));
        assertFalse(BankNotificationListenerService.hasFinancialSignal("Pague com cartão e ganhe pontos em dobro", "Inter"));
        assertFalse(BankNotificationListenerService.hasFinancialSignal("Faça Pix no crédito para parcelar compras", "C6 Bank"));
        assertFalse(BankNotificationListenerService.hasFinancialSignal("Faca pix no credito com taxas reduzidas", "Neon"));
        assertFalse(BankNotificationListenerService.hasFinancialSignal("Invista a partir de R$ 10,00 e veja seu dinheiro render", "Itaú"));

        // 6. Textos vazios ou não financeiros
        assertFalse(BankNotificationListenerService.hasFinancialSignal("Saiba mais sobre nossos novos produtos", "Banco"));
        assertFalse(BankNotificationListenerService.hasFinancialSignal("", ""));
        assertFalse(BankNotificationListenerService.hasFinancialSignal(null, null));
    }
}
