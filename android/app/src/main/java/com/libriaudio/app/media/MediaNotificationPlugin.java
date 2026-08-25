package com.libriaudio.app.media;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MediaNotification")
public class MediaNotificationPlugin extends Plugin {

    static MediaNotificationPlugin instance;

    @Override
    public void load() {
        instance = this;
        MediaNotificationService.pluginRef = this;
    }

    public void emitEvent(String eventName, JSObject data) {
        notifyListeners(eventName, data);
    }

    @PluginMethod
    public void show(PluginCall call) {
        Intent intent = new Intent(getContext(), MediaNotificationService.class);
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkUrl = call.getString("artworkUrl", "");
        Boolean isPlaying = call.getBoolean("isPlaying", false);
        Double position = call.getDouble("position", 0.0);
        Double duration = call.getDouble("duration", 0.0);

        MediaNotificationService svc = MediaNotificationService.instance;
        if (svc != null) {
            svc.update(title, artist, album, artworkUrl,
                       isPlaying != null ? isPlaying : false,
                       position != null ? position : 0.0,
                       duration != null ? duration : 0.0);
        } else {
            Intent intent = new Intent(getContext(), MediaNotificationService.class);
            intent.putExtra("title", title);
            intent.putExtra("artist", artist);
            intent.putExtra("album", album);
            intent.putExtra("artworkUrl", artworkUrl);
            intent.putExtra("isPlaying", isPlaying != null ? isPlaying : false);
            intent.putExtra("position", position != null ? position : 0.0);
            intent.putExtra("duration", duration != null ? duration : 0.0);
            getContext().startForegroundService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void hide(PluginCall call) {
        if (MediaNotificationService.instance != null) {
            MediaNotificationService.instance.stopSelf();
        }
        call.resolve();
    }
}
