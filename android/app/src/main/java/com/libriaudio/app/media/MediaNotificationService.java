package com.libriaudio.app.media;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.session.MediaButtonReceiver;

import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import com.getcapacitor.JSObject;

import java.net.URL;

public class MediaNotificationService extends Service {

    static MediaNotificationPlugin pluginRef;
    static MediaNotificationService instance;
    static final String CHANNEL_ID = "libriaudio_media_channel";
    static final int NOTIF_ID = 4242;

    private MediaSessionCompat session;
    private Bitmap artworkBitmap;
    private String currentArtworkUrl;
    private Notification lastNotification;

    private String title = "";
    private String artist = "";
    private String album = "";
    private boolean isPlaying = false;
    private long position = 0L;
    private long duration = 0L;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();

        session = new MediaSessionCompat(this, "LibriAudioSession");
        session.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { emit("play"); }
            @Override public void onPause() { emit("pause"); }
            @Override public void onSkipToNext() { emit("next"); }
            @Override public void onSkipToPrevious() { emit("previous"); }
            @Override public void onSeekTo(long pos) { emit("seek", pos); }
            @Override public void onStop() { emit("stop"); }
        });
        session.setActive(true);

        rebuildNotification();
        startForeground(NOTIF_ID, lastNotification);
    }

    private void emit(String action) {
        JSObject data = new JSObject();
        data.put("action", action);
        if (pluginRef != null) pluginRef.emitEvent("mediaNotificationAction", data);
    }

    private void emit(String action, long posMs) {
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("position", posMs);
        if (pluginRef != null) pluginRef.emitEvent("mediaNotificationAction", data);
    }

    public void update(String title, String artist, String album, String artworkUrl,
                        boolean isPlaying, double position, double duration) {
        this.title = title;
        this.artist = artist;
        this.album = album;
        this.isPlaying = isPlaying;
        this.position = (long) (position * 1000);
        this.duration = (long) (duration * 1000);

        MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album);
        if (artworkBitmap != null)
            meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artworkBitmap);
        session.setMetadata(meta.build());

        updatePlaybackState();

        if (artworkUrl != null && !artworkUrl.isEmpty() && !artworkUrl.equals(currentArtworkUrl)) {
            currentArtworkUrl = artworkUrl;
            loadArtwork(artworkUrl);
        } else {
            rebuildNotification();
        }
    }

    private void updatePlaybackState() {
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, position, 1f);
        session.setPlaybackState(builder.build());
    }

    private void loadArtwork(String url) {
        new Thread(() -> {
            try {
                Bitmap bmp = BitmapFactory.decodeStream(new URL(url).openStream());
                artworkBitmap = bmp;
                MediaMetadataCompat.Builder meta = new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
                    .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album);
                if (bmp != null) meta.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, bmp);
                session.setMetadata(meta.build());
            } catch (Exception ignored) {}
            rebuildNotification();
        }).start();
    }

    private PendingIntent contentIntent() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        return PendingIntent.getActivity(
            this, 0, launch,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private void rebuildNotification() {
        NotificationCompat.Action playPause;
        if (isPlaying) {
            playPause = new NotificationCompat.Action(
                android.R.drawable.ic_media_pause, "Pause",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PAUSE)
            );
        } else {
            playPause = new NotificationCompat.Action(
                android.R.drawable.ic_media_play, "Play",
                MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_PLAY)
            );
        }

        NotificationCompat.Action prev = new NotificationCompat.Action(
            android.R.drawable.ic_media_previous, "Previous",
            MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS)
        );
        NotificationCompat.Action next = new NotificationCompat.Action(
            android.R.drawable.ic_media_next, "Next",
            MediaButtonReceiver.buildMediaButtonPendingIntent(this, PlaybackStateCompat.ACTION_SKIP_TO_NEXT)
        );

        androidx.media.app.NotificationCompat.MediaStyle style =
            new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(session.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);

        lastNotification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(artist)
            .setSubText(album)
            .setLargeIcon(artworkBitmap)
            .setStyle(style)
            .setContentIntent(contentIntent())
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(prev)
            .addAction(playPause)
            .addAction(next)
            .build();

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, lastNotification);
        startForeground(NOTIF_ID, lastNotification);
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                CHANNEL_ID, "Media Playback", NotificationManager.IMPORTANCE_LOW
            );
            chan.setShowBadge(false);
            chan.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(chan);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("title")) {
            update(
                intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "",
                intent.getStringExtra("artist") != null ? intent.getStringExtra("artist") : "",
                intent.getStringExtra("album") != null ? intent.getStringExtra("album") : "",
                intent.getStringExtra("artworkUrl") != null ? intent.getStringExtra("artworkUrl") : "",
                intent.getBooleanExtra("isPlaying", false),
                intent.getDoubleExtra("position", 0.0),
                intent.getDoubleExtra("duration", 0.0)
            );
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        session.release();
        stopForeground(true);
        instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
