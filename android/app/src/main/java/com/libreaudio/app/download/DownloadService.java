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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DownloadService extends Service {

    static DownloadPlugin pluginRef;
    static DownloadService instance;

    static final String CHANNEL_ID = "libreaudio_download_channel";
    static final int NOTIF_ID = 5151;

    private static final String UA = "LibreAudio/1.0 (Android; +https://libriaudio.app)";
    private static final int MIN_VALID_BYTES = 2048;

    private volatile boolean batchCancelled = false;
    private Thread batchWorker;

    private String activeBookId;
    private String activeBookTitle;

    /** Per-chapter job state keyed by "bookId/chapterId". */
    private final Map<String, ChapterJob> chapterJobs = new ConcurrentHashMap<>();

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
        startForeground(NOTIF_ID, builder.build());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        String action = intent.getAction();
        if (action == null) action = "start";

        switch (action) {
            case "cancel":
                handleBatchCancel();
                return START_NOT_STICKY;
            case "downloadChapter":
                handleChapterDownload(intent);
                return START_STICKY;
            case "pauseChapter":
                handleChapterPause(intent.getStringExtra("bookId"), intent.getStringExtra("chapterId"));
                return START_STICKY;
            case "resumeChapter":
                handleChapterResume(intent);
                return START_STICKY;
            case "cancelChapter":
                handleChapterCancel(intent.getStringExtra("bookId"), intent.getStringExtra("chapterId"));
                return START_STICKY;
            default:
                handleBatchDownload(intent);
                return START_STICKY;
        }
    }

    /* ---------- batch download (legacy book-level) ---------- */

    private void handleBatchDownload(Intent intent) {
        batchCancelled = false;
        activeBookId = intent.getStringExtra("bookId");
        activeBookTitle = intent.getStringExtra("bookTitle");
        String tracksJson = intent.getStringExtra("tracksJson");

        emitProgress(activeBookTitle, 0, 0, "Preparing...", 0, 0);

        batchWorker = new Thread(() -> runBatchDownload(tracksJson));
        batchWorker.start();
    }

    private void handleBatchCancel() {
        batchCancelled = true;
        if (batchWorker != null) batchWorker.interrupt();
        stopSelf();
        if (pluginRef != null) {
            JSObject data = new JSObject();
            data.put("bookId", activeBookId == null ? "" : activeBookId);
            pluginRef.emitEvent("downloadCancelled", data);
        }
    }

    private void runBatchDownload(String tracksJson) {
        List<TrackInfo> tracks = parseTracks(tracksJson);
        if (tracks.isEmpty()) {
            emitError(activeBookId, "No tracks to download");
            return;
        }

        int total = tracks.size();
        int completed = 0;

        for (int i = 0; i < total; i++) {
            if (batchCancelled || batchWorker.isInterrupted()) return;
            TrackInfo t = tracks.get(i);
            String chapterId = t.trackId != null && !t.trackId.isEmpty() ? t.trackId : t.trackKey;
            File outFile = chapterFile(activeBookId, chapterId);

            if (isValidFile(outFile)) {
                emitTrackReady(t, outFile.getAbsolutePath(), i, total, completed);
                completed++;
                continue;
            }

            ChapterJob job = new ChapterJob(activeBookId, chapterId);
            chapterJobs.put(job.key(), job);

            final int completedAtStart = completed;
            final int totalTracks = total;
            try {
                boolean ok = downloadToFile(t.audioUrl, outFile, job, (loaded, totalBytes) -> {
                    int percent = totalBytes > 0
                            ? (int) Math.min(99, Math.floor((double) (completedAtStart + (double) loaded / Math.max(1, totalBytes)) / Math.max(1, totalTracks) * 100))
                            : (int) Math.min(99, Math.floor((double) completedAtStart / Math.max(1, totalTracks) * 100));
                    emitProgress(activeBookTitle, percent, loaded, t.title, completedAtStart, totalTracks);
                    emitChapterProgress(activeBookId, chapterId, "downloading", percent, loaded, totalBytes, null);
                });
                chapterJobs.remove(job.key());
                if (!ok) {
                    if (batchCancelled) return;
                    emitError(activeBookId, "Failed to download: " + t.title);
                    return;
                }
                emitTrackReady(t, outFile.getAbsolutePath(), i, total, completed);
                emitChapterProgress(activeBookId, chapterId, "completed", 100, outFile.length(), outFile.length(), null);
                completed++;
            } catch (Exception e) {
                chapterJobs.remove(job.key());
                emitError(activeBookId, "Download error: " + e.getMessage());
                return;
            }
        }

        emitComplete(activeBookId, total, completed);
        stopForeground(true);
        stopSelf();
    }

    /* ---------- single-chapter download ---------- */

    private void handleChapterDownload(Intent intent) {
        String bookId = intent.getStringExtra("bookId");
        String chapterId = intent.getStringExtra("chapterId");
        String remoteUrl = intent.getStringExtra("remoteUrl");
        String bookTitle = intent.getStringExtra("bookTitle");

        if (bookId == null || chapterId == null || remoteUrl == null) return;

        String key = bookId + "/" + chapterId;
        ChapterJob existing = chapterJobs.get(key);
        if (existing != null && existing.worker != null && existing.worker.isAlive()) return;

        ChapterJob job = new ChapterJob(bookId, chapterId);
        chapterJobs.put(key, job);

        emitChapterProgress(bookId, chapterId, "queued", 0, 0, 0, null);
        updateNotification(bookTitle != null ? bookTitle : bookId, chapterId, 0, 0, 1);

        job.worker = new Thread(() -> {
            File outFile = chapterFile(bookId, chapterId);
            if (isValidFile(outFile)) {
                emitChapterProgress(bookId, chapterId, "completed", 100, outFile.length(), outFile.length(), null);
                chapterJobs.remove(key);
                return;
            }
            try {
                boolean ok = downloadToFile(remoteUrl, outFile, job, (loaded, totalBytes) -> {
                    int percent = totalBytes > 0 ? (int) Math.min(99, (loaded * 100) / totalBytes) : 0;
                    emitChapterProgress(bookId, chapterId, job.paused ? "paused" : "downloading", percent, loaded, totalBytes, null);
                    updateNotification(bookTitle != null ? bookTitle : bookId, chapterId, percent, 0, 1);
                });
                if (job.cancelled) {
                    emitChapterProgress(bookId, chapterId, "cancelled", 0, 0, 0, null);
                } else if (!ok) {
                    emitChapterProgress(bookId, chapterId, "failed", 0, 0, 0, "Download failed");
                } else {
                    emitChapterProgress(bookId, chapterId, "completed", 100, outFile.length(), outFile.length(), null);
                }
            } catch (Exception e) {
                emitChapterProgress(bookId, chapterId, "failed", 0, 0, 0, e.getMessage());
            } finally {
                chapterJobs.remove(key);
            }
        });
        job.worker.start();
    }

    private void handleChapterPause(String bookId, String chapterId) {
        if (bookId == null || chapterId == null) return;
        ChapterJob job = chapterJobs.get(bookId + "/" + chapterId);
        if (job != null) {
            job.paused = true;
            emitChapterProgress(bookId, chapterId, "paused", job.lastPercent, job.lastLoaded, job.lastTotal, null);
        }
    }

    private void handleChapterResume(Intent intent) {
        String bookId = intent.getStringExtra("bookId");
        String chapterId = intent.getStringExtra("chapterId");
        String remoteUrl = intent.getStringExtra("remoteUrl");
        if (bookId == null || chapterId == null || remoteUrl == null) return;

        ChapterJob job = chapterJobs.get(bookId + "/" + chapterId);
        if (job != null) {
            job.paused = false;
            job.resumeRequested = true;
        } else {
            handleChapterDownload(intent);
        }
    }

    private void handleChapterCancel(String bookId, String chapterId) {
        if (bookId == null || chapterId == null) return;
        String key = bookId + "/" + chapterId;
        ChapterJob job = chapterJobs.get(key);
        if (job != null) {
            job.cancelled = true;
            if (job.worker != null) job.worker.interrupt();
            chapterJobs.remove(key);
        }
        File tmp = new File(chapterFile(bookId, chapterId).getAbsolutePath() + ".tmp");
        if (tmp.exists()) tmp.delete();
        emitChapterProgress(bookId, chapterId, "cancelled", 0, 0, 0, null);
    }

    /* ---------- core download with redirects & headers ---------- */

    private boolean downloadToFile(String audioUrl, File outFile, ChapterJob job, ProgressCallback cb) throws Exception {
        if (outFile.getParentFile() != null && !outFile.getParentFile().exists()) {
            outFile.getParentFile().mkdirs();
        }

        File tmp = new File(outFile.getAbsolutePath() + ".tmp");
        long existingBytes = tmp.exists() ? tmp.length() : 0;

        String currentUrl = audioUrl;
        if (currentUrl.startsWith("http://")) {
            currentUrl = "https://" + currentUrl.substring(7);
        }

        HttpURLConnection conn = null;
        boolean rangeRequested = false;

        for (int i = 0; i < 10; i++) {
            URL url = new URL(currentUrl);
            conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(60000);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent", UA);
            conn.setRequestProperty("Accept", "*/*");
            conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
            conn.setRequestProperty("Referer", "https://archive.org/");

            if (existingBytes > 0 && !rangeRequested) {
                conn.setRequestProperty("Range", "bytes=" + existingBytes + "-");
                rangeRequested = true;
            }

            conn.connect();

            int responseCode = conn.getResponseCode();
            if (responseCode == HttpURLConnection.HTTP_MOVED_PERM
                    || responseCode == HttpURLConnection.HTTP_MOVED_TEMP
                    || responseCode == 303 || responseCode == 307 || responseCode == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("Redirect without Location header");
                }
                if (location.startsWith("http://")) {
                    location = "https://" + location.substring(7);
                }
                if (!location.startsWith("http")) {
                    location = new URL(url, location).toString();
                }
                currentUrl = location;
                continue;
            }

            if (responseCode == 416) {
                // Range not satisfiable — file may already be complete
                if (isValidFile(outFile)) return true;
                existingBytes = 0;
                conn.disconnect();
                conn = null;
                rangeRequested = false;
                continue;
            }

            if (responseCode < 200 || responseCode >= 400) {
                if (conn != null) conn.disconnect();
                return false;
            }

            long totalBytes = conn.getContentLengthLong();
            if (totalBytes < 0) totalBytes = 0;
            if (existingBytes > 0 && totalBytes > 0) totalBytes += existingBytes;

            InputStream in = new BufferedInputStream(conn.getInputStream());
            OutputStream out = new FileOutputStream(tmp, existingBytes > 0);
            byte[] buffer = new byte[64 * 1024];
            long loaded = existingBytes;
            int read;
            long lastEmit = 0;

            while ((read = in.read(buffer)) != -1) {
                if (job.cancelled || Thread.currentThread().isInterrupted()) {
                    in.close();
                    out.close();
                    return false;
                }
                while (job.paused && !job.cancelled && !job.resumeRequested) {
                    Thread.sleep(200);
                }
                if (job.cancelled) {
                    in.close();
                    out.close();
                    return false;
                }
                job.resumeRequested = false;

                out.write(buffer, 0, read);
                loaded += read;
                job.lastLoaded = loaded;
                job.lastTotal = totalBytes;
                job.lastPercent = totalBytes > 0 ? (int) Math.min(99, (loaded * 100) / totalBytes) : 0;

                long now = System.currentTimeMillis();
                if (now - lastEmit > 250) {
                    lastEmit = now;
                    cb.onProgress(loaded, totalBytes);
                }
            }
            out.flush();
            in.close();
            out.close();

            if (job.cancelled) return false;

            if (outFile.exists()) outFile.delete();
            boolean renamed = tmp.renameTo(outFile);
            if (!renamed) {
                copyFile(tmp, outFile);
                tmp.delete();
            }
            cb.onProgress(outFile.length(), outFile.length());
            return isValidFile(outFile);
        }

        if (conn != null) conn.disconnect();
        return false;
    }

    private HttpURLConnection openConnectionWithRedirects(String urlString) throws Exception {
        String current = urlString;
        if (current.startsWith("http://")) {
            current = "https://" + current.substring(7);
        }

        for (int i = 0; i < 10; i++) {
            URL url = new URL(current);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(30000);
            conn.setReadTimeout(60000);
            conn.setInstanceFollowRedirects(false);
            conn.setRequestProperty("User-Agent", UA);
            conn.setRequestProperty("Accept", "*/*");
            conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
            conn.setRequestProperty("Referer", "https://archive.org/");

            int code = conn.getResponseCode();
            if (code == HttpURLConnection.HTTP_MOVED_PERM
                    || code == HttpURLConnection.HTTP_MOVED_TEMP
                    || code == 303 || code == 307 || code == 308) {
                String location = conn.getHeaderField("Location");
                conn.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("Redirect without Location header");
                }
                if (location.startsWith("http://")) {
                    location = "https://" + location.substring(7);
                }
                if (!location.startsWith("http")) {
                    location = new URL(url, location).toString();
                }
                current = location;
                continue;
            }
            return conn;
        }
        throw new Exception("Too many redirects");
    }

    /* ---------- file paths ---------- */

    static File chapterFile(Context ctx, String bookId, String chapterId) {
        File dir = new File(ctx.getFilesDir(), "audiobooks/" + bookId);
        return new File(dir, chapterId + ".mp3");
    }

    private File chapterFile(String bookId, String chapterId) {
        return chapterFile(this, bookId, chapterId);
    }

    private boolean isValidFile(File f) {
        return f.exists() && f.length() > MIN_VALID_BYTES;
    }

    /* ---------- helpers ---------- */

    private List<TrackInfo> parseTracks(String tracksJson) {
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
        } catch (Exception ignored) {}
        return tracks;
    }

    private void copyFile(File src, File dst) throws Exception {
        try (InputStream is = new BufferedInputStream(new java.io.FileInputStream(src));
             OutputStream os = new FileOutputStream(dst)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = is.read(buf)) != -1) os.write(buf, 0, n);
        }
    }

    static boolean activeInstanceBusy() {
        if (instance == null) return false;
        if (instance.batchWorker != null && instance.batchWorker.isAlive()) return true;
        for (ChapterJob job : instance.chapterJobs.values()) {
            if (job.worker != null && job.worker.isAlive()) return true;
        }
        return false;
    }

    /* ---------- event helpers ---------- */

    private void emitChapterProgress(String bookId, String chapterId, String status,
                                     int percent, long loaded, long total, String error) {
        JSObject data = new JSObject();
        data.put("bookId", bookId);
        data.put("chapterId", chapterId);
        data.put("status", status);
        data.put("percent", percent);
        data.put("downloadedBytes", loaded);
        data.put("totalBytes", total);
        if (error != null) data.put("error", error);
        if (pluginRef != null) pluginRef.emitEvent("downloadProgress", data);
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
        if (pluginRef != null) {
            pluginRef.emitEvent("downloadComplete", data);
            pluginRef.emitEvent("downloadFinished", data);
        }
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
        batchCancelled = true;
        if (batchWorker != null) batchWorker.interrupt();
        for (ChapterJob job : chapterJobs.values()) {
            job.cancelled = true;
            if (job.worker != null) job.worker.interrupt();
        }
        chapterJobs.clear();
        stopForeground(true);
        instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private interface ProgressCallback {
        void onProgress(long loaded, long totalBytes);
    }

    private static class ChapterJob {
        final String bookId;
        final String chapterId;
        volatile boolean paused;
        volatile boolean cancelled;
        volatile boolean resumeRequested;
        volatile long lastLoaded;
        volatile long lastTotal;
        volatile int lastPercent;
        Thread worker;

        ChapterJob(String bookId, String chapterId) {
            this.bookId = bookId;
            this.chapterId = chapterId;
        }

        String key() {
            return bookId + "/" + chapterId;
        }
    }

    private static class TrackInfo {
        String audioUrl;
        String trackId;
        String trackKey;
        int trackNumber;
        String title;
        int durationSeconds;
    }
}
