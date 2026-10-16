package com.guiafinanceiro.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.provider.Settings;
import android.text.TextUtils;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "BankNotificationPlugin")
public class BankNotificationPlugin extends Plugin {

    private static BankNotificationPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static BankNotificationPlugin getInstance() {
        return instance;
    }

    @PluginMethod
    public void isPermissionGranted(PluginCall call) {
        Context context = getContext();
        boolean granted = isNotificationServiceEnabled(context);
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        Context context = getContext();
        boolean granted = isNotificationServiceEnabled(context);
        if (!granted) {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void flushPendingNotifications(PluginCall call) {
        Context context = getContext();
        JSObject ret = new JSObject();
        JSArray items = new JSArray();

        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences(
                BankNotificationListenerService.PREFS_NAME,
                Context.MODE_PRIVATE
            );
            String bufferJson = prefs.getString(BankNotificationListenerService.KEY_BUFFER, "[]");

            // Limpa o buffer de pendentes atomicamente
            prefs.edit().remove(BankNotificationListenerService.KEY_BUFFER).apply();

            JSONArray array = new JSONArray(bufferJson);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject notif = new JSObject();
                notif.put("packageName", obj.optString("packageName"));
                notif.put("title", obj.optString("title"));
                notif.put("text", obj.optString("text"));
                notif.put("timestamp", obj.optLong("timestamp"));
                items.put(notif);
            }
        } catch (Exception e) {
            android.util.Log.e("BankNotificationPlugin", "Erro ao descarregar buffer offline de notificacoes", e);
        }

        ret.put("notifications", items);
        call.resolve(ret);
    }

    public void onNotificationReceived(String packageName, String title, String text, long timestamp) {
        JSObject data = new JSObject();
        data.put("packageName", packageName);
        data.put("title", title);
        data.put("text", text);
        data.put("timestamp", timestamp);
        notifyListeners("bankNotificationReceived", data);
    }

    public void onShareTextReceived(String text) {
        JSObject data = new JSObject();
        data.put("text", text);
        notifyListeners("shareTextReceived", data);
    }

    private static boolean isNotificationServiceEnabled(Context context) {
        String pkgName = context.getPackageName();
        final String flat = Settings.Secure.getString(context.getContentResolver(), "enabled_notification_listeners");
        if (!TextUtils.isEmpty(flat)) {
            final String[] names = flat.split(":");
            for (String name : names) {
                final ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null) {
                    if (TextUtils.equals(pkgName, cn.getPackageName())) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
