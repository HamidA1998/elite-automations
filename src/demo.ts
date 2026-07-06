import {brand} from "@/config";
import type {QualifiedLead} from "@/types";
import {escapeHtml} from "@/utils";

function mapsEmbed(address: string | null, businessName: string) {
  const q = encodeURIComponent(address ?? businessName);
  return `https://www.google.com/maps?q=${q}&output=embed`;
}

export function createDemoHtml(lead: QualifiedLead) {
  const visualThesis = "Confident local-premium, image-led, editorial, with warm contrast and restrained interaction.";
  const services = [
    lead.businessType.replace(/\sand\s/gi, ", "),
    "Local trusted service",
    "Fast response times",
  ];

  const testimonials = [
    "Friendly, responsive and much easier to deal with than most local competitors.",
    "Exactly the kind of polished first impression we would expect from a premium local business.",
    "Clearer messaging, stronger visuals, and a more reassuring customer journey.",
  ];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(lead.businessName)} | Premium Demo by ${escapeHtml(brand.businessName)}</title>
  <meta name="description" content="A premium website demo for ${escapeHtml(lead.businessName)} in ${escapeHtml(lead.area)}." />
  <style>
    :root{--bg:#f6f0e8;--surface:rgba(255,255,255,.72);--card:#fff;--text:#102031;--muted:#51606f;--line:rgba(16,32,49,.1);--accent:#d97706;--accent-2:#0f4c5c}
    body.dark{--bg:#07131f;--surface:rgba(8,18,31,.72);--card:#0f2133;--text:#f4f8fb;--muted:#b8c5d1;--line:rgba(255,255,255,.08);--accent:#f59e0b;--accent-2:#90e0ef}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:ui-sans-serif,system-ui,sans-serif;background:radial-gradient(circle at top right, rgba(217,119,6,.12), transparent 28%),linear-gradient(180deg,var(--bg),color-mix(in srgb,var(--bg) 82%, #fff));color:var(--text);transition:.3s ease}
    a{text-decoration:none;color:inherit}img{max-width:100%;display:block}
    .nav{position:sticky;top:0;z-index:20;backdrop-filter:blur(18px);background:var(--surface);border-bottom:1px solid var(--line)}
    .nav-inner,.section{width:min(1120px,calc(100% - 32px));margin:0 auto}
    .nav-inner{display:flex;justify-content:space-between;align-items:center;padding:16px 0}.nav-links{display:flex;gap:18px;align-items:center}.btn{display:inline-flex;align-items:center;justify-content:center;padding:14px 20px;border-radius:999px;background:var(--accent);color:#fff;font-weight:700;box-shadow:0 16px 42px rgba(217,119,6,.24);transition:transform .2s ease,box-shadow .2s ease}.btn:hover{transform:translateY(-2px);box-shadow:0 22px 48px rgba(217,119,6,.28)}
    .ghost{background:transparent;color:var(--text);border:1px solid var(--line);box-shadow:none}
    .hero{position:relative;min-height:calc(100svh - 73px);display:grid;align-items:end;padding:0;overflow:hidden}.hero-grid{position:relative;z-index:2;display:grid;grid-template-columns:minmax(0,620px);gap:28px;align-items:end;padding:120px 16px 72px;width:min(1180px,100% - 32px);margin:0 auto}.eyebrow{letter-spacing:.18em;text-transform:uppercase;font-size:.78rem;color:#d9edf6;font-weight:800}.headline{font-size:clamp(3.2rem,7vw,6.4rem);line-height:.92;margin:18px 0;color:#fff}.lede{font-size:1.12rem;line-height:1.7;color:rgba(255,255,255,.82);max-width:58ch}
    .hero-media{position:absolute;inset:0;overflow:hidden;min-height:520px}
    .hero-media img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.hero-media:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.12),rgba(0,0,0,.38))}
    .hero-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,10,18,.84) 0%, rgba(3,10,18,.62) 38%, rgba(3,10,18,.22) 70%, rgba(3,10,18,.1) 100%),linear-gradient(180deg,rgba(3,10,18,.12),rgba(3,10,18,.5))}
    .hero-note{display:grid;gap:8px;max-width:440px;padding-top:16px;border-top:1px solid rgba(255,255,255,.18);color:rgba(255,255,255,.72)}
    .metrics,.testimonials,.contact-grid{display:grid;gap:18px}.metrics{grid-template-columns:repeat(3,1fr);margin-top:28px}.metric,.testimonial,.contact-panel{background:var(--card);border:1px solid var(--line);border-radius:24px;padding:24px;box-shadow:0 18px 44px rgba(3,10,18,.08)}
    .section{padding:84px 0}.section h2{font-size:clamp(2rem,4vw,3.3rem);margin:0 0 14px}.sub{color:var(--muted);max-width:64ch;line-height:1.7}
    .services-layout{display:grid;grid-template-columns:.95fr 1.05fr;gap:28px;align-items:start;margin-top:32px}.service-list{display:grid;gap:18px}.service-item{padding:0 0 18px;border-bottom:1px solid var(--line)}.fade.visible{transform:none;opacity:1}.service-visual{border-radius:32px;overflow:hidden;min-height:420px;border:1px solid var(--line);box-shadow:0 30px 80px rgba(3,10,18,.12)}
    .service-visual img{width:100%;height:340px;object-fit:cover}
    .testimonials{grid-template-columns:repeat(3,1fr);margin-top:28px}.contact-grid{grid-template-columns:1fr .95fr;align-items:start;margin-top:28px}form{display:grid;gap:12px}input,textarea{width:100%;padding:14px 16px;border-radius:16px;border:1px solid var(--line);background:transparent;color:var(--text)}textarea{min-height:140px;resize:vertical}iframe{width:100%;height:100%;min-height:420px;border:0;border-radius:24px}
    footer{padding:32px 16px 56px;text-align:center;color:var(--muted)}
    @media (max-width: 900px){.hero-grid,.contact-grid,.metrics,.testimonials,.services-layout{grid-template-columns:1fr}.nav-links a:not(.btn){display:none}.hero{min-height:auto}.hero-grid{padding:110px 16px 52px}.hero-media{min-height:460px}.section{padding:64px 0}}
  </style>
</head>
<body>
  <nav class="nav">
    <div class="nav-inner">
      <strong>${escapeHtml(lead.businessName)}</strong>
      <div class="nav-links">
        <a href="#services">Services</a>
        <a href="#about">About</a>
        <a href="#contact" class="btn">Book now</a>
        <button class="btn ghost" id="theme-toggle" type="button">Mode</button>
      </div>
    </div>
  </nav>
  <main>
    <section class="hero">
      <div class="hero-media">
        <img src="../images/${escapeHtml(lead.imageAssets.hero.split("/").pop() ?? "")}" alt="${escapeHtml(lead.businessName)} hero image" />
        <div class="hero-overlay"></div>
      </div>
      <div class="hero-grid">
        <div class="fade">
          <div class="eyebrow">${escapeHtml(lead.area)}</div>
          <h1 class="headline">${escapeHtml(lead.businessName)} deserves a sharper digital first impression.</h1>
          <p class="lede">${escapeHtml(lead.businessName)} can look more credible, modern, and conversion-focused online with clearer messaging, stronger local trust signals, and a smoother mobile journey.</p>
          <div style="display:flex;gap:14px;flex-wrap:wrap;margin-top:24px">
            <a href="#contact" class="btn">Request a callback</a>
            <a href="#services" class="btn ghost">Explore services</a>
          </div>
          <div class="metrics">
            <div class="metric"><strong>Local area</strong><div>${escapeHtml(lead.area)}</div></div>
            <div class="metric"><strong>Phone</strong><div>${escapeHtml(lead.phoneNumber ?? "Add your number")}</div></div>
            <div class="metric"><strong>Speciality</strong><div>${escapeHtml(lead.businessType)}</div></div>
          </div>
          <div class="hero-note">
            <strong>Visual direction</strong>
            <span>${escapeHtml(visualThesis)}</span>
          </div>
        </div>
      </div>
    </section>
    <section class="section" id="services">
      <h2>Services presented with more clarity</h2>
      <p class="sub">A strong local business site should feel reassuring within seconds and make the next step obvious. This demo reframes the experience around clarity, trust, and action.</p>
      <div class="services-layout">
        <div class="service-list fade">
          ${services
            .map(
              (service) => `<article class="service-item"><h3>${escapeHtml(service)}</h3><p class="sub">Present this service with clearer outcomes, stronger proof, and a more confident call to action.</p></article>`
            )
            .join("")}
        </div>
        <div class="service-visual fade"><img src="../images/${escapeHtml(lead.imageAssets.services.split("/").pop() ?? "")}" alt="${escapeHtml(lead.businessName)} services image" /></div>
      </div>
    </section>
    <section class="section" id="about">
      <h2>Built to make the business feel established</h2>
      <p class="sub">This concept uses cleaner hierarchy, premium spacing, stronger proof points, and clearer contact prompts to help visitors trust ${escapeHtml(lead.businessName)} faster.</p>
    </section>
    <section class="section">
      <h2>What this version fixes</h2>
      <div class="testimonials">
        ${lead.audit.topProblems
          .map((problem: string) => `<article class="testimonial"><strong>Opportunity</strong><p class="sub">${escapeHtml(problem)}</p></article>`)
          .join("")}
      </div>
    </section>
    <section class="section">
      <h2>Customer reassurance section</h2>
      <div class="testimonials">
        ${testimonials
          .map((quote) => `<article class="testimonial"><strong>Trust signal</strong><p class="sub">${escapeHtml(quote)}</p></article>`)
          .join("")}
      </div>
    </section>
    <section class="section" id="contact">
      <h2>Make getting in touch frictionless</h2>
      <div class="contact-grid">
        <div class="contact-panel">
          <form>
            <input placeholder="Your name" />
            <input placeholder="Phone or email" />
            <textarea placeholder="How can we help?"></textarea>
            <button class="btn" type="button">Send enquiry</button>
          </form>
        </div>
        <div class="contact-panel">
          <iframe src="${mapsEmbed(lead.address, lead.businessName)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    </section>
  </main>
  <footer>Free demo by ${escapeHtml(brand.businessName)} — ${escapeHtml(brand.domain)}</footer>
  <script>
    const toggle = document.getElementById('theme-toggle');
    toggle?.addEventListener('click', () => document.body.classList.toggle('dark'));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.classList.add('visible');
      }
    }, {threshold: 0.12});
    document.querySelectorAll('.fade').forEach((node) => observer.observe(node));
  </script>
</body>
</html>`;
}
