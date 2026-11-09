package com.metroassist.divyangjan;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends Activity {

    private static final String PREFS = "metro_assist";
    private static final String PREF_SERVER = "server_url";
    private static final String DEFAULT_SERVER = "http://192.168.29.79:3000";
    private static final int REQUEST_FILE = 1001;

    private WebView webView;
    private ProgressBar progress;
    private LinearLayout errorView;
    private TextView errorDetail;
    private ValueCallback<Uri[]> fileCallback;
    private String bridgeScript;
    private long lastBackPress;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridgeScript = readRawResource(R.raw.download_bridge);
        buildUi();
        configureWebView();

        if (!prefs().contains(PREF_SERVER)) {
            showServerDialog(true);
        } else {
            loadServer(serverUrl());
        }
    }

    /* ----------------------------------- UI ---------------------------------- */

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.WHITE);

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgress(0);
        progress.setIndeterminate(false);
        progress.setProgressTintList(ColorStateList.valueOf(0xFFF4C430));
        progress.setVisibility(View.GONE);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, dp(3));
        progressParams.gravity = Gravity.TOP;
        root.addView(progress, progressParams);

        errorView = new LinearLayout(this);
        errorView.setOrientation(LinearLayout.VERTICAL);
        errorView.setGravity(Gravity.CENTER);
        errorView.setBackgroundColor(0xFFF4F6FA);
        errorView.setPadding(dp(28), dp(28), dp(28), dp(28));
        errorView.setClickable(true);
        errorView.setVisibility(View.GONE);

        TextView title = new TextView(this);
        title.setText("Server unreachable");
        title.setTextSize(22);
        title.setTextColor(0xFF0B2A4A);
        title.setGravity(Gravity.CENTER);
        errorView.addView(title);

        errorDetail = new TextView(this);
        errorDetail.setTextSize(14);
        errorDetail.setTextColor(0xFF475569);
        errorDetail.setGravity(Gravity.CENTER);
        errorDetail.setLineSpacing(dp(3), 1f);
        LinearLayout.LayoutParams detailParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        detailParams.topMargin = dp(14);
        errorView.addView(errorDetail, detailParams);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setOnClickListener(v -> loadServer(serverUrl()));
        LinearLayout.LayoutParams retryParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        retryParams.topMargin = dp(24);
        errorView.addView(retry, retryParams);

        Button change = new Button(this);
        change.setText("Change server");
        change.setOnClickListener(v -> showServerDialog(false));
        LinearLayout.LayoutParams changeParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        changeParams.topMargin = dp(8);
        errorView.addView(change, changeParams);

        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);

        if (getActionBar() != null) {
            getActionBar().setTitle("METRO ASSIST");
            getActionBar().setSubtitle("Pink Line station coordination");
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        settings.setUserAgentString(settings.getUserAgentString() + " METROAssistApp/1.0");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AndroidBridge(), "MetroAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if (scheme.equals("http") || scheme.equals("https")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception error) {
                    toast("No app available to open this link.");
                }
                return true;
            }

            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                progress.setVisibility(View.VISIBLE);
                progress.setProgress(5);
                hideError();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progress.setVisibility(View.GONE);
                if (bridgeScript != null) {
                    view.evaluateJavascript(bridgeScript, null);
                }
                if (getActionBar() != null) {
                    String host = Uri.parse(url).getHost();
                    getActionBar().setSubtitle(host == null ? "Pink Line station coordination" : host);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    showError(serverUrl(), String.valueOf(error.getDescription()));
                }
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler,
                                           SslError error) {
                handler.cancel();
                showError(serverUrl(),
                        "TLS certificate error. Use a trusted certificate or the local HTTP address.");
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress >= 100) {
                    progress.setVisibility(View.GONE);
                } else {
                    progress.setVisibility(View.VISIBLE);
                    progress.setProgress(newProgress);
                }
            }

            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String type = "*/*";
                String[] accepted = params.getAcceptTypes();
                if (accepted != null) {
                    for (String candidate : accepted) {
                        if (candidate != null && !candidate.isEmpty()) {
                            type = candidate.indexOf('/') >= 0 ? candidate : "*/*";
                            break;
                        }
                    }
                }
                intent.setType(type);
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(
                            Intent.createChooser(intent, "Select file"), REQUEST_FILE);
                    return true;
                } catch (Exception error) {
                    fileCallback = null;
                    toast("No file picker available.");
                    return false;
                }
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String disposition,
                                        String mimeType, long contentLength) {
                if (url == null || url.startsWith("blob:") || url.startsWith("data:")) {
                    return;
                }
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    String cookie = CookieManager.getInstance().getCookie(url);
                    if (cookie != null) {
                        request.addRequestHeader("Cookie", cookie);
                    }
                    if (userAgent != null) {
                        request.addRequestHeader("User-Agent", userAgent);
                    }
                    String fileName = URLUtil.guessFileName(url, disposition, mimeType);
                    request.setMimeType(mimeType);
                    request.setTitle(fileName);
                    request.setDescription("METRO ASSIST download");
                    request.setNotificationVisibility(
                            DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                    boolean publicDownloads = Build.VERSION.SDK_INT >= 29
                            || checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                            == PackageManager.PERMISSION_GRANTED;
                    if (publicDownloads) {
                        request.setDestinationInExternalPublicDir(
                                Environment.DIRECTORY_DOWNLOADS, fileName);
                    } else {
                        request.setDestinationInExternalFilesDir(MainActivity.this,
                                Environment.DIRECTORY_DOWNLOADS, fileName);
                    }

                    DownloadManager manager =
                            (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    manager.enqueue(request);
                    toast(publicDownloads
                            ? "Downloading " + fileName + " to Downloads."
                            : "Downloading " + fileName + " to the app Downloads folder.");
                } catch (Exception error) {
                    toast("Download failed: " + error.getMessage());
                }
            }
        });
    }

    /* ------------------------------ server config ----------------------------- */

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    private String serverUrl() {
        return prefs().getString(PREF_SERVER, DEFAULT_SERVER);
    }

    private void loadServer(String url) {
        hideError();
        webView.loadUrl(url);
    }

    private void showServerDialog(boolean firstRun) {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setText(serverUrl());
        input.setSelection(input.getText().length());

        FrameLayout wrapper = new FrameLayout(this);
        wrapper.setPadding(dp(20), dp(4), dp(20), 0);
        wrapper.addView(input, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle(firstRun ? "Connect to METRO ASSIST" : "Server address")
                .setMessage("Enter the address of the computer running the METRO ASSIST server. "
                        + "The phone must be on the same Wi-Fi network.\n\nExample: " + DEFAULT_SERVER)
                .setView(wrapper)
                .setPositiveButton("Connect", null)
                .setNegativeButton(firstRun ? "Exit" : "Cancel", null)
                .create();

        dialog.setCancelable(!firstRun);
        dialog.setOnShowListener(ignored -> {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v -> {
                String url = normalizeServer(input.getText().toString());
                if (url == null) {
                    input.setError("Enter a valid address, for example " + DEFAULT_SERVER);
                    return;
                }
                prefs().edit().putString(PREF_SERVER, url).apply();
                dialog.dismiss();
                loadServer(url);
            });
            if (firstRun) {
                dialog.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener(v -> finish());
            }
        });
        dialog.setOnDismissListener(ignored -> {
            if (firstRun && !prefs().contains(PREF_SERVER)) {
                finish();
            }
        });
        dialog.show();
        if (dialog.getWindow() != null) {
            dialog.getWindow().setSoftInputMode(
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE);
        }
        input.requestFocus();
    }

    private String normalizeServer(String value) {
        String raw = value == null ? "" : value.trim();
        if (raw.isEmpty()) {
            return null;
        }
        if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            raw = "http://" + raw;
        }
        while (raw.endsWith("/")) {
            raw = raw.substring(0, raw.length() - 1);
        }
        Uri uri = Uri.parse(raw);
        if (uri.getHost() == null || uri.getHost().isEmpty()) {
            return null;
        }
        return raw;
    }

    /* -------------------------------- downloads ------------------------------- */

    private class AndroidBridge {
        @JavascriptInterface
        public void saveBase64(String fileName, String mimeType, String base64) {
            try {
                String name = sanitize(fileName);
                String mime = mimeType == null || mimeType.isEmpty()
                        ? "application/octet-stream" : mimeType;
                byte[] data = Base64.decode(base64, Base64.DEFAULT);
                if (data == null || data.length == 0) {
                    throw new IOException("The exported file was empty.");
                }
                String location = writeFile(name, mime, data);
                toastOnUi("Saved " + name + " to " + location);
            } catch (Exception error) {
                toastOnUi("Could not save the exported file: " + error.getMessage());
            }
        }
    }

    private String writeFile(String name, String mimeType, byte[] data) throws IOException {
        if (Build.VERSION.SDK_INT >= 29) {
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH,
                    Environment.DIRECTORY_DOWNLOADS + "/METRO-ASSIST");
            Uri item = getContentResolver().insert(
                    MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (item == null) {
                throw new IOException("Could not create the download entry.");
            }
            try (OutputStream stream = getContentResolver().openOutputStream(item)) {
                if (stream == null) {
                    throw new IOException("Could not open the download file.");
                }
                stream.write(data);
            }
            return "Downloads/METRO-ASSIST";
        }

        boolean shared = checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED;
        File directory = shared
                ? new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), "METRO-ASSIST")
                : new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "METRO-ASSIST");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IOException("Could not create the download folder.");
        }
        File file = new File(directory, name);
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(data);
        }
        if (shared) {
            MediaScannerConnection.scanFile(this,
                    new String[]{file.getAbsolutePath()}, new String[]{mimeType}, null);
            return "Downloads/METRO-ASSIST";
        }
        return file.getParent();
    }

    private String sanitize(String fileName) {
        String name = fileName == null || fileName.trim().isEmpty()
                ? "metro-assist-export" : fileName.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
        return name.replaceAll("^\\.+", "_");
    }

    /* -------------------------------- helpers -------------------------------- */

    private void showError(String url, String description) {
        progress.setVisibility(View.GONE);
        errorDetail.setText("Could not reach " + url + "\n\n" + description
                + "\n\nStart the METRO ASSIST server and make sure this phone is on the same Wi-Fi network as the server.");
        errorView.setVisibility(View.VISIBLE);
    }

    private void hideError() {
        if (errorView != null) {
            errorView.setVisibility(View.GONE);
        }
    }

    private String readRawResource(int resource) {
        try (InputStream stream = getResources().openRawResource(resource)) {
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            byte[] chunk = new byte[4096];
            int read;
            while ((read = stream.read(chunk)) != -1) {
                buffer.write(chunk, 0, read);
            }
            return buffer.toString("UTF-8");
        } catch (IOException error) {
            return null;
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private void toastOnUi(String message) {
        runOnUiThread(() -> toast(message));
    }

    /* ------------------------------ lifecycle -------------------------------- */

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != REQUEST_FILE) {
            super.onActivityResult(requestCode, resultCode, data);
            return;
        }
        if (fileCallback == null) {
            return;
        }
        List<Uri> results = new ArrayList<>();
        if (resultCode == RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                for (int index = 0; index < count; index++) {
                    Uri uri = data.getClipData().getItemAt(index).getUri();
                    if (uri != null) {
                        results.add(uri);
                    }
                }
            } else if (data.getData() != null) {
                results.add(data.getData());
            }
        }
        fileCallback.onReceiveValue(results.isEmpty() ? null : results.toArray(new Uri[0]));
        fileCallback = null;
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        menu.add(Menu.NONE, 1, 1, "Change server");
        menu.add(Menu.NONE, 2, 2, "Reload");
        menu.add(Menu.NONE, 3, 3, "Open in browser");
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == 1) {
            showServerDialog(false);
            return true;
        }
        if (item.getItemId() == 2) {
            if (webView.getUrl() == null) {
                loadServer(serverUrl());
            } else {
                webView.reload();
            }
            return true;
        }
        if (item.getItemId() == 3) {
            String url = webView.getUrl() == null ? serverUrl() : webView.getUrl();
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
            } catch (Exception error) {
                toast("No browser available.");
            }
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastBackPress < 2000) {
            super.onBackPressed();
        } else {
            lastBackPress = now;
            toast("Press back again to exit.");
        }
    }

    @Override
    protected void onPause() {
        CookieManager.getInstance().flush();
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
