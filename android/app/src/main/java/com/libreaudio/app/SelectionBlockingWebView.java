package com.libreaudio.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import com.getcapacitor.CapacitorWebView;

/**
 * A CapacitorWebView that suppresses Android's native text-selection ActionMode
 * (the system Copy / Share toolbar). The WebView's native selection highlight
 * and drag handles are kept; only the floating toolbar is blocked so the host
 * can draw its own custom selection menu.
 */
public class SelectionBlockingWebView extends CapacitorWebView {

    public SelectionBlockingWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    @SuppressWarnings("deprecation")
    public ActionMode startActionMode(ActionMode.Callback callback) {
        return null;
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return null;
    }
}
