package com.libreaudio.app.download;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;

import org.json.JSONArray;

@CapacitorPlugin(
    name = "Download",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class DownloadPlugin extends Plugin {

    @Override
    public void load() {
        DownloadPlugin.instance = this;
        DownloadService.pluginRef = this;
    }

    static DownloadPlugin instance;

    public void emitEvent(String eventName, JSObject data) {
        notifyListeners(eventName, data);
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasNotificationPermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (hasNotificationPermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsPermissionCallback");
    }

    @PermissionCallback
    private void notificationsPermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasNotificationPermission());
        call.resolve(ret);
    }

    private boolean hasNotificationPermission() {
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    @PluginMethod
    public void startDownload(PluginCall call) {
        String bookId = call.getString("bookId");
        String bookTitle = call.getString("bookTitle");
        JSONArray tracksArray = call.getArray("tracks");
        if (bookId == null || tracksArray == null) {
            call.reject("bookId and tracks are required");
            return;
        }

        Intent intent = new Intent(getContext(), DownloadService.class);
        intent.setAction("start");
        intent.putExtra("bookId", bookId);
        intent.putExtra("bookTitle", bookTitle != null ? bookTitle : "");
        intent.putExtra("tracksJson", tracksArray.toString());
        try {
            getContext().startForegroundService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start download: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Intent intent = new Intent(getContext(), DownloadService.class);
        intent.setAction("cancel");
        try {
            getContext().startForegroundService(intent);
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void isDownloading(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("downloading", DownloadService.instance != null && DownloadService.activeInstanceBusy());
        call.resolve(ret);
    }

    @PluginMethod
    public void getStoreInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("path", new File(getContext().getFilesDir(), "libreaudio_downloads").getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void readTrack(PluginCall call) {
        String filePath = call.getString("filePath");
        for (int attempt = 0; attempt < 3; attempt++) {
            File f = new File(filePath);
            if (!f.exists() || f.length() <= 2048) {
                if (attempt < 2) {
                    try { Thread.sleep(800); } catch (InterruptedException ignored) { break; }
                    continue;
                }
                call.reject("Track file not ready");
                return;
            }
            try {
                byte[] data = Files.readAllBytes(Paths.get(filePath));
                String b64 = Base64.encodeToString(data, Base64.NO_WRAP);
                boolean deleteAfter = Boolean.TRUE.equals(call.getBoolean("deleteAfter", true));
                if (deleteAfter) {
                    f.delete();
                }
                JSObject ret = new JSObject();
                ret.put("base64", b64);
                ret.put("size", data.length);
                call.resolve(ret);
                return;
            } catch (Exception e) {
                call.reject("Failed to read track: " + e.getMessage());
                return;
            }
        }
        call.reject("Track file not ready");
    }

    @PluginMethod
    public void deleteTrack(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath != null) {
            File f = new File(filePath);
            if (f.exists()) f.delete();
        }
        call.resolve();
    }
}
