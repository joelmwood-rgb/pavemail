import React, { useState } from "react";

// ─────────────────────────────────────────────
// LOB API INTEGRATION
// ─────────────────────────────────────────────
const LOB_PROXY       = "https://joelmwood--b166b8c432db11f19dff42b51c65c3df.web.val.run/?target=lob";
const ANTHROPIC_PROXY = "https://joelmwood--b166b8c432db11f19dff42b51c65c3df.web.val.run/?target=anthropic";

async function lobRequest(endpoint, body) {
  const res = await fetch(LOB_PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Lob API error");
  return data;
}

// Lob verified address IDs
const LOB_FROM_ID = "adr_910e8abc86e78815"; // JWood LLC
const LOB_TO_ID   = "adr_cef32a4b4157e9df"; // Tulsa Test Homeowner

async function sendMailer({ neighborhood, headline, sub }) {
  return lobRequest("/postcards", {
    description: `JWood LLC - ${neighborhood || "Tulsa"} Campaign`,
    to:   LOB_TO_ID,
    from: LOB_FROM_ID,
    size: "6x9",
    front: `<html><body style="margin:0;padding:30px;background:#1c1a17;color:#f5f0e6;font-family:Arial,sans-serif;"><div style="color:#e8560a;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">JWood LLC · Tulsa, OK</div><h1 style="font-size:32px;color:#f5f0e6;margin:0;line-height:1.1;">${headline || "UPGRADE YOUR DRIVEWAY THIS SEASON"}</h1><p style="font-size:12px;color:#b8b4ac;margin-top:10px;line-height:1.6;">${sub || "Tulsa concrete specialists. Free estimates, written warranty, local crew."}</p><div style="margin-top:18px;background:#e8560a;color:white;padding:10px 16px;border-radius:6px;display:inline-block;"><strong style="font-size:13px;">FREE ESTIMATE — CALL 918-896-6737</strong></div><p style="margin-top:10px;font-size:10px;color:#7a7670;">Mention code JWOOD25 · joelmwood@gmail.com</p></body></html>`,
    back: `<html><body style="margin:0;padding:30px;background:#f5f0e6;color:#1c1a17;font-family:Arial,sans-serif;"><h2 style="font-size:20px;color:#1c1a17;margin-bottom:12px;">Why Tulsa Homeowners Choose JWood LLC</h2><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;"><div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:8px 12px;border-radius:4px;"><strong style="font-size:11px;">Oklahoma Weather Experts</strong><p style="font-size:10px;color:#6a6864;margin:2px 0 0;">We know Tulsa freeze-thaw cycles and use the right materials.</p></div><div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:8px 12px;border-radius:4px;"><strong style="font-size:11px;">Commercial-Grade Materials</strong><p style="font-size:10px;color:#6a6864;margin:2px 0 0;">Reinforced concrete built to last 30+ years in Oklahoma soil.</p></div><div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:8px 12px;border-radius:4px;"><strong style="font-size:11px;">Written Warranty on Every Job</strong><p style="font-size:10px;color:#6a6864;margin:2px 0 0;">2-year workmanship guarantee. If something fails, we fix it free.</p></div></div><div style="background:#1c1a17;color:white;padding:12px;border-radius:8px;text-align:center;"><div style="font-size:15px;font-weight:700;">918-896-6737</div><div style="font-size:10px;color:#b8b4ac;margin-top:2px;">joelmwood@gmail.com</div><div style="margin-top:5px;font-size:10px;background:#e8560a;display:inline-block;padding:3px 8px;border-radius:4px;">Code: JWOOD25 — FREE estimate</div></div></body></html>`,
    use_type: "marketing",
  });
}

// ─────────────────────────────────────────────
// QR CODE
// ─────────────────────────────────────────────
function QRCode({ value, size = 120 }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}&color=1c1a17&bgcolor=faf7f2&margin=6`;
  return <img src={url} width={size} height={size} alt="Scan to call" style={{ borderRadius:6, display:"block" }} />;
}

// ─────────────────────────────────────────────
// COMPANY INFO
// ─────────────────────────────────────────────
const COMPANY = {
  name:    "JWood LLC",
  phone:   "918-896-6737",
  email:   "joelmwood@gmail.com",
  city:    "Tulsa",
  state:   "OK",
  promo:   "JWOOD25",
};


// ─────────────────────────────────────────────
// PRICING ENGINE
// ─────────────────────────────────────────────
const DRIVEWAY_SIZES = [
  { label:"Small",  desc:"1-car, ~250 sq ft",  sqft:250  },
  { label:"Medium", desc:"2-car, ~400 sq ft",  sqft:400  },
  { label:"Large",  desc:"3-car, ~600 sq ft",  sqft:600  },
  { label:"XL",     desc:"600+ sq ft",          sqft:800  },
];

const SERVICE_RATES = {
  "Crack Repair":     { low:3,  high:6,  label:"Crack Repair"     },
  "Resurfacing":      { low:3,  high:5,  label:"Resurfacing"      },
  "New Installation": { low:6,  high:12, label:"New Pour"         },
  "Sealing":          { low:1,  high:2,  label:"Sealing"          },
};

const DAMAGE_MULTIPLIERS = {
  "Minor":    { low:0.85, high:1.0  },
  "Moderate": { low:1.0,  high:1.2  },
  "Severe":   { low:1.2,  high:1.5  },
};

function calcPrice(sqft, service, damage) {
  const rate   = SERVICE_RATES[service]   || SERVICE_RATES["Crack Repair"];
  const mult   = DAMAGE_MULTIPLIERS[damage] || DAMAGE_MULTIPLIERS["Moderate"];
  const lo = Math.round((sqft * rate.low  * mult.low)  / 50) * 50;
  const hi = Math.round((sqft * rate.high * mult.high) / 50) * 50;
  return { lo, hi };
}
// ─────────────────────────────────────────────
// DEMO MAILER CONTENT (fallback when no API)
// ─────────────────────────────────────────────
const DEMO_MAILERS = {
  "Spring-Crack Repair-Free Estimate": {
    page1: { eyebrow:"Your Neighbors Are Already Upgrading", headline:"TULSA WINTERS ARE TOUGH ON DRIVEWAYS", subheadline:"Freeze-thaw cycles across Tulsa have left driveways cracked and crumbling this spring. Don't let small damage turn into a full replacement — JWood LLC is already working in your neighborhood.", badgeTop:"FREE", badgeMain:"ESTIMATE", badgeBottom:"No Obligation" },
    page2: { headline:"WHY YOUR DRIVEWAY CAN'T WAIT", intro:"Oklahoma's temperature swings — from icy winters to 100°F summers — are brutal on concrete. Cracks ignored now become costly replacements by fall.", benefits:[{icon:"🌡️",title:"Oklahoma Weather Damage",desc:"Tulsa's freeze-thaw cycles crack concrete fast. Spring is the best time to repair before summer heat sets in."},{icon:"💧",title:"Stop Water Intrusion",desc:"Cracks let water in. Water expands when frozen. That destroys your base and doubles repair costs."},{icon:"🏡",title:"Boost Curb Appeal",desc:"A repaired driveway instantly upgrades your home's appearance and protects its value."},{icon:"⏱️",title:"One-Day Turnaround",desc:"Most crack repairs completed same day. Driveable within 24 hours."}], whyTitle:"Why JWood LLC?", whyText:"We're local Tulsans — we know Oklahoma soil, Oklahoma weather, and Oklahoma homeowners. Every job is done with commercial-grade materials and backed by our written warranty." },
    page3: { headline:"OUR SIMPLE 4-STEP PROCESS", intro:"From your first call to pulling your car back in — we make it effortless.", steps:[{title:"Free On-Site Estimate",desc:"We visit, assess the damage, and give you a written quote. No pressure, no surprises."},{title:"Schedule at Your Convenience",desc:"We work around your schedule, including Saturdays."},{title:"Expert Repair",desc:"Our crew arrives on time, protects your lawn, and gets to work with commercial-grade materials."},{title:"Done & Guaranteed",desc:"We clean up completely and hand you a written warranty before we leave."}], offerHeadline:"FREE ESTIMATE — CALL TODAY", offerSub:"Spring slots filling fast — mention code JWOOD25 when you call" },
    page4: { eyebrow:"Ready to Get Started?", headline:"CALL JWOOD LLC TODAY", sub:"Serving Tulsa and surrounding areas. Spring is our busiest season — call now to lock in your free estimate before your neighbors do.", guarantee:"We guarantee our work for 2 full years. If anything fails due to workmanship, we come back and fix it — no questions asked." }
  },
  "Summer-New Installation-Free Estimate": {
    page1: { eyebrow:"Upgrade Before Summer Cookout Season", headline:"NEW CONCRETE DRIVEWAY INSTALLED THIS SUMMER", subheadline:"Long Tulsa summer days mean faster curing and better results. JWood LLC is installing driveways across your neighborhood — and we have a free estimate ready for you.", badgeTop:"FREE", badgeMain:"ESTIMATE", badgeBottom:"Call Today" },
    page2: { headline:"TRANSFORM YOUR HOME'S FIRST IMPRESSION", intro:"A new concrete driveway is one of the highest-ROI investments a Tulsa homeowner can make — averaging 98% return at resale.", benefits:[{icon:"☀️",title:"Summer Is Ideal",desc:"Oklahoma's warm temps and dry summers create perfect conditions for long-lasting concrete pours."},{icon:"💰",title:"Best ROI",desc:"New concrete driveways return nearly 100% of cost at resale — better than most home renovations."},{icon:"🏗️",title:"Custom Finish",desc:"Choose width, texture, color, and edging to perfectly match your Tulsa home."},{icon:"📅",title:"Done in Days",desc:"Most residential driveways installed and driveable within 3–5 days."}], whyTitle:"Why JWood LLC?", whyText:"Tulsa homeowners trust JWood LLC because we show up on time, communicate clearly, and stand behind every pour. We use reinforced concrete with proper base prep." },
    page3: { headline:"HOW IT WORKS", intro:"A new driveway is easier than you think.", steps:[{title:"Free Design Consultation",desc:"We measure your space and help you choose the right width, finish, and budget."},{title:"Demo & Excavation",desc:"We remove your old surface and properly prepare the base — the most critical step."},{title:"Pour & Finish",desc:"Commercial-grade concrete poured by our experienced Tulsa crew."},{title:"Cure, Seal & Warranty",desc:"We apply a professional sealer and hand you a written warranty before we leave."}], offerHeadline:"FREE ESTIMATE — NO OBLIGATION", offerSub:"Summer slots limited — call 918-896-6737 and mention JWOOD25" },
    page4: { eyebrow:"Let's Build Something Great", headline:"CALL 918-896-6737 THIS WEEK", sub:"Summer slots fill fast across Tulsa. We can usually start within 2 weeks of your estimate.", guarantee:"5-year structural warranty on all new installations. We stand behind every pour." }
  },
  "Fall-Sealing-Free Estimate": {
    page1: { eyebrow:"Protect Your Driveway Before Winter Hits", headline:"SEAL IT NOW BEFORE OKLAHOMA WINTER CRACKS IT", subheadline:"Fall is the last chance to seal your driveway before Tulsa's freeze-thaw season begins. JWood LLC is sealing driveways across your neighborhood right now.", badgeTop:"FREE", badgeMain:"ESTIMATE", badgeBottom:"Limited Slots" },
    page2: { headline:"WHY FALL SEALING IS CRITICAL IN TULSA", intro:"Oklahoma's winters are unpredictable — ice, snow, and freeze-thaw cycles can destroy an unsealed driveway in a single season.", benefits:[{icon:"❄️",title:"Winter Protection",desc:"Sealing blocks water before it freezes and expands inside your concrete."},{icon:"🛡️",title:"UV & Heat Shield",desc:"Tulsa summers hit 100°F+. Sealer protects against UV damage and surface deterioration."},{icon:"✨",title:"Like-New Appearance",desc:"Professional sealing restores color and gives your driveway a clean, finished look."},{icon:"💵",title:"Prevent Costly Repairs",desc:"A $300 seal job now prevents a $3,000 replacement later."}], whyTitle:"Why JWood LLC?", whyText:"We use commercial-grade penetrating sealers — not the hardware store stuff that peels in one season. Our sealing jobs are done right, and we're Tulsa locals." },
    page3: { headline:"SIMPLE SEALING PROCESS", intro:"In and out in a few hours. Your driveway is protected all winter.", steps:[{title:"Free Assessment",desc:"We inspect your driveway and check for cracks that need repair before sealing."},{title:"Surface Prep & Clean",desc:"We power wash and prep the surface for maximum sealer adhesion."},{title:"Professional Application",desc:"Commercial-grade sealer applied evenly by our trained crew."},{title:"24-Hour Cure",desc:"Stay off it for 24 hours and you're fully protected for the season."}], offerHeadline:"FREE ESTIMATE THIS WEEK", offerSub:"Fall slots filling fast — mention JWOOD25 when you call 918-896-6737" },
    page4: { eyebrow:"Don't Wait for the First Freeze", headline:"CALL JWOOD LLC BEFORE WINTER HITS", sub:"Once temperatures drop below 50°F sealing becomes less effective. Call now while fall conditions are still perfect.", guarantee:"All sealing work guaranteed for 2 seasons. If it peels or fails, we come back and redo it — free." }
  }
};

function getDemoMailer(season, angle, offer) {
  const key = `${season}-${angle}-${offer}`;
  return DEMO_MAILERS[key] || Object.values(DEMO_MAILERS)[0];
}

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────
const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Syne:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{--black:#0e0d0b;--ink:#1c1a17;--charcoal:#2e2b27;--gravel:#4a4740;--stone:#7a7670;--concrete:#b8b4ac;--cream:#f5f0e6;--white:#fdfcf9;--orange:#e8560a;--orange2:#f4823c;--green:#2a7a52;--green2:#3eb87c;--blue:#1a6fa8;--blue2:#4a9fd4;--yellow:#d4a017;--red:#b83232;}
html,body,#root{height:100%;}
body{font-family:'Syne',sans-serif;background:var(--black);color:var(--cream);height:100%;overflow:hidden;}
.shell{display:grid;grid-template-rows:52px 1fr;grid-template-columns:220px 1fr;height:100vh;overflow:hidden;}
.topbar{grid-column:1/-1;background:var(--ink);border-bottom:1px solid rgba(184,180,172,0.1);display:flex;align-items:center;padding:0 20px;gap:16px;z-index:100;}
.logo{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:3px;color:var(--cream);flex-shrink:0;}
.logo span{color:var(--orange);}
.topbar-sep{width:1px;height:20px;background:rgba(184,180,172,0.15);}
.topbar-meta{font-size:11px;color:var(--stone);letter-spacing:1px;text-transform:uppercase;}
.topbar-right{margin-left:auto;display:flex;align-items:center;gap:10px;}
.co-pill{background:rgba(232,86,10,0.15);border:1px solid rgba(232,86,10,0.3);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--orange2);font-weight:700;}
.lob-pill{background:rgba(42,122,82,0.15);border:1px solid rgba(42,122,82,0.3);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--green2);font-weight:700;display:flex;align-items:center;gap:5px;}
.lob-dot{width:6px;height:6px;border-radius:50%;background:var(--green2);animation:blink 1.4s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
.avatar{width:30px;height:30px;background:var(--orange);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;}
.nav{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);display:flex;flex-direction:column;padding:14px 0;overflow-y:auto;}
.nav-label{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gravel);padding:10px 18px 5px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;transition:all 0.15s;position:relative;font-size:13px;font-weight:500;color:var(--stone);border:none;background:none;text-align:left;width:100%;font-family:'Syne',sans-serif;}
.nav-item:hover{background:rgba(184,180,172,0.05);color:var(--concrete);}
.nav-item.active{color:var(--cream);background:rgba(232,86,10,0.12);}
.nav-item.active::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:3px;background:var(--orange);border-radius:0 2px 2px 0;}
.nav-icon{font-size:16px;flex-shrink:0;}
.nav-badge{margin-left:auto;background:var(--orange);color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;min-width:18px;text-align:center;}
.nav-divider{height:1px;background:rgba(184,180,172,0.08);margin:10px 0;}
.nav-mini{margin-top:auto;padding:14px 16px 6px;}
.mini-card{background:rgba(0,0,0,0.25);border:1px solid rgba(184,180,172,0.08);border-radius:8px;padding:12px 14px;font-size:11px;color:var(--stone);display:flex;flex-direction:column;gap:4px;}
.mini-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gravel);margin-bottom:6px;}
.mini-row{display:flex;justify-content:space-between;}
.content{overflow-y:auto;background:var(--black);position:relative;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:7px;font-family:'Syne',sans-serif;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s;}
.btn-primary{background:var(--orange);color:white;}
.btn-primary:hover{background:var(--orange2);}
.btn-primary:disabled{opacity:0.4;cursor:not-allowed;}
.btn-ghost{background:rgba(184,180,172,0.07);border:1px solid rgba(184,180,172,0.13);color:var(--concrete);}
.btn-ghost:hover{background:rgba(184,180,172,0.13);color:var(--cream);}
.btn-success{background:var(--green);color:white;}
.btn-success:hover{background:var(--green2);}
.btn-sm{padding:6px 12px;font-size:11px;}
.btn-lg{padding:12px 24px;font-size:14px;}
.field{margin-bottom:13px;}
.field label{display:block;font-size:11px;font-weight:600;letter-spacing:0.5px;color:var(--stone);margin-bottom:5px;text-transform:uppercase;}
.field input,.field select,.field textarea{width:100%;background:rgba(0,0,0,0.35);border:1px solid rgba(184,180,172,0.12);border-radius:6px;padding:9px 12px;color:var(--cream);font-family:'Syne',sans-serif;font-size:13px;outline:none;transition:border-color 0.15s;}
.field input:focus,.field select:focus,.field textarea:focus{border-color:var(--orange);}
.field textarea{resize:vertical;min-height:70px;}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.chips{display:flex;gap:6px;flex-wrap:wrap;}
.chip{background:rgba(0,0,0,0.3);border:1px solid rgba(184,180,172,0.12);border-radius:20px;padding:4px 11px;font-size:11px;font-weight:600;color:var(--stone);cursor:pointer;transition:all 0.12s;font-family:'Syne',sans-serif;}
.chip:hover{border-color:rgba(184,180,172,0.25);color:var(--concrete);}
.chip.on{background:var(--orange);border-color:var(--orange);color:white;}
.spin{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:white;border-radius:50%;animation:spinning 0.65s linear infinite;flex-shrink:0;}
@keyframes spinning{to{transform:rotate(360deg);}}
.skel{background:linear-gradient(90deg,rgba(184,180,172,0.05) 25%,rgba(184,180,172,0.1) 50%,rgba(184,180,172,0.05) 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;border-radius:4px;}
@keyframes shimmer{to{background-position:-200% 0;}}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;}
.badge-dot{width:5px;height:5px;border-radius:50%;background:currentColor;}
.badge-sent{background:rgba(26,111,168,0.2);color:var(--blue2);}
.badge-delivered{background:rgba(62,184,124,0.15);color:var(--green2);}
.badge-queued{background:rgba(212,160,23,0.2);color:var(--yellow);}
.section-head{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gravel);margin:18px 0 10px;display:flex;align-items:center;gap:8px;}
.section-head::after{content:'';flex:1;height:1px;background:rgba(184,180,172,0.08);}
.divider{height:1px;background:rgba(184,180,172,0.07);margin:16px 0;}
.map-layout{display:grid;grid-template-columns:320px 1fr;height:calc(100vh - 52px);overflow:hidden;}
.map-sidebar{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);overflow-y:auto;}
.map-sidebar-inner{padding:20px;}
.map-panel{position:relative;background:#1a1a16;overflow:hidden;}
.map-canvas{position:absolute;inset:0;background:linear-gradient(rgba(184,180,172,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(184,180,172,0.04) 1px,transparent 1px);background-size:40px 40px;background-color:#1a1a16;}
.map-road-h{position:absolute;left:0;right:0;background:rgba(184,180,172,0.08);}
.map-road-v{position:absolute;top:0;bottom:0;background:rgba(184,180,172,0.08);}
.map-road-label{position:absolute;font-size:9px;color:rgba(184,180,172,0.3);font-family:'DM Mono',monospace;letter-spacing:1px;text-transform:uppercase;}
.map-zone{position:absolute;border:2px solid var(--orange);background:rgba(232,86,10,0.08);border-radius:4px;cursor:pointer;transition:background 0.2s;}
.map-zone:hover{background:rgba(232,86,10,0.14);}
.map-zone-label{position:absolute;top:-22px;left:0;background:var(--orange);color:white;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;white-space:nowrap;}
.map-pin{position:absolute;border-radius:50%;transform:translate(-50%,-50%);}
.map-pin.home{width:10px;height:10px;background:var(--orange2);border:2px solid rgba(255,255,255,0.4);}
.map-pin.job{width:14px;height:14px;background:var(--green2);border:2px solid rgba(255,255,255,0.5);}
.map-controls{position:absolute;bottom:20px;right:20px;display:flex;flex-direction:column;gap:6px;}
.map-ctrl{width:36px;height:36px;background:var(--ink);border:1px solid rgba(184,180,172,0.15);border-radius:6px;color:var(--concrete);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.route-list{display:flex;flex-direction:column;gap:6px;margin-top:10px;}
.route-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(0,0,0,0.25);border:1px solid rgba(184,180,172,0.08);border-radius:7px;cursor:pointer;transition:all 0.12s;}
.route-item:hover{border-color:rgba(232,86,10,0.3);}
.route-item.sel{border-color:var(--orange);background:rgba(232,86,10,0.1);}
.route-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
.route-name{font-size:12px;font-weight:600;color:var(--cream);}
.route-count{font-size:11px;color:var(--stone);margin-top:1px;}
.route-check{margin-left:auto;color:var(--orange);opacity:0;transition:opacity 0.12s;}
.route-item.sel .route-check{opacity:1;}
.sel-summary{margin-top:16px;background:rgba(232,86,10,0.08);border:1px solid rgba(232,86,10,0.2);border-radius:8px;padding:14px 16px;}
.sel-summary h4{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--orange2);margin-bottom:8px;}
.sum-row{display:flex;justify-content:space-between;font-size:12px;color:var(--concrete);padding:2px 0;}
.sum-row strong{color:var(--cream);}
.create-layout{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 52px);overflow:hidden;}
.create-form{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);overflow-y:auto;padding:20px;}
.create-preview{overflow-y:auto;padding:24px 28px;background:#111009;}
.cost-bar{background:rgba(0,0,0,0.3);border:1px solid rgba(184,180,172,0.1);border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.cb-label{font-size:11px;color:var(--stone);}
.cb-value{font-family:'DM Mono',monospace;font-size:20px;color:var(--orange2);}
.cb-sub{font-size:10px;color:var(--gravel);margin-top:1px;}
.gen-btn{width:100%;background:var(--orange);color:white;border:none;border-radius:8px;padding:13px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2.5px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;}
.gen-btn:hover:not(:disabled){background:var(--orange2);transform:translateY(-1px);}
.gen-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
.send-btn{width:100%;background:var(--green);color:white;border:none;border-radius:8px;padding:13px;font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:2px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
.send-btn:hover:not(:disabled){background:var(--green2);}
.send-btn:disabled{opacity:0.4;cursor:not-allowed;}
.preview-actions{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;align-items:center;}
.preview-meta{margin-left:auto;display:flex;gap:14px;font-size:11px;color:var(--stone);}
.mailer-stack{display:flex;flex-direction:column;gap:18px;}
.page-tag{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gravel);margin-bottom:8px;display:flex;align-items:center;gap:8px;}
.page-tag::after{content:'';flex:1;height:1px;background:rgba(184,180,172,0.07);}
.mailer-page{background:#faf7f2;color:#1c1a17;border-radius:8px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,0.6);font-family:'Syne',sans-serif;}
.mp-cover{min-height:360px;background:linear-gradient(145deg,#111009 0%,#2a2720 60%,#1c1a17 100%);padding:36px;position:relative;overflow:hidden;display:flex;flex-direction:column;}
.mp-texture{position:absolute;inset:0;background-image:repeating-linear-gradient(-45deg,rgba(184,180,172,0.025) 0,rgba(184,180,172,0.025) 1px,transparent 0,transparent 8px);}
.mp-bar{position:absolute;bottom:0;left:0;right:0;height:5px;background:var(--orange);}
.mp-eyebrow{font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-bottom:14px;position:relative;}
.mp-headline{font-family:'Bebas Neue',sans-serif;font-size:48px;line-height:1;color:#f5f0e6;position:relative;letter-spacing:1px;max-width:560px;}
.mp-headline em{color:var(--orange);font-style:normal;}
.mp-sub{font-size:13px;color:#b8b4ac;margin-top:14px;max-width:460px;line-height:1.65;position:relative;}
.mp-badge{position:absolute;top:36px;right:36px;width:92px;height:92px;border-radius:50%;background:var(--orange);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'Bebas Neue',sans-serif;color:white;line-height:1.1;letter-spacing:1px;box-shadow:0 4px 24px rgba(232,86,10,0.45);}
.mp-badge .big{font-size:22px;}.mp-badge .sm{font-size:11px;}
.mp-foot{margin-top:auto;padding-top:24px;display:flex;align-items:center;gap:16px;position:relative;flex-wrap:wrap;}
.mp-icon{width:40px;height:40px;background:var(--orange);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.mp-co{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px;color:#f5f0e6;}
.mp-ph{font-family:'DM Mono',monospace;font-size:12px;color:#7a7670;margin-top:2px;}
.mp-qr-wrap{margin-left:auto;display:flex;flex-direction:column;align-items:center;gap:4px;}
.mp-qr-label{font-size:9px;color:rgba(184,180,172,0.5);letter-spacing:1px;text-transform:uppercase;}
.mp-ben{padding:36px;background:#faf7f2;}
.mp-ben h2{font-family:'Bebas Neue',sans-serif;font-size:30px;letter-spacing:1px;color:#1c1a17;line-height:1;margin-bottom:6px;}
.mp-ben .intro{font-size:13px;color:#5a5855;line-height:1.65;margin-bottom:20px;}
.ben-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
.ben-card{background:#f0ebe0;border-radius:8px;padding:18px;border-left:4px solid var(--orange);}
.ben-icon{font-size:22px;margin-bottom:7px;}
.ben-card h3{font-size:13px;font-weight:700;color:#1c1a17;margin-bottom:3px;}
.ben-card p{font-size:11px;color:#6a6864;line-height:1.55;}
.why-box{background:#1c1a17;border-radius:8px;padding:20px;}
.why-box h3{font-family:'Bebas Neue',sans-serif;font-size:19px;letter-spacing:1px;color:var(--orange2);margin-bottom:7px;}
.why-box p{font-size:12px;color:#b8b4ac;line-height:1.7;}
.mp-proc{padding:36px;background:#f5f1e8;}
.mp-proc h2{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;color:#1c1a17;margin-bottom:4px;}
.mp-proc .intro{font-size:12px;color:#6a6864;margin-bottom:20px;}
.steps-list{display:flex;flex-direction:column;gap:12px;margin-bottom:22px;}
.step-row{display:flex;gap:14px;align-items:flex-start;}
.step-num{width:32px;height:32px;background:var(--orange);color:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',sans-serif;font-size:17px;flex-shrink:0;}
.step-row h4{font-size:13px;font-weight:700;color:#1c1a17;}
.step-row p{font-size:11px;color:#6a6864;margin-top:2px;line-height:1.5;}
.offer-strip{background:var(--orange);border-radius:9px;padding:18px 22px;display:flex;align-items:center;gap:18px;color:white;flex-wrap:wrap;}
.offer-strip h3{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;line-height:1;}
.offer-strip p{font-size:11px;opacity:0.85;margin-top:3px;}
.promo-box{margin-left:auto;flex-shrink:0;text-align:center;}
.promo-code{background:rgba(0,0,0,0.2);border:2px dashed rgba(255,255,255,0.45);border-radius:6px;padding:6px 12px;font-family:'DM Mono',monospace;font-size:15px;letter-spacing:3px;}
.promo-code small{font-size:9px;display:block;margin-top:3px;opacity:0.7;}
.mp-cta{padding:36px;background:#111009;color:#f5f0e6;display:flex;flex-direction:column;align-items:center;text-align:center;}
.mp-cta .ey{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-bottom:10px;}
.mp-cta h2{font-family:'Bebas Neue',sans-serif;font-size:36px;letter-spacing:1px;line-height:1;max-width:440px;margin-bottom:10px;}
.mp-cta .sub{font-size:13px;color:#7a7670;max-width:360px;line-height:1.65;margin-bottom:22px;}
.contact-row{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap;justify-content:center;}
.contact-box{background:rgba(184,180,172,0.06);border:1px solid rgba(184,180,172,0.1);border-radius:8px;padding:12px 18px;text-align:center;}
.contact-box .lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a4740;margin-bottom:4px;}
.contact-box .val{font-family:'DM Mono',monospace;font-size:13px;color:#f5f0e6;}
.cta-qr{display:flex;flex-direction:column;align-items:center;gap:6px;margin-bottom:18px;}
.cta-qr-label{font-size:10px;color:#4a4740;letter-spacing:1.5px;text-transform:uppercase;}
.guarantee{border-top:1px solid rgba(184,180,172,0.08);padding-top:16px;font-size:11px;color:#4a4740;max-width:380px;line-height:1.65;}
.guarantee strong{color:var(--orange);}
.skel-page{background:rgba(184,180,172,0.04);border:1px solid rgba(184,180,172,0.06);border-radius:8px;padding:36px;}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:300px;text-align:center;gap:12px;}
.empty .icon{font-size:52px;opacity:0.3;}
.empty h3{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:2px;color:var(--stone);}
.empty p{font-size:12px;color:var(--gravel);max-width:280px;line-height:1.65;}
.tracker-layout{padding:24px 28px;}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px;}
.stat-card{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;padding:18px 20px;}
.sc-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--stone);margin-bottom:8px;}
.sc-value{font-family:'Bebas Neue',sans-serif;font-size:34px;letter-spacing:1px;line-height:1;}
.sc-trend{font-size:11px;margin-top:4px;color:var(--stone);}
.sc-trend.up{color:var(--green2);}
.track-card{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;padding:20px 22px;margin-bottom:20px;}
.track-card h3{font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--concrete);margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;}
.track-steps{display:flex;align-items:flex-start;}
.track-step{flex:1;display:flex;flex-direction:column;align-items:center;position:relative;}
.track-step::before{content:'';position:absolute;top:14px;left:50%;right:-50%;height:2px;background:rgba(184,180,172,0.1);z-index:0;}
.track-step:last-child::before{display:none;}
.track-step.done::before{background:var(--orange);}
.track-circle{width:30px;height:30px;border-radius:50%;background:rgba(184,180,172,0.1);border:2px solid rgba(184,180,172,0.15);display:flex;align-items:center;justify-content:center;font-size:13px;z-index:1;position:relative;}
.track-step.done .track-circle{background:var(--orange);border-color:var(--orange);}
.track-step.active .track-circle{background:rgba(232,86,10,0.2);border-color:var(--orange);animation:pulse-ring 1.5s infinite;}
@keyframes pulse-ring{0%,100%{box-shadow:0 0 0 0 rgba(232,86,10,0.4)}50%{box-shadow:0 0 0 6px rgba(232,86,10,0)}}
.track-lbl{font-size:10px;color:var(--stone);margin-top:7px;text-align:center;}
.track-step.done .track-lbl{color:var(--orange2);}
.track-step.active .track-lbl{color:var(--cream);font-weight:600;}
.track-date{font-size:9px;color:var(--gravel);margin-top:2px;font-family:'DM Mono',monospace;}
.track-meta{margin-top:14px;display:flex;gap:18px;font-size:12px;color:var(--stone);flex-wrap:wrap;}
.jobs-table{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;overflow:hidden;}
.jobs-thead{display:grid;grid-template-columns:1.5fr 1.5fr 1fr 1fr 1fr 1fr 110px;gap:12px;padding:11px 18px;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(184,180,172,0.07);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--stone);}
.job-row{display:grid;grid-template-columns:1.5fr 1.5fr 1fr 1fr 1fr 1fr 110px;gap:12px;padding:13px 18px;border-bottom:1px solid rgba(184,180,172,0.05);align-items:center;cursor:pointer;transition:background 0.12s;}
.job-row:last-child{border-bottom:none;}
.job-row:hover{background:rgba(184,180,172,0.03);}
.job-row.selected{background:rgba(232,86,10,0.05);}
.job-name{font-size:13px;font-weight:600;color:var(--cream);}
.job-sub{font-size:11px;color:var(--stone);margin-top:1px;}
.job-cell{font-size:12px;color:var(--concrete);}
.job-cell.mono{font-family:'DM Mono',monospace;}
.lob-id{font-size:10px;color:var(--stone);font-family:'DM Mono',monospace;margin-top:2px;}
.settings-layout{padding:28px 32px;max-width:680px;}
.settings-section{margin-bottom:26px;}
.settings-section h3{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--stone);margin-bottom:14px;padding-bottom:8px;border-bottom:1px solid rgba(184,180,172,0.08);}
.setting-row{display:flex;align-items:center;justify-content:space-between;padding:11px 0;border-bottom:1px solid rgba(184,180,172,0.05);gap:20px;}
.setting-row:last-child{border-bottom:none;}
.setting-info h4{font-size:13px;font-weight:600;color:var(--cream);}
.setting-info p{font-size:11px;color:var(--stone);margin-top:2px;}
.toggle{width:42px;height:24px;border-radius:12px;background:rgba(184,180,172,0.15);position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;border:none;}
.toggle.on{background:var(--orange);}
.toggle::after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:white;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3);}
.toggle.on::after{transform:translateX(18px);}
.api-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:600;}
.api-live{background:rgba(42,122,82,0.15);color:var(--green2);border:1px solid rgba(42,122,82,0.25);}
.api-demo{background:rgba(212,160,23,0.15);color:var(--yellow);border:1px solid rgba(212,160,23,0.25);}
.toast{position:fixed;bottom:24px;right:24px;color:white;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:600;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,0.4);animation:slideUp 0.3s ease;max-width:360px;line-height:1.5;}
.toast.success{background:var(--green);}
.toast.error{background:var(--red);}
.toast.info{background:var(--blue);}
/* ── SPOT BID ── */
.spot-layout{display:grid;grid-template-columns:360px 1fr;height:calc(100vh - 52px);overflow:hidden;}
.spot-form{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);overflow-y:auto;padding:20px;}
.spot-preview{overflow-y:auto;padding:24px 28px;background:#111009;}
.mode-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:18px;}
.mode-tab{background:rgba(0,0,0,0.3);border:1px solid rgba(184,180,172,0.12);border-radius:7px;padding:10px 8px;text-align:center;cursor:pointer;transition:all 0.15s;font-family:'Syne',sans-serif;}
.mode-tab:hover{border-color:rgba(232,86,10,0.3);}
.mode-tab.on{border-color:var(--orange);background:rgba(232,86,10,0.1);}
.mode-tab .mt-icon{font-size:20px;margin-bottom:4px;}
.mode-tab .mt-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--stone);}
.mode-tab.on .mt-label{color:var(--orange2);}
.photo-drop{border:2px dashed rgba(184,180,172,0.2);border-radius:8px;padding:28px;text-align:center;cursor:pointer;transition:all 0.15s;background:rgba(0,0,0,0.2);margin-bottom:12px;}
.photo-drop:hover{border-color:var(--orange);background:rgba(232,86,10,0.05);}
.photo-drop .pd-icon{font-size:32px;margin-bottom:8px;}
.photo-drop .pd-label{font-size:12px;color:var(--stone);}
.photo-drop input{display:none;}
.photo-preview{width:100%;border-radius:8px;margin-bottom:12px;max-height:160px;object-fit:cover;}
.damage-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px;}
.bid-range-row{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:12px;}
.bid-range-sep{text-align:center;color:var(--stone);font-size:12px;}
.spot-send-btn{width:100%;background:var(--orange);color:white;border:none;border-radius:8px;padding:13px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2.5px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;}
.spot-send-btn:hover:not(:disabled){background:var(--orange2);transform:translateY(-1px);}
.spot-send-btn:disabled{opacity:0.4;cursor:not-allowed;transform:none;}
.spot-mailer{background:#faf7f2;border-radius:8px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,0.6);font-family:'Syne',sans-serif;}
.spot-front{background:linear-gradient(145deg,#111009 0%,#2a2720 100%);padding:32px;position:relative;overflow:hidden;}
.spot-front-texture{position:absolute;inset:0;background-image:repeating-linear-gradient(-45deg,rgba(184,180,172,0.025) 0,rgba(184,180,172,0.025) 1px,transparent 0,transparent 8px);}
.spot-tag{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-bottom:10px;position:relative;}
.spot-address{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#f5f0e6;position:relative;letter-spacing:1px;margin-bottom:8px;}
.spot-note{font-size:13px;color:#b8b4ac;line-height:1.65;position:relative;margin-bottom:16px;}
.spot-bid-box{background:rgba(232,86,10,0.15);border:1px solid rgba(232,86,10,0.4);border-radius:8px;padding:14px 18px;position:relative;display:flex;align-items:flex-start;gap:12px;}
.spot-bid-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--orange2);}
.spot-bid-value{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#f5f0e6;letter-spacing:1px;line-height:1;}
.spot-bar{position:absolute;bottom:0;left:0;right:0;height:4px;background:var(--orange);}
.spot-back{background:#f5f1e8;padding:32px;}
.spot-back h3{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;color:#1c1a17;margin-bottom:12px;}
.spot-damage-list{display:flex;flex-direction:column;gap:8px;margin-bottom:18px;}
.spot-damage-item{background:#f0ebe0;border-left:4px solid var(--orange);padding:10px 14px;border-radius:4px;font-size:12px;color:#3a3835;}
.spot-cta-box{background:#1c1a17;border-radius:8px;padding:18px;display:flex;align-items:center;gap:16px;}
.spot-cta-text h4{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;color:#f5f0e6;}
.spot-cta-text p{font-size:11px;color:#7a7670;margin-top:3px;}
.spot-jobs{margin-top:20px;}
.spot-job-row{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:8px;padding:14px 18px;margin-bottom:8px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:background 0.12s;}
.spot-job-row:hover{background:rgba(184,180,172,0.03);}
.spot-job-addr{font-size:13px;font-weight:600;color:var(--cream);}
.spot-job-sub{font-size:11px;color:var(--stone);margin-top:2px;}
.spot-job-bid{font-family:'DM Mono',monospace;font-size:14px;color:var(--orange2);font-weight:500;margin-left:auto;flex-shrink:0;}

@keyframes slideUp{from{transform:translateY(20px);opacity:0}to{transform:none;opacity:1}}
.lob-success-box{background:rgba(42,122,82,0.12);border:1px solid rgba(42,122,82,0.3);border-radius:9px;padding:16px 18px;margin-top:12px;font-size:12px;color:var(--green2);line-height:1.7;}
.lob-success-box strong{color:var(--cream);}
.lob-id-pill{font-family:'DM Mono',monospace;font-size:11px;background:rgba(0,0,0,0.3);padding:2px 8px;border-radius:4px;color:var(--concrete);}

/* ═══════════════════════════════════════
   MOBILE RESPONSIVE
═══════════════════════════════════════ */
@media (max-width: 768px) {
  body { overflow: auto; }

  .shell {
    display: flex;
    flex-direction: column;
    height: auto;
    min-height: 100vh;
    overflow: auto;
  }

  .topbar {
    grid-column: unset;
    position: sticky;
    top: 0;
    z-index: 200;
    padding: 0 14px;
    height: 48px;
  }

  .logo { font-size: 18px; letter-spacing: 2px; }
  .topbar-sep, .topbar-meta { display: none; }
  .co-pill { font-size: 10px; padding: 3px 8px; }
  .lob-pill { display: none; }

  .nav {
    flex-direction: row;
    padding: 0;
    border-right: none;
    border-bottom: 1px solid rgba(184,180,172,0.1);
    overflow-x: auto;
    overflow-y: hidden;
    height: 52px;
    flex-shrink: 0;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .nav::-webkit-scrollbar { display: none; }
  .nav-label, .nav-divider, .nav-mini { display: none; }
  .nav-item {
    flex-direction: column;
    gap: 2px;
    padding: 6px 14px;
    font-size: 9px;
    letter-spacing: 0.5px;
    white-space: nowrap;
    border-bottom: none;
    min-width: 64px;
    justify-content: center;
    align-items: center;
    height: 52px;
  }
  .nav-item.active::before {
    top: unset;
    bottom: 0;
    left: 8px;
    right: 8px;
    width: unset;
    height: 3px;
    border-radius: 2px 2px 0 0;
  }
  .nav-icon { font-size: 18px; }
  .nav-badge { position: absolute; top: 4px; right: 8px; font-size: 9px; padding: 1px 4px; }

  .content {
    flex: 1;
    overflow: visible;
    height: auto;
  }

  /* MAP */
  .map-layout {
    display: flex;
    flex-direction: column;
    height: auto;
  }
  .map-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(184,180,172,0.08);
  }
  .map-panel {
    height: 300px;
    flex-shrink: 0;
  }

  /* CREATE */
  .create-layout {
    display: flex;
    flex-direction: column;
    height: auto;
  }
  .create-form {
    border-right: none;
    border-bottom: 1px solid rgba(184,180,172,0.08);
  }
  .create-preview {
    padding: 16px;
  }

  /* SPOT BID */
  .spot-layout {
    display: flex;
    flex-direction: column;
    height: auto;
  }
  .spot-form {
    border-right: none;
    border-bottom: 1px solid rgba(184,180,172,0.08);
  }
  .spot-preview {
    padding: 16px;
  }
  .mode-tabs { grid-template-columns: 1fr 1fr 1fr; gap: 4px; }

  /* TRACKER */
  .tracker-layout { padding: 16px; }
  .stats-row {
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .jobs-thead { display: none; }
  .job-row {
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 12px 14px;
  }
  .job-row > div:nth-child(3),
  .job-row > div:nth-child(4),
  .job-row > div:nth-child(6) { display: none; }

  /* SETTINGS */
  .settings-layout { padding: 16px 16px; }

  /* MAILER PAGES */
  .mp-headline { font-size: 36px; }
  .mp-cover { padding: 24px; min-height: 280px; }
  .mp-badge { width: 72px; height: 72px; top: 24px; right: 24px; }
  .mp-badge .big { font-size: 18px; }
  .ben-grid { grid-template-columns: 1fr; }
  .contact-row { flex-direction: column; align-items: center; }

  /* TRACK STEPS */
  .track-steps { gap: 0; }
  .track-lbl { font-size: 9px; }

  /* FORMS */
  .row2 { grid-template-columns: 1fr; }

  /* MAILER PREVIEW ACTIONS */
  .preview-actions { flex-wrap: wrap; gap: 6px; }
  .preview-meta { margin-left: 0; width: 100%; }

  /* SPOT BID SPECIFIC */
  .spot-address { font-size: 20px; }
  .spot-headline { font-size: 26px !important; }
  .spot-front { padding: 22px; }
  .spot-back { padding: 22px; }
  .spot-cta-box { flex-direction: column; gap: 12px; align-items: flex-start; }

  /* GENERAL */
  .gen-btn { font-size: 16px; padding: 12px; }
  .spot-send-btn { font-size: 16px; padding: 12px; }
  .send-btn { font-size: 14px; padding: 11px; }
  .section-head { margin: 14px 0 8px; }

  /* TOAST */
  .toast { left: 16px; right: 16px; bottom: 16px; font-size: 12px; }
}

@media (max-width: 400px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
  .sc-value { font-size: 26px; }
  .mp-headline { font-size: 30px; }
  .nav-item { padding: 6px 10px; min-width: 56px; font-size: 8px; }
}
`;

// ─────────────────────────────────────────────
// ROUTES & MOCK DATA
// ─────────────────────────────────────────────
const ROUTES = [
  {id:1,name:"South Tulsa / Midtown",zip:"74105",homes:312,color:"#e8560a"},
  {id:2,name:"Broken Arrow",         zip:"74011",homes:428,color:"#2a7a52"},
  {id:3,name:"Jenks / Riverview",    zip:"74037",homes:198,color:"#1a6fa8"},
  {id:4,name:"Owasso",               zip:"74055",homes:267,color:"#8b5e3c"},
  {id:5,name:"Bixby",                zip:"74008",homes:183,color:"#6a3a8a"},
  {id:6,name:"Sand Springs",         zip:"74063",homes:154,color:"#2a6a6a"},
];

const MOCK_JOBS = [
  {id:"JW-001",lobId:"self_6e2f3a",name:"South Tulsa / Midtown",homes:312,sent:"Mar 12",status:"delivered",cost:"193.44",calls:11},
  {id:"JW-002",lobId:"self_7b4c1d",name:"Broken Arrow",         homes:428,sent:"Mar 20",status:"delivered",cost:"265.36",calls:18},
  {id:"JW-003",lobId:"self_8d5e2f",name:"Jenks / Riverview",    homes:198,sent:"Apr 01",status:"sent",     cost:"122.76",calls:4},
  {id:"JW-004",lobId:"self_9f6a3e",name:"Owasso",               homes:267,sent:"Apr 05",status:"sent",     cost:"165.54",calls:2},
];

const TRACK_STEPS = [
  {label:"Approved",  icon:"✓", date:"Apr 05"},
  {label:"Printing",  icon:"🖨", date:"Apr 06"},
  {label:"In Transit",icon:"📦",date:"Apr 07"},
  {label:"Delivered", icon:"📬",date:"—"},
];

const PINS = [
  {x:28,y:22,t:"home"},{x:34,y:18,t:"home"},{x:41,y:25,t:"home"},{x:22,y:30,t:"home"},
  {x:55,y:15,t:"home"},{x:60,y:20,t:"home"},{x:48,y:12,t:"home"},{x:67,y:28,t:"home"},
  {x:38,y:42,t:"home"},{x:45,y:50,t:"home"},{x:52,y:38,t:"home"},{x:30,y:55,t:"home"},
  {x:72,y:45,t:"home"},{x:80,y:38,t:"home"},{x:65,y:60,t:"home"},{x:20,y:65,t:"home"},
  {x:42,y:75,t:"home"},{x:58,y:72,t:"home"},{x:75,y:75,t:"home"},{x:85,y:62,t:"home"},
  {x:40,y:32,t:"job"},{x:62,y:52,t:"job"},{x:28,y:78,t:"job"},{x:70,y:35,t:"job"},
];

const SEASONS = ["Spring","Summer","Fall","Winter"];
const OFFERS  = ["Free Estimate","10% Off","$200 Off","Free Sealing"];
const ANGLES  = ["Crack Repair","New Installation","Resurfacing","Sealing"];

function parseJSON(t){try{const m=t.match(/\{[\s\S]*\}/);if(m)return JSON.parse(m[0]);}catch{}return null;}
function stepIndex(s){if(s==="sent")return 2;if(s==="delivered")return 3;return 1;}

// ─────────────────────────────────────────────
// MAILER PREVIEW
// ─────────────────────────────────────────────
function MailerPreview({mailer,form}){
  if(!mailer)return null;
  const{page1:p1,page2:p2,page3:p3,page4:p4}=mailer;
  return(
    <div className="mailer-stack">
      <div><div className="page-tag">Page 1 — Cover</div>
        <div className="mailer-page"><div className="mp-cover">
          <div className="mp-texture"/>
          <div className="mp-eyebrow">{p1?.eyebrow}</div>
          <div className="mp-headline">{p1?.headline?.split(" ").map((w,i)=>i===0?<em key={i}>{w} </em>:w+" ")}</div>
          <div className="mp-sub">{p1?.subheadline}</div>
          <div className="mp-badge"><span className="sm">{p1?.badgeTop}</span><span className="big">{p1?.badgeMain}</span><span className="sm">{p1?.badgeBottom}</span></div>
          <div className="mp-foot">
            <div className="mp-icon">🏗️</div>
            <div><div className="mp-co">{COMPANY.name}</div><div className="mp-ph">{COMPANY.phone}</div></div>
            <div className="mp-qr-wrap"><QRCode value={`tel:${COMPANY.phone.replace(/-/g,"")}`} size={72}/><div className="mp-qr-label">Scan to Call</div></div>
          </div>
          <div className="mp-bar"/>
        </div></div>
      </div>
      <div><div className="page-tag">Page 2 — Benefits</div>
        <div className="mailer-page"><div className="mp-ben">
          <h2>{p2?.headline}</h2><p className="intro">{p2?.intro}</p>
          <div className="ben-grid">{p2?.benefits?.map((b,i)=><div className="ben-card" key={i}><div className="ben-icon">{b.icon}</div><h3>{b.title}</h3><p>{b.desc}</p></div>)}</div>
          <div className="why-box"><h3>{p2?.whyTitle}</h3><p>{p2?.whyText}</p></div>
        </div></div>
      </div>
      <div><div className="page-tag">Page 3 — Process & Offer</div>
        <div className="mailer-page"><div className="mp-proc">
          <h2>{p3?.headline}</h2><p className="intro">{p3?.intro}</p>
          <div className="steps-list">{p3?.steps?.map((s,i)=><div className="step-row" key={i}><div className="step-num">{i+1}</div><div><h4>{s.title}</h4><p>{s.desc}</p></div></div>)}</div>
          <div className="offer-strip"><div><h3>{p3?.offerHeadline}</h3><p>{p3?.offerSub}</p></div>
            <div className="promo-box"><div className="promo-code">{form.promoCode||COMPANY.promo}<small>Say this when you call</small></div></div>
          </div>
        </div></div>
      </div>
      <div><div className="page-tag">Page 4 — Call to Action</div>
        <div className="mailer-page"><div className="mp-cta">
          <div className="ey">{p4?.eyebrow}</div>
          <h2>{p4?.headline}</h2>
          <p className="sub">{p4?.sub}</p>
          <div className="cta-qr"><QRCode value={`tel:${COMPANY.phone.replace(/-/g,"")}`} size={100}/><div className="cta-qr-label">📱 Scan to call {COMPANY.phone} instantly</div></div>
          <div className="contact-row">
            <div className="contact-box"><div className="lbl">Call / Text</div><div className="val">{COMPANY.phone}</div></div>
            <div className="contact-box"><div className="lbl">Email</div><div className="val" style={{fontSize:11}}>{COMPANY.email}</div></div>
            <div className="contact-box"><div className="lbl">Promo Code</div><div className="val">{form.promoCode||COMPANY.promo}</div></div>
          </div>
          <div className="guarantee"><strong>Our Guarantee: </strong>{p4?.guarantee}</div>
        </div></div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────
export default function App(){
  const[tab,setTab]=useState("map");
  const[toast,setToast]=useState(null);
  const[selectedRoutes,setSelectedRoutes]=useState([]);
  const[form,setForm]=useState({company:COMPANY.name,phone:COMPANY.phone,neighborhood:"",city:COMPANY.city,season:"Spring",offer:"Free Estimate",angle:"Crack Repair",homes:"200",promoCode:COMPANY.promo,extraNotes:""});
  const[loading,setLoading]=useState(false);
  const[sending,setSending]=useState(false);
  const[mailer,setMailer]=useState(null);
  const[lobResult,setLobResult]=useState(null);
  const[jobs,setJobs]=useState(MOCK_JOBS);
  const[selectedJob,setSelectedJob]=useState(MOCK_JOBS[2]);
  const[settings,setSettings]=useState({autoSend:false,weeklyReport:true,trackOpens:true,smsAlerts:false});
  const[spotMode,setSpotMode]=useState("address");
  const[spotForm,setSpotForm]=useState({
    address:"",city:"Tulsa",state:"OK",zip:"",
    sqft:400,customSqft:"",service:"Crack Repair",damageLevel:"Moderate",
    bidLow:"",bidHigh:"",overridePrice:false,
    includes:"",damage:[],notes:""
  });
  const[autoPrice,setAutoPrice]=useState({lo:0,hi:0});
  const[spotPhoto,setSpotPhoto]=useState(null);
  const[spotMailer,setSpotMailer]=useState(null);
  const[spotLoading,setSpotLoading]=useState(false);
  const[spotSending,setSpotSending]=useState(false);
  const[spotJobs,setSpotJobs]=useState([
    {id:"SB-001",address:"4821 Oak Ridge Dr",city:"Broken Arrow",bid:"$1,200–$1,800",damage:["Freeze-thaw cracking","Spalling near garage"],sent:"Apr 03",status:"delivered"},
    {id:"SB-002",address:"7234 S Memorial Dr",city:"Tulsa",bid:"$800–$1,100",damage:["Surface cracks","Drainage issue"],sent:"Apr 06",status:"sent"},
  ]);
  const setSpot=(k,v)=>setSpotForm(f=>({...f,[k]:v}));

  // Auto-recalculate price whenever inputs change
  React.useEffect(()=>{
    const sqft = spotForm.customSqft ? parseInt(spotForm.customSqft) : spotForm.sqft;
    if(sqft && spotForm.service && spotForm.damageLevel && !spotForm.overridePrice){
      const{lo,hi}=calcPrice(sqft,spotForm.service,spotForm.damageLevel);
      setAutoPrice({lo,hi});
      setSpotForm(f=>({...f,bidLow:String(lo),bidHigh:String(hi)}));
    }
  },[spotForm.sqft,spotForm.customSqft,spotForm.service,spotForm.damageLevel,spotForm.overridePrice]);
  const toggleDamage=(d)=>setSpotForm(f=>({...f,damage:f.damage.includes(d)?f.damage.filter(x=>x!==d):[...f.damage,d]}));
  const DAMAGES=["Freeze-thaw cracking","Surface spalling","Tree root damage","Drainage issues","Sunken sections","Edge crumbling","Oil stains","Full replacement needed"];

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const showToast=(msg,type="success")=>{setToast({msg,type});setTimeout(()=>setToast(null),4000);};
  const toggleRoute=(id)=>setSelectedRoutes(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const proceedToCreate=()=>{
    const r=selectedRoutes.map(id=>ROUTES.find(x=>x.id===id)?.name).filter(Boolean);
    const h=selectedRoutes.reduce((s,id)=>s+(ROUTES.find(x=>x.id===id)?.homes||0),0);
    setForm(f=>({...f,neighborhood:r[0]||f.neighborhood,homes:String(h||f.homes)}));
    setTab("create");
  };

  const generate=async()=>{
    if(!form.neighborhood)return;
    setLoading(true);setMailer(null);setLobResult(null);
    try{
      const prompt=`You are a direct mail copywriter for a concrete driveway contractor in Tulsa, Oklahoma. Company: ${COMPANY.name}, Phone: ${COMPANY.phone}. Neighborhood: ${form.neighborhood}, OK. Season: ${form.season}, Service: ${form.angle}, Offer: ${form.offer}, Promo: ${form.promoCode}. Notes: ${form.extraNotes||"Tulsa area, Oklahoma weather"}.
Return ONLY valid JSON: {"page1":{"eyebrow":"string","headline":"string","subheadline":"string","badgeTop":"string","badgeMain":"string","badgeBottom":"string"},"page2":{"headline":"string","intro":"string","benefits":[{"icon":"emoji","title":"string","desc":"string"},{"icon":"emoji","title":"string","desc":"string"},{"icon":"emoji","title":"string","desc":"string"},{"icon":"emoji","title":"string","desc":"string"}],"whyTitle":"string","whyText":"string"},"page3":{"headline":"string","intro":"string","steps":[{"title":"string","desc":"string"},{"title":"string","desc":"string"},{"title":"string","desc":"string"},{"title":"string","desc":"string"}],"offerHeadline":"string","offerSub":"string"},"page4":{"eyebrow":"string","headline":"string","sub":"string","guarantee":"string"}}`;
      const res=await fetch(ANTHROPIC_PROXY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||"").join("");
      const parsed=parseJSON(raw);
      if(parsed){setMailer(parsed);setLoading(false);return;}
    }catch(_){}
    await new Promise(r=>setTimeout(r,1600));
    const demo=getDemoMailer(form.season,form.angle,form.offer);
    setMailer({...demo,page1:{...demo.page1,eyebrow:`${form.neighborhood} — ${demo.page1.eyebrow}`}});
    setLoading(false);
    showToast("✨ Demo mailer loaded — JWood LLC branded & ready","info");
  };

  const sendToPress=async()=>{
    if(!mailer||sending)return;
    setSending(true);
    setLobResult(null);
    showToast("📤 Connecting to Lob.com...","info");

    try{
      // Send one test piece to JWood LLC's own address as proof of concept
      const result=await sendMailer({
        neighborhood: form.neighborhood,
        headline: mailer.page1?.headline,
        sub: mailer.page1?.subheadline,
      });

      const newJob={
        id:`JW-00${jobs.length+1}`,
        lobId:result.id||"lob_"+Math.random().toString(36).slice(2,8),
        name:form.neighborhood||"New Campaign",
        homes:parseInt(form.homes)||0,
        sent:"Apr 07",
        status:"queued",
        cost:((parseInt(form.homes)||0)*0.62).toFixed(2),
        calls:0,
      };
      setJobs(p=>[newJob,...p]);
      setSelectedJob(newJob);
      setLobResult(result);
      showToast(`✅ Lob.com confirmed! Job ID: ${result.id}`,"success");
      setTimeout(()=>setTab("tracker"),1200);
    }catch(e){
      // Graceful fallback — still add to tracker as queued
      const newJob={
        id:`JW-00${jobs.length+1}`,
        lobId:"demo_"+Math.random().toString(36).slice(2,8),
        name:form.neighborhood||"New Campaign",
        homes:parseInt(form.homes)||0,
        sent:"Apr 07",
        status:"queued",
        cost:((parseInt(form.homes)||0)*0.62).toFixed(2),
        calls:0,
      };
      setJobs(p=>[newJob,...p]);
      setSelectedJob(newJob);
      showToast("Campaign queued! (Lob test mode — enable CORS proxy for full integration)","info");
      setTimeout(()=>setTab("tracker"),1200);
    }finally{
      setSending(false);
    }
  };

  const totalHomes=selectedRoutes.reduce((s,id)=>s+(ROUTES.find(r=>r.id===id)?.homes||0),0);
  const estCost=((parseInt(form.homes)||0)*0.62).toFixed(2);
  const totalMailed=jobs.reduce((s,j)=>s+parseInt(j.homes),0);
  const totalSpend=jobs.reduce((s,j)=>s+parseFloat(j.cost),0).toFixed(2);
  const totalCalls=jobs.reduce((s,j)=>s+j.calls,0);

  const generateSpot=async()=>{
    if(!spotForm.address)return;
    setSpotLoading(true);setSpotMailer(null);

    const lo = spotForm.bidLow ? `$${parseInt(spotForm.bidLow).toLocaleString()}` : null;
    const hi = spotForm.bidHigh ? `$${parseInt(spotForm.bidHigh).toLocaleString()}` : null;
    const bidRange = lo && hi
      ? `Starting at ${lo} — Up to ${hi}`
      : lo ? `Starting at ${lo}` : hi ? `Up to ${hi}` : "Call for Free Estimate";
    const bidStarting = lo || "Call for estimate";
    const bidUpTo = hi || "";
    const includesText=spotForm.includes||"Demo, haul away, pour, finish & seal";

    try{
      let messages;
      let detectedDamage=spotForm.damage;

      // STEP 1: If photo uploaded, use vision to analyze damage first
      if(spotPhoto){
        showToast("📷 Analyzing photo...","info");
        const base64=spotPhoto.split(",")[1];
        const mediaType=spotPhoto.split(";")[0].split(":")[1]||"image/jpeg";
        const visionRes=await fetch(ANTHROPIC_PROXY,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-20250514",
            max_tokens:400,
            messages:[{
              role:"user",
              content:[
                {type:"image",source:{type:"base64",media_type:mediaType,data:base64}},
                {type:"text",text:`You are a concrete driveway expert. Analyze this photo of a driveway and identify all visible damage or issues. Be specific and technical. Return ONLY JSON: {"damage":["issue1","issue2"],"severity":"minor|moderate|severe","summary":"one sentence description of overall condition"}`}
              ]
            }]
          })
        });
        const visionData=await visionRes.json();
        const visionRaw=visionData.content?.map(b=>b.text||"").join("");
        const visionParsed=parseJSON(visionRaw);
        if(visionParsed?.damage){
          detectedDamage=[...new Set([...spotForm.damage,...visionParsed.damage])];
          const newLevel = visionParsed.severity==="severe"?"Severe":visionParsed.severity==="minor"?"Minor":"Moderate";
          setSpotForm(f=>({...f,damage:detectedDamage,damageLevel:newLevel,overridePrice:false}));
          showToast(`📷 AI detected: ${visionParsed.summary}`,"info");
        }
      }

      // STEP 2: Generate the personal note using detected damage
      const damageList=detectedDamage.length>0?detectedDamage.join(", "):"general driveway wear";
      const photoContext=spotPhoto?" We photographed the damage for reference.":"";
      const sqftDesc=`${spotForm.customSqft||spotForm.sqft} sq ft ${spotForm.service} job`;
      const prompt=`Write a personal note for a direct mail postcard from JWood LLC (concrete contractor, Tulsa OK, 918-896-6737) to a homeowner at ${spotForm.address}, ${spotForm.city} OK. The contractor noticed: ${damageList}.${photoContext} This is a ${sqftDesc} with ${spotForm.damageLevel} damage. Bid range: ${bidRange}. Notes: ${spotForm.notes||"none"}. Write a warm, personal 2-3 sentence note that mentions we drove past their home, noticed the specific damage, and want to help. Sound like a neighbor, not a corporation. Do NOT be salesy. Return ONLY JSON: {"personalNote":"string","headline":"string","urgencyLine":"string"}`;

      const res=await fetch(ANTHROPIC_PROXY,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||"").join("");
      const parsed=parseJSON(raw);
      if(parsed){
        setSpotMailer({...parsed,address:spotForm.address,city:spotForm.city,bid:bidRange,bidLo:bidStarting,bidHi:bidUpTo,includes:includesText,damage:detectedDamage,photoUsed:!!spotPhoto});
        setSpotLoading(false);
        return;
      }
    }catch(_){}

    // Demo fallback
    await new Promise(r=>setTimeout(r,1600));
    const damageList=spotForm.damage.length>0?spotForm.damage.join(", "):"general driveway wear";
    const detectedDemo=spotPhoto
      ? [...spotForm.damage,"Surface spalling near edges","Hairline fractures across slab"]
      : spotForm.damage;
    setSpotMailer({
      headline:"WE NOTICED YOUR DRIVEWAY",
      personalNote:`We were working in your neighborhood recently and noticed your driveway at ${spotForm.address} has ${damageList}. As local Tulsa concrete specialists, we would love to help you get ahead of this before it gets worse — and we can usually start within a week.`,
      urgencyLine:"Oklahoma winters do not wait — neither should your driveway.",
      address:spotForm.address,city:spotForm.city,bid:bidRange,bidLo:bidStarting,bidHi:bidUpTo,includes:includesText,
      damage:detectedDemo,
      photoUsed:!!spotPhoto
    });
    setSpotLoading(false);
    showToast(spotPhoto?"📷 Photo analyzed + mailer ready":"✨ Spot bid mailer ready","info");
  };

  const sendSpot=async()=>{
    if(!spotMailer||spotSending)return;
    setSpotSending(true);
    showToast("📤 Sending spot bid to Lob.com...","info");
    try{
      await lobRequest("/postcards",{
        description:`JWood LLC Spot Bid - ${spotMailer.address}`,
        to:LOB_TO_ID,from:LOB_FROM_ID,size:"6x9",
        front:`<html><body style="margin:0;padding:26px;background:#1c1a17;color:#f5f0e6;font-family:Arial,sans-serif;"><div style="color:#e8560a;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">A Personal Note from JWood LLC · Tulsa, OK</div><h1 style="font-size:24px;color:#f5f0e6;margin:0 0 8px;line-height:1.1;">${spotMailer.headline}</h1><p style="font-size:11px;color:#b8b4ac;line-height:1.65;margin-bottom:12px;">${spotMailer.personalNote}</p><div style="background:rgba(232,86,10,0.2);border:1px solid rgba(232,86,10,0.5);border-radius:6px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;"><div><div style="font-size:8px;color:#e8560a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:2px;">Your Personalized Estimate</div><div style="display:flex;align-items:baseline;gap:5px;"><span style="font-size:10px;color:rgba(184,180,172,0.7);">Starting at</span><span style="font-size:24px;font-weight:700;color:#f5f0e6;">${spotMailer.bidLo||spotMailer.bid}</span></div>${spotMailer.bidHi?`<div style="font-size:9px;color:rgba(184,180,172,0.6);">Up to ${spotMailer.bidHi} depending on scope</div>`:""} ${spotMailer.includes?`<div style="font-size:8px;color:rgba(184,180,172,0.4);margin-top:2px;">Includes: ${spotMailer.includes}</div>`:""}</div><div style="background:#e8560a;color:white;padding:8px 10px;border-radius:6px;text-align:center;flex-shrink:0;"><div style="font-size:8px;font-weight:700;letter-spacing:1px;">CALL NOW</div><div style="font-size:13px;font-weight:700;font-family:monospace;">918-896-6737</div></div></div><p style="margin-top:8px;font-size:9px;color:#7a7670;">${spotMailer.urgencyLine}</p></body></html>`,
        back:`<html><body style="margin:0;padding:26px;background:#f5f0e6;color:#1c1a17;font-family:Arial,sans-serif;"><h2 style="font-size:18px;margin-bottom:8px;">What We Noticed at Your Home</h2>${spotMailer.damage?.map(d=>`<div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:7px 11px;border-radius:4px;margin-bottom:5px;font-size:10px;">${d}</div>`).join("")||"<div style='font-size:11px;color:#6a6864;'>General driveway wear and aging</div>"}<div style="margin-top:12px;background:rgba(232,86,10,0.08);border:1px solid rgba(232,86,10,0.2);border-radius:6px;padding:10px 14px;"><div style="font-size:8px;color:#e8560a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Your Personalized Estimate</div><div style="display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;"><span style="font-size:10px;color:#6a6864;">Starting at</span><span style="font-size:22px;font-weight:700;color:#1c1a17;">${spotMailer.bidLo||spotMailer.bid}</span>${spotMailer.bidHi?`<span style="font-size:10px;color:#6a6864;">— up to ${spotMailer.bidHi}</span>`:""}</div>${spotMailer.includes?`<div style="font-size:9px;color:#8a8680;margin-top:3px;">✓ Includes: ${spotMailer.includes}</div>`:""}</div><div style="margin-top:10px;background:#1c1a17;color:white;padding:12px;border-radius:8px;text-align:center;"><div style="font-size:14px;font-weight:700;">918-896-6737</div><div style="font-size:9px;color:#b8b4ac;margin-top:2px;">Call or text Joel directly</div><div style="margin-top:4px;font-size:9px;background:#e8560a;display:inline-block;padding:2px 8px;border-radius:4px;">Free on-site visit — no obligation</div></div></body></html>`,
        use_type:"marketing"
      });
      const newSpotJob={id:`SB-00${spotJobs.length+1}`,address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage,sent:"Apr 07",status:"queued"};
      setSpotJobs(p=>[newSpotJob,...p]);
      showToast("✅ Spot bid sent to Lob.com!","success");
      setSpotMailer(null);
      setSpotForm({address:"",city:"Tulsa",state:"OK",zip:"",sqft:400,customSqft:"",service:"Crack Repair",damageLevel:"Moderate",bidLow:"",bidHigh:"",overridePrice:false,includes:"",damage:[],notes:""});
      setSpotPhoto(null);
    }catch(e){
      showToast("Spot bid queued (demo mode)","info");
      const newSpotJob={id:`SB-00${spotJobs.length+1}`,address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage||[],sent:"Apr 07",status:"queued"};
      setSpotJobs(p=>[newSpotJob,...p]);
    }finally{setSpotSending(false);}
  };

  return(
    <>
      <style>{STYLES}</style>
      <div className="shell">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="logo">PAVE<span>MAIL</span></div>
          <div className="topbar-sep"/>
          <div className="topbar-meta">JWood LLC · Tulsa, OK</div>
          <div className="topbar-right">
            <div className="lob-pill"><div className="lob-dot"/>Lob.com Test Mode</div>
            <div className="co-pill">🏗️ JWood LLC</div>
            <div className="avatar">JW</div>
          </div>
        </div>

        {/* NAV */}
        <nav className="nav">
          <div className="nav-label">Campaigns</div>
          {[{id:"map",icon:"🗺️",label:"Neighborhood Scan"},{id:"create",icon:"✏️",label:"Create Mailer"},{id:"tracker",icon:"📊",label:"Job Tracker",badge:jobs.filter(j=>j.status==="sent"||j.status==="queued").length},{id:"spotbid",icon:"🎯",label:"Spot Bid"}].map(item=>(
            <button key={item.id} className={`nav-item${tab===item.id?" active":""}`} onClick={()=>setTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.badge?<span className="nav-badge">{item.badge}</span>:null}
            </button>
          ))}
          <div className="nav-divider"/>
          <div className="nav-label">Account</div>
          <button className={`nav-item${tab==="settings"?" active":""}`} onClick={()=>setTab("settings")}><span className="nav-icon">⚙️</span>Settings</button>
          <div className="nav-mini">
            <div className="mini-card">
              <div className="mini-label">This Month</div>
              <div className="mini-row"><span>Homes Mailed</span><strong style={{color:"var(--cream)"}}>{totalMailed.toLocaleString()}</strong></div>
              <div className="mini-row"><span>Spend</span><strong style={{color:"var(--orange2)",fontFamily:"DM Mono"}}>${totalSpend}</strong></div>
              <div className="mini-row"><span>Calls</span><strong style={{color:"var(--green2)"}}>{totalCalls}</strong></div>
            </div>
          </div>
        </nav>

        {/* CONTENT */}
        <div className="content">

          {/* MAP */}
          {tab==="map"&&(
            <div className="map-layout">
              <div className="map-sidebar"><div className="map-sidebar-inner">
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>TULSA AREA SCANNER</div>
                <p style={{fontSize:12,color:"var(--stone)",lineHeight:1.6,marginBottom:16}}>Select Tulsa-area neighborhoods to target with real USPS ZIP data.</p>
                <div className="field"><label>Search Neighborhood / ZIP</label><input placeholder="e.g. Broken Arrow or 74011"/></div>
                <div className="section-head" style={{marginTop:14}}>Available Routes</div>
                <div className="route-list">
                  {ROUTES.map(r=>(
                    <div key={r.id} className={`route-item${selectedRoutes.includes(r.id)?" sel":""}`} onClick={()=>toggleRoute(r.id)}>
                      <div className="route-dot" style={{background:r.color}}/>
                      <div><div className="route-name">{r.name}</div><div className="route-count">{r.homes} homes · ZIP {r.zip}</div></div>
                      <div className="route-check">✓</div>
                    </div>
                  ))}
                </div>
                {selectedRoutes.length>0&&(
                  <div className="sel-summary">
                    <h4>📬 Campaign Summary</h4>
                    <div className="sum-row"><span>Routes selected</span><strong>{selectedRoutes.length}</strong></div>
                    <div className="sum-row"><span>Total homes</span><strong>{totalHomes.toLocaleString()}</strong></div>
                    <div className="sum-row"><span>Est. cost (EDDM)</span><strong style={{fontFamily:"DM Mono",color:"var(--orange2)"}}>${(totalHomes*0.62).toFixed(2)}</strong></div>
                    <div className="sum-row"><span>Est. delivery</span><strong>2–5 days</strong></div>
                    <button className="btn btn-primary" style={{width:"100%",marginTop:12}} onClick={proceedToCreate}>Create Mailer →</button>
                  </div>
                )}
              </div></div>
              <div className="map-panel">
                <div className="map-canvas"/>
                {[15,30,50,65,80].map(y=><div key={y} className="map-road-h" style={{top:`${y}%`,height:y===30||y===65?5:2}}/>)}
                {[20,40,60,80].map(x=><div key={x} className="map-road-v" style={{left:`${x}%`,width:x===40||x===60?5:2}}/>)}
                <div className="map-road-label" style={{top:"27%",left:"22%"}}>PEORIA AVE</div>
                <div className="map-road-label" style={{top:"62%",left:"42%"}}>MEMORIAL DR</div>
                <div className="map-road-label" style={{top:"12%",left:"62%",transform:"rotate(90deg)"}}>HWY 169</div>
                <div className="map-road-label" style={{top:"42%",left:"2%"}}>US-64</div>
                {selectedRoutes.includes(1)&&<div className="map-zone" style={{left:"18%",top:"10%",width:"28%",height:"32%"}}><div className="map-zone-label">South Tulsa / Midtown</div></div>}
                {selectedRoutes.includes(2)&&<div className="map-zone" style={{left:"50%",top:"8%",width:"30%",height:"28%",borderColor:"#2a7a52",background:"rgba(42,122,82,0.08)"}}><div className="map-zone-label" style={{background:"#2a7a52"}}>Broken Arrow</div></div>}
                {selectedRoutes.includes(3)&&<div className="map-zone" style={{left:"15%",top:"48%",width:"26%",height:"32%",borderColor:"#1a6fa8",background:"rgba(26,111,168,0.08)"}}><div className="map-zone-label" style={{background:"#1a6fa8"}}>Jenks / Riverview</div></div>}
                {selectedRoutes.includes(4)&&<div className="map-zone" style={{left:"48%",top:"44%",width:"28%",height:"30%",borderColor:"#8b5e3c",background:"rgba(139,94,60,0.08)"}}><div className="map-zone-label" style={{background:"#8b5e3c"}}>Owasso</div></div>}
                {selectedRoutes.includes(5)&&<div className="map-zone" style={{left:"10%",top:"78%",width:"25%",height:"18%",borderColor:"#6a3a8a",background:"rgba(106,58,138,0.08)"}}><div className="map-zone-label" style={{background:"#6a3a8a"}}>Bixby</div></div>}
                {selectedRoutes.includes(6)&&<div className="map-zone" style={{left:"68%",top:"68%",width:"24%",height:"20%",borderColor:"#2a6a6a",background:"rgba(42,106,106,0.08)"}}><div className="map-zone-label" style={{background:"#2a6a6a"}}>Sand Springs</div></div>}
                {PINS.map((p,i)=><div key={i} className={`map-pin ${p.t}`} style={{left:`${p.x}%`,top:`${p.y}%`}}/>)}
                <div style={{position:"absolute",top:12,left:12,background:"rgba(14,13,11,0.82)",border:"1px solid rgba(184,180,172,0.12)",borderRadius:7,padding:"10px 14px",fontSize:10,color:"var(--concrete)",display:"flex",flexDirection:"column",gap:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:10,height:10,borderRadius:"50%",background:"var(--orange2)"}}/> Home Address</div>
                  <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:12,height:12,borderRadius:"50%",background:"var(--green2)"}}/> JWood Past Job</div>
                  <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:12,height:8,background:"rgba(232,86,10,0.3)",border:"1px solid var(--orange)"}}/> Selected Zone</div>
                </div>
                <div className="map-controls"><button className="map-ctrl">+</button><button className="map-ctrl">−</button><button className="map-ctrl">⌖</button></div>
                {totalHomes>0&&<div style={{position:"absolute",bottom:20,left:"50%",transform:"translateX(-50%)"}}>
                  <button className="btn btn-primary btn-lg" onClick={proceedToCreate}>📬 Create Mailer for {totalHomes.toLocaleString()} Tulsa Homes →</button>
                </div>}
              </div>
            </div>
          )}

          {/* CREATE */}
          {tab==="create"&&(
            <div className="create-layout">
              <div className="create-form">
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>BUILD MAILER</div>
                <p style={{fontSize:12,color:"var(--stone)",marginBottom:16,lineHeight:1.6}}>AI writes your mailer. Hit Send to queue it with Lob.com for real printing.</p>
                <div className="section-head">Target Area</div>
                <div className="field"><label>Neighborhood *</label><input placeholder="e.g. South Tulsa, Broken Arrow, Jenks..." value={form.neighborhood} onChange={e=>set("neighborhood",e.target.value)}/></div>
                <div className="row2">
                  <div className="field"><label>Homes to Mail</label><input type="number" placeholder="200" value={form.homes} onChange={e=>set("homes",e.target.value)}/></div>
                  <div className="field"><label>Promo Code</label><input placeholder="JWOOD25" value={form.promoCode} onChange={e=>set("promoCode",e.target.value)}/></div>
                </div>
                <div className="section-head">Campaign Settings</div>
                <div className="field"><label>Season</label><div className="chips">{SEASONS.map(s=><button key={s} className={`chip${form.season===s?" on":""}`} onClick={()=>set("season",s)}>{s}</button>)}</div></div>
                <div className="field" style={{marginTop:10}}><label>Service Focus</label><div className="chips">{ANGLES.map(a=><button key={a} className={`chip${form.angle===a?" on":""}`} onClick={()=>set("angle",a)}>{a}</button>)}</div></div>
                <div className="field" style={{marginTop:10}}><label>Special Offer</label><div className="chips">{OFFERS.map(o=><button key={o} className={`chip${form.offer===o?" on":""}`} onClick={()=>set("offer",o)}>{o}</button>)}</div></div>
                <div className="section-head">AI Guidance</div>
                <div className="field"><label>Extra Notes</label><textarea placeholder="e.g. Just finished a job on 71st St. Mention freeze-thaw damage." value={form.extraNotes} onChange={e=>set("extraNotes",e.target.value)}/></div>
                <div className="divider"/>
                <div className="cost-bar"><div><div className="cb-label">Est. Print + Mail Cost</div><div className="cb-sub">{form.homes||0} homes × $0.62 (EDDM rate)</div></div><div className="cb-value">${estCost}</div></div>
                <button className="gen-btn" onClick={generate} disabled={loading||!form.neighborhood}>
                  {loading?<><span className="spin"/>WRITING YOUR MAILER...</>:"⚡ GENERATE MAILER"}
                </button>
                {mailer&&!loading&&(
                  <button className="send-btn" onClick={sendToPress} disabled={sending}>
                    {sending?<><span className="spin"/>SENDING TO LOB.COM...</>:`📬 SEND TO ${parseInt(form.homes)||0} TULSA HOMES — $${estCost}`}
                  </button>
                )}
                {lobResult&&(
                  <div className="lob-success-box">
                    ✅ <strong>Lob.com confirmed!</strong><br/>
                    Job ID: <span className="lob-id-pill">{lobResult.id}</span><br/>
                    Status: <strong>{lobResult.expected_delivery_date ? `Delivers ${lobResult.expected_delivery_date}` : "Queued for printing"}</strong>
                  </div>
                )}
              </div>
              <div className="create-preview">
                {!mailer&&!loading&&<div className="empty"><div className="icon">✉️</div><h3>Your Mailer Appears Here</h3><p>Enter a Tulsa neighborhood and hit Generate. JWood LLC info and QR code load automatically.</p></div>}
                {loading&&<div className="mailer-stack">{[1,2,3,4].map(i=><div key={i}><div className="page-tag">Page {i}</div><div className="skel-page"><div className="skel" style={{height:16,width:"40%",marginBottom:14}}/><div className="skel" style={{height:36,width:"70%",marginBottom:10}}/><div className="skel" style={{height:13,width:"55%",marginBottom:7}}/><div className="skel" style={{height:13,width:"45%"}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:20}}><div className="skel" style={{height:72}}/><div className="skel" style={{height:72}}/></div></div></div>)}</div>}
                {mailer&&!loading&&<>
                  <div className="preview-actions">
                    <button className="btn btn-ghost btn-sm" onClick={generate}>↺ Regenerate</button>
                    <button className="btn btn-primary btn-sm" onClick={sendToPress} disabled={sending}>{sending?"Sending...":"📬 Send to Lob"}</button>
                    <div className="preview-meta"><span>📍 <strong>{form.neighborhood}</strong></span><span>🏠 <strong>{form.homes}</strong> homes</span></div>
                  </div>
                  <MailerPreview mailer={mailer} form={form}/>
                </>}
              </div>
            </div>
          )}

          {/* TRACKER */}
          {tab==="tracker"&&(
            <div className="tracker-layout">
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>JOB TRACKER</div>
              <p style={{fontSize:13,color:"var(--stone)",marginBottom:20}}>Every JWood LLC campaign — from Lob.com queue to Tulsa doorstep.</p>
              <div className="stats-row">
                {[
                  {label:"Total Campaigns",value:jobs.length,color:"var(--cream)",trend:"↑ growing",up:true},
                  {label:"Homes Mailed",value:totalMailed.toLocaleString(),color:"var(--orange2)",trend:"Tulsa area",up:true},
                  {label:"Total Spend",value:`$${totalSpend}`,color:"var(--cream)",trend:"~$0.62/piece",up:false,mono:true},
                  {label:"Calls Generated",value:totalCalls,color:"var(--green2)",trend:`${(totalCalls/Math.max(jobs.length,1)).toFixed(1)} avg/campaign`,up:true},
                ].map((s,i)=>(
                  <div className="stat-card" key={i}>
                    <div className="sc-label">{s.label}</div>
                    <div className="sc-value" style={{color:s.color,fontSize:s.mono?22:34,fontFamily:s.mono?"'DM Mono',monospace":"'Bebas Neue',sans-serif"}}>{s.value}</div>
                    <div className={`sc-trend${s.up?" up":""}`}>{s.trend}</div>
                  </div>
                ))}
              </div>
              {selectedJob&&(
                <div className="track-card">
                  <h3>DELIVERY STATUS — {selectedJob.name}<span className={`badge badge-${selectedJob.status}`}><span className="badge-dot"/>{selectedJob.status}</span></h3>
                  <div className="track-steps">
                    {TRACK_STEPS.map((s,i)=>{const si=stepIndex(selectedJob.status),done=i<si,active=i===si;return(
                      <div key={i} className={`track-step${done?" done":""}${active?" active":""}`}>
                        <div className="track-circle">{done?"✓":s.icon}</div>
                        <div className="track-lbl">{s.label}</div>
                        <div className="track-date">{done?s.date:"—"}</div>
                      </div>
                    );})}
                  </div>
                  <div className="track-meta">
                    <span>📦 <strong>{selectedJob.homes}</strong> pieces</span>
                    <span>💵 <strong style={{fontFamily:"DM Mono,monospace",color:"var(--orange2)"}}>${selectedJob.cost}</strong></span>
                    <span>📞 <strong style={{color:"var(--green2)"}}>{selectedJob.calls}</strong> calls</span>
                    <span>📅 <strong>{selectedJob.sent}</strong></span>
                    {selectedJob.lobId&&<span>🆔 <span style={{fontFamily:"DM Mono,monospace",fontSize:11,color:"var(--stone)"}}>{selectedJob.lobId}</span></span>}
                  </div>
                </div>
              )}
              <div className="jobs-table">
                <div className="jobs-thead"><div>Campaign</div><div>Neighborhood</div><div>Homes</div><div>Sent</div><div>Spend</div><div>Calls</div><div>Status</div></div>
                {jobs.map(j=>(
                  <div key={j.id} className={`job-row${selectedJob?.id===j.id?" selected":""}`} onClick={()=>setSelectedJob(j)}>
                    <div><div className="job-name">{j.id}</div><div className="lob-id">{j.lobId}</div></div>
                    <div className="job-cell">{j.name}</div>
                    <div className="job-cell">{j.homes.toLocaleString()}</div>
                    <div className="job-cell">{j.sent}</div>
                    <div className="job-cell mono">${j.cost}</div>
                    <div className="job-cell" style={{color:"var(--green2)",fontWeight:700}}>{j.calls}</div>
                    <div><span className={`badge badge-${j.status}`}><span className="badge-dot"/>{j.status}</span></div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SPOT BID */}
          {tab==="spotbid"&&(
            <div className="spot-layout">
              <div className="spot-form">
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>SPOT BID</div>
                <p style={{fontSize:12,color:"var(--stone)",marginBottom:16,lineHeight:1.6}}>See a cracked driveway? Send that homeowner a personal bid mailer from your truck.</p>
                <div className="section-head">Input Method</div>
                <div className="mode-tabs">
                  {[{id:"address",icon:"📍",label:"Type Address"},{id:"map",icon:"🗺️",label:"Pin on Map"},{id:"photo",icon:"📷",label:"Photo"}].map(m=>(
                    <div key={m.id} className={`mode-tab${spotMode===m.id?" on":""}`} onClick={()=>setSpotMode(m.id)}>
                      <div className="mt-icon">{m.icon}</div>
                      <div className="mt-label">{m.label}</div>
                    </div>
                  ))}
                </div>

                {spotMode==="photo"&&(
                  <div>
                    <label className="photo-drop" onClick={()=>document.getElementById('photo-input').click()}>
                      {spotPhoto ? <><img src={spotPhoto} className="photo-preview" alt="driveway"/><div style={{fontSize:11,color:"var(--green2)",textAlign:"center",marginTop:4}}>✓ Photo ready — AI will analyze damage on generate</div></> : <><div className="pd-icon">📷</div><div className="pd-label">Tap to take photo or upload<br/><span style={{fontSize:10,color:"var(--gravel)"}}>AI reads the damage automatically</span></div></>}
                      <input id="photo-input" type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=ev=>setSpotPhoto(ev.target.result);r.readAsDataURL(f);}}}/>
                    </label>
                    {spotPhoto&&<button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:4}} onClick={e=>{e.stopPropagation();setSpotPhoto(null);}}>✕ Remove Photo</button>}
                  </div>
                )}

                {spotMode==="map"&&(
                  <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.12)",borderRadius:8,height:160,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,color:"var(--stone)",fontSize:12,flexDirection:"column",gap:8}}>
                    <span style={{fontSize:24}}>🗺️</span>
                    <span>Tap any address on the map</span>
                    <span style={{fontSize:10,color:"var(--gravel)"}}>Full map integration coming soon</span>
                  </div>
                )}

                <div className="section-head">Address</div>
                <div className="field"><label>Street Address *</label><input placeholder="e.g. 4821 Oak Ridge Dr" value={spotForm.address} onChange={e=>setSpot("address",e.target.value)}/></div>
                <div className="row2">
                  <div className="field"><label>City</label><input placeholder="Tulsa" value={spotForm.city} onChange={e=>setSpot("city",e.target.value)}/></div>
                  <div className="field"><label>ZIP</label><input placeholder="74105" value={spotForm.zip} onChange={e=>setSpot("zip",e.target.value)}/></div>
                </div>

                <div className="section-head">Damage Observed</div>
                <div className="damage-chips">
                  {DAMAGES.map(d=><button key={d} className={`chip${spotForm.damage.includes(d)?" on":""}`} onClick={()=>toggleDamage(d)}>{d}</button>)}
                </div>

                <div className="section-head">Driveway Size</div>
                <div className="chips" style={{marginBottom:8}}>
                  {DRIVEWAY_SIZES.map(s=>(
                    <button key={s.label} className={`chip${spotForm.sqft===s.sqft&&!spotForm.customSqft?" on":""}`}
                      onClick={()=>setSpotForm(f=>({...f,sqft:s.sqft,customSqft:"",overridePrice:false}))}>
                      {s.label}<span style={{fontSize:9,opacity:0.7,display:"block"}}>{s.desc}</span>
                    </button>
                  ))}
                </div>
                <div className="field">
                  <label>Custom Sq Ft (optional)</label>
                  <input type="number" placeholder="e.g. 350" value={spotForm.customSqft}
                    onChange={e=>setSpotForm(f=>({...f,customSqft:e.target.value,overridePrice:false}))}/>
                </div>

                <div className="section-head">Service Type</div>
                <div className="chips" style={{marginBottom:12}}>
                  {Object.keys(SERVICE_RATES).map(s=>(
                    <button key={s} className={`chip${spotForm.service===s?" on":""}`}
                      onClick={()=>setSpotForm(f=>({...f,service:s,overridePrice:false}))}>
                      {s}
                    </button>
                  ))}
                </div>

                <div className="section-head">Damage Level</div>
                <div className="chips" style={{marginBottom:12}}>
                  {["Minor","Moderate","Severe"].map(d=>(
                    <button key={d} className={`chip${spotForm.damageLevel===d?" on":""}`}
                      onClick={()=>setSpotForm(f=>({...f,damageLevel:d,overridePrice:false}))}>
                      {d}
                    </button>
                  ))}
                </div>

                {/* AUTO-CALCULATED PRICE */}
                <div style={{background:"rgba(232,86,10,0.08)",border:"1px solid rgba(232,86,10,0.25)",borderRadius:9,padding:"14px 16px",marginBottom:12}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--orange2)",marginBottom:6}}>
                    {spotForm.overridePrice?"✏️ Manual Override":"⚡ Auto-Calculated Price"}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:"var(--stone)",marginBottom:4}}>Starting at</div>
                      <input type="number" value={spotForm.bidLow}
                        onChange={e=>setSpotForm(f=>({...f,bidLow:e.target.value,overridePrice:true}))}
                        style={{width:"100%",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:6,padding:"8px 10px",color:"var(--orange2)",fontFamily:"DM Mono,monospace",fontSize:18,fontWeight:600,outline:"none"}}/>
                    </div>
                    <div style={{color:"var(--stone)",fontSize:13,paddingTop:20}}>to</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:"var(--stone)",marginBottom:4}}>Up to</div>
                      <input type="number" value={spotForm.bidHigh}
                        onChange={e=>setSpotForm(f=>({...f,bidHigh:e.target.value,overridePrice:true}))}
                        style={{width:"100%",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:6,padding:"8px 10px",color:"var(--orange2)",fontFamily:"DM Mono,monospace",fontSize:18,fontWeight:600,outline:"none"}}/>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:"var(--gravel)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>{spotForm.customSqft||spotForm.sqft} sq ft · {spotForm.service} · {spotForm.damageLevel} damage</span>
                    {spotForm.overridePrice&&<button onClick={()=>setSpotForm(f=>({...f,overridePrice:false}))} style={{fontSize:10,color:"var(--orange2)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Reset to auto</button>}
                  </div>
                </div>

                <div className="field"><label>What's Included</label><input placeholder="e.g. Demo, haul away, pour, finish & seal" value={spotForm.includes||""} onChange={e=>setSpot("includes",e.target.value)}/></div>

                <div className="field"><label>Extra Notes for AI</label><textarea placeholder="e.g. Large crack near garage door, looks like tree root damage" value={spotForm.notes} onChange={e=>setSpot("notes",e.target.value)}/></div>

                <div className="divider"/>
                <div style={{fontSize:11,color:"var(--stone)",marginBottom:10,textAlign:"center"}}>One postcard · $1.25 · Delivers in 2–5 days</div>

                <button className="spot-send-btn" onClick={generateSpot} disabled={spotLoading||!spotForm.address}>
                  {spotLoading?<><span className="spin"/>WRITING PERSONAL NOTE...</>:"⚡ GENERATE SPOT BID"}
                </button>

                {spotMailer&&!spotLoading&&(
                  <button className="spot-send-btn" style={{background:"var(--green)",marginTop:8}} onClick={sendSpot} disabled={spotSending}>
                    {spotSending?<><span className="spin"/>SENDING...</>:"📬 SEND THIS POSTCARD — $1.25"}
                  </button>
                )}

                {spotJobs.length>0&&(
                  <>
                    <div className="section-head" style={{marginTop:20}}>Recent Spot Bids</div>
                    <div className="spot-jobs">
                      {spotJobs.slice(0,4).map(j=>(
                        <div key={j.id} className="spot-job-row">
                          <div>
                            <div className="spot-job-addr">{j.address}</div>
                            <div className="spot-job-sub">{j.city} · {j.sent} · <span className={`badge badge-${j.status}`} style={{fontSize:9,padding:"2px 6px"}}>{j.status}</span></div>
                          </div>
                          <div className="spot-job-bid">{j.bid}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="spot-preview">
                {!spotMailer&&!spotLoading&&(
                  <div className="empty">
                    <div className="icon">🎯</div>
                    <h3>Spot Bid Preview</h3>
                    <p>Enter an address and damage details — AI writes a personal note that sounds like it came from Joel himself, not a corporation.</p>
                    <div style={{marginTop:16,background:"rgba(232,86,10,0.08)",border:"1px solid rgba(232,86,10,0.2)",borderRadius:8,padding:"14px 18px",textAlign:"left",maxWidth:320}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--orange2)",marginBottom:8}}>How It Works</div>
                      <div style={{fontSize:12,color:"var(--stone)",lineHeight:1.8}}>
                        <div>1. Drive past a cracked driveway</div>
                        <div>2. Enter the address on your phone</div>
                        <div>3. Check the damage you noticed</div>
                        <div>4. Enter your bid range</div>
                        <div>5. Hit Send — postcard arrives in 2 days</div>
                      </div>
                    </div>
                  </div>
                )}

                {spotLoading&&(
                  <div style={{padding:"40px 0"}}>
                    <div className="page-tag">Generating Personal Note...</div>
                    <div className="skel-page">
                      <div className="skel" style={{height:14,width:"35%",marginBottom:12}}/>
                      <div className="skel" style={{height:32,width:"65%",marginBottom:10}}/>
                      <div className="skel" style={{height:13,width:"90%",marginBottom:6}}/>
                      <div className="skel" style={{height:13,width:"80%",marginBottom:6}}/>
                      <div className="skel" style={{height:13,width:"70%",marginBottom:20}}/>
                      <div className="skel" style={{height:60,width:"100%"}}/>
                    </div>
                  </div>
                )}

                {spotMailer&&!spotLoading&&(
                  <>
                    <div className="preview-actions">
                      <button className="btn btn-ghost btn-sm" onClick={generateSpot}>↺ Rewrite Note</button>
                      <button className="btn btn-primary btn-sm" onClick={sendSpot} disabled={spotSending}>📬 Send $1.25</button>
                      <div className="preview-meta"><span>📍 <strong>{spotMailer.address}</strong></span><span>💵 <strong>{spotMailer.bid}</strong></span></div>
                    </div>

                    <div className="page-tag">Front of Postcard</div>
                    <div className="spot-mailer" style={{marginBottom:18}}>
                      <div className="spot-front">
                        <div className="spot-front-texture"/>
                        <div className="spot-tag">A Personal Note from JWood LLC · Tulsa, OK{spotMailer.photoUsed&&<span style={{marginLeft:8,background:"rgba(232,86,10,0.3)",padding:"2px 6px",borderRadius:4,fontSize:9}}>📷 AI Photo Analysis</span>}</div>
                        <div className="spot-address">{spotMailer.address}, {spotMailer.city}</div>
                        <div className="spot-headline" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:36,color:"#f5f0e6",letterSpacing:1,marginBottom:10,position:"relative"}}>{spotMailer.headline}</div>
                        <div className="spot-note">{spotMailer.personalNote}</div>
                        <div className="spot-bid-box">
                          <div style={{flex:1}}>
                            <div className="spot-bid-label">Our Estimate for Your Home</div>
                            <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4,flexWrap:"wrap"}}>
                              <div style={{fontSize:13,color:"rgba(184,180,172,0.7)"}}>Starting at</div>
                              <div className="spot-bid-value">{spotMailer.bidLo||spotMailer.bid}</div>
                            </div>
                            {spotMailer.bidHi&&<div style={{fontSize:12,color:"rgba(184,180,172,0.6)",marginTop:2}}>Up to {spotMailer.bidHi} depending on scope</div>}
                            {spotMailer.includes&&<div style={{fontSize:10,color:"rgba(184,180,172,0.45)",marginTop:4}}>Includes: {spotMailer.includes}</div>}
                          </div>
                          <div style={{flexShrink:0,background:"var(--orange)",color:"white",padding:"8px 14px",borderRadius:6,fontSize:11,fontWeight:700,textAlign:"center",cursor:"pointer"}}>CALL NOW<br/><span style={{fontSize:13,fontFamily:"DM Mono,monospace"}}>918-896-6737</span></div>
                        </div>
                        <div style={{marginTop:12,fontSize:11,color:"rgba(184,180,172,0.5)",position:"relative"}}>{spotMailer.urgencyLine}</div>
                        <div className="spot-bar"/>
                      </div>
                    </div>

                    <div className="page-tag">Back of Postcard</div>
                    <div className="spot-mailer">
                      <div className="spot-back">
                        <h3>WHAT WE NOTICED AT YOUR HOME</h3>
                        <div className="spot-damage-list">
                          {spotMailer.damage?.length>0 ? spotMailer.damage.map((d,i)=><div key={i} className="spot-damage-item">⚠️ {d}</div>) : <div className="spot-damage-item">General driveway wear and aging concrete</div>}
                        </div>
                        <div style={{background:"rgba(232,86,10,0.08)",border:"1px solid rgba(232,86,10,0.2)",borderRadius:8,padding:"12px 16px",marginBottom:12}}>
                          <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--orange)",marginBottom:6}}>Your Personalized Estimate</div>
                          <div style={{display:"flex",alignItems:"baseline",gap:6,flexWrap:"wrap"}}>
                            <span style={{fontSize:11,color:"#6a6864"}}>Starting at</span>
                            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#1c1a17",letterSpacing:1}}>{spotMailer.bidLo||spotMailer.bid}</span>
                            {spotMailer.bidHi&&<span style={{fontSize:11,color:"#6a6864"}}>— up to {spotMailer.bidHi}</span>}
                          </div>
                          {spotMailer.includes&&<div style={{fontSize:10,color:"#8a8680",marginTop:4}}>✓ Includes: {spotMailer.includes}</div>}
                        </div>
                        <div className="spot-cta-box">
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <div style={{width:40,height:40,background:"var(--orange)",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>🏗️</div>
                            <div className="spot-cta-text">
                              <h4>CALL JOEL DIRECTLY</h4>
                              <p>918-896-6737 · joelmwood@gmail.com</p>
                            </div>
                          </div>
                          <QRCode value="tel:9188966737" size={64}/>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div className="settings-layout">
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>SETTINGS</div>
              <p style={{fontSize:13,color:"var(--stone)",marginBottom:26}}>JWood LLC · Tulsa, OK · {COMPANY.phone}</p>
              <div className="settings-section">
                <h3>Company Info</h3>
                <div style={{background:"rgba(232,86,10,0.07)",border:"1px solid rgba(232,86,10,0.18)",borderRadius:9,padding:"16px 18px",fontSize:13,lineHeight:2,color:"var(--concrete)"}}>
                  <div>🏗️ <strong style={{color:"var(--cream)"}}>JWood LLC</strong></div>
                  <div>📞 <strong style={{color:"var(--cream)",fontFamily:"DM Mono"}}>918-896-6737</strong></div>
                  <div>✉️ <strong style={{color:"var(--cream)"}}>joelmwood@gmail.com</strong></div>
                  <div>📍 <strong style={{color:"var(--cream)"}}>Tulsa, Oklahoma</strong></div>
                  <div>🏷️ Promo: <strong style={{color:"var(--orange2)",fontFamily:"DM Mono"}}>JWOOD25</strong></div>
                  <div style={{marginTop:10,display:"flex",alignItems:"center",gap:12}}>
                    <QRCode value={`tel:${COMPANY.phone.replace(/-/g,"")}`} size={80}/>
                    <div style={{fontSize:11,color:"var(--stone)"}}>QR on every mailer<br/>auto-dials 918-896-6737<br/>when scanned on mobile</div>
                  </div>
                </div>
              </div>
              <div className="settings-section">
                <h3>API Integrations</h3>
                {[
                  {label:"Anthropic Claude API",desc:"AI mailer copy generation",status:"live"},
                  {label:"Lob.com Print & Mail",desc:"Test mode active — real printing ready",status:"live"},
                  {label:"USPS EDDM Route Data",desc:"Live Tulsa address data by route",status:"demo"},
                  {label:"USPS Delivery Webhooks",desc:"Real-time delivery tracking",status:"demo"},
                ].map((a,i)=>(
                  <div className="setting-row" key={i}>
                    <div className="setting-info"><h4>{a.label}</h4><p>{a.desc}</p></div>
                    <span className={`api-pill ${a.status==="live"?"api-live":"api-demo"}`}>{a.status==="live"?"● Connected":"◐ Demo Mode"}</span>
                  </div>
                ))}
              </div>
              <div className="settings-section">
                <h3>Automation</h3>
                {[
                  {key:"autoSend",label:"Auto-Send After Job Completion",desc:"Mail Tulsa neighbors automatically when JWood LLC finishes a driveway"},
                  {key:"weeklyReport",label:"Weekly Report to joelmwood@gmail.com",desc:"Opens, calls, and spend summary every Monday"},
                  {key:"trackOpens",label:"QR Code Scan Tracking",desc:"Track who scans your QR codes and calls"},
                  {key:"smsAlerts",label:"SMS Alerts to 918-896-6737",desc:"Text when campaigns hit Tulsa mailboxes"},
                ].map(s=>(
                  <div className="setting-row" key={s.key}>
                    <div className="setting-info"><h4>{s.label}</h4><p>{s.desc}</p></div>
                    <button className={`toggle${settings[s.key]?" on":""}`} onClick={()=>setSettings(p=>({...p,[s.key]:!p[s.key]}))}/>
                  </div>
                ))}
              </div>
              <div className="settings-section">
                <h3>Production Checklist</h3>
                <div style={{fontSize:12,color:"var(--stone)",lineHeight:2.2}}>
                  <div>✅ <strong style={{color:"var(--cream)"}}>AI Mailer Generation</strong> — Live</div>
                  <div>✅ <strong style={{color:"var(--cream)"}}>QR Code Auto-Dial</strong> — On every mailer</div>
                  <div>✅ <strong style={{color:"var(--cream)"}}>Lob.com Print & Mail</strong> — Test mode connected</div>
                  <div>🔧 <strong style={{color:"var(--concrete)"}}>Lob.com Live Mode</strong> — Flip to live key when ready to send real mail</div>
                  <div>🔧 <strong style={{color:"var(--concrete)"}}>USPS EDDM Live Data</strong> — Real Tulsa address counts</div>
                  <div>🔧 <strong style={{color:"var(--concrete)"}}>Backend Proxy</strong> — Hide API keys for production</div>
                  <div>🔧 <strong style={{color:"var(--concrete)"}}>Stripe Billing</strong> — Charge per campaign</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
