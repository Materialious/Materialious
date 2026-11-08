package us.materialio.app;

import android.app.UiModeManager;
import android.content.Context;
import android.content.res.Configuration;

import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.List;
import java.util.ArrayList;

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

    @PluginMethod()
    public void getIpAddresses(PluginCall call) {
        List<String> addresses = new ArrayList<>();
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                Enumeration<InetAddress> inetAddresses = interfaces.nextElement().getInetAddresses();
                while (inetAddresses.hasMoreElements()) {
                    InetAddress address = inetAddresses.nextElement();
                    if (!address.isLoopbackAddress() && address.getHostAddress().indexOf(':') < 0) {
                        addresses.add(address.getHostAddress());
                    }
                }
            }
        } catch (Exception e) {
            // Fall through with an empty list.
        }

        JSObject ret = new JSObject();
        ret.put("value", new JSArray(addresses));
        call.resolve(ret);
    }
}
