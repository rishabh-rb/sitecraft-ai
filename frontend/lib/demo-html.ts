export const demoHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Luma Table — Seasonal dining</title>
    <style>
      :root { color-scheme: dark; --bg:#17120f; --surface:#211914; --line:rgba(255,247,237,.14); --text:#fff7ed; --muted:#c9b8a8; --primary:#d97706; --secondary:#f5c56b; }
      * { box-sizing:border-box; }
      html { scroll-behavior:smooth; }
      body { margin:0; background:var(--bg); color:var(--text); font-family:Inter,ui-sans-serif,system-ui,sans-serif; }
      a { color:inherit; text-decoration:none; }
      .nav { position:sticky; top:0; z-index:4; display:flex; align-items:center; justify-content:space-between; gap:24px; padding:18px clamp(20px,5vw,72px); background:rgba(23,18,15,.78); border-bottom:1px solid var(--line); backdrop-filter:blur(16px); }
      .brand { display:flex; align-items:center; gap:10px; font-weight:800; letter-spacing:-.03em; }
      .mark { display:grid; place-items:center; width:34px; height:34px; border-radius:11px; color:#2b2118; background:linear-gradient(135deg,var(--secondary),var(--primary)); }
      .links { display:flex; gap:24px; color:var(--muted); font-size:13px; font-weight:650; }
      .button { display:inline-flex; align-items:center; justify-content:center; gap:8px; padding:12px 17px; border-radius:999px; border:1px solid transparent; background:linear-gradient(135deg,var(--secondary),var(--primary)); color:#2b2118; font-size:13px; font-weight:800; cursor:pointer; }
      .button.secondary { color:var(--text); border-color:var(--line); background:rgba(255,255,255,.06); }
      .hero { position:relative; overflow:hidden; padding:clamp(72px,12vw,150px) clamp(20px,5vw,72px) 96px; background:radial-gradient(circle at 82% 12%,rgba(217,119,6,.35),transparent 35%),linear-gradient(180deg,#1f1711,var(--bg)); }
      .hero-grid { position:relative; z-index:1; display:grid; grid-template-columns:minmax(0,1fr) minmax(280px,.8fr); align-items:end; gap:48px; max-width:1180px; margin:0 auto; }
      .eyebrow { color:var(--secondary); font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; }
      h1 { max-width:680px; margin:16px 0 22px; font-size:clamp(44px,7vw,88px); line-height:.96; letter-spacing:-.065em; }
      .lead { max-width:570px; color:var(--muted); font-size:clamp(16px,2vw,20px); line-height:1.65; }
      .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:30px; }
      .hero-card { overflow:hidden; border:1px solid var(--line); border-radius:26px; background:rgba(255,255,255,.06); box-shadow:0 28px 80px rgba(0,0,0,.3); }
      .hero-card img { display:block; width:100%; aspect-ratio:4/5; object-fit:cover; opacity:.88; }
      .hero-card figcaption { padding:15px 17px; color:var(--muted); font-size:12px; }
      section { padding:86px clamp(20px,5vw,72px); border-top:1px solid var(--line); }
      .wrap { max-width:1180px; margin:0 auto; }
      .section-head { display:flex; align-items:end; justify-content:space-between; gap:24px; margin-bottom:32px; }
      h2 { max-width:590px; margin:10px 0 0; font-size:clamp(30px,4vw,54px); line-height:1; letter-spacing:-.05em; }
      .muted { color:var(--muted); line-height:1.7; }
      .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; }
      .card { padding:24px; border:1px solid var(--line); border-radius:20px; background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.025)); }
      .card img { width:100%; aspect-ratio:4/3; border-radius:13px; object-fit:cover; margin-bottom:18px; }
      .card h3 { margin:0 0 9px; font-size:20px; letter-spacing:-.03em; }
      .card p { margin:0; color:var(--muted); font-size:14px; line-height:1.65; }
      .story { display:grid; grid-template-columns:1fr 1fr; gap:56px; align-items:center; }
      .story img { width:100%; border-radius:24px; aspect-ratio:1.15; object-fit:cover; }
      .quote { margin:0; color:#f7dfbc; font-size:clamp(22px,3vw,38px); line-height:1.2; letter-spacing:-.04em; }
      .form { display:grid; grid-template-columns:1fr 1fr; gap:14px; max-width:760px; margin-top:26px; }
      label { display:grid; gap:7px; color:var(--muted); font-size:12px; font-weight:700; }
      input, textarea { width:100%; border:1px solid var(--line); border-radius:12px; padding:13px 14px; background:rgba(255,255,255,.06); color:var(--text); outline:none; }
      textarea { min-height:110px; resize:vertical; }
      .full { grid-column:1/-1; }
      .success { display:none; margin-top:16px; color:#9fe3d0; font-size:13px; font-weight:700; }
      footer { display:flex; justify-content:space-between; gap:18px; padding:30px clamp(20px,5vw,72px); color:var(--muted); font-size:12px; }
      @media (max-width:760px) { .links { display:none; } .hero-grid,.story { grid-template-columns:1fr; } .hero-card { max-width:420px; } .cards { grid-template-columns:1fr; } .section-head { display:block; } .form { grid-template-columns:1fr; } .full { grid-column:auto; } footer { display:block; } footer span { display:block; margin-top:8px; } }
    </style>
  </head>
  <body>
    <header class="nav">
      <a class="brand" href="#top"><span class="mark">L</span><span>Luma Table</span></a>
      <nav class="links" aria-label="Primary navigation"><a href="#menu">Menu</a><a href="#story">Our story</a><a href="#reserve">Reservations</a></nav>
      <a class="button" href="#reserve">Reserve a table <span>↗</span></a>
    </header>
    <main id="top">
      <section class="hero">
        <div class="hero-grid">
          <div>
            <div class="eyebrow">Seasonal dining · New Delhi</div>
            <h1>A table worth remembering.</h1>
            <p class="lead">A warm, ingredient-led restaurant where the menu follows the seasons and every plate is made for sharing.</p>
            <div class="actions"><a class="button" href="#menu">Explore the menu <span>↓</span></a><a class="button secondary" href="#reserve">Reserve a table</a></div>
          </div>
          <figure class="hero-card"><img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1100&q=85" alt="Warmly lit restaurant dining room" /><figcaption>Open Tuesday–Sunday · Dinner from 6pm</figcaption></figure>
        </div>
      </section>
      <section id="menu"><div class="wrap"><div class="section-head"><div><div class="eyebrow">From the kitchen</div><h2>Made for the table.</h2></div><p class="muted">Our menu changes with the market, bringing local produce and thoughtful technique to every course.</p></div><div class="cards"><article class="card"><img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=700&q=80" alt="Seasonal plated dish" /><h3>Seasonal plates</h3><p>Bright, generous dishes built around what is best right now.</p></article><article class="card"><img src="https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=700&q=80" alt="Craft cocktail with botanical garnish" /><h3>House cocktails</h3><p>Small-batch infusions, thoughtful pours, and a little bit of theatre.</p></article><article class="card"><img src="https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=700&q=80" alt="Fresh artisan bread" /><h3>Slow mornings</h3><p>Weekend brunch, warm bread, and coffee worth lingering over.</p></article></div></div></section>
      <section id="story"><div class="wrap story"><img src="https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1000&q=85" alt="Chef preparing a plated course" /><div><div class="eyebrow">Our story</div><blockquote class="quote">“The best meals make room for conversation.”</blockquote><p class="muted">Luma Table began with a simple idea: make a neighbourhood restaurant that feels special without ever feeling formal. Our kitchen is led by produce, curiosity, and the people around the table.</p></div></div></section>
      <section id="reserve"><div class="wrap"><div class="eyebrow">Join us</div><h2>Save a seat for the next good story.</h2><p class="muted">Tell us when you would like to visit and our team will confirm your reservation.</p><form class="form" onsubmit="event.preventDefault(); document.querySelector('.success').style.display='block'; this.reset();"><label>Name<input required placeholder="Your name" /></label><label>Email<input required type="email" placeholder="you@example.com" /></label><label>Date<input required type="date" /></label><label>Guests<select style="width:100%;border:1px solid var(--line);border-radius:12px;padding:13px 14px;background:rgba(255,255,255,.06);color:var(--text)"><option>2 guests</option><option>3 guests</option><option>4 guests</option><option>5+ guests</option></select></label><label class="full">Note<textarea placeholder="Any dietary notes or special occasion?"></textarea></label><button class="button full" type="submit">Request reservation <span>↗</span></button></form><div class="success" role="status">Thanks — your reservation request is ready for confirmation.</div></div></section>
    </main>
    <footer><strong>Luma Table</strong><span>Generated with SiteCraft AI · Sample preview</span></footer>
  </body>
</html>`;
