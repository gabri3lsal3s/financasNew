import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class BankNotificationListenerService extends NotificationListenerService {

    public static final String PREFS_NAME = "bank_notifications_prefs";
    public static final String KEY_BUFFER = "pending_notifications_buffer";
    public static final String KEY_ALLOWED_PACKAGES = "allowed_bank_packages";
    public static final String CHANNEL_ID = "bank_transaction_suggestions";
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

            String notifTitle = title != null && !title.trim().isEmpty() ? title : "Transação detectada";

            builder.setContentTitle(notifTitle)
                    .setContentText(text)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentIntent(reviewPending)
                    .setAutoCancel(true)
                    .addAction(new Notification.Action.Builder(null, "Confirmar", confirmPending).build())
                    .addAction(new Notification.Action.Builder(null, "Conferir", reviewPending).build());

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
