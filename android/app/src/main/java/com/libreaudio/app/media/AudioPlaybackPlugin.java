package com.libreaudio.app.media;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AudioPlayback")
public class AudioPlaybackPlugin extends Plugin {

    @Override
    public void load() {
        AudioPlaybackPlugin.instance = this;
        AudioPlaybackService.pluginRef = this;
    }

    static AudioPlaybackPlugin instance;

    public void emitEvent(String eventName, JSObject data) {
        notifyListeners(eventName, data);
    }

    @PluginMethod
    public void loadTrack(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }
        String title = call.getString("title", "");
        String artist = call.getString("artist", "");
        String album = call.getString("album", "");
        String artworkUrl = call.getString("artworkUrl", "");
        Double seekTo = call.getDouble("seekTo", 0.0);
        Boolean autoPlay = call.getBoolean("autoPlay", true);

        Intent intent = new Intent(getContext(), AudioPlaybackService.class);
        intent.putExtra("load", true);
        intent.putExtra("url", url);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("artworkUrl", artworkUrl);
        intent.putExtra("seekTo", seekTo != null ? seekTo : 0.0);
        intent.putExtra("autoPlay", autoPlay != null ? autoPlay : true);
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioPlaybackService.class);
        intent.putExtra("command", "play");
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioPlaybackService.class);
        intent.putExtra("command", "pause");
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Double position = call.getDouble("position", 0.0);
        Intent intent = new Intent(getContext(), AudioPlaybackService.class);
        intent.putExtra("command", "seek");
        intent.putExtra("position", position != null ? position : 0.0);
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        Double rate = call.getDouble("rate", 1.0);
        AudioPlaybackService svc = AudioPlaybackService.instance;
        if (svc != null && rate != null) {
            svc.setPlaybackRate(rate);
        }
        call.resolve();
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume", 1.0);
        AudioPlaybackService svc = AudioPlaybackService.instance;
        if (svc != null && volume != null) {
            svc.setVolume(volume);
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), AudioPlaybackService.class);
        intent.putExtra("command", "stop");
        getContext().startForegroundService(intent);
        call.resolve();
    }

    @PluginMethod
    public void getPosition(PluginCall call) {
        AudioPlaybackService svc = AudioPlaybackService.instance;
        JSObject result = new JSObject();
        result.put("position", svc != null ? svc.getPosition() : 0.0);
        result.put("duration", svc != null ? svc.getDuration() : 0.0);
        result.put("isPlaying", svc != null && svc.isPlaying());
        call.resolve(result);
    }
}
