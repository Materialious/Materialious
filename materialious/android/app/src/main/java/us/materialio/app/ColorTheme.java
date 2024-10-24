package us.materialio.app;

import android.content.Context;
import android.content.res.TypedArray;

import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PluginCall;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import com.google.android.material.color.DynamicColors;

@CapacitorPlugin(name = "ColorTheme")
public class ColorTheme extends Plugin {
    @PluginMethod()
    public void getColorPalette(PluginCall call) {
        JSObject colorPalette = new JSObject();

        if (DynamicColors.isDynamicColorAvailable()) {
            Context dynamicColorContext = DynamicColors.wrapContextIfAvailable(getContext(), com.google.android.material.R.style.ThemeOverlay_Material3_DynamicColors_DayNight);

            int[] attrsToResolve = {
                    com.google.android.material.R.attr.colorPrimary,
                    com.google.android.material.R.attr.colorOnPrimary,
                    com.google.android.material.R.attr.colorSecondary,
                    com.google.android.material.R.attr.colorAccent
            };

            try {
                TypedArray ta = dynamicColorContext.obtainStyledAttributes(attrsToResolve);

                colorPalette.put("primary", ta.getColor(0,0));
                colorPalette.put("onPrimary", ta.getColor(1,0));
                colorPalette.put("secondary", ta.getColor(2,0));
                colorPalette.put("accent", ta.getColor(3,0));

                ta.recycle();

                call.resolve(colorPalette);
            } catch (Exception e) {
                call.reject("Unable to fetch dynamic color");
            }
        } else {
            call.reject("Dynamic color not available");
        }
    }
}
