# Chrome Web Store listing drafts

Use these answers when you upload `dist/ollama-web-summarizer-1.0.1.zip`. They match version 1.0.1 of the extension. This file is not included in the zip.

The current name, **Ollama Web Summarizer**, is kept in the manifest. If Chrome or Ollama’s trademark terms become a problem, a safer title is **Web Summarizer for Ollama**, with the same “Not affiliated with Ollama Inc.” line in the listing and privacy policy.

Promo tile (optional but recommended): `docs/assets/promo-440x280.png` (440×280).

## Short description

Summarize web pages and selected text with your local Ollama models, then chat about the content.

(The manifest already uses this text. It is 108 characters; the limit is 132.)

## Long description

Ollama Web Summarizer helps you summarize the page you are reading, or any text you select, using models that already run on your computer with Ollama. Follow-up questions stay in the extension. Nothing is sent to a cloud API.

This is not an official Ollama product, and it is not affiliated with Ollama Inc. You need Ollama installed and running locally, plus at least one model.

What you can do
• Click the toolbar icon and summarize the current page
• Highlight text to summarize, explain, or ask a question
• Right-click selected text and use the context menu
• Chat about the page in the popup
• Pick, install, or remove local Ollama models from the popup
• Choose from 12 light and dark themes

Privacy
Page text, selected text, and your questions are sent only to Ollama on your machine, usually at http://localhost:11434. The extension stores your model, theme, and local server URL in Chrome’s local storage. It does not create an account, and it does not send your browsing data to the developer or to any third-party server.

Setup
1. Install Ollama from https://ollama.com and pull a model, for example: ollama pull llama3.2
2. Allow the extension to call your local Ollama server. After this listing is published, copy the extension ID from chrome://extensions and set OLLAMA_ORIGINS to chrome-extension:// followed by that ID, then restart Ollama. Do not set OLLAMA_ORIGINS to *.
3. Install this extension, open a regular webpage, and click Summarize Page.

If Ollama is not running, the extension will say it cannot connect and will not send page content anywhere else.

Category: Productivity

Support / homepage: https://github.com/mso-docs/Ollama-Web-Summarizer

Privacy policy URL (after GitHub Pages is enabled from the /docs folder):
https://mso-docs.github.io/Ollama-Web-Summarizer/privacy.html

## Single purpose

Summarize the current webpage or selected text, and chat about that content, using a locally running Ollama model.

## Remote code

No, I am not using remote code.

All scripts ship in the extension package. Calls to http://localhost or http://127.0.0.1 are data requests to a native app on the same computer, not remotely hosted code.

## Data use disclosures

Check:

- Website content: the extension reads the current page’s text and any text the user selects, then sends that text to local Ollama to summarize or answer questions.
- User settings / preferences, if the form has that option: the selected model, theme, and local Ollama URL are stored in chrome.storage.local.

Do not check personally identifiable information, health, financial, authentication, location, or web browsing history. The extension does not send the page URL to Ollama and does not store browsing history.

Chat messages and page text are kept in memory for the current popup or on-page session and are not written to disk by the extension.

Limited-use certifications: certify that this data is used only to provide the stated feature, is not sold, and is not used for unrelated purposes. The privacy policy, this form, and the extension’s behavior should stay in agreement.

## Permission justifications

activeTab
Access the page the user is on when they open the popup, so the extension can ask the content script for that page’s text and summarize it.

storage
Save the selected Ollama model, theme, and local Ollama URL on the device.

contextMenus
Add “Summarize with Ollama” and “Explain with Ollama” when the user right-clicks selected text.

host_permissions for http://localhost/* and http://127.0.0.1/*
Call the local Ollama HTTP API to list and manage models and to generate summaries and chat replies. The default URL is http://localhost:11434. Users may change the port in the popup, so the permission covers any port on those loopback hosts. The extension does not request access to any remote website API and will not accept a non-local URL.

Content script on http and https pages
Inject the highlight toolbar and extract page or selection text on ordinary websites when the user asks. The script does not contact remote services and does not change site behavior except for that optional toolbar and result dialog.

The previous `scripting` permission was unused and has been removed.

## Test instructions for reviewers

This extension requires Ollama, a local app, and will not summarize a page until Ollama is running. If Ollama is not available in the review environment, the popup should show a clear connection error and must not contact any other server.

1. Install Ollama from https://ollama.com, then run: ollama pull llama3.2
2. Allow the packed extension origin, then fully restart Ollama. The published Chrome ID appears on chrome://extensions after the uploaded package is loaded. Example:
   OLLAMA_ORIGINS=chrome-extension://<ID>
3. Open a public article (for example a Wikipedia page). Click the toolbar icon, then Summarize Page. You should see a streamed summary.
4. Highlight a paragraph and use the on-page toolbar or the right-click menu to summarize or explain it.
5. If Ollama is stopped, the popup should show a connection error and should not contact any other server.

The privacy policy is at https://mso-docs.github.io/Ollama-Web-Summarizer/privacy.html (or docs/privacy.html in the source repository if Pages is not yet enabled).
