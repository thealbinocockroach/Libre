package com.libreaudio.app;

import android.content.Context;
import android.util.AttributeSet;
import android.view.ActionMode;
import com.getcapacitor.CapacitorWebView;

/**
 * A CapacitorWebView that allows native text-selection ActionMode.
 */
public class SelectionBlockingWebView extends CapacitorWebView {

    public SelectionBlockingWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    @SuppressWarnings("deprecation")
    public ActionMode startActionMode(ActionMode.Callback callback) {
        return super.startActionMode(callback);
    }

    @Override
    public ActionMode startActionMode(ActionMode.Callback callback, int type) {
        return super.startActionMode(callback, type);
    }
}
