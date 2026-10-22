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

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(context, BankNotificationListenerService.CHANNEL_ID);
        } else {
            builder = new Notification.Builder(context);
        }

        String displayText = (title != null && !title.trim().isEmpty()) ? title : (text != null ? text : "");

        builder.setContentTitle("Lançamento confirmado")
                .setContentText(displayText)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setAutoCancel(true)
                .addAction(new Notification.Action.Builder(null, "Desfazer", undoPending).build());

        try {
            nm.notify(undoNotificationId, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Erro ao emitir notificacao de desfazer", e);
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
