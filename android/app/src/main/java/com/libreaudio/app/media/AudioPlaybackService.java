package com.libreaudio.app.media;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.media.audiofx.Equalizer;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.media.session.MediaButtonReceiver;

import com.getcapacitor.JSObject;

import java.net.URL;

@UnstableApi
public class AudioPlaybackService extends Service {

    static AudioPlaybackPlugin pluginRef;
    static AudioPlaybackService instance;
    static final String CHANNEL_ID = "libreaudio_playback_channel";
    static final int NOTIF_ID = 4242;

    private ExoPlayer exoPlayer;
    private MediaSessionCompat mediaSession;
    private Bitmap artworkBitmap;
    private String currentArtworkUrl;

    private Equalizer equalizer;
    private String currentPreset = "off";
    private int audioSessionId = 0;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final Object playerLock = new Object();

    private String trackTitle = "";
    private String trackArtist = "";
    private String trackAlbum = "";
    private String artworkUrl = "";

    private void runOnMain(Runnable r) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            r.run();
        } else {
            mainHandler.post(r);
        }
    }

    private <T> T syncOnMain(final SyncTask<T> task, final T fallback) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            return task.run();
        }
        final java.util.concurrent.atomic.AtomicReference<T> result =
            new java.util.concurrent.atomic.AtomicReference<>(fallback);
        final java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
        mainHandler.post(() -> {
            try {
                result.set(task.run());
            } finally {
                latch.countDown();
            }
        });
        try {
            latch.await(500, java.util.concurrent.TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return result.get();
    }

    private interface SyncTask<T> {
        T run();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        allocateAudioSession();
        initExoPlayer();
        initMediaSession();
    }

    private void allocateAudioSession() {
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
            audioSessionId = am.generateAudioSessionId();
        }
        if (audioSessionId <= 0) {
            audioSessionId = 1;
        }
    }

    private void initExoPlayer() {
        exoPlayer = new ExoPlayer.Builder(this).build();
        exoPlayer.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                if (isPlaying) {
                    ensureAudioEffects();
                }
                emitState();
                updatePlaybackState();
                updateNotification();
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) {
                    emit("ended");
                } else if (state == Player.STATE_READY) {
                    ensureAudioEffects();
                    emit("ready");
                } else if (state == Player.STATE_BUFFERING) {
                    emit("buffering");
                }
            }

            @Override
            public void onPlaybackParametersChanged(PlaybackParameters params) {
                emitSpeed();
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                JSObject data = new JSObject();
                data.put("action", "error");
                data.put("message", error.getMessage() != null ? error.getMessage() : "Playback error");
                emitEvent(data);
            }
        });
    }

    private synchronized void ensureAudioEffects() {
        if (exoPlayer == null) return;
        try {
            int realSessionId = 0;
            try {
                realSessionId = exoPlayer.getAudioSessionId();
            } catch (Exception ignored) {}
            if (realSessionId <= 0) {
                realSessionId = audioSessionId;
            }
            if (realSessionId <= 0) return;

            if (equalizer == null || this.audioSessionId != realSessionId) {
                if (equalizer != null) {
                    try {
                        equalizer.release();
                    } catch (Exception ignored) {}
                    equalizer = null;
                }
                this.audioSessionId = realSessionId;
                equalizer = new Equalizer(0, realSessionId);
                Log.d("LibreAudioEQ", "Equalizer bound to audioSessionId=" + realSessionId + " bands=" + equalizer.getNumberOfBands());
            }
            applyPreset(currentPreset);
        } catch (Exception e) {
            Log.e("LibreAudioEQ", "ensure failed", e);
        }
    }

    public void setEqualizer(String preset) {
        if (preset == null) preset = "off";
        currentPreset = preset;
        runOnMain(() -> {
            ensureAudioEffects();
            applyPreset(currentPreset);
        });
    }

    private void applyPreset(String preset) {
        Log.d("LibreAudioEQ", "applyPreset -> " + preset + " eq=" + (equalizer != null));
        if (equalizer == null) return;
        try {
            if ("off".equals(preset)) {
                equalizer.setEnabled(false);
                return;
            }
            if (!equalizer.getEnabled()) {
                equalizer.setEnabled(true);
            }
            short[] bandRange = equalizer.getBandLevelRange();
            int minDb = bandRange[0];
            int maxDb = bandRange[1];
            int numBands = equalizer.getNumberOfBands();
            for (int i = 0; i < numBands; i++) {
                double freqHz = equalizer.getCenterFreq((short) i) / 1000.0;
                int gainMillibel = computeBandGain(preset, freqHz) * 100;
                gainMillibel = Math.max(minDb, Math.min(maxDb, gainMillibel));
                equalizer.setBandLevel((short) i, (short) gainMillibel);
            }
        } catch (Exception e) {
            Log.e("LibreAudioEQ", "applyPreset failed", e);
        }
    }

    private int computeBandGain(String preset, double fHz) {
        switch (preset) {
            case "voice_boost": {
                // Speech presence boost (1kHz - 3.5kHz) and roll off muddy sub-bass rumble
                if (fHz < 250) return -4;
                if (fHz >= 1000 && fHz <= 3500) return 7;
                if (fHz > 3500 && fHz <= 6000) return 4;
                return 0;
            }
            case "clarity":
                // Bright high-shelf
                if (fHz < 200) return -2;
                if (fHz >= 3500) return 7;
                if (fHz >= 1800) return 4;
                return 0;
            case "bass_warmth":
                // Rich warm narration low-shelf
                if (fHz <= 250) return 8;
                if (fHz <= 500) return 4;
                if (fHz >= 3500) return -3;
                return 0;
            case "treble_bright":
                if (fHz >= 5000) return 8;
                if (fHz >= 2500) return 5;
                if (fHz <= 300) return -2;
                return 0;
            case "noise_reduce":
                // De-hiss: steep roll-off above 4kHz
                if (fHz >= 5000) return -12;
                if (fHz >= 3000) return -7;
                if (fHz >= 1500) return -3;
                return 0;
            default:
                return 0;
        }
    }

    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "LibreAudioPlayback");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() {
                if (exoPlayer != null) exoPlayer.setPlayWhenReady(true);
                emit("play");
            }
            @Override public void onPause() {
                if (exoPlayer != null) exoPlayer.setPlayWhenReady(false);
                emit("pause");
            }
            @Override public void onSkipToNext() { emit("next"); }
            @Override public void onSkipToPrevious() { emit("previous"); }
            @Override public void onSeekTo(long pos) {
                if (exoPlayer != null) exoPlayer.seekTo(pos);
            }
            @Override public void onStop() {
                if (exoPlayer != null) exoPlayer.stop();
                emit("stop");
            }
        });
        mediaSession.setActive(true);
    }

    public void load(String url, String title, String artist, String album, String artUrl,
                     double seekTo, boolean autoPlay) {
        this.trackTitle = title;
        this.trackArtist = artist;
        this.trackAlbum = album;
        this.artworkUrl = artUrl;

        MediaItem mediaItem = MediaItem.fromUri(Uri.parse(url));
        if (audioSessionId > 0 && exoPlayer.getAudioSessionId() != audioSessionId) {
            try {
                exoPlayer.setAudioSessionId(audioSessionId);
            } catch (Exception ignored) {}
        }
        exoPlayer.setMediaItem(mediaItem);
        exoPlayer.prepare();

        if (seekTo > 0) {
            exoPlayer.seekTo((long) (seekTo * 1000));
        }

        updateMediaMetadata();

        if (artUrl != null && !artUrl.isEmpty()) {
            loadArtwork(artUrl);
        }

        if (autoPlay) {
            exoPlayer.setPlayWhenReady(true);
        }

        startForeground(NOTIF_ID, buildNotification());
    }

    public void play() {
        runOnMain(() -> {
            if (exoPlayer != null) {
                exoPlayer.setPlayWhenReady(true);
            }
            updatePlaybackState();
            updateNotification();
        });
    }

    public void pause() {
        runOnMain(() -> {
            if (exoPlayer != null) {
                exoPlayer.setPlayWhenReady(false);
            }
            updatePlaybackState();
            updateNotification();
        });
    }

    public void seekTo(double positionSeconds) {
        runOnMain(() -> {
            if (exoPlayer != null) {
                exoPlayer.seekTo((long) (positionSeconds * 1000));
            }
        });
    }

    public void setPlaybackRate(double rate) {
        runOnMain(() -> {
            if (exoPlayer != null) {
                exoPlayer.setPlaybackParameters(new PlaybackParameters((float) rate));
            }
        });
    }

    public void setVolume(double volume) {
        runOnMain(() -> {
            if (exoPlayer != null) {
                exoPlayer.setVolume((float) Math.max(0, Math.min(1, volume)));
            }
        });
    }

    public void stop() {
        runOnMain(() -> {
            if (exoPlayer != null) {
                exoPlayer.stop();
            }
        });
        stopForeground(true);
        stopSelf();
    }

    public double getPosition() {
        return syncOnMain(() -> {
            if (exoPlayer != null) {
                return exoPlayer.getCurrentPosition() / 1000.0;
            }
            return 0.0;
        }, 0.0);
    }

    public double getDuration() {
        return syncOnMain(() -> {
            if (exoPlayer != null) {
                long dur = exoPlayer.getDuration();
                return dur > 0 ? dur / 1000.0 : 0.0;
            }
            return 0.0;
        }, 0.0);
    }

    public boolean isPlaying() {
        return syncOnMain(() -> exoPlayer != null && exoPlayer.isPlaying(), false);
    }

    private void updateMediaMetadata() {
        if (mediaSession == null) return;
        android.support.v4.media.MediaMetadataCompat.Builder meta =
            new android.support.v4.media.MediaMetadataCompat.Builder()
                .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_TITLE, trackTitle)
                .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ARTIST, trackArtist)
                .putString(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ALBUM, trackAlbum);
        if (artworkBitmap != null) {
            meta.putBitmap(android.support.v4.media.MediaMetadataCompat.METADATA_KEY_ART, artworkBitmap);
        }
        mediaSession.setMetadata(meta.build());
    }

    private void updatePlaybackState() {
        if (mediaSession == null || exoPlayer == null) return;
        int state = exoPlayer.isPlaying() ?
            PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        long pos = exoPlayer.getCurrentPosition();
        float speed = exoPlayer.getPlaybackParameters().speed;

        PlaybackStateCompat.Builder builder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_STOP
            )
            .setState(state, pos, speed);
        mediaSession.setPlaybackState(builder.build());
    }

    private void loadArtwork(String url) {
        new Thread(() -> {
            try {
                Bitmap bmp = BitmapFactory.decodeStream(new URL(url).openStream());
                artworkBitmap = bmp;
                runOnMain(() -> {
                    updateMediaMetadata();
                    updateNotification();
                });
            } catch (Exception ignored) {}
        }).start();
    }

    private Notification buildNotification() {
        NotificationCompat.Action playPause;
        boolean playing = exoPlayer != null && exoPlayer.isPlaying();
        if (playing) {
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

        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pending = PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        long pos = exoPlayer != null ? exoPlayer.getCurrentPosition() : 0;
        long dur = exoPlayer != null ? exoPlayer.getDuration() : 0;

        androidx.media.app.NotificationCompat.MediaStyle style =
            new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(getApplicationInfo().icon)
            .setContentTitle(trackTitle)
            .setContentText(trackArtist)
            .setSubText(trackAlbum)
            .setLargeIcon(artworkBitmap)
            .setStyle(style)
            .setContentIntent(pending)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(playing)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setProgress((int) dur, (int) pos, dur <= 0)
            .addAction(prev)
            .addAction(playPause)
            .addAction(next)
            .build();
    }

    private void updateNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIF_ID, buildNotification());
    }
    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel chan = new NotificationChannel(
                CHANNEL_ID, "Audio Playback", NotificationManager.IMPORTANCE_LOW);
            chan.setShowBadge(false);
            chan.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(chan);
        }
    }

    private void emit(String action) {
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("position", getPosition());
        data.put("duration", getDuration());
        data.put("isPlaying", isPlaying());
        emitEvent(data);
    }

    private void emitState() {
        JSObject data = new JSObject();
        data.put("action", "stateChanged");
        data.put("position", getPosition());
        data.put("duration", getDuration());
        data.put("isPlaying", isPlaying());
        emitEvent(data);
    }

    private void emitSpeed() {
        JSObject data = new JSObject();
        data.put("action", "speedChanged");
        data.put("speed", exoPlayer != null ? exoPlayer.getPlaybackParameters().speed : 1.0);
        emitEvent(data);
    }

    private void emitEvent(JSObject data) {
        if (pluginRef != null) {
            pluginRef.emitEvent("audioPlaybackEvent", data);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // A service started via startForegroundService() MUST call startForeground()
        // promptly on every invocation, otherwise Android throws
        // ForegroundServiceDidNotStartInTimeException and crashes the app.
        startForeground(NOTIF_ID, buildNotification());

        if (intent != null) {
            if (intent.getBooleanExtra("load", false)) {
                load(
                    intent.getStringExtra("url") != null ? intent.getStringExtra("url") : "",
                    intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "",
                    intent.getStringExtra("artist") != null ? intent.getStringExtra("artist") : "",
                    intent.getStringExtra("album") != null ? intent.getStringExtra("album") : "",
                    intent.getStringExtra("artworkUrl") != null ? intent.getStringExtra("artworkUrl") : "",
                    intent.getDoubleExtra("seekTo", 0.0),
                    intent.getBooleanExtra("autoPlay", true)
                );
            } else if (intent.hasExtra("command")) {
                String cmd = intent.getStringExtra("command");
                if ("play".equals(cmd)) play();
                else if ("pause".equals(cmd)) pause();
                else if ("stop".equals(cmd)) stop();
                else if ("seek".equals(cmd)) seekTo(intent.getDoubleExtra("position", 0));
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (equalizer != null) {
            try {
                equalizer.release();
            } catch (Exception ignored) {}
            equalizer = null;
        }
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        instance = null;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
