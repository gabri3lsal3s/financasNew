package com.guiafinanceiro.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

public class BankNotificationActionReceiver extends BroadcastReceiver {

    private static final String TAG = "BankNotifActionReceiver";
    public static final String ACTION_CONFIRM = "com.guiafinanceiro.app.ACTION_CONFIRM_TRANSACTION";
    public static final String ACTION_UNDO = "com.guiafinanceiro.app.ACTION_UNDO_TRANSACTION";
    public static final String KEY_CONFIRMED_BUFFER = "confirmed_transactions_buffer";
    public static final String CHANNEL_CONFIRMATIONS = "axis_confirmations";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        int notificationId = intent.getIntExtra("notificationId", 0);
        String packageName = intent.getStringExtra("packageName");
        String title = intent.getStringExtra("title");
        String text = intent.getStringExtra("text");
        long timestamp = intent.getLongExtra("timestamp", System.currentTimeMillis());

        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && notificationId != 0) {
            nm.cancel(notificationId);
        }

        if (ACTION_CONFIRM.equals(action)) {
            Log.d(TAG, "Confirmando transacao em segundo plano: " + title + " - " + text);

            saveConfirmedTransaction(context, packageName, title, text, timestamp);

            BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
            if (plugin != null) {
                plugin.onTransactionConfirmed(packageName, title, text, timestamp);
            }

            postUndoNotification(context, nm, notificationId, packageName, title, text, timestamp);

        } else if (ACTION_UNDO.equals(action)) {
            Log.d(TAG, "Desfazendo transacao confirmada: " + title);
            removeConfirmedTransaction(context, timestamp);

            BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
            if (plugin != null) {
                plugin.onTransactionUndone(packageName, title, text, timestamp);
            }

            postUndoneConfirmationNotification(context, nm, notificationId);
        }
    }

    /**
     * Determina se a notificação bancária representa uma entrada de receita (income) ou despesa (expense).
     * Garante que compras no crédito, crédito à vista ou saídas não sejam classificadas como renda.
     */
    public static boolean isIncome(String title, String text) {
        if (title == null && text == null) return false;
        String combined = ((title != null ? title : "") + " " + (text != null ? text : "")).toLowerCase();
        if (combined.trim().isEmpty()) return false;

        // 1. Estornos e reembolsos são entradas financeiras (reversão de valores)
        if (combined.contains("estorno") || combined.contains("reembolso") ||
            combined.contains("devolução pix") || combined.contains("devolucao pix") ||
            combined.contains("pix devolvido")) {
            return true;
        }

        // 2. Sinais inequívocos de compra ou despesa (têm precedência sobre termos genéricos de recebimento)
        if (combined.contains("crédito à vista") || combined.contains("credito a vista") ||
            combined.contains("crédito parcelado") || combined.contains("credito parcelado") ||
            combined.contains("compra no crédito") || combined.contains("compra no credito") ||
            combined.contains("compra no débito") || combined.contains("compra no debito") ||
            combined.contains("compra aprovada") || combined.contains("compra realizada") ||
            combined.contains("compra autorizada") || combined.contains("compra de") ||
            combined.contains("você pagou") || combined.contains("voce pagou") ||
            combined.contains("pagamento de") || combined.contains("pagamento realizado") ||
            combined.contains("pagamento efetuado") || combined.contains("pix enviado") ||
            combined.contains("transferência enviada") || combined.contains("transferencia enviada") ||
            combined.contains("débito realizado") || combined.contains("debito realizado") ||
            combined.contains("valor debitado") || combined.contains("debitado")) {
            return false;
        }

        // 3. Sinais legítimos de entrada / renda financeira
        return combined.contains("recebeu") || combined.contains("recebido") || combined.contains("recebida") ||
               combined.contains("crédito em conta") || combined.contains("credito em conta") ||
               combined.contains("creditado em conta") || combined.contains("creditada em conta") ||
               combined.contains("creditado na sua conta") || combined.contains("creditada na sua conta") ||
               combined.contains("transferência recebida") || combined.contains("transferencia recebida") ||
               combined.contains("pix recebido") || combined.contains("salário") || combined.contains("salario") ||
               combined.contains("folha de pagamento") || combined.contains("depósito recebido") ||
               combined.contains("deposito recebido") || combined.contains("depósito em conta") ||
               combined.contains("deposito em conta") || combined.contains("ted recebida") ||
               combined.contains("doc recebido") || combined.contains("proventos") ||
               combined.contains("rendimentos") || combined.contains("dividendos");
    }

    public static String extractPartyName(String text) {
        if (text == null) return null;
        try {
            // Padrão Pix recebido: "Você recebeu um Pix de [Nome] ***..."
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "(?:recebeu\\s+(?:um\\s+)?pix|pix\\s+recebido|transfer[êe]ncia\\s+recebida)\\s+de\\s+([A-Za-zÀ-ÿ\\s'-]{2,50}?)(?:\\s+[*0-9.-]{6,18})?(?:\\s+(?:via|com\\s+sucesso|no\\s+valor|de\\s+R\\$|valor)|\\.|$)",
                java.util.regex.Pattern.CASE_INSENSITIVE
            );
            java.util.regex.Matcher m = p.matcher(text);
            if (m.find()) {
                String name = m.group(1);
                if (name != null) {
                    name = name.replaceAll("[*0-9.-]{6,18}", "").replaceAll("(?i)\\s+(?:via|com\\s+sucesso)$", "").trim();
                    if (name.length() >= 2 && !name.toLowerCase().startsWith("r$") && !name.toLowerCase().startsWith("valor") && !name.toLowerCase().startsWith("no valor")) {
                        return name;
                    }
                }
            }

            // Padrão Pix enviado: "Você enviou um Pix para [Nome]..."
            java.util.regex.Pattern p2 = java.util.regex.Pattern.compile(
                "(?:enviou\\s+(?:um\\s+)?pix|pix\\s+enviado|transferiu\\s+(?:um\\s+)?pix|pix\\s+para)\\s+(?:para\\s+|a\\s+)?([A-Za-zÀ-ÿ\\s'-]{2,50}?)(?:\\s+[*0-9.-]{6,18})?(?:\\s+(?:via|com\\s+sucesso|no\\s+valor|de\\s+R\\$|valor)|\\.|$)",
                java.util.regex.Pattern.CASE_INSENSITIVE
            );
            java.util.regex.Matcher m2 = p2.matcher(text);
            if (m2.find()) {
                String name = m2.group(1);
                if (name != null) {
                    name = name.replaceAll("[*0-9.-]{6,18}", "").replaceAll("(?i)\\s+(?:via|com\\s+sucesso)$", "").trim();
                    if (name.length() >= 2 && !name.toLowerCase().startsWith("r$") && !name.toLowerCase().startsWith("valor") && !name.toLowerCase().startsWith("no valor")) {
                        return name;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Erro ao extrair nome do pagador/favorecido", e);
        }
        return null;
    }

    private void ensureConfirmationChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            android.app.NotificationChannel channel = nm.getNotificationChannel(CHANNEL_CONFIRMATIONS);
            if (channel == null) {
                channel = new android.app.NotificationChannel(
                        CHANNEL_CONFIRMATIONS,
                        "Confirmações de Lançamentos",
                        NotificationManager.IMPORTANCE_DEFAULT
                );
                channel.setDescription("Notificações de confirmação e ações de desfazer para lançamentos rápidos");
                nm.createNotificationChannel(channel);
            }
        }
    }

    private void postUndoNotification(
            Context context,
            NotificationManager nm,
            int originalNotificationId,
            String packageName,
            String title,
            String text,
            long timestamp
    ) {
        if (nm == null) return;
        ensureConfirmationChannel(nm);

        int undoNotificationId = (originalNotificationId != 0) ? originalNotificationId + 1 : 9999;

        Intent undoIntent = new Intent(context, BankNotificationActionReceiver.class);
        undoIntent.setAction(ACTION_UNDO);
        undoIntent.putExtra("notificationId", undoNotificationId);
        undoIntent.putExtra("packageName", packageName);
        undoIntent.putExtra("title", title);
        undoIntent.putExtra("text", text);
        undoIntent.putExtra("timestamp", timestamp);

        PendingIntent undoPending = PendingIntent.getBroadcast(
                context,
                undoNotificationId,
                undoIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent reviewIntent = new Intent(context, MainActivity.class);
        reviewIntent.setAction(MainActivity.ACTION_REVIEW_TRANSACTION);
        reviewIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        reviewIntent.putExtra("packageName", packageName);
        reviewIntent.putExtra("title", title);
        reviewIntent.putExtra("text", text);
        reviewIntent.putExtra("timestamp", timestamp);
        reviewIntent.putExtra("notificationId", undoNotificationId);

        PendingIntent reviewPending = PendingIntent.getActivity(
                context,
                undoNotificationId + 10,
                reviewIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_CONFIRMATIONS);
        } else {
            builder = new Notification.Builder(context);
        }

        String amountFormatted = BankNotificationListenerService.extractAmountText(title, text);
        boolean income = isIncome(title, text);
        String partyName = extractPartyName(text);

        String notifTitle = (income ? "Receita adicionada" : "Despesa adicionada");
        if (amountFormatted != null) {
            notifTitle += " · " + amountFormatted;
        }

        String bodyText = (partyName != null ? partyName : (title != null && !title.trim().isEmpty() ? title.trim() : "Lançamento confirmado"))
                + " • Categoria: Outros";

        Notification.BigTextStyle bigStyle = new Notification.BigTextStyle()
                .setBigContentTitle(notifTitle)
                .bigText(bodyText);

        builder.setContentTitle(notifTitle)
                .setContentText(bodyText)
                .setStyle(bigStyle)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(reviewPending)
                .setAutoCancel(true)
                .addAction(new Notification.Action.Builder(null, "Desfazer", undoPending).build())
                .addAction(new Notification.Action.Builder(null, "Conferir", reviewPending).build());

        try {
            nm.notify(undoNotificationId, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Erro ao emitir notificacao rica de confirmacao", e);
        }
    }

    private void postUndoneConfirmationNotification(Context context, NotificationManager nm, int notificationId) {
        if (nm == null) return;
        ensureConfirmationChannel(nm);

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, CHANNEL_CONFIRMATIONS);
        } else {
            builder = new Notification.Builder(context);
        }

        builder.setContentTitle("Lançamento desfeito")
                .setContentText("A transação foi cancelada com sucesso.")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setAutoCancel(true);

        try {
            nm.notify(notificationId, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Erro ao emitir confirmacao de cancelamento", e);
        }
    }

    private void saveConfirmedTransaction(Context context, String packageName, String title, String text, long timestamp) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            String currentJson = prefs.getString(KEY_CONFIRMED_BUFFER, "[]");
            JSONArray array = new JSONArray(currentJson);

            JSONObject item = new JSONObject();
            item.put("packageName", packageName);
            item.put("title", title);
            item.put("text", text);
            item.put("timestamp", timestamp);
            item.put("status", "confirmed");

            array.put(item);
            prefs.edit().putString(KEY_CONFIRMED_BUFFER, array.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao persistir transacao confirmada", e);
        }
    }

    private void removeConfirmedTransaction(Context context, long timestamp) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(BankNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE);
            String currentJson = prefs.getString(KEY_CONFIRMED_BUFFER, "[]");
            JSONArray array = new JSONArray(currentJson);
            JSONArray updated = new JSONArray();

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                if (obj.optLong("timestamp") != timestamp) {
                    updated.put(obj);
                }
            }
            prefs.edit().putString(KEY_CONFIRMED_BUFFER, updated.toString()).apply();
        } catch (Exception e) {
            Log.e(TAG, "Erro ao remover transacao desfeita", e);
        }
    }
}
