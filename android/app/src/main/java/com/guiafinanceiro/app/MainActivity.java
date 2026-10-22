package com.guiafinanceiro.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";
    public static final String ACTION_REVIEW_TRANSACTION = "com.guiafinanceiro.app.ACTION_REVIEW_TRANSACTION";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BankNotificationPlugin.class);
        registerPlugin(AppIconPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        super.onCreate(savedInstanceState);
        handleSendIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent);
    }

    private void handleSendIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (ACTION_REVIEW_TRANSACTION.equals(action)) {
            try {
                org.json.JSONObject obj = new org.json.JSONObject();
                obj.put("packageName", intent.getStringExtra("packageName"));
                obj.put("title", intent.getStringExtra("title"));
                obj.put("text", intent.getStringExtra("text"));
                obj.put("timestamp", intent.getLongExtra("timestamp", System.currentTimeMillis()));
                String payload = obj.toString();
                BankNotificationPlugin.setPendingReview(payload);
                BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
                if (plugin != null) {
                    plugin.onOpenReviewTransaction(payload);
                }
            } catch (Exception e) {
                Log.e(TAG, "Erro ao processar intent de revisao", e);
            }
            return;
        }

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if (type.startsWith("text/")) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText == null) {
                    CharSequence cs = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                    if (cs != null) {
                        sharedText = cs.toString();
                    }
                }
                if (sharedText != null && !sharedText.trim().isEmpty()) {
                    // Armazena no buffer estático anti-perda (Cold Start)
                    BankNotificationPlugin.setPendingShare(sharedText);
                    // Se o plugin já estiver ativo na WebView (Warm Start), notifica os ouvintes JS
                    BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
                    if (plugin != null) {
                        plugin.onShareTextReceived(sharedText);
                    }
                }
            } else if (type.startsWith("image/") || "application/pdf".equalsIgnoreCase(type) || type.contains("pdf")) {
                Uri streamUri = null;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    try {
                        streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
                    } catch (Exception e) {
                        streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    }
                } else {
                    streamUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                }
                if (streamUri == null) {
                    streamUri = intent.getData();
                }

                if (streamUri != null) {
                    handleSharedUriAsync(streamUri, type);
                }
            }
        }
    }

    private void handleSharedUriAsync(Uri streamUri, String mimeType) {
        // Grava os bytes em cache temporário seguro (getCacheDir()) imediatamente
        // para prevenir SecurityException quando a permissão transitória de URI expirar
        new Thread(() -> {
            File tempCacheFile = null;
            try {
                String extension = ".tmp";
                if (mimeType != null) {
                    if (mimeType.contains("pdf")) {
                        extension = ".pdf";
                    } else if (mimeType.contains("png")) {
                        extension = ".png";
                    } else if (mimeType.contains("jpeg") || mimeType.contains("jpg")) {
                        extension = ".jpg";
                    }
                }
                File cacheDir = getCacheDir();
                tempCacheFile = new File(cacheDir, "receipt_share_" + System.currentTimeMillis() + extension);

                try (InputStream in = getContentResolver().openInputStream(streamUri);
                     OutputStream out = new FileOutputStream(tempCacheFile)) {
                    if (in != null) {
                        byte[] buffer = new byte[8192];
                        int read;
                        while ((read = in.read(buffer)) != -1) {
                            out.write(buffer, 0, read);
                        }
                        out.flush();
                    }
                }

                if (!tempCacheFile.exists() || tempCacheFile.length() == 0) {
                    Log.w(TAG, "Arquivo de comprovante copiado vazio ou inexistente.");
                    safeDelete(tempCacheFile);
                    return;
                }

                final File fileToProcess = tempCacheFile;
                Uri localUri = Uri.fromFile(fileToProcess);

                ReceiptOcrHelper.extractTextFromUri(
                        getApplicationContext(),
                        localUri,
                        mimeType,
                        new ReceiptOcrHelper.OcrCallback() {
                            @Override
                            public void onSuccess(String recognizedText) {
                                try {
                                    if (recognizedText != null && !recognizedText.trim().isEmpty()) {
                                        // Armazena no buffer estático anti-perda (Cold Start)
                                        BankNotificationPlugin.setPendingShare(recognizedText);
                                        // Se o plugin já estiver ativo na WebView (Warm Start), notifica os ouvintes JS
                                        BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
                                        if (plugin != null) {
                                            plugin.onShareTextReceived(recognizedText);
                                        }
                                    }
                                } finally {
                                    safeDelete(fileToProcess);
                                }
                            }

                            @Override
                            public void onError(Exception error) {
                                Log.e(TAG, "Erro ao extrair OCR de comprovante compartilhado", error);
                                safeDelete(fileToProcess);
                            }
                        }
                );

            } catch (Exception e) {
                Log.e(TAG, "Falha ao gravar comprovante compartilhado no cache seguro", e);
                if (tempCacheFile != null) {
                    safeDelete(tempCacheFile);
                }
            }
        }).start();
    }

    private static void safeDelete(File file) {
        if (file != null && file.exists()) {
            try {
                file.delete();
            } catch (Exception ignored) {
            }
        }
    }
}
