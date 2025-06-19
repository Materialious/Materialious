package us.materialio.app;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;

import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;

@CapacitorPlugin(name = "AndroidTv")
public class AndroidTv extends Plugin {
    @PluginMethod()
    public void isAndroidTv(PluginCall call) {
        UiModeManager uiModeManager = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
        boolean isTelevision = uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;

        JSObject ret = new JSObject();
        ret.put("value", isTelevision);
        call.resolve(ret);
    }
}
