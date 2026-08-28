package com.libriaudio.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.libriaudio.app.media.MediaNotificationPlugin;
import com.libriaudio.app.media.AudioPlaybackPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaNotificationPlugin.class);
        registerPlugin(AudioPlaybackPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
