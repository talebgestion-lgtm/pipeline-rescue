const fs = require("node:fs");
const path = require("node:path");

const siteDir = __dirname;
const htmlFiles = fs
  .readdirSync(siteDir)
  .filter((file) => file.endsWith(".html"))
  .sort();

const failures = [];

function read(file) {
  return fs.readFileSync(path.join(siteDir, file), "utf8");
}

function getIds(html) {
  const ids = new Set();
  const idPattern = /\sid=["']([^"']+)["']/gi;
  let match;
  while ((match = idPattern.exec(html)) !== null) {
    ids.add(match[1]);
  }
  return ids;
}

const pages = new Map(
  htmlFiles.map((file) => {
    const html = read(file);
    return [file, { html, ids: getIds(html) }];
  })
);

function fail(file, href, reason) {
  failures.push(`${file}: invalid href "${href}" - ${reason}`);
}

for (const [file, page] of pages) {
  const hrefPattern = /\shref=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefPattern.exec(page.html)) !== null) {
    const href = match[1].trim();

    if (
      href === "" ||
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }

    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (!page.ids.has(id)) {
        fail(file, href, "missing fragment target on same page");
      }
      continue;
    }

    const [targetPath, fragment] = href.split("#");
    const normalized = path.normalize(targetPath);

    if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
      fail(file, href, "site links must stay inside the static site folder");
      continue;
    }

    const targetFile = path.join(siteDir, normalized);
    if (!fs.existsSync(targetFile)) {
      fail(file, href, "target file does not exist");
      continue;
    }

    if (fragment && targetPath.endsWith(".html")) {
      const targetPage = pages.get(path.basename(targetPath));
      if (!targetPage || !targetPage.ids.has(fragment)) {
        fail(file, href, "missing fragment target on linked page");
      }
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files and found no broken local links.`);
