package com.guiafinanceiro.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.annotation.NonNull;

import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Utilitário nativo de OCR (Optical Character Recognition) fino e de custo zero para comprovantes.
 * Utiliza Google ML Kit Text Recognition (<800 KB, baixado dinamicamente via Google Play Services)
 * e o PdfRenderer nativo do Android para converter faturas e comprovantes em PDF (até 2 páginas) em Bitmaps.
 */
public final class ReceiptOcrHelper {

    private static final String TAG = "ReceiptOcrHelper";
    private static final int MAX_PDF_PAGES_TO_RENDER = 2;

    private static TextRecognizer textRecognizer;

    private ReceiptOcrHelper() {
        // Utilitário estático
    }

    public interface OcrCallback {
        void onSuccess(String recognizedText);
        void onError(Exception error);
    }

    public static synchronized TextRecognizer getTextRecognizer() {
        if (textRecognizer == null) {
            textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return textRecognizer;
    }

    /**
     * Extrai texto de um comprovante a partir de sua URI (Imagem ou PDF).
     *
     * @param context Contexto da aplicação
     * @param uri URI local ou content:// do arquivo
     * @param mimeType MIME type do arquivo (ex.: "application/pdf", "image/png", "image/jpeg")
     * @param callback Callback com o resultado ou erro
     */
    public static void extractTextFromUri(
            @NonNull Context context,
            @NonNull Uri uri,
            String mimeType,
            @NonNull OcrCallback callback
    ) {
        boolean isPdf = isPdfMimeOrUri(uri, mimeType);
        if (isPdf) {
            extractTextFromPdf(context, uri, callback);
        } else {
            extractTextFromImage(context, uri, callback);
        }
    }

    /**
     * Extrai texto de imagem usando ML Kit Text Recognition.
     */
    public static void extractTextFromImage(
            @NonNull Context context,
            @NonNull Uri imageUri,
            @NonNull OcrCallback callback
    ) {
        InputImage image;
        try {
            image = InputImage.fromFilePath(context, imageUri);
        } catch (Exception ex) {
            Log.w(TAG, "Falha em InputImage.fromFilePath, tentando decodificacao direta por InputStream: " + ex.getMessage());
            try (InputStream is = context.getContentResolver().openInputStream(imageUri)) {
                if (is == null) {
                    callback.onError(new IllegalArgumentException("Nao foi possivel abrir stream para a URI: " + imageUri));
                    return;
                }
                Bitmap bitmap = BitmapFactory.decodeStream(is);
                if (bitmap == null) {
                    callback.onError(new IllegalArgumentException("Falha ao decodificar bitmap da imagem fornecida"));
                    return;
                }
                image = InputImage.fromBitmap(bitmap, 0);
            } catch (Exception streamEx) {
                Log.e(TAG, "Erro fatal ao decodificar imagem para OCR", streamEx);
                callback.onError(streamEx);
                return;
            }
        }

        getTextRecognizer().process(image)
                .addOnSuccessListener(visionText -> {
                    String recognized = visionText != null ? visionText.getText() : "";
                    callback.onSuccess(recognized);
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Erro no reconhecimento de texto da imagem via ML Kit", e);
                    callback.onError(e);
                });
    }

    /**
     * Converte até 2 páginas de documento PDF em Bitmap via PdfRenderer nativo
     * e extrai o texto consolidado com suporte a autenticação mecânica.
     */
    public static void extractTextFromPdf(
            @NonNull Context context,
            @NonNull Uri pdfUri,
            @NonNull OcrCallback callback
    ) {
        ParcelFileDescriptor pfd = null;
        PdfRenderer renderer = null;
        final List<Bitmap> bitmaps = new ArrayList<>();

        try {
            pfd = context.getContentResolver().openFileDescriptor(pdfUri, "r");
            if (pfd == null) {
                callback.onError(new IllegalArgumentException("Nao foi possivel abrir o descritor de arquivo para o PDF: " + pdfUri));
                return;
            }

            renderer = new PdfRenderer(pfd);
            int totalPages = renderer.getPageCount();
            if (totalPages <= 0) {
                closeQuietly(renderer, pfd);
                callback.onSuccess("");
                return;
            }

            int pagesToRender = Math.min(totalPages, MAX_PDF_PAGES_TO_RENDER);

            for (int i = 0; i < pagesToRender; i++) {
                PdfRenderer.Page page = renderer.openPage(i);

                // Escala de 2x para garantir nitidez nos caracteres finos de autenticacao mecanica
                int targetWidth = Math.max(page.getWidth() * 2, 1080);
                int targetHeight = (int) (((float) targetWidth / page.getWidth()) * page.getHeight());

                Bitmap bitmap = Bitmap.createBitmap(targetWidth, targetHeight, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bitmap);
                canvas.drawColor(Color.WHITE); // Fundo branco contra transparencia padrao de paginas PDF
                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                page.close();

                bitmaps.add(bitmap);
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao abrir ou renderizar PDF via PdfRenderer", e);
            recycleBitmaps(bitmaps);
            closeQuietly(renderer, pfd);
            callback.onError(e);
            return;
        }

        final PdfRenderer finalRenderer = renderer;
        final ParcelFileDescriptor finalPfd = pfd;

        List<Task<Text>> tasks = new ArrayList<>();
        for (Bitmap bmp : bitmaps) {
            InputImage inputImage = InputImage.fromBitmap(bmp, 0);
            tasks.add(getTextRecognizer().process(inputImage));
        }

        Tasks.whenAllSuccess(tasks)
                .addOnSuccessListener(results -> {
                    StringBuilder combinedText = new StringBuilder();
                    for (Object obj : results) {
                        if (obj instanceof Text) {
                            String pageText = ((Text) obj).getText();
                            if (pageText != null && !pageText.trim().isEmpty()) {
                                if (combinedText.length() > 0) {
                                    combinedText.append("\n");
                                }
                                combinedText.append(pageText);
                            }
                        }
                    }

                    recycleBitmaps(bitmaps);
                    closeQuietly(finalRenderer, finalPfd);
                    callback.onSuccess(combinedText.toString());
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Falha no OCR dos bitmaps gerados a partir do PDF", e);
                    recycleBitmaps(bitmaps);
                    closeQuietly(finalRenderer, finalPfd);
                    callback.onError(e);
                });
    }

    private static boolean isPdfMimeOrUri(Uri uri, String mimeType) {
        if ("application/pdf".equalsIgnoreCase(mimeType)) {
            return true;
        }
        if (uri != null) {
            String path = uri.getPath();
            if (path != null && path.toLowerCase().endsWith(".pdf")) {
                return true;
            }
            String uriString = uri.toString().toLowerCase();
            return uriString.endsWith(".pdf") || uriString.contains("application/pdf");
        }
        return false;
    }

    private static void recycleBitmaps(List<Bitmap> bitmaps) {
        if (bitmaps == null) return;
        for (Bitmap bmp : bitmaps) {
            if (bmp != null && !bmp.isRecycled()) {
                bmp.recycle();
            }
        }
        bitmaps.clear();
    }

    private static void closeQuietly(PdfRenderer renderer, ParcelFileDescriptor pfd) {
        if (renderer != null) {
            try {
                renderer.close();
            } catch (Exception ignored) {
            }
        }
        if (pfd != null) {
            try {
                pfd.close();
            } catch (Exception ignored) {
            }
        }
    }
}
