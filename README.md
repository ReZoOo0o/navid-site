# navid — media kit site

Sponsor-facing site for [@navid__fa](https://instagram.com/navid__fa), a documentary
filmmaker and photographer riding from Shiraz through the Caucasus.

English and Persian (RTL), static, no tracking, no third-party requests.

```bash
npm ci
npm run dev      # localhost:4321  ·  /fa/ for Persian
npm run verify   # build + PDF + tests + browser checks
```

Content lives in `src/data/*.yaml` and is schema-validated at build time.
Every number on the site comes from `facts.yaml` and nowhere else.

**This repo is generated.** It is built from a private working repo by
`scripts/split-public.mjs`. Do not edit it by hand — changes here are
overwritten on the next publish.
