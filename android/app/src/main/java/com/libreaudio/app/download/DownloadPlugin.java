package com.libreaudio.app.download;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
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
        ),
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
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

    /* ---------- permissions ---------- */

    @PluginMethod
    public void checkStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasStoragePermission());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        if (hasStoragePermission()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // App-scoped internal storage does not require runtime permission on Android 10+.
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("storage", call, "storagePermissionCallback");
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", hasStoragePermission());
        call.resolve(ret);
    }

    private boolean hasStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            return true;
        }
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
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
        if (Build.VERSION.SDK_INT >= 33) {
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    /* ---------- storage paths ---------- */

    @PluginMethod
    public void getDownloadsDirectory(PluginCall call) {
        File dir = new File(getContext().getFilesDir(), "audiobooks");
        if (!dir.exists()) dir.mkdirs();
        JSObject ret = new JSObject();
        ret.put("path", dir.getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void listDownloadedChapters(PluginCall call) {
        File root = new File(getContext().getFilesDir(), "audiobooks");
        JSONArray chapters = new JSONArray();
        if (root.exists() && root.isDirectory()) {
            File[] bookDirs = root.listFiles();
            if (bookDirs != null) {
                for (File bookDir : bookDirs) {
                    if (!bookDir.isDirectory()) continue;
                    String bookId = bookDir.getName();
                    File[] files = bookDir.listFiles();
                    if (files == null) continue;
                    for (File f : files) {
                        String name = f.getName();
                        if (!name.endsWith(".mp3")) continue;
                        String chapterId = name.substring(0, name.length() - 4);
                        JSObject item = new JSObject();
                        item.put("bookId", bookId);
                        item.put("chapterId", chapterId);
                        item.put("filePath", f.getAbsolutePath());
                        item.put("fileSizeBytes", f.length());
                        item.put("exists", f.exists() && f.length() > 2048);
                        chapters.put(item);
                    }
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("chapters", chapters);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStoreInfo(PluginCall call) {
        getDownloadsDirectory(call);
    }

    @PluginMethod
    public void fileExists(PluginCall call) {
        String bookId = call.getString("bookId");
        String chapterId = call.getString("chapterId");
        if (bookId == null || chapterId == null) {
            call.reject("bookId and chapterId are required");
            return;
        }
        File f = DownloadService.chapterFile(getContext(), bookId, chapterId);
        JSObject ret = new JSObject();
        ret.put("exists", f.exists() && f.length() > 2048);
        call.resolve(ret);
    }

    @PluginMethod
    public void getPlayableUri(PluginCall call) {
        String bookId = call.getString("bookId");
        String chapterId = call.getString("chapterId");
        String remoteUrl = call.getString("remoteUrl", "");
        if (bookId == null || chapterId == null) {
            call.reject("bookId and chapterId are required");
            return;
        }
        File local = DownloadService.chapterFile(getContext(), bookId, chapterId);
        JSObject ret = new JSObject();
        if (local.exists() && local.length() > 2048) {
            ret.put("uri", Uri.fromFile(local).toString());
        } else {
            String fallback = remoteUrl != null ? remoteUrl : "";
            if (fallback.startsWith("http://")) {
                fallback = "https://" + fallback.substring(7);
            }
            ret.put("uri", fallback);
        }
        call.resolve(ret);
    }

    /* ---------- chapter download controls ---------- */

    @PluginMethod
    public void downloadChapter(PluginCall call) {
        String bookId = call.getString("bookId");
        String chapterId = call.getString("chapterId");
        String remoteUrl = call.getString("remoteUrl");
        if (bookId == null || chapterId == null || remoteUrl == null) {
            call.reject("bookId, chapterId, and remoteUrl are required");
            return;
        }

        Intent intent = new Intent(getContext(), DownloadService.class);
        intent.setAction("downloadChapter");
        intent.putExtra("bookId", bookId);
        intent.putExtra("chapterId", chapterId);
        intent.putExtra("remoteUrl", remoteUrl);
        intent.putExtra("bookTitle", call.getString("bookTitle", ""));
        try {
            getContext().startForegroundService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start chapter download: " + e.getMessage());
        }
    }

    @PluginMethod
    public void pauseDownload(PluginCall call) {
        startChapterAction(call, "pauseChapter");
    }

    @PluginMethod
    public void resumeDownload(PluginCall call) {
        String bookId = call.getString("bookId");
        String chapterId = call.getString("chapterId");
        String remoteUrl = call.getString("remoteUrl", "");
        if (bookId == null || chapterId == null) {
            call.reject("bookId and chapterId are required");
            return;
        }
        Intent intent = new Intent(getContext(), DownloadService.class);
        intent.setAction("resumeChapter");
        intent.putExtra("bookId", bookId);
        intent.putExtra("chapterId", chapterId);
        intent.putExtra("remoteUrl", remoteUrl);
        try {
            getContext().startForegroundService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to resume: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        startChapterAction(call, "cancelChapter");
    }

    @PluginMethod
    public void deleteDownloadedChapter(PluginCall call) {
        String bookId = call.getString("bookId");
        String chapterId = call.getString("chapterId");
        if (bookId == null || chapterId == null) {
            call.reject("bookId and chapterId are required");
            return;
        }
        File f = DownloadService.chapterFile(getContext(), bookId, chapterId);
        if (f.exists()) f.delete();
        File tmp = new File(f.getAbsolutePath() + ".tmp");
        if (tmp.exists()) tmp.delete();
        startChapterAction(call, "cancelChapter");
    }

    @PluginMethod
    public void deleteBookDownloads(PluginCall call) {
        String bookId = call.getString("bookId");
        if (bookId == null) {
            call.reject("bookId is required");
            return;
        }
        File bookDir = new File(getContext().getFilesDir(), "audiobooks/" + bookId);
        if (bookDir.exists() && bookDir.isDirectory()) {
            File[] files = bookDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    if (f.isFile()) f.delete();
                }
            }
            bookDir.delete();
        }
        call.resolve();
    }

    private void startChapterAction(PluginCall call, String action) {
        String bookId = call.getString("bookId");
        String chapterId = call.getString("chapterId");
        if (bookId == null || chapterId == null) {
            call.reject("bookId and chapterId are required");
            return;
        }
        Intent intent = new Intent(getContext(), DownloadService.class);
        intent.setAction(action);
        intent.putExtra("bookId", bookId);
        intent.putExtra("chapterId", chapterId);
        try {
            getContext().startForegroundService(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Action failed: " + e.getMessage());
        }
    }

    /* ---------- legacy batch download ---------- */

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
