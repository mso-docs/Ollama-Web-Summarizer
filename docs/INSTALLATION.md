# Installation guide

Ollama Web Summarizer talks only to a local Ollama server. You need Ollama running, at least one model, and CORS configured so the extension is allowed to call it.

This is not an official Ollama product, and it is not affiliated with Ollama Inc.

## 1. Install Ollama and a model

Download Ollama from [https://ollama.com](https://ollama.com), then pull a model:

```bash
ollama pull llama3.2
```

## 2. Allow the extension to call Ollama

Ollama rejects browser requests unless `OLLAMA_ORIGINS` includes the extension’s origin. After you load or install the extension, open `chrome://extensions`, find **Ollama Web Summarizer**, and copy its ID.

Set the variable to that exact origin, then fully restart Ollama:

```bash
export OLLAMA_ORIGINS="chrome-extension://YOUR_EXTENSION_ID"
```

For unpacked testing, `chrome-extension://*` is acceptable. If you also load the extension in Firefox, you can add `moz-extension://*`.

Do not set `OLLAMA_ORIGINS` to `*`. That lets any website in your browser call the Ollama API on this computer.

The helper scripts `scripts/start-ollama.sh` and `scripts/start-ollama.bat` start `ollama serve` with `chrome-extension://*,moz-extension://*` unless you have already set `OLLAMA_ORIGINS`.

### macOS, including the Ollama app

The menu-bar Ollama app does not read `~/.bashrc` or `~/.zshrc`. Setting the variable in your shell will not affect the app until you also set it in the environment the app uses.

For the current login session:

```bash
launchctl setenv OLLAMA_ORIGINS "chrome-extension://YOUR_EXTENSION_ID"
```

Then quit Ollama completely from the menu bar and open it again. `ollama serve` started in a terminal will still need the variable in that terminal, or you can use `scripts/start-ollama.sh`.

`launchctl setenv` does not always survive a reboot. To make it persistent, save a Launch Agent such as `~/Library/LaunchAgents/com.mackenzie.ollama-origins.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.mackenzie.ollama-origins</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/launchctl</string>
      <string>setenv</string>
      <string>OLLAMA_ORIGINS</string>
      <string>chrome-extension://YOUR_EXTENSION_ID</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
  </dict>
</plist>
```

Then run:

```bash
launchctl load ~/Library/LaunchAgents/com.mackenzie.ollama-origins.plist
```

Quit and reopen the Ollama app after the agent has loaded.

### Windows

In PowerShell (you do not need an Administrator session for a user-level variable):

```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', 'chrome-extension://YOUR_EXTENSION_ID', 'User')
```

Quit the Ollama tray app completely and start it again, or run `scripts\start-ollama.bat`.

### Linux

If you start Ollama in a terminal, export the variable in that shell or add it to your shell profile, then run `ollama serve` or `scripts/start-ollama.sh`.

If Ollama is a systemd user or system service, set the variable in a drop-in, for example:

```ini
[Service]
Environment=OLLAMA_ORIGINS=chrome-extension://YOUR_EXTENSION_ID
```

Reload and restart the service after you change it.

## 3. Load the extension

### Chrome Web Store

When the listing is live, install it from the Chrome Web Store, then confirm `OLLAMA_ORIGINS` uses the published extension ID.

### Unpacked (developer mode)

1. Open Chrome and go to `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository folder that contains `manifest.json` (not a subfolder).

## 4. Check that it works

1. Open a public article, such as a Wikipedia page.
2. Click the extension icon, then **Summarize Page**.
3. You should see a streamed summary. If Ollama is not running, the popup will say it cannot connect and will not send the page to any other server.

The popup’s **Ollama URL** field is `http://localhost:11434` by default. You can change the port, but the host must stay `localhost` or `127.0.0.1`.

## Troubleshooting

### 403 Forbidden

CORS is not allowing this extension. Set `OLLAMA_ORIGINS` to the extension origin, then completely quit and restart Ollama. On a Mac, quitting the menu-bar app is required; restarting a terminal is not enough for the app.

Confirm Ollama is up with:

```bash
curl http://localhost:11434/api/tags
```

### Cannot connect to Ollama

- Start Ollama, or reopen the app.
- Confirm the URL in the popup matches the host and port Ollama is using.
- If you changed `OLLAMA_HOST`, update the popup URL to the local address. Remote hosts are not allowed.

### Could not access this page

Refresh the tab. The extension can read ordinary `http` and `https` pages. It cannot read `chrome://` pages, the Chrome Web Store, or similar restricted pages.

### Model not found or empty dropdown

Run `ollama list`. If the list is empty, pull a model. Then reopen the popup.

## Edge and Firefox

The same Manifest V3 package should load as an unpacked extension in Microsoft Edge. Publishing to Edge Add-ons is a separate listing.

Firefox needs a few extra manifest fields (a Gecko ID and Firefox data-collection settings) and is not packaged for Mozilla Add-ons in this version. If you test it in Firefox, also add `moz-extension://*` or the add-on’s origin to `OLLAMA_ORIGINS`.
