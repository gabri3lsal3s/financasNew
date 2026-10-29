package com.guiafinanceiro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class BankNotificationListenerService extends NotificationListenerService {

    public static final String PREFS_NAME = "bank_notifications_prefs";
    public static final String KEY_BUFFER = "pending_notifications_buffer";
    public static final String KEY_ALLOWED_PACKAGES = "allowed_bank_packages";
    public static final String CHANNEL_ID = "bank_transaction_suggestions";
    private static final int MAX_BUFFER_SIZE = 30;

    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
        "(?:R\\$\\s*|US\\$\\s*|USD\\s*)(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+(?:,\\d{2})?)"
    );

    private static final Pattern BLACKLIST_MARKETING_PATTERN = Pattern.compile(
        "(?i)\\b(?:" +
        "saiba\\s+mais|clique\\s+aqui|conhe[çc]a|confira|aproveite|ganhe\\s+f[ôo]lego|" +
        "dica(?:\\s+do)?|novidade|descubra|experimente|empr[ée]stimo|cr[ée]dito\\s+pr[ée]-aprovado|" +
        "limite\\s+(?:dispon[íi]vel|aprovado|aumentou|liberado|especial)|aumento\\s+de\\s+limite|" +
        "novo\\s+limite|dinheiro\\s+extra|seguro(?:\\s+de)?|open\\s+finance|portabilidade|" +
        "traga\\s+seu\\s+sal[áa]rio|indique\\s+um\\s+amigo|cashback|acumule\\s+pontos|shopping|" +
        "pontos\\s+do\\s+cart[ãa]o|fatura\\s+(?:fechou|fechada|abriu|aberta)|resumo\\s+d[aeo]\\s+fatura|" +
        "pague\\s+o\\s+valor\\s+m[íi]nimo|n[ãa]o\\s+foi\\s+autorizad[ao]|compra\\s+negada|" +
        "saldo\\s+insuficiente|cart[ãa]o\\s+bloqueado|token|c[óo]digo\\s+de\\s+seguran[çc]a" +
        ")\\b"
    );

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
        "com.samsung.android.app.spay",
        "com.mercadopago.wallet",
        "com.picpay",
        "br.com.uol.ps",
        "br.com.uol.ps.myaccount",
        "com.recargapay",

        // Fintechs & Outros Bancos
        "com.willbank.app",
        "br.com.willbank",
        "br.com.original.bank",
        "br.com.agibank",

        // Investimentos, Cripto & Contas Globais
        "com.btg.pactual.banking",
        "com.btgpactual.investimentos",
        "br.com.btg.pactual.digital",
        "br.com.xp.carteira",
        "com.xpinc.investments",
        "br.com.xp.investimentos",
        "br.com.rico",
        "br.com.rico.investimentos",
        "br.com.rico.rico",
        "com.binance.dev",
        "com.nomadfinancial.app",
        "com.nomadglobal.app",
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
        if (titleChar == null || titleChar.toString().trim().isEmpty()) {
            titleChar = extras.getCharSequence(Notification.EXTRA_TITLE_BIG);
        }

        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        }
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            textChar = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);
        }
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            textChar = extras.getCharSequence(Notification.EXTRA_INFO_TEXT);
        }
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            textChar = extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT);
        }
        if (textChar == null || textChar.toString().trim().isEmpty()) {
            CharSequence[] lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
            if (lines != null && lines.length > 0) {
                StringBuilder sb = new StringBuilder();
                for (CharSequence line : lines) {
                    if (line != null && line.length() > 0) {
                        if (sb.length() > 0) sb.append(" ");
                        sb.append(line);
                    }
                }
                textChar = sb.toString();
            }
        }
        if ((textChar == null || textChar.toString().trim().isEmpty()) && notification.tickerText != null) {
            textChar = notification.tickerText;
        }

        String title = titleChar != null ? titleChar.toString().trim() : "";
        String text = textChar != null ? textChar.toString().trim() : "";

        // TRAVA 1: Exigência inegociável de quantia monetária formatada (F35 / Tarefa 10.1)
        // Transações financeiras sem valor não existem no mundo real.
        // Descarta instantaneamente ~95% dos anúncios, dicas e alertas institucionais.
        String amountFormatted = extractAmountText(title, text);
        if (amountFormatted == null) {
            return;
        }

        // TRAVA 2: Blacklist Semântica Anti-Marketing e Ofertas (F35 / Tarefa 10.2)
        if (isBlacklistedNotification(text, title)) {
            return;
        }

        if (!hasFinancialSignal(text, title)) {
            return;
        }

        long timestamp = sbn.getPostTime();

        // Dispara notificação push nativa interativa mesmo com o app em segundo plano ou fechado
        postInteractivePush(packageName, title, text, timestamp);

        BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
        if (plugin != null) {
            plugin.onNotificationReceived(packageName, title, text, timestamp);
        } else {
            saveToOfflineBuffer(packageName, title, text, timestamp);
        }
    }

    /**
     * Extrai valor monetário presente no título ou texto da notificação (ex: "R$ 10,00").
     */
    static String extractAmountText(String title, String text) {
        String combined = (title != null ? title : "") + " " + (text != null ? text : "");
        Matcher m = AMOUNT_PATTERN.matcher(combined);
        if (m.find()) {
            return m.group(0).trim();
        }
        return null;
    }

    /**
     * Verifica se a notificação contém termos de marketing, ofertas de crédito ou mensagens institucionais (TRAVA 2).
     */
    static boolean isBlacklistedNotification(String text, String title) {
        String combined = (title != null ? title : "") + " " + (text != null ? text : "");
        return BLACKLIST_MARKETING_PATTERN.matcher(combined).find();
    }

    /**
     * Emite notificação nativa interativa no Android com botões [Confirmar] e [Conferir].
     */
    private void postInteractivePush(String packageName, String title, String text, long timestamp) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = nm.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(
                            CHANNEL_ID,
                            "Transações Detectadas",
                            NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Notificações interativas de compras e receitas bancárias com ação rápida");
                    channel.enableVibration(true);
                    nm.createNotificationChannel(channel);
                }
            }

            int notifId = (int) (Math.abs(timestamp ^ (title.hashCode() + text.hashCode())) % 1000000000) + 1000;

            // Ação 1: Confirmar (BroadcastReceiver)
            Intent confirmIntent = new Intent(this, BankNotificationActionReceiver.class);
            confirmIntent.setAction(BankNotificationActionReceiver.ACTION_CONFIRM);
            confirmIntent.putExtra("notificationId", notifId);
            confirmIntent.putExtra("packageName", packageName);
            confirmIntent.putExtra("title", title);
            confirmIntent.putExtra("text", text);
            confirmIntent.putExtra("timestamp", timestamp);

            PendingIntent confirmPending = PendingIntent.getBroadcast(
                    this,
                    notifId,
                    confirmIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Ação 2: Conferir (abre MainActivity no modo rápido do wizard)
            Intent reviewIntent = new Intent(this, MainActivity.class);
            reviewIntent.setAction(MainActivity.ACTION_REVIEW_TRANSACTION);
            reviewIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            reviewIntent.putExtra("packageName", packageName);
            reviewIntent.putExtra("title", title);
            reviewIntent.putExtra("text", text);
            reviewIntent.putExtra("timestamp", timestamp);
            reviewIntent.putExtra("notificationId", notifId);

            PendingIntent reviewPending = PendingIntent.getActivity(
                    this,
                    notifId + 10,
                    reviewIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            String amountFormatted = extractAmountText(title, text);
            boolean isIncome = BankNotificationActionReceiver.isIncome(title, text);
            String partyName = BankNotificationActionReceiver.extractPartyName(text);

            String notifTitle = isIncome ? "Renda detectada" : "Transação detectada";
            if (amountFormatted != null) {
                notifTitle += " · " + amountFormatted;
            }

            String notifBody;
            if (partyName != null) {
                notifBody = partyName + " • " + (title != null && !title.trim().isEmpty() ? title.trim() : "Banco");
            } else if (text != null && !text.trim().isEmpty()) {
                notifBody = text.trim();
            } else {
                notifBody = "Toque em Adicionar Rápido para salvar em 2º plano ou Conferir e Salvar para editar.";
            }

            Notification.BigTextStyle bigStyle = new Notification.BigTextStyle()
                    .setBigContentTitle(notifTitle)
                    .bigText(notifBody);

            builder.setContentTitle(notifTitle)
                    .setContentText(notifBody)
                    .setStyle(bigStyle)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentIntent(reviewPending)
                    .setAutoCancel(true)
                    .addAction(new Notification.Action.Builder(null, "Adicionar Rápido", confirmPending).build())
                    .addAction(new Notification.Action.Builder(null, "Conferir e Salvar", reviewPending).build());

            nm.notify(notifId, builder.build());

        } catch (Exception e) {
            Log.e("BankNotification", "Erro ao disparar push nativo interativo", e);
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
     * Valida heuristicamente se a notificação possui sinal financeiro relevante de fato consumado
     * (compras, pagamentos, transferências, Pix, proventos, depósitos ou ordens de investimento)
     * e descarta imediatamente construções no gerúndio ou de tom sugestivo/promocional (F35 / Tarefa 10.3).
     */
    static boolean hasFinancialSignal(String text, String title) {
        if (text == null) text = "";
        if (title == null) title = "";

        String combined = (title + " " + text).toLowerCase();

        // 1. Rejeição imediata de construções no gerúndio ou tom instrutivo
        if (combined.contains("fazendo pix") || combined.contains("pagando boleto") ||
            combined.contains("pague com cart") || combined.contains("faça pix no cr") ||
            combined.contains("faca pix no cr") || combined.contains("invista a partir")) {
            return false;
        }

        // 2. Verbos e termos de fato consumado (movimentações financeiras reais efetivadas)
        String[] executedSignals = new String[] {
            "compra aprovada", "compra realizada", "compra de r$", "compra no cartão", "compra no cartao",
            "você recebeu", "voce recebeu", "recebido", "recebida", "recebimento",
            "você pagou", "voce pagou", "pagou", "pago com sucesso", "pagamento realizado", "pagamento efetuado", "pagamento aprovado",
            "você enviou", "voce enviou", "enviou um pix", "pix enviado", "pix de r$", "pix para", "enviado", "enviada",
            "boleto pago", "transferência recebida", "transferencia recebida",
            "transferência enviada", "transferencia enviada", "transferência realizada", "transferencia realizada",
            "depósito recebido", "deposito recebido", "crédito em conta", "credito em conta",
            "debitado", "debitada", "débito realizado", "debito realizado",
            "autorizada", "autorizado", "transação autorizada", "transacao autorizada",
            "aprovada", "aprovado", "transação aprovada", "transacao aprovada",
            "utilizado", "utilizada", "limite utilizado",
            "cobrado", "cobrada",
            "aproximação", "aproximacao", "por aproximação", "por aproximacao", "nfc",
            "transação", "transacao",
            "google pay", "google wallet", "carteira google", "samsung pay", "samsung wallet", "gpay", "spay",
            "ordem executada", "dividendo", "dividendos", "rendimento", "rendimentos"
        };

        for (String signal : executedSignals) {
            if (combined.contains(signal)) {
                return true;
            }
        }

        // 3. Validação combinada de quantia monetária explícita com canal financeiro concreto ou carteira
        if (combined.contains("r$") || combined.contains("us$") || combined.contains("usd") || combined.contains("brl")) {
            String[] channelSignals = new String[] {
                "compra", "pix", "cartão", "cartao", "transferência", "transferencia",
                "boleto", "ted", "doc", "debito", "débito", "crédito", "credito",
                "google pay", "google wallet", "carteira google", "samsung pay", "samsung wallet", "gpay", "spay",
                "aproximação", "aproximacao", "nfc", "transação", "transacao", "pago", "pagou",
                "cobrado", "cobrada", "debitado", "debitada", "autorizado", "autorizada",
                "aprovado", "aprovada", "utilizado", "utilizada", "enviado", "enviada"
            };
            for (String cs : channelSignals) {
                if (combined.contains(cs)) {
                    return true;
                }
            }
        }

        return false;
    }
}
