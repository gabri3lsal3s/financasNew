package com.guiafinanceiro.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintJob;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebView;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "NativeExportPlugin")
public class NativeExportPlugin extends Plugin {

    private static final String TAG = "NativeExportPlugin";
    private static final long CACHE_TTL_MS = 24L * 60L * 60L * 1000L;
    private static final long PRINT_RESUME_CHECK_DELAY_MS = 1500L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Object printLock = new Object();

    private PluginCall pendingPrintCall;
    private AtomicBoolean pendingPrintCompleted;
    private PrintJob pendingPrintJob;

    public static String sanitizeFilename(String filename, String fallback) {
        String defaultName = (fallback != null && !fallback.trim().isEmpty()) ? fallback.trim() : "export";
        if (filename == null) {
            return defaultName;
        }
        StringBuilder sb = new StringBuilder(filename.length());
        for (int i = 0; i < filename.length(); i++) {
            char ch = filename.charAt(i);
            if (ch >= 32 && ch != 127) {
                sb.append(ch);
            }
        }
        String clean = sb.toString()
                .replaceAll("\\.\\.[/\\\\]", "")
                .replaceAll("[/\\\\?%*:|\"<>]", "_")
                .trim();
        return clean.isEmpty() ? defaultName : clean;
    }

    public static String sanitizeJobName(String jobName) {
        if (jobName == null || jobName.trim().isEmpty()) {
            return "Relatorio_Axir";
        }
        String trimmed = jobName.trim();
        if (trimmed.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            trimmed = trimmed.substring(0, trimmed.length() - 4);
        }
        return sanitizeFilename(trimmed, "Relatorio_Axir");
    }

    public static String normalizeMimeType(String mimeType) {
        if (mimeType == null || mimeType.trim().isEmpty()) {
            return "application/octet-stream";
        }
        String base = mimeType;
        int semicolonIdx = base.indexOf(';');
        if (semicolonIdx >= 0) {
            base = base.substring(0, semicolonIdx);
        }
        String normalized = base.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? "application/octet-stream" : normalized;
    }

    @PluginMethod
    public void printWebView(PluginCall call) {
        final String jobName = sanitizeJobName(call.getString("jobName", "Relatorio_Axir"));
        final Activity activity = getActivity();
        final WebView webView = getBridge() != null ? getBridge().getWebView() : null;

        if (activity == null || activity.isFinishing() || webView == null) {
            resolveDirectPrintFailure(call, "WebView indisponível para impressão.");
            return;
        }

        // Finaliza eventual chamada anterior presa antes de iniciar nova impressão
        finalizePreviousPendingPrint();

        activity.runOnUiThread(() -> {
            final AtomicBoolean completed = new AtomicBoolean(false);
            try {
                PrintManager printManager = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    resolveDirectPrintFailure(call, "Serviço de impressão não disponível neste dispositivo.");
                    return;
                }

                final PrintDocumentAdapter inner = webView.createPrintDocumentAdapter(jobName);
                PrintDocumentAdapter wrapper = new PrintDocumentAdapter() {
                    @Override
                    public void onStart() {
                        inner.onStart();
                    }

                    @Override
                    public void onLayout(
                            PrintAttributes oldAttributes,
                            PrintAttributes newAttributes,
                            CancellationSignal cancellationSignal,
                            LayoutResultCallback callback,
                            Bundle extras) {
                        inner.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras);
                    }

                    @Override
                    public void onWrite(
                            PageRange[] pages,
                            ParcelFileDescriptor destination,
                            CancellationSignal cancellationSignal,
                            WriteResultCallback callback) {
                        inner.onWrite(pages, destination, cancellationSignal, callback);
                    }

                    @Override
                    public void onFinish() {
                        try {
                            inner.onFinish();
                        } finally {
                            resolvePrintCall(call, completed, true, null);
                        }
                    }
                };

                PrintAttributes attributes = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build();

                PrintJob job = printManager.print(jobName, wrapper, attributes);
                if (job == null) {
                    resolvePrintCall(call, completed, false, "Não foi possível iniciar o diálogo de impressão.");
                    return;
                }

                synchronized (printLock) {
                    if (!completed.get()) {
                        pendingPrintCall = call;
                        pendingPrintCompleted = completed;
                        pendingPrintJob = job;
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Falha ao iniciar impressão nativa da WebView", e);
                resolvePrintCall(call, completed, false, e.getMessage());
            }
        });
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        mainHandler.postDelayed(() -> {
            PluginCall staleCall = null;
            AtomicBoolean staleCompleted = null;
            synchronized (printLock) {
                if (pendingPrintCall != null) {
                    boolean jobDone = pendingPrintJob == null
                            || pendingPrintJob.isCompleted()
                            || pendingPrintJob.isCancelled()
                            || pendingPrintJob.isFailed();
                    if (jobDone) {
                        staleCall = pendingPrintCall;
                        staleCompleted = pendingPrintCompleted;
                        pendingPrintCall = null;
                        pendingPrintCompleted = null;
                        pendingPrintJob = null;
                    }
                }
            }
            if (staleCall != null && staleCompleted != null) {
                resolvePrintCall(staleCall, staleCompleted, true, null);
            }
        }, PRINT_RESUME_CHECK_DELAY_MS);
    }

    @Override
    protected void handleOnDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        finalizePreviousPendingPrint();
        super.handleOnDestroy();
    }

    private void finalizePreviousPendingPrint() {
        PluginCall prevCall;
        AtomicBoolean prevCompleted;
        synchronized (printLock) {
            prevCall = pendingPrintCall;
            prevCompleted = pendingPrintCompleted;
            pendingPrintCall = null;
            pendingPrintCompleted = null;
            pendingPrintJob = null;
        }
        if (prevCall != null && prevCompleted != null) {
            resolvePrintCall(prevCall, prevCompleted, true, null);
        }
    }

    private void resolveDirectPrintFailure(PluginCall call, String error) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("error", error != null ? error : "Erro ao gerar PDF.");
        call.resolve(ret);
    }

    private void resolvePrintCall(PluginCall call, AtomicBoolean completed, boolean success, String error) {
        if (call == null || completed == null || !completed.compareAndSet(false, true)) {
            return;
        }
        synchronized (printLock) {
            if (pendingPrintCall == call) {
                pendingPrintCall = null;
                pendingPrintCompleted = null;
                pendingPrintJob = null;
            }
        }
        JSObject ret = new JSObject();
        ret.put("success", success);
        if (error != null && !error.trim().isEmpty()) {
            ret.put("error", error);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void exportFile(PluginCall call) {
        final String filename = call.getString("filename");
        final String base64Data = call.getString("base64Data");
        final String rawMimeType = call.getString("mimeType", "application/octet-stream");
        final boolean shouldShare = Boolean.TRUE.equals(call.getBoolean("share", true));

        if (filename == null || filename.trim().isEmpty() || base64Data == null || base64Data.trim().isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("fileName", sanitizeFilename(filename, "export.bin"));
            ret.put("savedToDownloads", false);
            ret.put("shared", false);
            ret.put("error", "Dados do arquivo ausentes para exportação.");
            call.resolve(ret);
            return;
        }

        final String safeFilename = sanitizeFilename(filename, "export.bin");
        final String cleanMimeType = normalizeMimeType(rawMimeType);
        final Context context = getContext();

        new Thread(() -> {
            boolean savedToDownloads = false;
            try {
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                File exportsDir = new File(context.getCacheDir(), "exports");
                if (!exportsDir.exists()) {
                    exportsDir.mkdirs();
                }
                cleanupOldExports(exportsDir);

                File cacheFile = new File(exportsDir, safeFilename);
                try (FileOutputStream fos = new FileOutputStream(cacheFile)) {
                    fos.write(bytes);
                    fos.flush();
                }

                savedToDownloads = saveCopyToDownloads(context, safeFilename, cleanMimeType, bytes);

                if (!shouldShare) {
                    JSObject ret = new JSObject();
                    ret.put("success", savedToDownloads);
                    ret.put("fileName", safeFilename);
                    ret.put("savedToDownloads", savedToDownloads);
                    ret.put("shared", false);
                    if (!savedToDownloads) {
                        ret.put("error", "Não foi possível salvar o arquivo em Downloads.");
                    }
                    call.resolve(ret);
                    return;
                }

                final Uri contentUri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        cacheFile
                );
                final boolean finalSaved = savedToDownloads;

                Activity activity = getActivity();
                if (activity == null || activity.isFinishing()) {
                    JSObject ret = new JSObject();
                    ret.put("success", finalSaved);
                    ret.put("fileName", safeFilename);
                    ret.put("savedToDownloads", finalSaved);
                    ret.put("shared", false);
                    if (!finalSaved) {
                        ret.put("error", "Tela indisponível para compartilhamento.");
                    }
                    call.resolve(ret);
                    return;
                }

                activity.runOnUiThread(() -> {
                    try {
                        Intent shareIntent = new Intent(Intent.ACTION_SEND);
                        shareIntent.setType(cleanMimeType);
                        shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                        shareIntent.putExtra(Intent.EXTRA_SUBJECT, safeFilename);
                        shareIntent.setClipData(ClipData.newRawUri(safeFilename, contentUri));
                        shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                        Intent chooser = Intent.createChooser(shareIntent, "Exportar " + safeFilename);
                        chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        activity.startActivity(chooser);

                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("fileName", safeFilename);
                        ret.put("savedToDownloads", finalSaved);
                        ret.put("shared", true);
                        call.resolve(ret);
                    } catch (Exception shareError) {
                        Log.e(TAG, "Erro ao abrir Share Sheet para arquivo exportado", shareError);
                        JSObject ret = new JSObject();
                        ret.put("success", finalSaved);
                        ret.put("fileName", safeFilename);
                        ret.put("savedToDownloads", finalSaved);
                        ret.put("shared", false);
                        ret.put("error", shareError.getMessage());
                        call.resolve(ret);
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Falha ao exportar arquivo nativamente", e);
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("fileName", safeFilename);
                ret.put("savedToDownloads", savedToDownloads);
                ret.put("shared", false);
                ret.put("error", e.getMessage() != null ? e.getMessage() : "Erro ao exportar arquivo.");
                call.resolve(ret);
            }
        }).start();
    }

    private void cleanupOldExports(File exportsDir) {
        File[] files = exportsDir.listFiles();
        if (files == null) return;
        long cutoff = System.currentTimeMillis() - CACHE_TTL_MS;
        for (File f : files) {
            if (f.isFile() && f.lastModified() < cutoff) {
                try {
                    f.delete();
                } catch (Exception ignored) {
                    // no-op
                }
            }
        }
    }

    private boolean saveCopyToDownloads(Context context, String safeFilename, String cleanMimeType, byte[] bytes) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (insertIntoMediaStoreDownloads(context, safeFilename, cleanMimeType, bytes)) {
                return true;
            }
            if (!"application/octet-stream".equals(cleanMimeType)) {
                return insertIntoMediaStoreDownloads(context, safeFilename, "application/octet-stream", bytes);
            }
            return false;
        }

        File downloadsDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (downloadsDir == null) {
            return false;
        }
        if (!downloadsDir.exists()) {
            downloadsDir.mkdirs();
        }
        File destFile = new File(downloadsDir, safeFilename);
        try (FileOutputStream fos = new FileOutputStream(destFile)) {
            fos.write(bytes);
            fos.flush();
            return true;
        } catch (Exception e) {
            Log.w(TAG, "Falha ao gravar cópia em external downloads dir: " + e.getMessage());
            return false;
        }
    }

    private boolean insertIntoMediaStoreDownloads(Context context, String safeFilename, String mimeType, byte[] bytes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            return false;
        }
        ContentResolver resolver = context.getContentResolver();
        Uri itemUri = null;
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, safeFilename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + File.separator + "Axir");
            values.put(MediaStore.Downloads.IS_PENDING, 1);

            itemUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (itemUri == null) {
                return false;
            }

            try (OutputStream out = resolver.openOutputStream(itemUri)) {
                if (out == null) {
                    resolver.delete(itemUri, null, null);
                    return false;
                }
                out.write(bytes);
                out.flush();
            }

            ContentValues finishValues = new ContentValues();
            finishValues.put(MediaStore.Downloads.IS_PENDING, 0);
            resolver.update(itemUri, finishValues, null, null);
            return true;
        } catch (Exception e) {
            Log.w(TAG, "MediaStore.Downloads falhou para mimeType=" + mimeType + ": " + e.getMessage());
            if (itemUri != null) {
                try {
                    resolver.delete(itemUri, null, null);
                } catch (Exception ignored) {
                    // no-op
                }
            }
            return false;
        }
    }

    @PluginMethod
    public void shareText(PluginCall call) {
        final String title = call.getString("title", "Axir");
        final String text = call.getString("text", "");

        if (text == null || text.trim().isEmpty()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "Texto vazio.");
            call.resolve(ret);
            return;
        }

        final Activity activity = getActivity();
        if (activity == null || activity.isFinishing()) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "Tela indisponível para compartilhamento.");
            call.resolve(ret);
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType("text/plain");
                sendIntent.putExtra(Intent.EXTRA_SUBJECT, title != null && !title.trim().isEmpty() ? title : "Axir");
                sendIntent.putExtra(Intent.EXTRA_TEXT, text);

                Intent chooser = Intent.createChooser(sendIntent, title != null && !title.trim().isEmpty() ? title : "Compartilhar");
                activity.startActivity(chooser);

                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Falha ao compartilhar texto nativamente", e);
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", e.getMessage());
                call.resolve(ret);
            }
        });
    }
}
