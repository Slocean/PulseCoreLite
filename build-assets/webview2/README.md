# WebView2 Offline Installer

Place the WebView2 offline installer binary in this directory before running:

```powershell
npm run pack:release
```

`pack:release` uses this file for:

- `*_setup-full.exe`
- `*_setup-full.msi`
- `*_portable-full.zip`

Expected file names (any one is enough):

- `install_webview2.exe` (recommended)
- `MicrosoftEdgeWebView2RuntimeInstallerX64.exe`

You can also set an explicit path at build time:

```powershell
$env:WEBVIEW2_OFFLINE_INSTALLER="D:\Downloads\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
npm run pack:release
```

Download source (Evergreen Standalone Installer):

- <https://developer.microsoft.com/microsoft-edge/webview2/>
