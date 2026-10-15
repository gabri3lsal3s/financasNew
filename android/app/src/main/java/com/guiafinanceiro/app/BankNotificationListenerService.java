package com.guiafinanceiro.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class BankNotificationListenerService extends NotificationListenerService {

    private static final Set<String> MONITORED_BANK_PACKAGES = new HashSet<>(Arrays.asList(
        "com.nu.production",
        "com.itau",
        "com.itau.personnalite",
        "br.com.intermedium",
        "com.c6bank.app",
        "com.bradesco",
        "com.santander.app",
        "com.mercadopago.wallet",
        "br.gov.caixa.tem",
        "br.com.gabba.Caixa",
        "br.com.bb.android"
    ));

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (packageName == null) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;

        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleChar = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textChar = extras.getCharSequence(Notification.EXTRA_TEXT);
        CharSequence bigTextChar = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        String title = titleChar != null ? titleChar.toString() : "";
        String text = bigTextChar != null ? bigTextChar.toString() : (textChar != null ? textChar.toString() : "");

        boolean isBankPackage = MONITORED_BANK_PACKAGES.contains(packageName);
        String lowerText = text.toLowerCase();
        String lowerTitle = title.toLowerCase();
        boolean hasFinancialKeyword = text.contains("R$") || lowerText.contains("pix") || lowerTitle.contains("pix");

        if (!isBankPackage && !hasFinancialKeyword) {
            return;
        }

        long timestamp = sbn.getPostTime();

        BankNotificationPlugin plugin = BankNotificationPlugin.getInstance();
        if (plugin != null) {
            plugin.onNotificationReceived(packageName, title, text, timestamp);
        }
    }
}
