package com.guiafinanceiro.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class BankNotificationListenerService extends NotificationListenerService {

    public static final String PREFS_NAME = "bank_notifications_prefs";
    public static final String KEY_BUFFER = "pending_notifications_buffer";
    public static final String KEY_ALLOWED_PACKAGES = "allowed_bank_packages";
    private static final int MAX_BUFFER_SIZE = 30;

    public static final Set<String> DEFAULT_MONITORED_PACKAGES = new HashSet<>(Arrays.asList(
        // Bancos Tradicionais & Digitais
        "com.nu.production",
        "br.com.intermedium",
        "com.c6bank.app",
        "br.com.neon",
        "br.com.bradesco.next",
        "com.itau",
        "com.itau.personnalite",
        "com.bradesco",
        "com.santander.app",
        "br.com.santander.way",
        "br.gov.caixa.tem",
        "br.com.gabba.Caixa",
        "br.com.bb.android",

        // Carteiras Digitais & Pagamentos
        "com.google.android.apps.walletnfcrel",
        "com.samsung.android.spay",
        "com.samsung.android.raja.spay",
        "com.mercadopago.wallet",
        "com.picpay",
        "br.com.uol.ps",
        "br.com.uol.ps.myaccount",

        // Investimentos, Cripto & Contas Globais
        "com.btg.pactual.banking",
        "com.btgpactual.investimentos",
        "br.com.xp.carteira",
        "com.xpinc.investments",
        "br.com.rico",
        "br.com.rico.investimentos",
        "com.binance.dev",
        "com.nomadfinancial.app",
        "com.transferwise.android",

        // Cooperativas, Adquirentes & Outros
        "br.com.sicoob.net",
        "br.com.sicredi.mobile",
        "br.com.safra.mobile",
        "br.com.stone.ton",
        "co.stone.stone"
    ));

    /**
     * Retorna o conjunto de pacotes bancários autorizados pelo usuário.
     * Se ainda não houver preferência salva, adota os pacotes padrão homologados.
     */
    public Set<String> getAllowedPackages() {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            Set<String> saved = prefs.getStringSet(KEY_ALLOWED_PACKAGES, null);
            if (saved != null && !saved.isEmpty()) {
                return saved;
            }
        } catch (Exception ignored) {
        }
        return DEFAULT_MONITORED_PACKAGES;
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null) return;

        // REGRA DE OURO ANTI-FALSOS POSITIVOS:
        // Apenas pacotes de aplicativos bancários explicitamente autorizados são processados.
        // Qualquer app não bancário (WhatsApp, SMS, Shopee, lojas, etc.) é descartado de imediato.
        Set<String> allowedPackages = getAllowedPackages();
        if (!allowedPackages.contains(packageName)) {
            return;
        }

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleChar = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleChar != null ? titleChar.toString() : "";
        String text = bigTextChar != null ? bigTextChar.toString() : (textChar != null ? textChar.toString() : "");

        if (!hasFinancialSignal(text, title)) {
            return;
        }

        long timestamp = sbn.getPostTime();

        BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
        if (plugin != null) {
            plugin.onNotificationReceived(packageName, title, text, timestamp);
        } else {
            saveToOfflineBuffer(packageName, title, text, timestamp);
        }
    }

    /**
     * Persiste notificações recebidas em segundo plano quando o aplicativo estiver fechado
     * em um buffer circular seguro de SharedPreferences (capacidade para até 30 notificações).
     */
    private synchronized void saveToOfflineBuffer(String packageName, String title, String text, long timestamp) {
        try {
            android.content.SharedPreferences prefs = getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
            String currentJson = prefs.getString(KEY_BUFFER, "[]");
            org.json.JSONArray array = new org.json.JSONArray(currentJson);

            while (array.length() >= MAX_BUFFER_SIZE) {
                array.remove(0);
            }

            org.json.JSONObject item = new org.json.JSONObject();
            item.put("packageName", packageName);
            item.put("title", title);
            item.put("text", text);
            item.put("timestamp", timestamp);

            array.put(item);

            prefs.edit().putString(KEY_BUFFER, array.toString()).apply();
        } catch (Exception e) {
            android.util.Log.e("BankNotification", "Erro ao salvar notificacao offline no buffer", e);
        }
    }

    /**
     * Valida heuristicamente se a notificação possui sinal financeiro relevante
     * (compras, pagamentos, transferências, Pix, proventos, depósitos ou ordens de investimento).
     */
    static boolean hasFinancialSignal(String text, String title) {
        if (text == null) text = "";
        if (title == null) title = "";

        if (text.contains("R$") || text.contains("US$") || text.contains("USD") ||
            title.contains("R$") || title.contains("US$") || title.contains("USD")) {
            return true;
        }

        String lowerText = text.toLowerCase();
        String lowerTitle = title.toLowerCase();

        String[] signals = new String[] {
            "pix",
            "compra",
            "pago", "pagamento",
            "recebeu", "recebimento",
            "transferência", "transferencia",
            "depósito", "deposito",
            "ordem",
            "executada", "executado",
            "cripto", "crypto",
            "dividendo", "dividendos",
            "rendimento", "rendimentos",
            "investimento", "investimentos"
        };

        for (String signal : signals) {
            if (lowerText.contains(signal) || lowerTitle.contains(signal)) {
                return true;
            }
        }

        return false;
    }
}
