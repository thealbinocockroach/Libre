package com.libreaudio.app.selection;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * No-op plugin kept for compatibility. Native selection is now always enabled.
 */
@CapacitorPlugin(name = "TextSelection")
public class TextSelectionPlugin extends Plugin {

    @PluginMethod
    public void setBlockNativeSelection(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", false);
        call.resolve(ret);
    }
}
