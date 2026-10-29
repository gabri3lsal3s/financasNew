package com.guiafinanceiro.app;

import static org.junit.Assert.*;

import org.junit.Test;

public class BankNotificationActionReceiverTest {

    @Test
    public void testConstants() {
        assertEquals("com.guiafinanceiro.app.ACTION_CONFIRM_TRANSACTION", BankNotificationActionReceiver.ACTION_CONFIRM);
        assertEquals("com.guiafinanceiro.app.ACTION_UNDO_TRANSACTION", BankNotificationActionReceiver.ACTION_UNDO);
        assertEquals("axis_confirmations", BankNotificationActionReceiver.CHANNEL_CONFIRMATIONS);
        assertEquals("confirmed_transactions_buffer", BankNotificationActionReceiver.KEY_CONFIRMED_BUFFER);
    }

    @Test
    public void testIsIncome() {
        // Receitas legítimas
        assertTrue(BankNotificationActionReceiver.isIncome("Pix recebido", "Você recebeu um Pix de R$ 150,00"));
        assertTrue(BankNotificationActionReceiver.isIncome("Transferência", "Transferência recebida de João"));
        assertTrue(BankNotificationActionReceiver.isIncome("Crédito", "Crédito em conta efetuado"));
        assertTrue(BankNotificationActionReceiver.isIncome("Itaú", "Crédito em conta no valor de R$ 1.500,00"));
        assertTrue(BankNotificationActionReceiver.isIncome("Salário", "Seu salário de R$ 5.000 caiu na conta"));
        assertTrue(BankNotificationActionReceiver.isIncome("Reembolso", "Reembolso aprovado de R$ 85,00"));
        assertTrue(BankNotificationActionReceiver.isIncome("Estorno", "Estorno no cartão de crédito de R$ 120,00 realizado"));
        assertTrue(BankNotificationActionReceiver.isIncome("XP", "Proventos recebidos no valor de R$ 45,00"));

        // Despesas e compras no crédito (não devem ser classificadas como renda)
        assertFalse(BankNotificationActionReceiver.isIncome("Nubank", "Compra no crédito à vista de R$ 50,00 aprovada"));
        assertFalse(BankNotificationActionReceiver.isIncome("Itaú", "Compra no crédito aprovada de R$ 120,00"));
        assertFalse(BankNotificationActionReceiver.isIncome("Bradesco", "Crédito à vista no valor de R$ 85,00 em Posto Ipiranga"));
        assertFalse(BankNotificationActionReceiver.isIncome("Santander", "Compra aprovada no Cartão SX: R$ 32,50 no crédito à vista em UBER"));
        assertFalse(BankNotificationActionReceiver.isIncome("C6 Bank", "Você pagou R$ 30,00 no crédito"));
        assertFalse(BankNotificationActionReceiver.isIncome("Banco do Brasil", "BB informa: compra de R$ 90,00 no credito a vista aprovada"));
        assertFalse(BankNotificationActionReceiver.isIncome("Inter", "Você recebeu um comprovante de compra no crédito de R$ 40,00"));
        assertFalse(BankNotificationActionReceiver.isIncome("Nubank", "Compra de R$ 38,00 aprovada no cartão"));
        assertFalse(BankNotificationActionReceiver.isIncome("Inter", "Pagamento de boleto realizado com sucesso"));
        assertFalse(BankNotificationActionReceiver.isIncome("Caixa", "Compra no credito aprovada R$ 75,00"));
        assertFalse(BankNotificationActionReceiver.isIncome("Mercado Pago", "Pix enviado com sucesso de R$ 30,00"));
        assertFalse(BankNotificationActionReceiver.isIncome("Bradesco", "Débito realizado na sua conta corrente R$ 110,00"));

        // Casos vazios e nulos
        assertFalse(BankNotificationActionReceiver.isIncome("", ""));
        assertFalse(BankNotificationActionReceiver.isIncome(null, null));
    }

    @Test
    public void testExtractPartyName() {
        // Pix recebido
        assertEquals("Maria Souza", BankNotificationActionReceiver.extractPartyName("Você recebeu um Pix de Maria Souza ***.123.456-** no valor de R$ 50,00"));
        assertEquals("Carlos Alberto", BankNotificationActionReceiver.extractPartyName("Pix recebido de Carlos Alberto via aplicativo"));

        // Pix enviado
        assertEquals("João Silva", BankNotificationActionReceiver.extractPartyName("Você enviou um Pix para João Silva ***.456.789-** com sucesso"));
        assertEquals("Supermercado Central", BankNotificationActionReceiver.extractPartyName("Pix enviado para Supermercado Central no valor de R$ 85,00"));

        // Sem favorecido explícito
        assertNull(BankNotificationActionReceiver.extractPartyName("Compra de R$ 38,00 aprovada"));
        assertNull(BankNotificationActionReceiver.extractPartyName(""));
        assertNull(BankNotificationActionReceiver.extractPartyName(null));
    }
}
