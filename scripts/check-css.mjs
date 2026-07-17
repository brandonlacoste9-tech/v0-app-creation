const base = process.argv[2] || "https://capable-medovik-53f769.netlify.app";
const html = await (await fetch(base + "/")).text();
const refs = [...html.matchAll(/\/_next\/static\/[^"'\s>]+\.css/g)].map((m) => m[0]);
console.log("base", base);
console.log("css refs:", refs);
for (const p of [...new Set(refs)]) {
  const url = base + p;
  const res = await fetch(url);
  const t = await res.text();
  console.log(
    res.status,
    "len=" + t.length,
    "hasUtils=" + /min-h-screen|orange-500|--color-background/.test(t),
    p
  );
}
