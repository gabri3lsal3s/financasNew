package com.guiafinanceiro.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;

@CapacitorPlugin(name = "AppUpdatePlugin")
public class AppUpdatePlugin extends Plugin {

    private long downloadId = -1;
    private BroadcastReceiver downloadReceiver;

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("canInstall", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("canInstall", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } else {
            call.resolve();
        }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("filePath é obrigatório");
            return;
        }

        File file = new File(filePath);
        if (!file.exists()) {
            call.reject("Arquivo APK não encontrado em: " + filePath);
            return;
        }

        boolean launched = triggerInstall(file);
        if (launched) {
            call.resolve();
        } else {
            call.reject("Falha ao abrir o instalador nativo do pacote.");
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        String expectedSha256 = call.getString("sha256");

        if (url == null || url.trim().isEmpty()) {
            call.reject("url é obrigatório");
            return;
        }

        Context context = getContext();
        DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (downloadManager == null) {
            call.reject("DownloadManager não disponível no dispositivo.");
            return;
        }

        try {
            Uri downloadUri = Uri.parse(url);
            DownloadManager.Request request = new DownloadManager.Request(downloadUri);
            request.setTitle("Atualização Áxis");
            request.setDescription("Baixando nova versão do aplicativo...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setMimeType("application/vnd.android.package-archive");
            
            String fileName = "axis-update-" + System.currentTimeMillis() + ".apk";
            File targetFile = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName);
            request.setDestinationUri(Uri.fromFile(targetFile));

            downloadId = downloadManager.enqueue(request);

            if (downloadReceiver != null) {
                try {
                    context.unregisterReceiver(downloadReceiver);
                } catch (Exception ignored) {}
            }

            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id == downloadId) {
                        try {
                            ctx.unregisterReceiver(this);
                        } catch (Exception ignored) {}

                        DownloadManager.Query query = new DownloadManager.Query();
                        query.setFilterById(downloadId);
                        Cursor cursor = downloadManager.query(query);

                        if (cursor != null && cursor.moveToFirst()) {
                            int statusIndex = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                            int status = cursor.getInt(statusIndex);
                            cursor.close();

                            if (status == DownloadManager.STATUS_SUCCESSFUL) {
                                if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
                                    String actualHash = calculateSha256(targetFile);
                                    if (!expectedSha256.equalsIgnoreCase(actualHash)) {
                                        notifyDownloadFailed("Assinatura de integridade (SHA-256) divergente.");
                                        return;
                                    }
                                }

                                triggerInstall(targetFile);
                                JSObject event = new JSObject();
                                event.put("status", "installed_triggered");
                                notifyListeners("updateStatusChanged", event);
                            } else {
                                notifyDownloadFailed("Falha no download da atualização.");
                            }
                        }
                    }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(
                    downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE),
                    Context.RECEIVER_EXPORTED
                );
            } else {
                context.registerReceiver(
                    downloadReceiver,
                    new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
                );
            }

            JSObject ret = new JSObject();
            ret.put("downloadId", downloadId);
            ret.put("status", "downloading");
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Erro ao enfileirar download: " + e.getMessage(), e);
        }
    }

    private boolean triggerInstall(File apkFile) {
        try {
            Context context = getContext();
            Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );

            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(installIntent);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void notifyDownloadFailed(String reason) {
        JSObject event = new JSObject();
        event.put("status", "error");
        event.put("error", reason);
        notifyListeners("updateStatusChanged", event);
    }

    private String calculateSha256(File file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            FileInputStream fis = new FileInputStream(file);
            byte[] byteArray = new byte[8192];
            int bytesCount;
            while ((bytesCount = fis.read(byteArray)) != -1) {
                digest.update(byteArray, 0, bytesCount);
            }
            fis.close();

            byte[] bytes = digest.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (downloadReceiver != null) {
            try {
                getContext().unregisterReceiver(downloadReceiver);
            } catch (Exception ignored) {}
            downloadReceiver = null;
        }
        super.handleOnDestroy();
    }
}
