package com.libreaudio.app;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "FileBackup")
public class FileBackupPlugin extends Plugin {

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");
        String mimeType = call.getString("mimeType", "application/json");

        if (filename == null || content == null) {
            call.reject("filename and content are required");
            return;
        }

        Context ctx = getContext();

        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, filename);
            values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

            Uri resolver = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri uri = ctx.getContentResolver().insert(resolver, values);

            if (uri == null) {
                call.reject("Failed to create file in Downloads");
                return;
            }

            OutputStream os = ctx.getContentResolver().openOutputStream(uri);
            if (os == null) {
                call.reject("Failed to open output stream");
                return;
            }
            os.write(content.getBytes("UTF-8"));
            os.flush();
            os.close();

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to write file: " + e.getMessage());
        }
    }
}
