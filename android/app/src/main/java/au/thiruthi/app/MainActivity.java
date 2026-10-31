package au.thiruthi.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
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

import java.io.IOException;
import java.io.InputStream;

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
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(0xFF0E5E63);

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
}
