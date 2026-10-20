package com.guiafinanceiro.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
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

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

@CapacitorPlugin(name = "BankNotificationPlugin")
public class BankNotificationPlugin extends Plugin {

    private static BankNotificationPlugin instance;

    private static final Map<String, String> BANK_PACKAGES = new LinkedHashMap<>();
    static {
        BANK_PACKAGES.put("com.nu.production", "Nubank");
        BANK_PACKAGES.put("br.com.intermedium", "Inter");
        BANK_PACKAGES.put("com.c6bank.app", "C6 Bank");
        BANK_PACKAGES.put("com.mercadopago.wallet", "Mercado Pago");
        BANK_PACKAGES.put("com.picpay", "PicPay");
        BANK_PACKAGES.put("br.com.uol.ps", "PagBank");
        BANK_PACKAGES.put("br.com.uol.ps.myaccount", "PagBank");
        BANK_PACKAGES.put("br.com.neon", "Neon");
        BANK_PACKAGES.put("br.com.bradesco.next", "Next");
        BANK_PACKAGES.put("com.btg.pactual.banking", "BTG Pactual");
        BANK_PACKAGES.put("com.btgpactual.investimentos", "BTG Pactual");
        BANK_PACKAGES.put("br.com.xp.carteira", "XP Investimentos");
        BANK_PACKAGES.put("com.xpinc.investments", "XP Investimentos");
        BANK_PACKAGES.put("com.nomadfinancial.app", "Nomad");
        BANK_PACKAGES.put("com.transferwise.android", "Wise");
        BANK_PACKAGES.put("com.itau", "Itaú");
        BANK_PACKAGES.put("com.itau.personnalite", "Itaú Personnalité");
        BANK_PACKAGES.put("com.bradesco", "Bradesco");
        BANK_PACKAGES.put("com.santander.app", "Santander");
        BANK_PACKAGES.put("br.com.santander.way", "Santander");
        BANK_PACKAGES.put("br.gov.caixa.tem", "Caixa");
        BANK_PACKAGES.put("br.com.gabba.Caixa", "Caixa");
        BANK_PACKAGES.put("br.com.bb.android", "Banco do Brasil");
        BANK_PACKAGES.put("br.com.sicoob.net", "Sicoob");
        BANK_PACKAGES.put("br.com.sicredi.mobile", "Sicredi");
        BANK_PACKAGES.put("br.com.safra.mobile", "Banco Safra");
        BANK_PACKAGES.put("br.com.stone.ton", "Ton");
        BANK_PACKAGES.put("co.stone.stone", "Stone");
    }

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static BankNotificationPlugin getInstance() {
        return instance;
    }

    @PluginMethod
    public void getInstalledBankingApps(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        JSArray apps = new JSArray();
        JSArray installedBankNames = new JSArray();
        Set<String> seenBanks = new HashSet<>();

        for (Map.Entry<String, String> entry : BANK_PACKAGES.entrySet()) {
            String pkg = entry.getKey();
            String bankName = entry.getValue();
            boolean isInstalled = false;
            try {
                pm.getPackageInfo(pkg, 0);
                isInstalled = true;
            } catch (PackageManager.NameNotFoundException ignored) {
                isInstalled = false;
            }

            if (isInstalled) {
                JSObject item = new JSObject();
                item.put("packageName", pkg);
                item.put("bankName", bankName);
                item.put("isInstalled", true);
                apps.put(item);

                if (!seenBanks.contains(bankName)) {
                    seenBanks.add(bankName);
                    installedBankNames.put(bankName);
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("apps", apps);
        ret.put("installedBankNames", installedBankNames);
        call.resolve(ret);
    }

    @PluginMethod
    public void syncMonitoredPackages(PluginCall call) {
        JSArray packagesArray = call.getArray("packages");
        Context context = getContext();

        try {
            Set<String> pkgSet = new HashSet<>();
            if (packagesArray != null) {
                for (int i = 0; i < packagesArray.length(); i++) {
                    String pkg = packagesArray.getString(i);
                    if (pkg != null && !pkg.trim().isEmpty()) {
                        pkgSet.add(pkg.trim());
                    }
                }
            }

            android.content.SharedPreferences prefs = context.getSharedPreferences(
                BankNotificationListenerService.PREFS_NAME,
                Context.MODE_PRIVATE
            );
            prefs.edit().putStringSet(BankNotificationListenerService.KEY_ALLOWED_PACKAGES, pkgSet).apply();

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("count", pkgSet.size());
            call.resolve(ret);
        } catch (Exception e) {
            android.util.Log.e("BankNotificationPlugin", "Erro ao sincronizar pacotes monitorados", e);
            call.reject("Erro ao salvar pacotes monitorados: " + e.getMessage());
        }
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
