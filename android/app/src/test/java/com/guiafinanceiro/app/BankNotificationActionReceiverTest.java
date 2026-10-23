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
        assertTrue(BankNotificationActionReceiver.isIncome("Pix recebido", "Você recebeu um Pix de R$ 150,00"));
        assertTrue(BankNotificationActionReceiver.isIncome("Transferência", "Transferência recebida de João"));
        assertTrue(BankNotificationActionReceiver.isIncome("Crédito", "Crédito em conta efetuado"));
        assertTrue(BankNotificationActionReceiver.isIncome("Salário", "Seu salário de R$ 5.000 caiu na conta"));

        assertFalse(BankNotificationActionReceiver.isIncome("Nubank", "Compra de R$ 38,00 aprovada no cartão"));
        assertFalse(BankNotificationActionReceiver.isIncome("Inter", "Pagamento de boleto realizado com sucesso"));
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
