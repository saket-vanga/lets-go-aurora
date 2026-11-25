// Small proxy that lets the Lets Go Aurora app read live ADS-B positions
// (adsb.lol, with adsb.fi as backup). Only Finnair (FIN…) lookups are allowed.
const ALLOWED = ['https://saket-vanga.github.io', 'http://localhost:8765'];
const FEEDS = ['https://api.adsb.lol/v2', 'https://opendata.adsb.fi/api/v2'];

const R = Math.PI / 180;
const km = (a, b, c, d) => {
  const x = Math.sin((c - a) * R / 2) ** 2 + Math.cos(a * R) * Math.cos(c * R) * Math.sin((d - b) * R / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};
const angle = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const trim = a => ({
  flight: (a.flight || '').trim(), hex: a.hex, reg: a.r, type: a.t,
  lat: a.lat, lon: a.lon, alt: a.alt_baro, gs: a.gs, track: a.track,
  seen: a.seen_pos ?? a.seen ?? null,
});

async function feed(path) {
  for (const base of FEEDS) {
    try {
      const r = await fetch(base + path, { headers: { 'User-Agent': 'lets-go-aurora-trip-app' }, cf: { cacheTtl: 5 } });
      if (!r.ok) continue;
      const d = await r.json();
      const ac = (d.ac || []).filter(a => a.lat != null && a.lon != null);
      return ac;
    } catch (e) { /* try next feed */ }
  }
  return [];
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const origin = req.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (url.pathname === '/') return json({ ok: true, use: '/flight?cs=FIN132&lat=..&lon=..&hdg=..&hex=..' }, 200, cors);
    if (url.pathname !== '/flight') return json({ error: 'not found' }, 404, cors);

    const q = url.searchParams;
    const cs = (q.get('cs') || '').toUpperCase();
    const hex = (q.get('hex') || '').toLowerCase();
    const lat = parseFloat(q.get('lat')), lon = parseFloat(q.get('lon')), hdg = parseFloat(q.get('hdg'));
    if (!/^FIN[0-9A-Z]{1,5}$/.test(cs)) return json({ error: 'Only Finnair callsigns (FIN…) are supported' }, 400, cors);
    if (hex && !/^[0-9a-f]{6}$/.test(hex)) return json({ error: 'bad hex' }, 400, cors);

    const out = { cs, t: Date.now(), source: null, ac: null, candidates: 0 };
    const hdrs = { ...cors, 'Cache-Control': 'public, max-age=10' };

    // 1. the exact aircraft we locked onto earlier
    if (hex) {
      const ac = await feed('/hex/' + hex);
      if (ac.length) { out.source = 'hex'; out.ac = trim(ac[0]); return json(out, 200, hdrs); }
    }
    // 2. flight number as callsign (long-haul Finnair flights usually use it)
    const byCs = await feed('/callsign/' + cs);
    if (byCs.length) { out.source = 'callsign'; out.ac = trim(byCs[0]); return json(out, 200, hdrs); }

    // 3. a Finnair aircraft near where the flight should be, heading the right way
    if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      const near = (await feed(`/point/${lat.toFixed(3)}/${lon.toFixed(3)}/250`))
        .filter(a => /^FIN/.test((a.flight || '').trim()) && a.alt_baro !== 'ground');
      out.candidates = near.length;
      let best = null, bestScore = Infinity;
      for (const a of near) {
        const d = km(lat, lon, a.lat, a.lon);
        const h = isFinite(hdg) && a.track != null ? angle(hdg, a.track) : 0;
        if (h > 55) continue;
        const score = d + h * 4;
        if (score < bestScore) { bestScore = score; best = a; }
      }
      if (best) { out.source = 'match'; out.ac = trim(best); out.distKm = Math.round(km(lat, lon, best.lat, best.lon)); }
    }
    return json(out, 200, hdrs);
  },
};
