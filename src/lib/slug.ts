export function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** First meaningful line of a document body, used as a one-line description. */
export function firstLine(body: string, max = 150) {
  const line =
    body
      .split("\n")
      .map((l) => l.replace(/^[#>*\-\s]+/, "").trim())
      .find((l) => l.length > 20) ?? body.trim();
  return line.length > max ? `${line.slice(0, max).trimEnd()}...` : line;
}
