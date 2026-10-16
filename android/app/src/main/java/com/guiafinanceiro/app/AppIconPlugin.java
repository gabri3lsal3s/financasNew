package com.guiafinanceiro.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppIconPlugin")
public class AppIconPlugin extends Plugin {

    private static final String DEFAULT_ALIAS = "com.guiafinanceiro.app.MainActivityDefault";
    private static final String PRO_ALIAS = "com.guiafinanceiro.app.MainActivityPro";

    @PluginMethod
    public void setAppIcon(PluginCall call) {
        String icon = call.getString("icon", "default");
        boolean isPro = "pro".equalsIgnoreCase(icon) || Boolean.TRUE.equals(call.getBoolean("isPro", false));

        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        ComponentName defaultComponent = new ComponentName(context, DEFAULT_ALIAS);
        ComponentName proComponent = new ComponentName(context, PRO_ALIAS);

        int currentProState = pm.getComponentEnabledSetting(proComponent);
        boolean isCurrentlyPro = (currentProState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED);

        if (isPro != isCurrentlyPro) {
            if (isPro) {
                // Habilita o alias Pro primeiro para que o app nunca fique sem um launcher ativo no Android
                pm.setComponentEnabledSetting(
                    proComponent,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                pm.setComponentEnabledSetting(
                    defaultComponent,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            } else {
                // Habilita o alias Default primeiro
                pm.setComponentEnabledSetting(
                    defaultComponent,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
                pm.setComponentEnabledSetting(
                    proComponent,
                    PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                    PackageManager.DONT_KILL_APP
                );
            }
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("currentIcon", isPro ? "pro" : "default");
        ret.put("isPro", isPro);
        call.resolve(ret);
    }

    @PluginMethod
    public void getAppIcon(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        ComponentName proComponent = new ComponentName(context, PRO_ALIAS);
        int proState = pm.getComponentEnabledSetting(proComponent);
        boolean isPro = (proState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED);

        JSObject ret = new JSObject();
        ret.put("currentIcon", isPro ? "pro" : "default");
        ret.put("isPro", isPro);
        call.resolve(ret);
    }
}
