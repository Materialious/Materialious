package us.materialio.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidPictureInPicture")
public class AndroidPictureInPicture extends Plugin {
    public void notifyPictureInPictureModeChanged(boolean active) {
        JSObject data = new JSObject();
        data.put("isInPictureInPictureMode", active);
        notifyListeners("pictureInPictureModeChanged", data);
    }

    @PluginMethod
    public void setPlaybackActive(PluginCall call) {
        boolean active = call.getBoolean("active", false);
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setPictureInPicturePlaybackActive(active);
        }
        call.resolve(new JSObject());
    }

    @PluginMethod
    public void setAutoPipEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        if (getActivity() instanceof MainActivity) {
            ((MainActivity) getActivity()).setAutomaticPictureInPictureEnabled(enabled);
        }
        call.resolve(new JSObject());
    }
}
