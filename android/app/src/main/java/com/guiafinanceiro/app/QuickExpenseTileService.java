package com.guiafinanceiro.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import android.util.Log;

/**
 * QuickExpenseTileService — Quick Settings Tile do Android Nativo (§4.3).
 *
 * Permite ao usuário adicionar um atalho rápido na cortina de notificações
 * do sistema Android ("Lançar Despesa").
 *
 * Ao ser tocado, recolhe o painel de configurações rápidas, lida com tela de bloqueio
 * se necessário (unlockAndRun) e abre o aplicativo com o modal de novo lançamento ativo.
 */
public class QuickExpenseTileService extends TileService {

    private static final String TAG = "QuickExpenseTile";
    private static final String EXPENSE_DEEP_LINK = "https://com.guiafinanceiro.app/transacoes?novo=despesa";

    @Override
    public void onStartListening() {
        super.onStartListening();
        try {
            Tile tile = getQsTile();
            if (tile != null) {
                tile.setState(Tile.STATE_INACTIVE);
                tile.setLabel(getString(R.string.shortcut_new_expense));
                tile.updateTile();
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao atualizar estado do Quick Settings Tile", e);
        }
    }

    @Override
    public void onClick() {
        super.onClick();

        Runnable launchRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(EXPENSE_DEEP_LINK));
                    intent.setClass(QuickExpenseTileService.this, MainActivity.class);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                        PendingIntent pendingIntent = PendingIntent.getActivity(
                            QuickExpenseTileService.this,
                            1001,
                            intent,
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                        );
                        startActivityAndCollapse(pendingIntent);
                    } else {
                        startActivityAndCollapse(intent);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Falha ao abrir aplicativo a partir do Tile", e);
                }
            }
        };

        try {
            if (isLocked()) {
                unlockAndRun(launchRunnable);
            } else {
                launchRunnable.run();
            }
        } catch (Exception e) {
            Log.e(TAG, "Erro ao processar clique no Quick Settings Tile", e);
        }
    }
}
