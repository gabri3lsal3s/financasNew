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
    private static String pendingSharePayload;
    private static String pendingReviewPayload;

    public static synchronized void setPendingShare(String payload) {
        pendingSharePayload = payload;
    }

    public static synchronized String getPendingSharePayload() {
        return pendingSharePayload;
    }

    public static synchronized void setPendingReview(String payload) {
        pendingReviewPayload = payload;
    }

    public static synchronized String getPendingReviewPayload() {
        return pendingReviewPayload;
    }

    static class BankAppInfo {
        final String bankName;
        final String category; // "bank", "wallet", "broker"

        BankAppInfo(String bankName, String category) {
            this.bankName = bankName;
            this.category = category;
        }
    }

    private static final Map<String, BankAppInfo> BANK_PACKAGES = new LinkedHashMap<>();
    static {
        // Bancos Tradicionais & Digitais
        BANK_PACKAGES.put("com.nu.production", new BankAppInfo("Nubank", "bank"));
        BANK_PACKAGES.put("br.com.intermedium", new BankAppInfo("Inter", "bank"));
        BANK_PACKAGES.put("com.c6bank.app", new BankAppInfo("C6 Bank", "bank"));
        BANK_PACKAGES.put("br.com.neon", new BankAppInfo("Neon", "bank"));
        BANK_PACKAGES.put("br.com.bradesco.next", new BankAppInfo("Next", "bank"));
        BANK_PACKAGES.put("com.itau", new BankAppInfo("Itaú", "bank"));
        BANK_PACKAGES.put("com.itau.personnalite", new BankAppInfo("Itaú Personnalité", "bank"));
        BANK_PACKAGES.put("com.bradesco", new BankAppInfo("Bradesco", "bank"));
        BANK_PACKAGES.put("com.santander.app", new BankAppInfo("Santander", "bank"));
        BANK_PACKAGES.put("br.com.santander.way", new BankAppInfo("Santander", "bank"));
        BANK_PACKAGES.put("br.gov.caixa.tem", new BankAppInfo("Caixa", "bank"));
        BANK_PACKAGES.put("br.com.gabba.Caixa", new BankAppInfo("Caixa", "bank"));
        BANK_PACKAGES.put("br.com.bb.android", new BankAppInfo("Banco do Brasil", "bank"));

        // Carteiras Digitais & Pagamentos
        BANK_PACKAGES.put("com.google.android.apps.walletnfcrel", new BankAppInfo("Carteira Google", "wallet"));
        BANK_PACKAGES.put("com.samsung.android.spay", new BankAppInfo("Samsung Pay", "wallet"));
        BANK_PACKAGES.put("com.samsung.android.raja.spay", new BankAppInfo("Samsung Pay", "wallet"));
        BANK_PACKAGES.put("com.mercadopago.wallet", new BankAppInfo("Mercado Pago", "wallet"));
        BANK_PACKAGES.put("com.picpay", new BankAppInfo("PicPay", "wallet"));
        BANK_PACKAGES.put("br.com.uol.ps", new BankAppInfo("PagBank", "wallet"));
        BANK_PACKAGES.put("br.com.uol.ps.myaccount", new BankAppInfo("PagBank", "wallet"));

        // Investimentos, Cripto & Contas Globais
        BANK_PACKAGES.put("com.btg.pactual.banking", new BankAppInfo("BTG Pactual", "bank"));
        BANK_PACKAGES.put("com.btgpactual.investimentos", new BankAppInfo("BTG Investimentos", "broker"));
        BANK_PACKAGES.put("br.com.xp.carteira", new BankAppInfo("XP Investimentos", "broker"));
        BANK_PACKAGES.put("com.xpinc.investments", new BankAppInfo("XP Investimentos", "broker"));
        BANK_PACKAGES.put("br.com.rico", new BankAppInfo("Rico", "broker"));
        BANK_PACKAGES.put("br.com.rico.investimentos", new BankAppInfo("Rico", "broker"));
        BANK_PACKAGES.put("com.binance.dev", new BankAppInfo("Binance", "broker"));
        BANK_PACKAGES.put("com.nomadfinancial.app", new BankAppInfo("Nomad", "broker"));
        BANK_PACKAGES.put("com.transferwise.android", new BankAppInfo("Wise", "broker"));

        // Cooperativas, Adquirentes & Outros
        BANK_PACKAGES.put("br.com.sicoob.net", new BankAppInfo("Sicoob", "bank"));
        BANK_PACKAGES.put("br.com.sicredi.mobile", new BankAppInfo("Sicredi", "bank"));
        BANK_PACKAGES.put("br.com.safra.mobile", new BankAppInfo("Banco Safra", "bank"));
        BANK_PACKAGES.put("br.com.stone.ton", new BankAppInfo("Ton", "bank"));
        BANK_PACKAGES.put("co.stone.stone", new BankAppInfo("Stone", "bank"));
    }

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static BankNotificationPlugin getInstance() {
        return instance;
    }

    /**
     * Checagem defensiva de presenca do pacote com fallback para getLaunchIntentForPackage.
     * Evita falsos negativos no Android 11+ (API 30+) causados por restricoes de visibilidade.
     */
    private boolean isPackageInstalled(PackageManager pm, String packageName) {
        if (pm == null || packageName == null || packageName.trim().isEmpty()) {
            return false;
        }
        try {
            pm.getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException ignored) {
            try {
                return pm.getLaunchIntentForPackage(packageName) != null;
            } catch (Exception e) {
                return false;
            }
        } catch (Exception ignored) {
            try {
                return pm.getLaunchIntentForPackage(packageName) != null;
            } catch (Exception e) {
                return false;
            }
        }
    }

    @PluginMethod
    public void getInstalledBankingApps(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context != null ? context.getPackageManager() : null;
        JSArray apps = new JSArray();
        JSArray installedBankNames = new JSArray();
        Set<String> seenBanks = new HashSet<>();

        if (pm != null) {
            for (Map.Entry<String, BankAppInfo> entry : BANK_PACKAGES.entrySet()) {
                String pkg = entry.getKey();
                BankAppInfo info = entry.getValue();
                boolean isInstalled = isPackageInstalled(pm, pkg);

                if (isInstalled) {
                    JSObject item = new JSObject();
                    item.put("packageName", pkg);
                    item.put("bankName", info.bankName);
                    item.put("category", info.category);
                    item.put("isInstalled", true);
                    apps.put(item);

                    if (!seenBanks.contains(info.bankName)) {
                        seenBanks.add(info.bankName);
                        installedBankNames.put(info.bankName);
                    }
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

    @PluginMethod
    public void flushConfirmedTransactions(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray items = new JSArray();

        try {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(
                    BankNotificationListenerService.PREFS_NAME,
                    Context.MODE_PRIVATE
            );
            String bufferJson = prefs.getString(BankNotificationActionReceiver.KEY_CONFIRMED_BUFFER, "[]");

            prefs.edit().remove(BankNotificationActionReceiver.KEY_CONFIRMED_BUFFER).apply();

            JSONArray array = new JSONArray(bufferJson);
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                JSObject item = new JSObject();
                item.put("packageName", obj.optString("packageName"));
                item.put("title", obj.optString("title"));
                item.put("text", obj.optString("text"));
                item.put("timestamp", obj.optLong("timestamp"));
                items.put(item);
            }
        } catch (Exception e) {
            android.util.Log.e("BankNotificationPlugin", "Erro ao descarregar buffer de transacoes confirmadas", e);
        }

        ret.put("transactions", items);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        JSObject ret = new JSObject();
        String text;
        synchronized (BankNotificationPlugin.class) {
            text = pendingSharePayload;
            pendingSharePayload = null; // Buffer consumido atomicamente
        }
        ret.put("text", text);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPendingReviewTransaction(PluginCall call) {
        JSObject ret = new JSObject();
        String payload;
        synchronized (BankNotificationPlugin.class) {
            payload = pendingReviewPayload;
            pendingReviewPayload = null;
        }
        ret.put("payload", payload);
        call.resolve(ret);
    }

    @PluginMethod
    public void extractTextFromReceipt(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String mimeType = call.getString("mimeType", "image/jpeg");
        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("Dados do arquivo ausentes");
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Contexto indisponivel");
            return;
        }

        new Thread(() -> {
            java.io.File tempFile = null;
            try {
                byte[] bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                String ext = (mimeType != null && mimeType.contains("pdf")) ? ".pdf" : ".jpg";
                tempFile = new java.io.File(context.getCacheDir(), "receipt_ocr_" + System.currentTimeMillis() + ext);
                try (java.io.FileOutputStream fos = new java.io.FileOutputStream(tempFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                final java.io.File fileRef = tempFile;
                android.net.Uri localUri = android.net.Uri.fromFile(fileRef);

                ReceiptOcrHelper.extractTextFromUri(context, localUri, mimeType, new ReceiptOcrHelper.OcrCallback() {
                    @Override
                    public void onSuccess(String recognizedText) {
                        try {
                            JSObject ret = new JSObject();
                            ret.put("text", recognizedText != null ? recognizedText : "");
                            call.resolve(ret);
                        } finally {
                            if (fileRef.exists()) fileRef.delete();
                        }
                    }

                    @Override
                    public void onError(Exception error) {
                        try {
                            call.reject("Erro no OCR do comprovante: " + error.getMessage());
                        } finally {
                            if (fileRef.exists()) fileRef.delete();
                        }
                    }
                });
            } catch (Exception e) {
                if (tempFile != null && tempFile.exists()) tempFile.delete();
                call.reject("Falha ao processar arquivo: " + e.getMessage());
            }
        }).start();
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

    public void onOpenReviewTransaction(String payload) {
        JSObject data = new JSObject();
        data.put("payload", payload);
        notifyListeners("openReviewTransaction", data);
    }

    public void onTransactionConfirmed(String packageName, String title, String text, long timestamp) {
        JSObject data = new JSObject();
        data.put("packageName", packageName);
        data.put("title", title);
        data.put("text", text);
        data.put("timestamp", timestamp);
        notifyListeners("bankTransactionConfirmed", data);
    }

    public void onTransactionUndone(String packageName, String title, String text, long timestamp) {
        JSObject data = new JSObject();
        data.put("packageName", packageName);
        data.put("title", title);
        data.put("text", text);
        data.put("timestamp", timestamp);
        notifyListeners("bankTransactionUndone", data);
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
