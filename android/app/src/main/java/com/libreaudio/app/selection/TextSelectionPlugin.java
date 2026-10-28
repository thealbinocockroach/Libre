package com.libreaudio.app.selection;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TextSelection")
public class TextSelectionPlugin extends Plugin {

    @PluginMethod
    public void setBlockNativeSelection(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("active", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openDictionary(PluginCall call) {
        String word = call.getString("word", "");
        if (word == null || word.trim().isEmpty()) {
            call.reject("Word is empty");
            return;
        }
        word = word.trim();

        Context context = getContext();
        PackageManager pm = context.getPackageManager();

        // 1. Check known popular dictionary apps (WordWeb, GoldenDict, Livio, ColorDict, Merriam-Webster)
        String[] dictPackages = new String[] {
            "com.wordwebsoftware.android.wordweb",
            "mobi.goldendict.android",
            "livio.pack.lang.en_US",
            "com.socialnmobile.colordict",
            "com.merriamwebster"
        };

        for (String pkg : dictPackages) {
            try {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_TEXT, word);
                intent.setPackage(pkg);
                if (intent.resolveActivity(pm) != null) {
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(intent);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                    return;
                }
            } catch (Exception ignored) {}
        }

        // 2. Try ACTION_PROCESS_TEXT (Android 6.0+) - matches system definition or any installed dictionary
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent processTextIntent = new Intent(Intent.ACTION_PROCESS_TEXT);
                processTextIntent.setType("text/plain");
                processTextIntent.putExtra(Intent.EXTRA_PROCESS_TEXT, word);
                processTextIntent.putExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, true);
                if (processTextIntent.resolveActivity(pm) != null) {
                    processTextIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(processTextIntent);
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                    return;
                }
            } catch (Exception ignored) {}
        }

        // 3. Fallback: External browser search for definition (clean, no webview freeze)
        try {
            Uri searchUri = Uri.parse("https://www.google.com/search?q=define+" + Uri.encode(word));
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, searchUri);
            browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(browserIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to open dictionary: " + e.getMessage());
        }
    }
}
