import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS for your frontend
app.use(cors({
  origin: ["https://thickoilz.w3spaces.com/"],
  methods: ["GET", "POST"]
}));

// Proxy helper
function proxify(url) {
  return "/proxy?url=" + encodeURIComponent(url);
}

// Main proxy endpoint
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing ?url");

  try {
    const response = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                      "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
      },
      redirect: "follow"
    });

    const contentType = response.headers.get("content-type") || "";

    // Non-HTML files (images, JS, CSS, etc.)
    if (!contentType.includes("text/html")) {
      res.set("content-type", contentType);
      response.body.pipe(res);
      return;
    }

    // Parse HTML
    let html = await response.text();
    const $ = cheerio.load(html);

    // Rewrite all links, forms, iframes, scripts
    $("a[href], form[action], img[src], script[src], link[href], iframe[src]").each((_, el) => {
      const $el = $(el);
      const attr = $el.attr("href") ? "href" : $el.attr("src") ? "src" : "action";
      const val = $el.attr(attr);
      if (!val) return;
      try {
        const abs = new URL(val, target).href;
        $el.attr(attr, proxify(abs));
      } catch (e) {}
    });

    // Remove X-Frame-Options headers from fetched page
    $("meta[http-equiv='Content-Security-Policy']").remove();
    $("meta[http-equiv='X-Frame-Options']").remove();

    // Anti-breakout script
    $("body").append(`
      <script>
        document.addEventListener('click', function(e){
          const a = e.target.closest('a');
          if (!a) return;
          const href = a.getAttribute('href');
          if (!href) return;
          e.preventDefault();
          window.location.href = '/proxy?url=' + encodeURIComponent(new URL(href, '${target}').href);
        }, true);
      </script>
    `);

    res.set("content-type", "text/html");
    res.send($.html());

  } catch (err) {
    console.error(err);
    res.status(500).send("Proxy error: " + err.message);
  }
});

app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));

