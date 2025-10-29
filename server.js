import express from "express";
import fetch from "node-fetch";
import * as cheerio from "cheerio"; // <-- fixed

const app = express();
const PORT = process.env.PORT || 3000;

// Allow CORS for your frontend origin (update this!)
app.use(cors({
  origin: ["https://thickoilz.w3spaces.com/"], // e.g. Netlify/Vercel site
  methods: ["GET", "POST"],
}));

// Helper function
function proxify(url) {
  return "/proxy?url=" + encodeURIComponent(url);
}

// Main proxy endpoint
app.get("/proxy", async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send("Missing ?url");

  try {
    const response = await fetch(target);
    const contentType = response.headers.get("content-type") || "";

    // For non-HTML (images, CSS, JS, etc.)
    if (!contentType.includes("text/html")) {
      res.set("content-type", contentType);
      response.body.pipe(res);
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Rewrite all links
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

    // Inject a small anti-breakout script
    $("body").append(`
      <script>
      (function() {
        document.addEventListener('click', function(e){
          const a = e.target.closest('a');
          if (!a) return;
          const href = a.getAttribute('href');
          if (!href) return;
          e.preventDefault();
          window.location.href = '/proxy?url=' + encodeURIComponent(new URL(href, '${target}').href);
        }, true);
      })();
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
