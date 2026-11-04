package us.materialio.app;

import android.os.Bundle;
import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.util.Rational;


import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private volatile boolean pictureInPicturePlaybackActive = false;
    private volatile boolean automaticPictureInPictureEnabled = true;

    public void setAutomaticPictureInPictureEnabled(boolean enabled) {
        automaticPictureInPictureEnabled = enabled;
        updatePictureInPictureParams();
    }

    public void setPictureInPicturePlaybackActive(boolean active) {
        pictureInPicturePlaybackActive = active;
        updatePictureInPictureParams();
    }

    private void updatePictureInPictureParams() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            PictureInPictureParams.Builder params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                params.setAutoEnterEnabled(pictureInPicturePlaybackActive && automaticPictureInPictureEnabled);
            }
            setPictureInPictureParams(params.build());
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ColorTheme.class);
        registerPlugin(AndroidTv.class);
        registerPlugin(AndroidPictureInPicture.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && pictureInPicturePlaybackActive && automaticPictureInPictureEnabled) {
            enterPictureInPictureMode(new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(16, 9))
                    .build());
        }
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (getBridge() != null) {
            com.getcapacitor.PluginHandle plugin = getBridge().getPlugin("AndroidPictureInPicture");
            if (plugin != null && plugin.getInstance() instanceof AndroidPictureInPicture) {
                ((AndroidPictureInPicture) plugin.getInstance())
                        .notifyPictureInPictureModeChanged(isInPictureInPictureMode);
            }
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        WebView webview = getBridge().getWebView();
        webview.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        webview.setVerticalScrollBarEnabled(false);
        webview.setHorizontalScrollBarEnabled(false);

        WebSettings settings = webview.getSettings();
        settings.setMediaPlaybackRequiresUserGesture(false);
    }
}
