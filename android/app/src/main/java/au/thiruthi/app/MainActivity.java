package au.thiruthi.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.os.Build;
import android.os.Environment;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import android.graphics.Bitmap;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Tamil Thiruthi Android app.
 * Opens your live website (THIRUTHI_APP_URL), or else the bundled copy (assets/www) served at
 * https://appassets.androidplatform.net/ (Android's reserved host for local app files),
 * and connects the page's photo buttons to the camera and the photo gallery.
 */
public class MainActivity extends Activity {

    private static final String LOCAL_HOST = "appassets.androidplatform.net";

    /** Host the app treats as its own: your website's, or the bundled copy's. */
    private String appHost = LOCAL_HOST;
    private boolean useLocalFiles = true;
    private static final int REQ_PICK = 1;
    private static final int REQ_CAMERA = 2;

    private WebView webView;
    /** Host of the page currently shown; the native bridge only answers our own pages. */
    private volatile String pageHost = "";
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xFF0B3536);

        String startUrl = "https://" + LOCAL_HOST + "/index.html";
        String siteUrl = getString(R.string.app_url).trim();
        if (siteUrl.startsWith("https://")) {
            Uri site = Uri.parse(siteUrl);
            if (site.getHost() != null) {
                appHost = site.getHost();
                useLocalFiles = false;
                startUrl = siteUrl;
            }
        }

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setUserAgentString(s.getUserAgentString() + " ThiruthiApp/1.0");

        webView.setWebViewClient(new LocalFilesClient());
        webView.addJavascriptInterface(new NativeBridge(), "ThiruthiNative");
        webView.setWebChromeClient(new PhotoChromeClient());
        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(startUrl);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    /** Serves the bundled website files; everything else (Supabase) goes to the internet. */
    private class LocalFilesClient extends WebViewClient {
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            Uri u = Uri.parse(url);
            pageHost = u.getHost() == null ? "" : u.getHost();
            super.onPageStarted(view, url, favicon);
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (!useLocalFiles || !LOCAL_HOST.equals(url.getHost())) return null;
            String path = url.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
            InputStream in = openAsset("www" + path);
            if (in == null) {
                // Single-page app: unknown paths show the app itself.
                path = "/index.html";
                in = openAsset("www/index.html");
                if (in == null) return null;
            }
            return new WebResourceResponse(mimeFor(path), "utf-8", in);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (appHost.equals(url.getHost())) return false;
            // Links to other sites (e.g. photo links, email links) open outside the app.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException e) {
                // nothing can open it; stay in the app
            }
            return true;
        }
    }

    private InputStream openAsset(String name) {
        try {
            return getAssets().open(name);
        } catch (IOException e) {
            return null;
        }
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js") || p.endsWith(".mjs")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    /** Connects <input type="file"> in the page to the camera or the gallery. */
    private class PhotoChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (filePathCallback != null) filePathCallback.onReceiveValue(null);
            filePathCallback = callback;
            if (params.isCaptureEnabled() && openCamera()) return true;
            if (openGallery(params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE)) return true;
            filePathCallback.onReceiveValue(null);
            filePathCallback = null;
            return true;
        }
    }

    /** Takes a full-size photo and saves it to the phone's gallery (Pictures). */
    private boolean openCamera() {
        try {
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            values.put(MediaStore.Images.Media.DISPLAY_NAME, "thiruthi_" + System.currentTimeMillis() + ".jpg");
            cameraUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (cameraUri == null) return false;
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(intent, REQ_CAMERA);
            return true;
        } catch (Exception e) {
            // No camera app, or no permission to save on Android 9 and older: use the gallery instead.
            cameraUri = null;
            return false;
        }
    }

    private boolean openGallery(boolean multiple) {
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        if (multiple) intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(Intent.createChooser(intent, "Choose photos"), REQ_PICK);
            return true;
        } catch (ActivityNotFoundException e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (filePathCallback == null) return;
        ValueCallback<Uri[]> cb = filePathCallback;
        filePathCallback = null;
        Uri[] result = null;

        if (requestCode == REQ_CAMERA) {
            if (resultCode == RESULT_OK && cameraUri != null) {
                result = new Uri[]{cameraUri};
            } else if (cameraUri != null) {
                try { getContentResolver().delete(cameraUri, null, null); } catch (Exception ignored) { }
            }
            cameraUri = null;
        } else if (requestCode == REQ_PICK && resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null && clip.getItemCount() > 0) {
                result = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) result[i] = clip.getItemAt(i).getUri();
            } else if (data.getData() != null) {
                result = new Uri[]{data.getData()};
            }
        }
        cb.onReceiveValue(result);
    }

    /**
     * Called from the website (window.ThiruthiNative): Android web views cannot share or
     * download files, so the app does it. Only pages from the app's own host may use it.
     */
    private class NativeBridge {
        private static final int MAX_BYTES = 30 * 1024 * 1024;

        private byte[] decode(String base64) {
            if (!appHost.equals(pageHost) || base64 == null || base64.length() > MAX_BYTES * 4 / 3 + 8) return null;
            try { return Base64.decode(base64, Base64.DEFAULT); } catch (IllegalArgumentException e) { return null; }
        }

        private String safeName(String name) {
            String n = name == null ? "" : name.replaceAll("[^\\p{L}\\p{N} ._-]", "").trim();
            if (n.isEmpty()) n = "report";
            if (!n.toLowerCase().endsWith(".pdf")) n += ".pdf";
            return n.length() > 80 ? n.substring(n.length() - 80) : n;
        }

        /** Opens the share sheet (or WhatsApp directly when target is "whatsapp") with the PDF attached. */
        @JavascriptInterface
        public String sharePdf(String base64, String name, String target) {
            byte[] bytes = decode(base64);
            if (bytes == null) return "denied";
            try {
                File dir = PdfProvider.sharedDir(MainActivity.this);
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) if (System.currentTimeMillis() - f.lastModified() > 3600_000L) f.delete();
                File file = new File(dir, safeName(name));
                try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
                Uri uri = Uri.parse("content://" + getPackageName() + ".pdf/" + Uri.encode(file.getName()));
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("application/pdf");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.putExtra(Intent.EXTRA_TITLE, file.getName());
                send.setClipData(ClipData.newRawUri(file.getName(), uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final boolean toWhatsApp = "whatsapp".equals(target);
                runOnUiThread(() -> {
                    if (toWhatsApp) {
                        for (String pkg : new String[]{"com.whatsapp", "com.whatsapp.w4b"}) {
                            try {
                                startActivity(new Intent(send).setPackage(pkg));
                                return;
                            } catch (ActivityNotFoundException ignored) { }
                        }
                        Toast.makeText(MainActivity.this, "WhatsApp is not installed", Toast.LENGTH_SHORT).show();
                    }
                    startActivity(Intent.createChooser(send, "Share PDF"));
                });
                return "ok";
            } catch (IOException e) {
                return "error";
            }
        }

        /** Saves the PDF to Downloads (Android 10+); on older phones opens the share sheet instead. */
        @JavascriptInterface
        public String savePdf(String base64, String name) {
            byte[] bytes = decode(base64);
            if (bytes == null) return "denied";
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return sharePdf(base64, name, "").equals("ok") ? "shared" : "error";
            try {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, safeName(name));
                v.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) return "error";
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out == null) return "error";
                    out.write(bytes);
                }
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Downloads", Toast.LENGTH_SHORT).show());
                return "ok";
            } catch (Exception e) {
                return "error";
            }
        }
    }
}
