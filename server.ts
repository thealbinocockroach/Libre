import express from "express";
import path from "path";
import { Readable } from "stream";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Gutenberg API Proxy
  app.get("/api/gutenberg/search", async (req, res) => {
    try {
      const q = req.query.q as string;
      const gutUrl = `https://gutendex.com/books/?search=${encodeURIComponent(q)}`;
      const fetchRes = await fetch(gutUrl);
      const data = await fetchRes.json();
      res.json(data);
    } catch (err) {
      console.error("Gutendex search error:", err);
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/gutenberg/text", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing URL parameter" });
      }

      // Check allowed domains for security
      const parsed = new URL(url);
      const allowedHosts = [
        "www.gutenberg.org",
        "gutenberg.org",
        "raw.githubusercontent.com",
        "archive.org",
        "ia800000.us.archive.org",
        "ia600000.us.archive.org",
        "openlibrary.org",
      ];

      const isAllowed = allowedHosts.some(
        (host) => parsed.hostname === host || parsed.hostname.endsWith(".archive.org") || parsed.hostname.endsWith(".gutenberg.org")
      );

      if (!isAllowed) {
        return res.status(400).json({ error: "Disallowed domain" });
      }
      
      const fetchRes = await fetch(url, {
        headers: {
          "User-Agent": "LibriAudio-Reader/1.0",
        },
      });
      const text = await fetchRes.text();
      res.send(text);
    } catch (err) {
      console.error("Gutenberg text fetch error:", err);
      res.status(500).json({ error: "Text fetch failed" });
    }
  });

  // Free English Dictionary Proxy Endpoint
  app.get("/api/dictionary/:word", async (req, res) => {
    try {
      const word = req.params.word.trim().toLowerCase();
      if (!word) {
        return res.status(400).json({ error: "Missing word" });
      }
      const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!dictRes.ok) {
        return res.status(dictRes.status).json({ error: "Word definition not found" });
      }
      const data = await dictRes.json();
      res.json(data);
    } catch (err) {
      console.error("Dictionary lookup error:", err);
      res.status(500).json({ error: "Dictionary service unavailable" });
    }
  });

  app.get("/api/proxy-audio", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "Missing url parameter" });
      }

      // Validate URL format
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL parameter" });
      }

      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 LibriAudio-Downloader/1.0",
        Accept: "*/*",
        "Accept-Encoding": "identity",
      };

      if (req.headers.range) {
        requestHeaders["Range"] = req.headers.range as string;
      }

      const fetchRes = await fetch(url, {
        headers: requestHeaders,
        redirect: "follow",
      });

      if (!fetchRes.ok && fetchRes.status !== 206) {
        return res.status(fetchRes.status).send(fetchRes.statusText);
      }

      // Set CORS and streaming headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Range, Content-Type, Accept");
      res.setHeader("Accept-Ranges", "bytes");

      const contentType = fetchRes.headers.get("content-type") || "audio/mpeg";
      res.setHeader("Content-Type", contentType);

      if (fetchRes.headers.has("content-length")) {
        res.setHeader("Content-Length", fetchRes.headers.get("content-length")!);
      }
      if (fetchRes.headers.has("content-range")) {
        res.setHeader("Content-Range", fetchRes.headers.get("content-range")!);
      }

      res.status(fetchRes.status);

      if (fetchRes.body) {
        // Stream directly to response for fast, reliable chunking without memory bloat
        const readable = Readable.fromWeb(fetchRes.body as any);
        readable.pipe(res);
      } else {
        const arrayBuffer = await fetchRes.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }
    } catch (err) {
      console.error("Audio proxy error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Audio fetch failed" });
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support React Router SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
