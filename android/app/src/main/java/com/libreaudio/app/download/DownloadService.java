package com.libreaudio.app.download;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.getcapacitor.JSObject;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class DownloadService extends Service {

    static DownloadPlugin pluginRef;
    static DownloadService instance;

    static final String CHANNEL_ID = "libreaudio_download_channel";
    static final int NOTIF_ID = 5151;

    private volatile boolean cancelled = false;
    private Thread worker;
    private String activeBookId;
    private String activeBookTitle;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle("Preparing download...")
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true);
        Notification notification = builder.build();
        startForeground(NOTIF_ID, notification);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }
        String action = intent.getAction();

        if ("cancel".equals(action)) {
            cancelled = true;
            if (worker != null) {
                worker.interrupt();
            }
            stopSelf();
            if (pluginRef != null) {
                JSObject data = new JSObject();
                data.put("bookId", activeBookId == null ? "" : activeBookId);
                pluginRef.emitEvent("downloadCancelled", data);
            }
            return START_NOT_STICKY;
        }

        // start payload
        cancelled = false;
        activeBookId = intent.getStringExtra("bookId");
        activeBookTitle = intent.getStringExtra("bookTitle");
        String tracksJson = intent.getStringExtra("tracksJson");

        emitProgress(activeBookTitle, 0, 0, "Preparing...", 0, 0);

        worker = new Thread(() -> runDownload(tracksJson));
        worker.start();

        return START_STICKY;
    }

    private void runDownload(String tracksJson) {
        List<TrackInfo> tracks = new ArrayList<>();
        try {
            if (tracksJson != null && !tracksJson.isEmpty()) {
                JSONArray arr = new JSONArray(tracksJson);
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    TrackInfo t = new TrackInfo();
                    t.audioUrl = o.optString("audioUrl", "");
                    t.trackId = o.optString("trackId", "");
                    t.trackKey = o.optString("trackKey", "");
                    t.trackNumber = o.optInt("trackNumber", 0);
                    t.title = o.optString("title", "");
                    t.durationSeconds = o.optInt("durationSeconds", 0);
                    tracks.add(t);
                }
            }
        } catch (Exception e) {
            emitError(activeBookId, "Invalid download list");
            return;
        }

        if (tracks.isEmpty()) {
            emitError(activeBookId, "No tracks to download");
            return;
        }

        int total = tracks.size();
        int completed = 0;

        for (int i = 0; i < total; i++) {
            if (cancelled || worker.isInterrupted()) {
                return;
            }
            TrackInfo t = tracks.get(i);
            // skip tracks already on disk from a previous partial run
            File outFile = trackFile(activeBookId, t.trackKey);
            boolean alreadyHave = outFile.exists() && outFile.length() > 2048;
            if (alreadyHave) {
                emitTrackReady(t, outFile.getAbsolutePath(), i, total, completed);
                completed++;
                continue;
            }

            try {
                boolean ok = downloadOne(t, outFile, i, total, completed);
                if (!ok) {
                    if (cancelled) {
                        return;
                    }
                    emitError(activeBookId, "Failed to download: " + t.title);
                    return;
                }
                emitTrackReady(t, outFile.getAbsolutePath(), i, total, completed);
                completed++;
            } catch (Exception e) {
                emitError(activeBookId, "Download error: " + e.getMessage());
                return;
            }
        }

        emitComplete(activeBookId, total, completed);
        stopForeground(true);
        stopSelf();
    }

    /**
     * Stream-download a single track returning real byte progress.
     */
    private boolean downloadOne(TrackInfo t, File outFile, int index, int total, int completed) {
        HttpURLConnection conn = null;
        InputStream in = null;
        OutputStream out = null;
        File tmp = new File(outFile.getParentFile(), outFile.getName() + ".tmp");
        try {
            if (outFile.getParentFile() != null && !outFile.getParentFile().exists()) {
                outFile.getParentFile().mkdirs();
            }
            URL url = new URL(t.audioUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(30000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "LibreAudio/1.0 (Android)");
            conn.connect();

            int responseCode = conn.getResponseCode();
            if (responseCode < 200 || responseCode >= 400) {
                return false;
            }

            long totalBytes = conn.getContentLength();
            if (totalBytes < 0) totalBytes = 0;

            in = new BufferedInputStream(conn.getInputStream());
            out = new FileOutputStream(tmp);

            byte[] buffer = new byte[64 * 1024];
            long loaded = 0;
            int read;
            long lastEmit = 0;

            while ((read = in.read(buffer)) != -1) {
                if (cancelled || worker.isInterrupted()) {
                    return false;
                }
                out.write(buffer, 0, read);
                loaded += read;
                long now = System.currentTimeMillis();
                // throttle event storm
                if (now - lastEmit > 250 || loaded >= totalBytes) {
                    lastEmit = now;
                    int percent;
                    if (totalBytes > 0) {
                        percent = (int) Math.min(99, Math.floor((double) (completed + (long) ((double) loaded / Math.max(1, totalBytes))) / Math.max(1, total) * 100));
                    } else {
                        percent = (int) Math.min(99, Math.floor((double) completed / Math.max(1, total) * 100));
                    }
                    emitProgress(activeBookTitle, percent, loaded, t.title, completed, total);
                }
            }
            out.flush();

            if (cancelled) {
                return false;
            }

            // rename tmp -> final
            if (outFile.exists()) {
                outFile.delete();
            }
            boolean renamed = tmp.renameTo(outFile);
            if (!renamed) {
                copyFile(tmp, outFile);
                tmp.delete();
            }

            return outFile.exists() && outFile.length() > 2048;
        } catch (Exception e) {
            return false;
        } finally {
            if (in != null) try { in.close(); } catch (Exception ignored) {}
            if (out != null) try { out.close(); } catch (Exception ignored) {}
            if (conn != null) conn.disconnect();
            if (tmp.exists() && !outFile.exists()) {
                tmp.delete();
            }
        }
    }

    private void copyFile(File src, File dst) {
        try (InputStream is = new BufferedInputStream(new java.io.FileInputStream(src));
             OutputStream os = new java.io.FileOutputStream(dst)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = is.read(buf)) != -1) os.write(buf, 0, n);
        } catch (Exception ignored) {}
    }

    private File trackFile(String bookId, String trackKey) {
        File dir = new File(getFilesDir(), "libreaudio_downloads/" + bookId);
        return new File(dir, trackKey + ".mp3");
    }

    /* ---------- event helpers ---------- */

    static boolean activeInstanceBusy() {
        return instance != null && instance.worker != null && instance.worker.isAlive();
    }

    private void emitProgress(String bookTitle, int percent, long loadedBytes, String trackTitle, int completedTracks, int totalTracks) {
        JSObject data = new JSObject();
        data.put("bookId", activeBookId);
        data.put("bookTitle", bookTitle);
        data.put("percent", percent);
        data.put("bytesLoaded", loadedBytes);
        data.put("trackTitle", trackTitle);
        data.put("completedTracks", completedTracks);
        data.put("totalTracks", totalTracks);
        if (pluginRef != null) pluginRef.emitEvent("downloadProgress", data);
        updateNotification(bookTitle, trackTitle, percent, completedTracks, totalTracks);
    }

    private void emitTrackReady(TrackInfo t, String filePath, int index, int total, int completed) {
        JSObject data = new JSObject();
        data.put("bookId", activeBookId);
        data.put("filePath", filePath);
        data.put("trackKey", t.trackKey);
        data.put("trackId", t.trackId);
        data.put("trackNumber", t.trackNumber);
        data.put("title", t.title);
        data.put("durationSeconds", t.durationSeconds);
        data.put("index", index);
        data.put("total", total);
        if (pluginRef != null) pluginRef.emitEvent("trackReady", data);
    }

    private void emitComplete(String bookId, int total, int completed) {
        JSObject data = new JSObject();
        data.put("bookId", bookId);
        data.put("totalTracks", total);
        data.put("completedTracks", completed);
        if (pluginRef != null) pluginRef.emitEvent("downloadComplete", data);
        if (pluginRef != null) pluginRef.emitEvent("downloadFinished", data);
    }

    private void emitError(String bookId, String message) {
        JSObject data = new JSObject();
        data.put("bookId", bookId);
        data.put("message", message);
        if (pluginRef != null) pluginRef.emitEvent("downloadError", data);
        updateNotificationError(activeBookTitle, message);
    }

    /* ---------- notification ---------- */

    private NotificationManager nm() {
        return (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private PendingIntent contentIntent() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        return PendingIntent.getActivity(this, 0, launch,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private void updateNotification(String bookTitle, String trackTitle, int percent, int completedTracks, int totalTracks) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle("Downloading: " + bookTitle)
                .setContentText(trackTitle)
                .setProgress(100, Math.max(0, Math.min(100, percent)), false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setContentIntent(contentIntent());
        if (totalTracks > 0 && completedTracks > 0) {
            b.setSubText(completedTracks + " / " + totalTracks + " tracks");
        }
        nm().notify(NOTIF_ID, b.build());
    }

    private void updateNotificationError(String bookTitle, String message) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(getApplicationInfo().icon)
                .setContentTitle("Download failed")
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(contentIntent());
        nm().notify(NOTIF_ID, b.build());
        stopForeground(false);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                    CHANNEL_ID, "Downloads", NotificationManager.IMPORTANCE_LOW);
            chan.setShowBadge(false);
            chan.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            nm().createNotificationChannel(chan);
        }
    }

    @Override
    public void onDestroy() {
        cancelled = true;
        if (worker != null) {
            worker.interrupt();
        }
        stopForeground(true);
        instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /* ---------- data holder ---------- */

    private static class TrackInfo {
        String audioUrl;
        String trackId;
        String trackKey;
        int trackNumber;
        String title;
        int durationSeconds;
    }
}
