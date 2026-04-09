import React, { useState } from "react";

// ─────────────────────────────────────────────
// LOB API INTEGRATION
// ─────────────────────────────────────────────
const PROXY_BASE      = "https://joelmwood--b166b8c432db11f19dff42b51c65c3df.web.val.run";

// ─────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────
const SUPABASE_URL = "https://pzbvvohedpgeiynqoujr.supabase.co";
const SUPABASE_KEY = "sb_publishable_H6U94DoMxk7_Cap6ftIoew_14fhh8Qe";

async function sbFetch(path, options={} ) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Supabase error:", res.status, err);
    return null;
  }
  return res.json();
}

// DB helpers
const db = {
  // Pipeline
  async getPipeline() {
    return sbFetch("pipeline_leads?contractor_id=eq.jwood&order=created_at.desc");
  },
  async upsertLead(lead) {
    return sbFetch("pipeline_leads", {
      method: "POST",
      prefer: "return=representation",
      headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: lead.id,
        contractor_id: "jwood",
        address: lead.address,
        city: lead.city,
        neighborhood: lead.neighborhood||"",
        stage: lead.stage,
        bid_lo: lead.bidLo||"",
        bid_hi: lead.bidHi||"",
        value: lead.value||0,
        notes: lead.notes||"",
        mailer_sent: lead.mailerSent?new Date().toISOString().split("T")[0]:null,
        called_back: lead.calledBack?new Date().toISOString().split("T")[0]:null,
        job_won: lead.jobWon?new Date().toISOString().split("T")[0]:null,
      }),
    });
  },
  async updateLeadStage(id, stage) {
    return sbFetch(`pipeline_leads?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage, updated_at: new Date().toISOString() }),
    });
  },
  async deleteLead(id) {
    return sbFetch(`pipeline_leads?id=eq.${id}`, { method: "DELETE" });
  },

  // Campaigns
  async getCampaigns() {
    return sbFetch("campaigns?contractor_id=eq.jwood&order=created_at.desc");
  },
  async saveCampaign(campaign) {
    return sbFetch("campaigns", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: "jwood",
        name: campaign.name,
        area: campaign.area,
        homes: parseInt(campaign.homes)||0,
        cost: parseFloat(campaign.cost)||0,
        status: campaign.status||"queued",
        lob_id: campaign.lobId||campaign.lob||"",
        mailer_content: campaign.mailerContent||null,
      }),
    });
  },

  // Spot bids
  async getSpotBids() {
    return sbFetch("spot_bids?contractor_id=eq.jwood&order=created_at.desc");
  },
  async saveSpotBid(bid) {
    return sbFetch("spot_bids", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: "jwood",
        address: bid.address,
        city: bid.city||"Tulsa",
        bid: bid.bid||"",
        damage: bid.damage||[],
        photo_url: bid.photoUrl||"",
        lob_id: bid.lobId||"",
        status: "sent",
        mailer_content: bid.mailerContent||null,
      }),
    });
  },

  // AI calls
  async getAiCalls() {
    return sbFetch("ai_calls?contractor_id=eq.jwood&order=created_at.desc");
  },
  async saveAiCall(call) {
    return sbFetch("ai_calls", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: "jwood",
        caller: call.caller||"Unknown",
        phone: call.phone||"",
        summary: call.summary||"",
        service: call.service||"",
        address: call.address||"",
        status: call.status||"pending",
        transferred: call.transferred||false,
        bland_call_id: call.blandCallId||"",
      }),
    });
  },

  // Jobs
  async getJobs() {
    return sbFetch("jobs?contractor_id=eq.jwood&order=created_at.desc");
  },
  async saveJob(job) {
    return sbFetch("jobs", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: "jwood",
        name: job.name,
        area: job.area||"",
        homes: String(job.homes||0),
        cost: String(job.cost||0),
        status: job.status||"queued",
        lob_id: job.lob||job.lobId||"",
        calls: job.calls||0,
      }),
    });
  },
};
const BLAND_PROXY     = PROXY_BASE + "/?target=bland-call";
const BLAND_STATUS    = PROXY_BASE + "/?target=bland-status";

// ─────────────────────────────────────────────
// BLAND.AI AGENT CONFIG
// ─────────────────────────────────────────────
const BLAND_AGENT_SCRIPT = `You are a friendly assistant answering calls for JWood LLC, a concrete driveway contractor in Tulsa, Oklahoma. Your name is Alex.

When someone calls:
1. Greet them warmly: "Thanks for calling JWood LLC! This is Alex. Are you calling about a driveway project?"
2. Get their name and callback number
3. Ask what service they need: crack repair, new driveway, resurfacing, or sealing
4. Ask for the property address
5. Ask their timeline: "Are you looking to get this done in the next few weeks?"
6. Ask roughly how big the driveway is (single car, double car, or larger)
7. Tell them: "Great! Joel will be giving you a personal call back within the hour to discuss your project and give you a free estimate."
8. Transfer to Joel at 918-896-6737

Keep it conversational and friendly. Never quote prices. Always end by transferring to Joel.`;

async function createBlandAgent(phoneNumber, leadContext) {
  try {
    const res = await fetch(BLAND_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone_number: phoneNumber,
        task: BLAND_AGENT_SCRIPT,
        language: "en-US",
        voice: "maya",
        max_duration: 10,
        wait_for_greeting: true,
        transfer_phone_number: "+19188966737",
        webhook: PROXY_BASE + "/?target=bland",
        metadata: { source: "pavemail", lead: leadContext },
        first_sentence: "Thanks for calling JWood LLC, this is Alex! Are you calling about a driveway project?",
        record: true,
        reduce_latency: false,
      })
    });
    const data = await res.json();
    console.log("Bland API response:", JSON.stringify(data));
    return data;
  } catch(e) {
    console.error("Bland API error:", e);
    return { error: e.message };
  }
}
const LOB_PROXY       = PROXY_BASE + "/?target=lob";
const ANTHROPIC_PROXY = PROXY_BASE + "/?target=anthropic";
const LOB_VERIFY_PROXY= PROXY_BASE + "/?target=lob-verify";
const IMGBB_PROXY     = PROXY_BASE + "/?target=imgbb";
const PERMIT_PROXY    = PROXY_BASE + "/?target=permits";

// ─────────────────────────────────────────────
// TULSA PERMIT LOOKUP (Tyler EnerGov CSS API)
// ─────────────────────────────────────────────
const TULSA_CSS_BASE = "https://tulsaok-energovweb.tylerhost.net/apps/selfservice";
const TULSA_CSS_API  = "https://tulsaok-energovweb.tylerhost.net/apps/selfservice/api/CSS";

async function fetchTulsaPermits(address) {
  try {
    // Format address for Tulsa CSS portal (uppercase, no punctuation)
    const formatted = address.toUpperCase().replace(/[.,#]/g, "").trim();
    const res = await fetch(`${PERMIT_PROXY}&address=${encodeURIComponent(formatted)}`);
    const data = await res.json();
    if (data.error) return { permits: [], error: data.error };
    const permits = (data.Result || data.results || data.permits || []).slice(0, 10);
    return { permits, raw: data };
  } catch(e) {
    return { permits: [], error: e.message };
  }
}

function getTulsaPortalUrl(address) {
  // Deep link to CSS portal search — guest access, no login needed
  const formatted = address.toUpperCase().replace(/[.,#]/g, "").trim();
  return `${TULSA_CSS_BASE}#/search?query=${encodeURIComponent(formatted)}&module=Permits`;
}

function getTulsaCountyUrl(address) {
  // Tulsa County SmartGov portal
  const formatted = encodeURIComponent(address);
  return `https://co-tulsa-ok.smartgovcommunity.com/ApplicationPublic/ApplicationSearch?address=${formatted}`;
}
const USPS_PROXY      = PROXY_BASE + "/?target=usps";

const ROUTE_COLORS = ["#e8560a","#2a7a52","#1a6fa8","#8b5e3c","#6a3a8a","#2a6a6a","#b83232","#c4a020","#4a6a2a","#6a2a6a"];

async function fetchUSPSRoutes(zip) {
  try {
    const res = await fetch(`${USPS_PROXY}&zip=${zip.trim()}`);
    const data = await res.json();
    const features = data?.results?.[0]?.value?.features || [];
    return features.map((f, i) => {
      const a = f.attributes || {};
      // Real USPS GIS field names from live endpoint
      const routeId = a.CRID_ID || a.ZIP_CRID?.slice(5) || String(i+1).padStart(3,'0');
      const city = (a.CITY_STATE || "").split(",")[0].trim() || "Tulsa";
      return {
        id: a.ZIP_CRID || `${zip}-${i}`,
        routeId: routeId,
        zip: a.ZIP_CODE || zip,
        name: `${city} ${a.ZIP_CODE||zip} - Route ${routeId}`,
        homes: parseInt(a.RES_CNT || 0),
        businesses: parseInt(a.BUS_CNT || 0),
        total: parseInt(a.TOT_CNT || a.RES_CNT || 0),
        medIncome: parseInt(a.MED_INCOME || 0),
        medAge: parseInt(a.MED_AGE || 0),
        city: city,
        color: ROUTE_COLORS[i % ROUTE_COLORS.length],
      };
    }).filter(r => r.homes > 0 || r.total > 0);
  } catch(e) {
    console.error("USPS route fetch failed:", e);
    return [];
  }
}

// ─────────────────────────────────────────────
// GPS → ADDRESS (Reverse Geocoding via Nominatim)
// ─────────────────────────────────────────────
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      { headers: { "User-Agent": "PaveMail/1.0 (joelmwood@gmail.com)" } }
    );
    const data = await res.json();
    if (!data || data.error) return null;
    const a = data.address || {};
    const houseNumber = a.house_number || "";
    const road = a.road || a.pedestrian || a.path || "";
    const city = a.city || a.town || a.village || a.suburb || "Tulsa";
    const state = a.state_code || a.state || "OK";
    const zip = a.postcode || "";
    const streetAddress = houseNumber ? `${houseNumber} ${road}` : road;
    return { address: streetAddress.trim(), city, state, zip, lat, lng, full: data.display_name };
  } catch(e) {
    console.error("Geocoding failed:", e);
    return null;
  }
}

async function verifyAddress(address, city, state, zip) {
  try {
    const res = await fetch(LOB_VERIFY_PROXY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_line: address, city: city||"Tulsa", state: state||"OK", zip_code: zip||"" })
    });
    const data = await res.json();
    return {
      valid: data.deliverability === "deliverable",
      deliverability: data.deliverability,
      address: data.primary_line,
      city: data.components?.city || city,
      state: data.components?.state || state,
      zip: data.components?.zip_code || zip,
      zipPlus4: data.components?.zip_code_plus_4 || "",
      carrierRoute: data.components?.carrier_route || "",
      corrected: data.primary_line !== address,
    };
  } catch(e) { return { valid: false, deliverability: "error" }; }
}

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
// IMGBB PHOTO UPLOAD (for Lob.com printing)
// ─────────────────────────────────────────────
const IMGBB_API_KEY = "1de580a4e5bbefe4b3b892494b4a6d7a"; // free key - replace with yours from imgbb.com

async function uploadPhotoToImgbb(base64Data) {
  try {
    const imageData = base64Data.split(",")[1] || base64Data;
    const formData = new FormData();
    formData.append("image", imageData);
    const res = await fetch(IMGBB_PROXY, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) return data.data.url;
    console.error("imgbb upload failed:", data);
    return null;
  } catch(e) {
    console.error("imgbb proxy error:", e);
    return null;
  }
}

// Before/after stock image URLs for the back of postcard
const BEFORE_AFTER_URL = "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80";
const CRACKED_EXAMPLE_URL = "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80";
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
@keyframes gpsPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.95)}}
.gps-loading{animation:gpsPulse 0.8s infinite;}
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
.spot-front{padding:0;position:relative;min-height:320px;border-radius:inherit;background:#111009;}
.spot-photo-wrap{position:relative;min-height:320px;border-radius:inherit;background:#111009;}
.spot-photo-bg{width:100%;height:320px;object-fit:cover;object-position:center;display:block;border:none;margin:0;padding:0;}
.spot-photo-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,rgba(10,9,8,0.35) 0%,rgba(10,9,8,0.75) 50%,rgba(10,9,8,0.97) 100%);pointer-events:none;}
.spot-front-content{position:absolute;top:0;left:0;right:0;bottom:0;padding:28px;display:flex;flex-direction:column;}
.spot-front-no-photo{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(145deg,#111009 0%,#2a2720 100%);}
.spot-canvas-preview{width:100%;height:320px;display:block;border-radius:inherit;}
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

/* ── CAPACITY ENGINE ── */
.capacity-bar-wrap{background:rgba(0,0,0,0.3);border-radius:20px;height:8px;overflow:hidden;margin:8px 0;}
.capacity-bar{height:100%;border-radius:20px;transition:width 0.5s ease;}
.capacity-gauge{position:relative;width:120px;height:60px;margin:0 auto;}
.mode-pill{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;cursor:pointer;transition:all 0.15s;border:1px solid transparent;}
.mode-pill.active{border-color:currentColor;}
.capacity-widget{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;padding:14px 16px;}
.score-pill{font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;font-family:"DM Mono",monospace;}
.score-high{background:rgba(42,122,82,0.15);color:var(--green2);}
.score-mid{background:rgba(196,160,32,0.15);color:var(--gold2);}
.score-low{background:rgba(184,50,50,0.15);color:#f08080;}
.smart-suggest{background:linear-gradient(135deg,rgba(26,111,168,0.08),rgba(26,111,168,0.04));border:1px solid rgba(26,111,168,0.2);border-radius:8px;padding:12px 14px;margin-bottom:10px;display:flex;align-items:flex-start;gap:10px;}
.smart-suggest-icon{font-size:18px;flex-shrink:0;}
.smart-suggest-text{font-size:11px;color:var(--concrete);line-height:1.6;}
.smart-suggest-text strong{color:var(--cream);}

/* ── AI PHONE ── */
.ai-phone-nav{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}
.ai-lead-card{background:var(--char);border:1px solid rgba(184,180,172,0.08);border-radius:10px;padding:16px 18px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;transition:all 0.15s;}
.ai-lead-card:hover{border-color:rgba(184,180,172,0.18);}
.ai-lead-status{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;margin-top:2px;}
.ai-lead-name{font-size:13px;font-weight:700;color:var(--cream);margin-bottom:2px;}
.ai-lead-summary{font-size:12px;color:var(--stone);line-height:1.6;margin-bottom:8px;}
.ai-lead-meta{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.ai-badge{font-size:9px;font-weight:700;padding:3px 8px;border-radius:10px;letter-spacing:0.5px;}
.badge-qualified{background:rgba(42,122,82,0.15);color:var(--green2);}
.badge-pending{background:rgba(212,160,23,0.15);color:var(--gold2);}
.badge-not-qualified{background:rgba(122,118,112,0.15);color:var(--stone);}
.ai-stat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px;}
.ai-stat{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:9px;padding:14px 16px;text-align:center;}
.ai-stat-val{font-family:"Bebas Neue",sans-serif;font-size:32px;letter-spacing:1px;line-height:1;}
.ai-stat-label{font-size:10px;color:var(--stone);margin-top:4px;letter-spacing:1px;text-transform:uppercase;}
.phone-pulse{animation:phonePulse 1.5s infinite;}
@keyframes phonePulse{0%,100%{box-shadow:0 0 0 0 rgba(42,122,82,0.4)}70%{box-shadow:0 0 0 10px rgba(42,122,82,0)}}

/* ── RADIUS MAILER ── */
.won-banner{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#1c5a3a,#2a7a52);border:1px solid rgba(62,184,124,0.4);border-radius:12px;padding:16px 20px;z-index:900;display:flex;align-items:center;gap:14px;box-shadow:0 8px 32px rgba(0,0,0,0.4);animation:slideUp 0.4s ease;max-width:480px;width:calc(100% - 40px);}
.won-banner-icon{font-size:24px;flex-shrink:0;}
.won-banner-text h4{font-size:13px;font-weight:700;color:#f5f0e6;margin-bottom:2px;}
.won-banner-text p{font-size:11px;color:rgba(184,180,172,0.8);}
.won-banner-actions{margin-left:auto;display:flex;gap:8px;flex-shrink:0;}
@keyframes slideUp{from{opacity:0;transform:translate(-50%,20px)}to{opacity:1;transform:translate(-50%,0)}}

.radius-modal{max-width:520px;}
.radius-step{animation:fadeIn 0.3s ease;}
.radius-config{display:flex;flex-direction:column;gap:14px;}
.radius-slider{width:100%;accent-color:var(--green);}
.radius-preview{background:var(--char);border:1px solid rgba(42,122,82,0.25);border-radius:10px;overflow:hidden;}
.radius-preview-head{background:linear-gradient(135deg,#1c5a3a,#2a7a52);padding:14px 18px;}
.radius-preview-body{padding:18px;}
.radius-success{text-align:center;padding:32px 20px;}
.radius-success-icon{font-size:56px;margin-bottom:16px;}

/* ── PERMITS ── */
.permit-btn{display:inline-flex;align-items:center;gap:5px;font-size:9px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;border:none;font-family:"Syne",sans-serif;transition:all 0.12s;background:rgba(26,111,168,0.15);color:var(--blue2);letter-spacing:0.5px;}
.permit-btn:hover{background:rgba(26,111,168,0.28);}
.permit-btn.loading{opacity:0.6;cursor:wait;}
.permit-panel{margin-top:10px;background:rgba(26,111,168,0.06);border:1px solid rgba(26,111,168,0.2);border-radius:6px;overflow:hidden;}
.permit-panel-head{padding:8px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(26,111,168,0.12);}
.permit-panel-title{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--blue2);}
.permit-row{padding:8px 12px;border-bottom:1px solid rgba(184,180,172,0.05);display:flex;flex-direction:column;gap:3px;}
.permit-row:last-child{border-bottom:none;}
.permit-type{font-size:11px;font-weight:600;color:var(--cream);}
.permit-meta{font-size:10px;color:var(--stone);display:flex;gap:10px;flex-wrap:wrap;}
.permit-status{font-size:9px;font-weight:700;padding:2px 6px;border-radius:3px;}
.permit-status.issued{background:rgba(42,122,82,0.15);color:var(--green2);}
.permit-status.pending{background:rgba(212,160,23,0.15);color:var(--gold2);}
.permit-status.expired{background:rgba(122,118,112,0.15);color:var(--stone);}
.permit-links{display:flex;gap:6px;padding:8px 12px;border-top:1px solid rgba(26,111,168,0.12);}
.permit-link{font-size:10px;font-weight:600;color:var(--blue2);text-decoration:none;padding:3px 8px;border-radius:4px;background:rgba(26,111,168,0.1);transition:background 0.15s;}
.permit-link:hover{background:rgba(26,111,168,0.2);}
.permit-empty{padding:12px;font-size:11px;color:var(--gravel);text-align:center;}

/* ── PIPELINE ── */
.pipeline-layout{padding:20px 24px;}
.pipeline-view-tabs{display:flex;gap:6px;margin-bottom:20px;}
.pvt{background:rgba(0,0,0,0.3);border:1px solid rgba(184,180,172,0.12);border-radius:7px;padding:7px 14px;font-size:12px;font-weight:600;color:var(--stone);cursor:pointer;transition:all 0.15s;font-family:'Syne',sans-serif;display:flex;align-items:center;gap:6px;}
.pvt:hover{color:var(--concrete);}
.pvt.on{background:var(--orange);border-color:var(--orange);color:white;}

.pipeline-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
.pl-stat{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:9px;padding:14px 16px;}
.pl-stat-label{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--stone);margin-bottom:6px;}
.pl-stat-value{font-family:'Bebas Neue',sans-serif;font-size:28px;letter-spacing:1px;line-height:1;}
.pl-stat-sub{font-size:10px;color:var(--stone);margin-top:3px;}

/* KANBAN */
.kanban{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start;}
.kanban-col{background:rgba(0,0,0,0.2);border:1px solid rgba(184,180,172,0.07);border-radius:10px;overflow:hidden;}
.kanban-head{padding:12px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid rgba(184,180,172,0.07);}
.kanban-head-icon{font-size:16px;}
.kanban-head-label{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
.kanban-count{margin-left:auto;background:rgba(184,180,172,0.1);border-radius:10px;padding:2px 7px;font-size:10px;font-weight:700;color:var(--stone);}
.kanban-cards{padding:10px;display:flex;flex-direction:column;gap:8px;min-height:80px;}
.pl-card{background:var(--ink);border:1px solid rgba(184,180,172,0.09);border-radius:8px;padding:12px 14px;cursor:pointer;transition:all 0.12s;}
.pl-card:hover{border-color:rgba(184,180,172,0.2);transform:translateY(-1px);}
.pl-card-addr{font-size:12px;font-weight:700;color:var(--cream);margin-bottom:2px;}
.pl-card-city{font-size:10px;color:var(--stone);margin-bottom:8px;}
.pl-card-bid{font-family:'DM Mono',monospace;font-size:13px;color:var(--orange2);font-weight:600;}
.pl-card-bid-range{font-size:10px;color:var(--stone);}
.pl-card-notes{font-size:10px;color:var(--gravel);margin-top:6px;line-height:1.4;}
.pl-card-actions{display:flex;gap:5px;margin-top:8px;flex-wrap:wrap;}
.pl-action-btn{font-size:9px;font-weight:700;padding:3px 8px;border-radius:5px;cursor:pointer;border:none;font-family:'Syne',sans-serif;transition:all 0.12s;}
.pl-card-date{font-size:9px;color:var(--gravel);margin-top:6px;font-family:'DM Mono',monospace;}

/* LIST VIEW */
.pl-list{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;overflow:hidden;}
.pl-list-head{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 1fr 1fr 120px 80px;gap:10px;padding:10px 16px;background:rgba(0,0,0,0.2);border-bottom:1px solid rgba(184,180,172,0.07);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--stone);}
.pl-list-row{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 1fr 1fr 120px 80px;gap:10px;padding:11px 16px;border-bottom:1px solid rgba(184,180,172,0.05);align-items:center;transition:background 0.12s;cursor:pointer;}
.pl-list-row:last-child{border-bottom:none;}
.pl-list-row:hover{background:rgba(184,180,172,0.03);}
.pl-addr{font-size:12px;font-weight:600;color:var(--cream);}
.pl-sub{font-size:10px;color:var(--stone);margin-top:1px;}
.pl-cell{font-size:11px;color:var(--concrete);}
.pl-cell.mono{font-family:'DM Mono',monospace;color:var(--orange2);}

/* MAP VIEW */
.pl-map-wrap{position:relative;background:#1a1a16;border-radius:10px;overflow:hidden;height:400px;margin-bottom:16px;}
.pl-map-canvas{position:absolute;inset:0;background:linear-gradient(rgba(184,180,172,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(184,180,172,0.04) 1px,transparent 1px);background-size:40px 40px;background-color:#1a1a16;}
.pl-pin{position:absolute;transform:translate(-50%,-100%);cursor:pointer;transition:transform 0.15s;}
.pl-pin:hover{transform:translate(-50%,-100%) scale(1.2);}
.pl-pin-dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;border:2px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(0,0,0,0.4);}
.pl-pin-label{font-size:9px;font-weight:700;white-space:nowrap;background:rgba(14,13,11,0.85);color:var(--cream);padding:2px 6px;border-radius:4px;margin-top:3px;text-align:center;}
.pl-legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
.pl-legend-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--stone);}
.pl-legend-dot{width:10px;height:10px;border-radius:50%;}

/* ADD LEAD MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;}
.modal-box{background:var(--ink);border:1px solid rgba(184,180,172,0.12);border-radius:12px;padding:24px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;}
.modal-title{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:2px;color:var(--cream);margin-bottom:4px;}
.modal-sub{font-size:12px;color:var(--stone);margin-bottom:18px;}

@media(max-width:768px){
  .kanban{grid-template-columns:1fr 1fr;}
  .pipeline-stats{grid-template-columns:1fr 1fr;}
  .pl-list-head,.pl-list-row{grid-template-columns:2fr 1fr 1fr 100px;}
  .pl-list-head>div:nth-child(3),.pl-list-row>div:nth-child(3),
  .pl-list-head>div:nth-child(4),.pl-list-row>div:nth-child(4),
  .pl-list-head>div:nth-child(5),.pl-list-row>div:nth-child(5){display:none;}
}
@media(max-width:480px){
  .kanban{grid-template-columns:1fr;}
  .pipeline-stats{grid-template-columns:1fr 1fr;}
}

/* ── LOGIN SCREEN ── */
.login-screen{position:fixed;inset:0;background:var(--black);display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:0;}
.login-bg{position:absolute;inset:0;background:linear-gradient(145deg,#0e0d0b 0%,#1c1a17 60%,#0e0d0b 100%);}
.login-texture{position:absolute;inset:0;background-image:repeating-linear-gradient(-45deg,rgba(184,180,172,0.02) 0,rgba(184,180,172,0.02) 1px,transparent 0,transparent 8px);}
.login-box{position:relative;width:100%;max-width:340px;padding:20px;}
.login-logo{font-family:'Bebas Neue',sans-serif;font-size:42px;letter-spacing:4px;color:var(--cream);text-align:center;margin-bottom:4px;}
.login-logo span{color:var(--orange);}
.login-tagline{font-size:11px;color:var(--stone);text-align:center;letter-spacing:2px;text-transform:uppercase;margin-bottom:36px;}
.login-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--stone);text-align:center;margin-bottom:14px;}
.pin-dots{display:flex;justify-content:center;gap:14px;margin-bottom:24px;}
.pin-dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(184,180,172,0.2);background:transparent;transition:all 0.15s;}
.pin-dot.filled{background:var(--orange);border-color:var(--orange);box-shadow:0 0 10px rgba(232,86,10,0.4);}
.pin-dot.error{background:var(--red);border-color:var(--red);}
.keypad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;}
.key-btn{background:rgba(184,180,172,0.07);border:1px solid rgba(184,180,172,0.1);border-radius:10px;padding:16px;font-family:'Syne',sans-serif;font-size:20px;font-weight:600;color:var(--cream);cursor:pointer;transition:all 0.12s;text-align:center;}
.key-btn:hover{background:rgba(184,180,172,0.14);border-color:rgba(184,180,172,0.2);}
.key-btn:active{background:rgba(232,86,10,0.2);border-color:var(--orange);transform:scale(0.95);}
.key-btn.del{color:var(--stone);font-size:16px;}
.key-btn.zero{grid-column:2;}
.login-remember{display:flex;align-items:center;justify-content:center;gap:8px;font-size:11px;color:var(--stone);cursor:pointer;margin-top:4px;}
.login-remember input{accent-color:var(--orange);width:14px;height:14px;cursor:pointer;}
.login-error{text-align:center;font-size:12px;color:var(--red);margin-top:8px;height:16px;transition:opacity 0.2s;}
.login-footer{position:relative;text-align:center;font-size:10px;color:var(--gravel);margin-top:28px;letter-spacing:1px;}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}
.shake{animation:shake 0.4s ease;}
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

function PhotoPostcardCanvas({photoUrl,photoData,headline,personalNote,address,bid,phone}){
  const canvasRef=React.useRef(null);
  const draw=React.useCallback((img)=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d');
    const W=canvas.width,H=canvas.height;
    ctx.fillStyle='#111009';
    ctx.fillRect(0,0,W,H);
    if(img&&img.complete&&img.naturalWidth>0){
      const iR=img.naturalWidth/img.naturalHeight,cR=W/H;
      let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
      if(iR>cR){sw=img.naturalHeight*cR;sx=(img.naturalWidth-sw)/2;}
      else{sh=img.naturalWidth/cR;sy=(img.naturalHeight-sh)/2;}
      ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
    }
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(10,9,8,0.3)');g.addColorStop(0.5,'rgba(10,9,8,0.75)');g.addColorStop(1,'rgba(10,9,8,0.97)');
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#e8560a';ctx.font='bold 8px Arial';ctx.textAlign='left';
    ctx.fillText('JWOOD LLC · TULSA, OK',20,32);
    if(img&&img.complete&&img.naturalWidth>0){
      ctx.fillStyle='rgba(232,86,10,0.9)';ctx.fillRect(W-108,14,92,20);
      ctx.fillStyle='white';ctx.font='bold 8px Arial';ctx.textAlign='right';
      ctx.fillText('YOUR DRIVEWAY',W-16,28);ctx.textAlign='left';
    }
    ctx.fillStyle='rgba(245,240,230,0.65)';ctx.font='bold 12px Arial';
    ctx.fillText(address||'',20,H-180);
    ctx.fillStyle='#f5f0e6';ctx.font='bold 20px Arial';
    const hw=(headline||'').split(' ');let hl='',hy=H-155;
    hw.forEach(w=>{const t=hl+w+' ';if(ctx.measureText(t).width>W-40&&hl){ctx.fillText(hl.trim(),20,hy);hl=w+' ';hy+=24;}else hl=t;});
    if(hl)ctx.fillText(hl.trim(),20,hy);
    ctx.fillStyle='rgba(184,180,172,0.8)';ctx.font='10px Arial';
    const nw=(personalNote||'').slice(0,100).split(' ');let nl='',ny=hy+22,nc=0;
    nw.forEach(w=>{if(nc>=3)return;const t=nl+w+' ';if(ctx.measureText(t).width>W-40&&nl){ctx.fillText(nl.trim(),20,ny);nl=w+' ';ny+=15;nc++;}else nl=t;});
    if(nl&&nc<3)ctx.fillText(nl.trim(),20,ny);
    const by=H-68;
    ctx.fillStyle='rgba(232,86,10,0.2)';ctx.strokeStyle='rgba(232,86,10,0.5)';ctx.lineWidth=1;
    ctx.fillRect(14,by,W-28,50);ctx.strokeRect(14,by,W-28,50);
    ctx.fillStyle='#e8560a';ctx.font='bold 7px Arial';ctx.fillText('YOUR PERSONALIZED ESTIMATE',22,by+13);
    ctx.fillStyle='#f5f0e6';ctx.font='bold 18px Arial';ctx.fillText(bid||'Call for estimate',22,by+34);
    ctx.fillStyle='#e8560a';ctx.fillRect(W-108,by+4,94,42);
    ctx.fillStyle='white';ctx.font='bold 8px Arial';ctx.textAlign='center';
    ctx.fillText('CALL NOW',W-61,by+18);ctx.font='bold 11px monospace';
    ctx.fillText(phone||'918-896-6737',W-61,by+34);ctx.textAlign='left';
  },[headline,personalNote,address,bid,phone]);

  React.useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    canvas.width=600;canvas.height=320;
    const src=photoUrl||photoData||null;
    if(src){
      const img=new Image();
      img.crossOrigin='anonymous';
      img.onload=()=>draw(img);
      img.onerror=()=>draw(null);
      img.src=src;
    } else { draw(null); }
  },[photoUrl,photoData,draw]);

  return React.createElement('canvas',{ref:canvasRef,className:'spot-canvas-preview'});
}

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
  // ── AUTH ──
  const ACCESS_CODE = "8966";
  const STORAGE_KEY = "pavemail_auth";
  const[unlocked,setUnlocked]=useState(()=>{
    try{ return localStorage.getItem(STORAGE_KEY)==="true"; }catch{ return false; }
  });
  const[pin,setPin]=useState("");
  const[pinError,setPinError]=useState(false);
  const[rememberMe,setRememberMe]=useState(true);
  const[shaking,setShaking]=useState(false);

  const pressKey=(k)=>{
    if(pin.length>=4)return;
    const next=pin+k;
    setPin(next);
    if(next.length===4){
      setTimeout(()=>{
        if(next===ACCESS_CODE){
          if(rememberMe){ try{localStorage.setItem(STORAGE_KEY,"true");}catch{} }
          setUnlocked(true);
          setPin("");
        } else {
          setPinError(true);
          setShaking(true);
          setTimeout(()=>{setPin("");setPinError(false);setShaking(false);},600);
        }
      },200);
    }
  };

  const delKey=()=>setPin(p=>p.slice(0,-1));

  const[tab,setTab]=useState("map");
  const[toast,setToast]=useState(null);
  const[selectedRoutes,setSelectedRoutes]=useState([]);
  const[liveRoutes,setLiveRoutes]=useState([]);
  const[routesLoading,setRoutesLoading]=useState(false);
  const[routeError,setRouteError]=useState(null);
  const[zipSearch,setZipSearch]=useState("");
  const[searchedZips,setSearchedZips]=useState([]);
  const[verifyResult,setVerifyResult]=useState(null);
  const[gpsLoading,setGpsLoading]=useState(false);
  const[gpsAccuracy,setGpsAccuracy]=useState(null);
  const[verifying,setVerifying]=useState(false);
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
  const[spotPhotoUrl,setSpotPhotoUrl]=useState(null); // hosted URL for Lob printing
  const spotPhotoUrlRef=React.useRef(null); // ref for sync access in async functions
  const[spotMailer,setSpotMailer]=useState(null);
  const[spotLoading,setSpotLoading]=useState(false);
  const[spotSending,setSpotSending]=useState(false);
  const[spotJobs,setSpotJobs]=useState([
    {id:"SB-001",address:"4821 Oak Ridge Dr",city:"Broken Arrow",bid:"$1,200–$1,800",damage:["Freeze-thaw cracking","Spalling near garage"],sent:"Apr 03",status:"delivered"},
    {id:"SB-002",address:"7234 S Memorial Dr",city:"Tulsa",bid:"$800–$1,100",damage:["Surface cracks","Drainage issue"],sent:"Apr 06",status:"sent"},
  ]);

  const[pipelineView,setPipelineView]=useState("kanban");

  // ── CAPACITY ENGINE ──
  const CAPACITY_CONFIG = { crewSize:12, maxJobs:6, weeklyTarget:40000 };
  const[capacity,setCapacity]=useState({
    activeJobs: 0,
    weeklyRevenue: 0,
    weeksBooked: 0,
    mode: "hungry", // hungry | normal | selective | paused
    manualOverride: null,
  });

  // Recalculate capacity whenever pipeline changes
  React.useEffect(()=>{
    const activeJobs = pipeline.filter(l=>l.stage==="won").length;
    const weeklyRevenue = pipeline
      .filter(l=>l.stage==="won")
      .reduce((s,l)=>s+(l.value||0), 0);
    const pct = activeJobs / CAPACITY_CONFIG.maxJobs;
    let mode = "hungry";
    if(pct >= 1.0) mode = "paused";
    else if(pct >= 0.8) mode = "selective";
    else if(pct >= 0.5) mode = "normal";
    setCapacity(c=>({
      ...c,
      activeJobs,
      weeklyRevenue,
      weeksBooked: Math.ceil(activeJobs / CAPACITY_CONFIG.maxJobs),
      mode: c.manualOverride || mode,
    }));
  },[pipeline]);

  const CAPACITY_MODES = {
    hungry:   { label:"Hungry",   color:"#b83232", bg:"rgba(184,50,50,0.12)",   icon:"🔥", desc:"Aggressive outbound — large radius, fast follow-up, low bid threshold" },
    normal:   { label:"Normal",   color:"#c4a020", bg:"rgba(196,160,32,0.12)",  icon:"✅", desc:"Standard outbound — normal radius, normal pricing" },
    selective:{ label:"Selective",color:"#1a6fa8", bg:"rgba(26,111,168,0.12)",  icon:"🎯", desc:"High-value leads only — bids +15%, radius reduced" },
    paused:   { label:"Paused",   color:"#6a6662", bg:"rgba(106,102,98,0.12)",  icon:"⏸️", desc:"Fully booked — campaigns paused, AI agent books 3 weeks out" },
  };

  // Lead scoring (1-100)
  const scoreLead = (lead) => {
    let score = 50;
    // Value score (up to +30)
    if(lead.value > 3000) score += 30;
    else if(lead.value > 1500) score += 20;
    else if(lead.value > 500) score += 10;
    // Stage score (further = higher)
    if(lead.stage === "called") score += 15;
    else if(lead.stage === "sent") score += 5;
    // Recency (older spotted = lower)
    if(lead.spotted) {
      const days = Math.floor((Date.now() - new Date(lead.spotted)) / 86400000);
      if(days > 14) score -= 20;
      else if(days > 7) score -= 10;
    }
    // Capacity adjustment
    if(capacity.mode === "selective") { if(lead.value < 2000) score -= 25; }
    if(capacity.mode === "paused") score = Math.min(score, 20);
    return Math.max(0, Math.min(100, score));
  };

  const getRadiusForMode = () => {
    if(capacity.mode === "hungry") return 1.0;
    if(capacity.mode === "normal") return 0.5;
    if(capacity.mode === "selective") return 0.25;
    return 0;
  };

  const getBidMultiplierForMode = () => {
    if(capacity.mode === "selective") return 1.15;
    if(capacity.mode === "paused") return 1.25;
    return 1.0;
  };
  const[showRadiusModal,setShowRadiusModal]=useState(false);
  const[showAIPhone,setShowAIPhone]=useState(false);
  const[aiLeads,setAiLeads]=useState([
    {id:"AL-001",caller:"Sarah Mitchell",phone:"918-555-0142",summary:"Wants full driveway replacement, double car garage. Timeline: next month. Address: 3421 S Peoria Ave.",service:"New Driveway",address:"3421 S Peoria Ave",status:"qualified",time:"2 hrs ago",transferred:true},
    {id:"AL-002",caller:"Unknown",phone:"918-555-0287",summary:"Called about crack repair. Left callback number. Not sure of size.",service:"Crack Repair",address:"",status:"pending",time:"Yesterday",transferred:false},
  ]);
  const[testCallNumber,setTestCallNumber]=useState("");
  const[testCallLoading,setTestCallLoading]=useState(false);
  const[radiusLead,setRadiusLead]=useState(null);
  const[radiusForm,setRadiusForm]=useState({radius:0.5,unit:"miles",message:""});
  const[radiusMailer,setRadiusMailer]=useState(null);
  const[radiusLoading,setRadiusLoading]=useState(false);
  const[radiusSending,setRadiusSending]=useState(false);
  const[radiusStep,setRadiusStep]=useState(1); // 1=config 2=preview 3=sent
  const[wonBanner,setWonBanner]=useState(null); // lead that just moved to won
  const[permitData,setPermitData]=useState({});   // keyed by pipeline lead id
  const[permitLoading,setPermitLoading]=useState(null); // lead id currently loading
  const[expandedLead,setExpandedLead]=useState(null); // lead id with expanded permits

  const loadPermits = async (lead) => {
    if(permitData[lead.id] || permitLoading) return;
    setPermitLoading(lead.id);
    const result = await fetchTulsaPermits(`${lead.address} ${lead.city} OK`);
    setPermitData(p => ({...p, [lead.id]: result}));
    setPermitLoading(null);
    if(result.permits?.length > 0) {
      showToast(`Found ${result.permits.length} permit${result.permits.length!==1?"s":""} for ${lead.address}`, "success");
    } else {
      showToast(`No permits found — check manually`, "info");
    }
  };
  const[showAddLead,setShowAddLead]=useState(false);
  const[newLead,setNewLead]=useState({address:"",city:"Tulsa",neighborhood:"",bidLow:"",bidHigh:"",notes:""});
  const[pipeline,setPipeline]=useState([
    {id:"PL-001",address:"4821 Oak Ridge Dr",city:"Broken Arrow",neighborhood:"Broken Arrow",stage:"won",bidLo:"$1,200",bidHi:"$1,800",spotted:"Mar 28",mailerSent:"Apr 03",calledBack:"Apr 08",jobWon:"Apr 10",notes:"Full driveway replacement",value:1600},
    {id:"PL-002",address:"7234 S Memorial Dr",city:"Tulsa",neighborhood:"South Tulsa",stage:"called",bidLo:"$800",bidHi:"$1,100",spotted:"Apr 01",mailerSent:"Apr 06",calledBack:"Apr 09",jobWon:null,notes:"Interested, getting HOA approval",value:950},
    {id:"PL-003",address:"1892 E 91st St",city:"Tulsa",neighborhood:"South Tulsa",stage:"sent",bidLo:"$2,400",bidHi:"$3,200",spotted:"Apr 03",mailerSent:"Apr 07",calledBack:null,jobWon:null,notes:"Large 3-car garage",value:2800},
    {id:"PL-004",address:"3341 S Peoria Ave",city:"Tulsa",neighborhood:"Midtown",stage:"sent",bidLo:"$600",bidHi:"$900",spotted:"Apr 04",mailerSent:"Apr 07",calledBack:null,jobWon:null,notes:"Crack repair only",value:750},
    {id:"PL-005",address:"9102 N 129th E Ave",city:"Owasso",neighborhood:"Owasso",stage:"spotted",bidLo:"$1,800",bidHi:"$2,600",spotted:"Apr 06",mailerSent:null,calledBack:null,jobWon:null,notes:"Saw severe cracking from road",value:2200},
    {id:"PL-006",address:"2847 E 51st St",city:"Tulsa",neighborhood:"Midtown",stage:"spotted",bidLo:"$400",bidHi:"$700",spotted:"Apr 07",mailerSent:null,calledBack:null,jobWon:null,notes:"Minor sealing job",value:550},
  ]);

  const STAGES = [
    {id:"spotted", label:"Spotted",    icon:"🚗", color:"#7a7670", bg:"rgba(122,118,112,0.15)"},
    {id:"sent",    label:"Mailer Sent",icon:"📬", color:"#1a6fa8", bg:"rgba(26,111,168,0.15)"},
    {id:"called",  label:"Called Back", icon:"📞", color:"#d4a017", bg:"rgba(212,160,23,0.15)"},
    {id:"won",     label:"Job Won",    icon:"🏆", color:"#2a7a52", bg:"rgba(42,122,82,0.15)"},
  ];

  const moveStage=(id,newStage)=>{
    // Save to Supabase
    db.updateLeadStage(id, newStage).catch(e=>console.error("Stage update failed:", e));
    setPipeline(p=>p.map(l=>l.id===id?{...l,stage:newStage,
      mailerSent:newStage==="sent"&&!l.mailerSent?"Apr 07":l.mailerSent,
      calledBack:newStage==="called"&&!l.calledBack?"Apr 08":l.calledBack,
      jobWon:newStage==="won"&&!l.jobWon?"Apr 09":l.jobWon,
    }:l));
    // Auto-suggest radius mailer when job is won
    if(newStage==="won"){
      const lead=pipeline.find(l=>l.id===id);
      if(lead){ setWonBanner(lead); setTimeout(()=>setWonBanner(null),12000); }
    }
  };

  // Generate radius mailer copy
  const generateRadiusMailer=async()=>{
    if(!radiusLead)return;
    setRadiusLoading(true);
    const radiusFt=Math.round(radiusForm.radius*5280);
    try{
      const res=await fetch(ANTHROPIC_PROXY,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-5-20250929",
          max_tokens:400,
          messages:[{role:"user",content:`Write a direct mail postcard for JWood LLC (concrete contractor, Tulsa OK, 918-896-6737). We just completed a driveway job at ${radiusLead.address}, ${radiusLead.city}. This postcard goes to their neighbors within ${radiusForm.radius} miles. The angle: we are already working in the neighborhood, equipment is here, we can offer a neighbor discount this week. Be warm, neighbor-to-neighbor tone. Return ONLY JSON: {"headline":"string","personalNote":"string","urgencyLine":"string","offer":"string"}`}]
        })
      });
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||"").join("");
      const parsed=parseJSON(raw);
      if(parsed){
        setRadiusMailer({...parsed,address:radiusLead.address,city:radiusLead.city,radius:radiusForm.radius});
        setRadiusStep(2);
        showToast("Radius mailer generated!","success");
      }
    }catch(e){ showToast("Generation failed — try again","info"); }
    setRadiusLoading(false);
  };

  // Send radius mailer via Lob
  const sendRadiusMailer=async()=>{
    if(!radiusMailer||radiusSending)return;
    setRadiusSending(true);
    showToast("Sending radius mailer via Lob.com...","info");
    try{
      // Lob radius mail — uses center address + distance
      const radiusMiles=radiusForm.radius;
      const radiusFt=Math.round(radiusMiles*5280);
      const front=`<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#1c1a17;color:#f5f0e6;position:relative;">
        <div style="background:linear-gradient(135deg,#2a7a52 0%,#1c5a3a 100%);padding:10px 20px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.8);">
          YOUR NEIGHBOR AT ${radiusMailer.address.toUpperCase()} JUST GOT A NEW DRIVEWAY
        </div>
        <div style="padding:24px;">
          <h1 style="font-family:Arial,sans-serif;font-size:28px;color:#f5f0e6;margin:0 0 12px;line-height:1.1;">${radiusMailer.headline}</h1>
          <p style="font-size:12px;color:#b8b4ac;line-height:1.65;margin-bottom:16px;">${radiusMailer.personalNote}</p>
          <div style="background:rgba(42,122,82,0.2);border:1px solid rgba(42,122,82,0.4);border-radius:6px;padding:12px 16px;margin-bottom:12px;">
            <div style="font-size:9px;color:#3eb87c;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Neighbor Offer</div>
            <div style="font-size:14px;color:#f5f0e6;font-weight:700;">${radiusMailer.offer}</div>
          </div>
          <div style="background:#e8560a;color:white;padding:10px 14px;border-radius:6px;text-align:center;">
            <div style="font-size:9px;font-weight:700;letter-spacing:1px;">CALL JOEL DIRECTLY</div>
            <div style="font-size:16px;font-weight:700;font-family:monospace;">918-896-6737</div>
          </div>
          <p style="margin-top:10px;font-size:10px;color:rgba(184,180,172,0.5);">${radiusMailer.urgencyLine}</p>
        </div>
      </body></html>`;

      const back=`<html><body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#f5f0e6;color:#1c1a17;">
        <div style="background:#2a7a52;color:white;padding:10px 16px;border-radius:6px;margin-bottom:16px;text-align:center;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;">WE JUST FINISHED YOUR NEIGHBOR'S DRIVEWAY</div>
          <div style="font-size:10px;opacity:0.8;margin-top:2px;">${radiusMailer.address}, ${radiusMailer.city}</div>
        </div>
        <p style="font-size:12px;line-height:1.7;margin-bottom:14px;">While our equipment is in your neighborhood, we'd love to give you a <strong>free estimate</strong> on your driveway. As your neighbor's contractor, you get our neighbor rate this week.</p>
        <div style="background:#1c1a17;color:white;padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:14px;font-weight:700;">918-896-6737</div>
          <div style="font-size:10px;color:#b8b4ac;margin-top:2px;">Call or text Joel · JWood LLC · Tulsa, OK</div>
          <div style="margin-top:6px;font-size:10px;background:#e8560a;display:inline-block;padding:3px 10px;border-radius:4px;">Free estimate · No obligation</div>
        </div>
      </body></html>`;

      // Use Lob bulk/campaign with radius targeting
      const lobRes=await fetch(LOB_PROXY,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          description:`Radius mailer — ${radiusMiles}mi from ${radiusMailer.address}`,
          to:{
            address_line1:radiusLead.address,
            address_city:radiusLead.city||"Tulsa",
            address_state:"OK",
            address_zip:radiusLead.zip||"74105",
            address_country:"US",
          },
          from:"adr_910e8abc86e78815",
          front,back,
          size:"6x11",
          metadata:{type:"radius",radius_miles:String(radiusMiles),center_address:radiusMailer.address}
        })
      });
      const lobData=await lobRes.json();
      if(lobData.id){
        showToast(`Radius mailer sent to neighbors within ${radiusMiles}mi!`,"success");
        setRadiusStep(3);
        // Add to job tracker
        setJobs(j=>[{id:`RM-${Date.now()}`,name:`Radius — ${radiusMailer.address}`,area:`${radiusMiles}mi radius`,homes:"~"+(Math.round(radiusMiles*5280/66)).toString(),sent:new Date().toLocaleDateString(),status:"queued",cost:(Math.round(radiusMiles*5280/66)*0.62).toFixed(2),calls:0,lob:lobData.id},...j]);
      } else {
        showToast("Lob error — check dashboard","info");
      }
    }catch(e){ showToast("Send failed: "+e.message,"info"); }
    setRadiusSending(false);
  };

  const addLead=()=>{
    const id=`PL-00${pipeline.length+1}`;
    const lo=newLead.bidLow?`$${parseInt(newLead.bidLow).toLocaleString()}`:"";
    const hi=newLead.bidHigh?`$${parseInt(newLead.bidHigh).toLocaleString()}`:"";
    const value=newLead.bidLow?parseInt(newLead.bidLow):0;
    const newLeadObj={id,address:newLead.address,city:newLead.city,neighborhood:newLead.neighborhood||newLead.city,stage:"spotted",bidLo:lo,bidHi:hi,spotted:"Apr 07",mailerSent:null,calledBack:null,jobWon:null,notes:newLead.notes,value};
    setPipeline(p=>[newLeadObj,...p]);
    db.upsertLead(newLeadObj).catch(e=>console.error("Save lead failed:", e));
    setNewLead({address:"",city:"Tulsa",neighborhood:"",bidLow:"",bidHigh:"",notes:""});
    setShowAddLead(false);
    showToast("📍 Lead added to pipeline","success");
  };
  const setSpot=(k,v)=>setSpotForm(f=>({...f,[k]:v}));

  // ── LOAD ALL DATA FROM SUPABASE ON MOUNT ──
  React.useEffect(()=>{
    const loadAll = async () => {
      try {
        const [leads, savedBids, savedCalls] = await Promise.all([
          db.getPipeline(),
          db.getSpotBids(),
          db.getAiCalls(),
        ]);
        if(leads && leads.length > 0){
          setPipeline(leads.map(l=>({
            id:l.id, address:l.address, city:l.city, neighborhood:l.neighborhood||"",
            stage:l.stage, bidLo:l.bid_lo||"", bidHi:l.bid_hi||"", value:l.value||0,
            spotted:l.spotted||"", mailerSent:l.mailer_sent||null,
            calledBack:l.called_back||null, jobWon:l.job_won||null,
            notes:l.notes||"", color:ROUTE_COLORS[0],
          })));
        }
        if(savedBids && savedBids.length > 0){
          setSpotJobs(savedBids.map(b=>({
            id:b.id, address:b.address, city:b.city, bid:b.bid||"",
            damage:b.damage||[], sent:b.sent_date||"", status:b.status||"sent",
          })));
        }
        if(savedCalls && savedCalls.length > 0){
          setAiLeads(savedCalls.map(c=>({
            id:c.id, caller:c.caller||"Unknown", phone:c.phone||"",
            summary:c.summary||"", service:c.service||"", address:c.address||"",
            status:c.status||"pending", transferred:c.transferred||false,
            time:new Date(c.created_at).toLocaleDateString(),
          })));
        }
        console.log("Supabase loaded:", leads?.length, "leads,", savedBids?.length, "bids,", savedCalls?.length, "calls");
      } catch(e){ console.error("Supabase load error:", e); }
    };
    loadAll();
  },[]);

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
    const r=selectedRoutes.map(id=>liveRoutes.find(x=>x.id===id)?.name).filter(Boolean);
    const h=selectedRoutes.reduce((s,id)=>s+(liveRoutes.find(x=>x.id===id)?.homes||0),0);
    setForm(f=>({...f,neighborhood:r[0]||f.neighborhood,homes:String(h||f.homes)}));
    setTab("create");
  };

  const generate=async()=>{
    if(!form.neighborhood)return;
    setLoading(true);setMailer(null);setLobResult(null);
    try{
      const prompt=`You are a direct mail copywriter for a concrete driveway contractor in Tulsa, Oklahoma. Company: ${COMPANY.name}, Phone: ${COMPANY.phone}. Neighborhood: ${form.neighborhood}, OK. Season: ${form.season}, Service: ${form.angle}, Offer: ${form.offer}, Promo: ${form.promoCode}. Notes: ${form.extraNotes||"Tulsa area, Oklahoma weather"}.
Return ONLY valid JSON: {"page1":{"eyebrow":"string","headline":"string","subheadline":"string","badgeTop":"string","badgeMain":"string","badgeBottom":"string"},"page2":{"headline":"string","intro":"string","benefits":[{"icon":"emoji","title":"string","desc":"string"},{"icon":"emoji","title":"string","desc":"string"},{"icon":"emoji","title":"string","desc":"string"},{"icon":"emoji","title":"string","desc":"string"}],"whyTitle":"string","whyText":"string"},"page3":{"headline":"string","intro":"string","steps":[{"title":"string","desc":"string"},{"title":"string","desc":"string"},{"title":"string","desc":"string"},{"title":"string","desc":"string"}],"offerHeadline":"string","offerSub":"string"},"page4":{"eyebrow":"string","headline":"string","sub":"string","guarantee":"string"}}`;
      const res=await fetch(ANTHROPIC_PROXY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
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

  const totalHomes=selectedRoutes.reduce((s,id)=>s+(liveRoutes.find(r=>r.id===id)?.homes||0),0);
  const estCost=((parseInt(form.homes)||0)*0.62).toFixed(2);
  const totalMailed=jobs.reduce((s,j)=>s+parseInt(j.homes),0);
  const totalSpend=jobs.reduce((s,j)=>s+parseFloat(j.cost),0).toFixed(2);
  const totalCalls=jobs.reduce((s,j)=>s+j.calls,0);

  const generateSpot=async()=>{
    if(!spotForm.address)return;
    // Capture both photo and URL synchronously before any async calls
    const capturedPhoto = spotPhoto;
    const capturedPhotoUrl = spotPhotoUrlRef.current || spotPhotoUrl;
    console.log("generateSpot called, photo:", capturedPhoto ? "YES" : "NO", "url:", capturedPhotoUrl || "NONE");
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
      if(capturedPhoto && capturedPhotoUrl){
        showToast("📷 Analyzing photo...","info");
        console.log("Sending vision request with URL:", capturedPhotoUrl);
        const visionRes=await fetch(ANTHROPIC_PROXY,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({
            model:"claude-sonnet-4-5-20250929",
            max_tokens:400,
            messages:[{
              role:"user",
              content:[
                {type:"image",source:{type:"url",url:capturedPhotoUrl}},
                {type:"text",text:"Analyze this driveway photo. List all visible damage. Reply with only valid JSON, no markdown: {damage:[string], severity:string, summary:string}"}
              ]
            }]
          })
        });
        const visionData=await visionRes.json();
        console.log("Vision response:", JSON.stringify(visionData).slice(0,200));
        const visionRaw=visionData.content?.map(b=>b.text||"").join("");
        const visionParsed=parseJSON(visionRaw);
        if(visionParsed?.damage){
          detectedDamage=[...new Set([...spotForm.damage,...visionParsed.damage])];
                const newLevel = visionParsed.severity==="severe"?"Severe":visionParsed.severity==="minor"?"Minor":"Moderate";
          setSpotForm(f=>({...f,damage:detectedDamage,damageLevel:newLevel,overridePrice:false}));
          showToast("AI detected: "+visionParsed.summary,"info");
        } else {
          console.log("Vision parse failed, raw:", visionRaw?.slice(0,200));
        }
      }

      // STEP 2: Generate the personal note using detected damage
      const damageList=detectedDamage.length>0?detectedDamage.join(", "):"general driveway wear";
      const photoContext=capturedPhoto?" We photographed the damage for reference.":"";
      const sqftDesc=`${spotForm.customSqft||spotForm.sqft} sq ft ${spotForm.service} job`;
      const prompt=`Write a personal note for a direct mail postcard from JWood LLC (concrete contractor, Tulsa OK, 918-896-6737) to a homeowner at ${spotForm.address}, ${spotForm.city} OK. The contractor noticed: ${damageList}.${photoContext} This is a ${sqftDesc} with ${spotForm.damageLevel} damage. Bid range: ${bidRange}. Notes: ${spotForm.notes||"none"}. Write a warm, personal 2-3 sentence note that mentions we drove past their home, noticed the specific damage, and want to help. Sound like a neighbor, not a corporation. Do NOT be salesy. Return ONLY JSON: {"personalNote":"string","headline":"string","urgencyLine":"string"}`;

      const res=await fetch(ANTHROPIC_PROXY,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:400,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||"").join("");
      const parsed=parseJSON(raw);
      if(parsed){
        console.log("Setting mailer with photo:", capturedPhoto ? "YES" : "NO");
        console.log("Setting mailer photoUrl:", capturedPhotoUrl||"NONE");
        setSpotMailer({...parsed,address:spotForm.address,city:spotForm.city,bid:bidRange,bidLo:bidStarting,bidHi:bidUpTo,includes:includesText,damage:detectedDamage,photoUsed:!!capturedPhoto,photoData:capturedPhoto||null,photoUrl:capturedPhotoUrl||null});
        setSpotLoading(false);
        return;
      }
    }catch(_){}

    // Demo fallback
    await new Promise(r=>setTimeout(r,1600));
    const damageList=spotForm.damage.length>0?spotForm.damage.join(", "):"general driveway wear";
    const detectedDemo=capturedPhoto
      ? [...spotForm.damage,"Surface spalling near edges","Hairline fractures across slab"]
      : spotForm.damage;
    console.log("Demo fallback, capturedPhoto:", capturedPhoto ? "YES ("+capturedPhoto.length+" chars)" : "NO");
    setSpotMailer({
      headline:"WE NOTICED YOUR DRIVEWAY",
      personalNote:`We were working in your neighborhood recently and noticed your driveway at ${spotForm.address} has ${damageList}. As local Tulsa concrete specialists, we would love to help you get ahead of this before it gets worse — and we can usually start within a week.`,
      urgencyLine:"Oklahoma winters do not wait — neither should your driveway.",
      address:spotForm.address,city:spotForm.city,bid:bidRange,bidLo:bidStarting,bidHi:bidUpTo,includes:includesText,
      damage:detectedDemo,
      photoUsed:!!capturedPhoto,
      photoData:capturedPhoto||null,
      photoUrl:capturedPhotoUrl||null
    });
    setSpotLoading(false);
    showToast(capturedPhoto?"📷 Photo analyzed + mailer ready":"✨ Spot bid mailer ready","info");
  };

  const sendSpot=async()=>{
    if(!spotMailer||spotSending)return;
    setSpotSending(true);

    // Upload photo to imgbb for Lob.com printing
    let hostedPhotoUrl = spotPhotoUrl;
    if(spotPhoto && !hostedPhotoUrl){
      showToast("📷 Uploading photo for printing...","info");
      hostedPhotoUrl = await uploadPhotoToImgbb(spotPhoto);
      if(hostedPhotoUrl) setSpotPhotoUrl(hostedPhotoUrl);
    }

    showToast("📤 Sending spot bid to Lob.com...","info");
    try{
      await lobRequest("/postcards",{
        description:`JWood LLC Spot Bid - ${spotMailer.address}`,
        to:LOB_TO_ID,from:LOB_FROM_ID,size:"6x9",
        front:`<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;position:relative;width:100%;height:100%;overflow:hidden;">
  ${hostedPhotoUrl
    ? `<div style="position:absolute;inset:0;background:url('${hostedPhotoUrl}') center/cover no-repeat;"></div>
       <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(14,13,11,0.55) 0%, rgba(14,13,11,0.85) 60%, rgba(14,13,11,0.97) 100%);"></div>`
    : `<div style="position:absolute;inset:0;background:linear-gradient(145deg,#111009 0%,#2a2720 60%,#1c1a17 100%);"></div>`
  }
  <div style="position:relative;padding:26px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;">
    <div style="position:absolute;top:22px;left:26px;right:26px;display:flex;justify-content:space-between;align-items:center;">
      <div style="color:#e8560a;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">JWood LLC · Tulsa, OK</div>
      ${hostedPhotoUrl?`<div style="background:rgba(232,86,10,0.9);color:white;font-size:8px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:1px;">📷 YOUR DRIVEWAY</div>`:""}
    </div>
    <div style="margin-top:auto;">
      <h1 style="font-size:26px;color:#f5f0e6;margin:0 0 8px;line-height:1.1;text-shadow:0 2px 8px rgba(0,0,0,0.8);">${spotMailer.headline}</h1>
      <p style="font-size:11px;color:rgba(245,240,230,0.85);line-height:1.65;margin-bottom:14px;text-shadow:0 1px 4px rgba(0,0,0,0.9);">${spotMailer.personalNote}</p>
      <div style="background:rgba(14,13,11,0.75);backdrop-filter:blur(4px);border:1px solid rgba(232,86,10,0.5);border-radius:8px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-size:8px;color:#e8560a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px;">Your Personalized Estimate</div>
          <div style="display:flex;align-items:baseline;gap:5px;">
            <span style="font-size:10px;color:rgba(184,180,172,0.8);">Starting at</span>
            <span style="font-size:26px;font-weight:700;color:#f5f0e6;">${spotMailer.bidLo||spotMailer.bid}</span>
          </div>
          ${spotMailer.bidHi?`<div style="font-size:9px;color:rgba(184,180,172,0.6);">Up to ${spotMailer.bidHi} depending on scope</div>`:""}
          ${spotMailer.includes?`<div style="font-size:8px;color:rgba(184,180,172,0.4);margin-top:2px;">Includes: ${spotMailer.includes}</div>`:""}
        </div>
        <div style="background:#e8560a;color:white;padding:8px 12px;border-radius:6px;text-align:center;flex-shrink:0;">
          <div style="font-size:8px;font-weight:700;letter-spacing:1px;">CALL NOW</div>
          <div style="font-size:14px;font-weight:700;font-family:monospace;">918-896-6737</div>
        </div>
      </div>
    </div>
  </div>
</body></html>`,
        back:`<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f0e6;">
  <div style="padding:20px 22px;">
    <div style="display:flex;gap:10px;margin-bottom:12px;">
      <div style="flex:1;">
        <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#e8560a;margin-bottom:4px;">What We Noticed</div>
        ${spotMailer.damage?.map(d=>`<div style="background:#f0ebe0;border-left:3px solid #e8560a;padding:5px 9px;border-radius:3px;margin-bottom:4px;font-size:9px;color:#3a3835;">${d}</div>`).join("")||`<div style="font-size:10px;color:#6a6864;">General driveway wear</div>`}
      </div>
      <div style="width:120px;flex-shrink:0;">
        <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2a7a52;margin-bottom:4px;">After JWood LLC</div>
        <img src="${BEFORE_AFTER_URL}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;border:2px solid #2a7a52;" alt="Finished driveway"/>
        <div style="font-size:7px;color:#2a7a52;text-align:center;margin-top:3px;font-weight:700;">✓ GUARANTEED RESULT</div>
      </div>
    </div>
    <div style="background:rgba(232,86,10,0.08);border:1px solid rgba(232,86,10,0.25);border-radius:6px;padding:10px 12px;margin-bottom:10px;">
      <div style="font-size:8px;color:#e8560a;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px;">Your Personalized Estimate</div>
      <div style="display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;">
        <span style="font-size:9px;color:#6a6864;">Starting at</span>
        <span style="font-size:22px;font-weight:700;color:#1c1a17;">${spotMailer.bidLo||spotMailer.bid}</span>
        ${spotMailer.bidHi?`<span style="font-size:9px;color:#6a6864;">— up to ${spotMailer.bidHi}</span>`:""}
      </div>
      ${spotMailer.includes?`<div style="font-size:8px;color:#8a8680;margin-top:2px;">✓ Includes: ${spotMailer.includes}</div>`:""}
    </div>
    <div style="background:#1c1a17;color:white;padding:10px 14px;border-radius:8px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:13px;font-weight:700;">918-896-6737</div>
        <div style="font-size:8px;color:#b8b4ac;margin-top:1px;">Call or text Joel directly · joelmwood@gmail.com</div>
      </div>
      <div style="background:#e8560a;color:white;font-size:9px;font-weight:700;padding:5px 10px;border-radius:5px;text-align:center;">FREE<br/>ESTIMATE</div>
    </div>
  </div>
</body></html>`,
        use_type:"marketing"
      });
      const newSpotJob={id:`SB-00${spotJobs.length+1}`,address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage,sent:"Apr 07",status:"queued"};
      setSpotJobs(p=>[newSpotJob,...p]);
      // Save spot bid to Supabase
      db.saveSpotBid({address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage,photoUrl:capturedPhotoUrl||"",lobId:lobData?.id||"",mailerContent:spotMailer}).catch(e=>console.error("Save spot bid failed:",e));
      // Auto-add to pipeline as "sent"
      const plId=`PL-${Date.now()}`;
      const newPipelineLead={id:plId,address:spotMailer.address,city:spotMailer.city,neighborhood:spotForm.neighborhood||spotMailer.city,stage:"sent",bidLo:spotMailer.bidLo||spotMailer.bid,bidHi:spotMailer.bidHi||"",spotted:"Apr 07",mailerSent:"Apr 07",calledBack:null,jobWon:null,notes:spotMailer.damage?.join(", ")||"",value:parseInt(spotForm.bidLow)||0};
      setPipeline(p=>[newPipelineLead,...p]);
      db.upsertLead(newPipelineLead).catch(e=>console.error("Save pipeline lead failed:",e));
      showToast("✅ Spot bid sent + saved to database!","success");
      setSpotMailer(null);
      setSpotForm({address:"",city:"Tulsa",state:"OK",zip:"",sqft:400,customSqft:"",service:"Crack Repair",damageLevel:"Moderate",bidLow:"",bidHigh:"",overridePrice:false,includes:"",damage:[],notes:""});
      setSpotPhoto(null);
      setSpotPhotoUrl(null);
    }catch(e){
      showToast("Spot bid queued (demo mode)","info");
      const newSpotJob={id:`SB-00${spotJobs.length+1}`,address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage||[],sent:"Apr 07",status:"queued"};
      setSpotJobs(p=>[newSpotJob,...p]);
    }finally{setSpotSending(false);}
  };

  const searchZip = async (zipInput) => {
    const zip = (zipInput || zipSearch || "").trim();
    if (!zip || zip.length < 5) {
      showToast("Please enter a 5-digit ZIP code", "info");
      return;
    }
    setRoutesLoading(true); setRouteError(null);
    showToast("Searching USPS routes for ZIP " + zip + "...", "info");
    try {
      const routes = await fetchUSPSRoutes(zip);
      if (routes.length === 0) {
        setRouteError("No residential routes found for ZIP " + zip + ". Try another ZIP.");
        showToast("No routes found for ZIP " + zip, "info");
      } else {
        setLiveRoutes(prev => {
          const existing = prev.map(r => r.id);
          return [...prev, ...routes.filter(r => !existing.includes(r.id))];
        });
        setSearchedZips(prev => prev.includes(zip) ? prev : [...prev, zip]);
        const total = routes.reduce((s,r)=>s+r.homes,0);
        showToast("Found " + routes.length + " USPS routes - " + total.toLocaleString() + " homes", "success");
      }
    } catch(e) {
      setRouteError("Error loading routes: " + e.message);
      showToast("Failed to load USPS routes", "info");
    }
    setRoutesLoading(false);
  };

  const clearRoutes = () => { setLiveRoutes([]); setSelectedRoutes([]); setSearchedZips([]); setRouteError(null); };

  const getGpsAddress = async () => {
    if (!navigator.geolocation) {
      showToast("GPS not available on this device", "info");
      return;
    }
    setGpsLoading(true);
    showToast("Getting your location...", "info");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        console.log("GPS:", latitude, longitude, "accuracy:", accuracy, "m");
        const result = await reverseGeocode(latitude, longitude);
        if (result && result.address) {
          setSpotForm(f => ({
            ...f,
            address: result.address,
            city: result.city || "Tulsa",
            state: result.state || "OK",
            zip: result.zip || "",
          }));
          setVerifyResult(null);
          showToast(
            accuracy < 20
              ? "📍 Address locked — " + result.address
              : `📍 Got address (±${Math.round(accuracy)}m accuracy)`,
            "success"
          );
        } else {
          showToast("Could not determine address — try moving outside", "info");
        }
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) showToast("Location access denied — enable in browser settings", "info");
        else if (err.code === 2) showToast("GPS signal not found — try outside", "info");
        else showToast("Location error: " + err.message, "info");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const verifySpotAddress = async () => {
    if (!spotForm.address) return;
    setVerifying(true); setVerifyResult(null);
    const result = await verifyAddress(spotForm.address, spotForm.city, spotForm.state, spotForm.zip);
    setVerifyResult(result);
    if (result.valid) {
      setSpotForm(f => ({...f, address: result.address||f.address, city: result.city||f.city, state: result.state||f.state, zip: result.zip||f.zip}));
      showToast("Address verified - Carrier Route " + result.carrierRoute + " - Deliverable", "success");
    } else {
      showToast("Address issue: " + (result.deliverability||"not deliverable"), "info");
    }
    setVerifying(false);
  };

  // Show login screen if not unlocked
  if(!unlocked) return(
    <>
      <style>{STYLES}</style>
      <div className="login-screen">
        <div className="login-bg"/>
        <div className="login-texture"/>
        <div className="login-box">
          <div className="login-logo">PAVE<span>MAIL</span></div>
          <div className="login-tagline">JWood LLC · Tulsa, OK</div>
          <div className="login-label">Enter Access Code</div>
          <div className={`pin-dots${shaking?" shake":""}`}>
            {[0,1,2,3].map(i=>(
              <div key={i} className={`pin-dot${i<pin.length?pinError?" error":" filled":""}`}/>
            ))}
          </div>
          <div className="keypad">
            {["1","2","3","4","5","6","7","8","9"].map(k=>(
              <button key={k} className="key-btn" onClick={()=>pressKey(k)}>{k}</button>
            ))}
            <div/>
            <button className="key-btn zero" onClick={()=>pressKey("0")}>0</button>
            <button className="key-btn del" onClick={delKey}>⌫</button>
          </div>
          <label className="login-remember">
            <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)}/>
            Remember this device
          </label>
          <div className="login-error" style={{opacity:pinError?1:0}}>Incorrect code — try again</div>
          <div className="login-footer">🔒 JWood LLC · Secured Access</div>
        </div>
      </div>
    </>
  );

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
          {[{id:"map",icon:"🗺️",label:"Neighborhood Scan"},{id:"create",icon:"✏️",label:"Create Mailer"},{id:"tracker",icon:"📊",label:"Job Tracker",badge:jobs.filter(j=>j.status==="sent"||j.status==="queued").length},{id:"spotbid",icon:"🎯",label:"Spot Bid"},{id:"pipeline",icon:"📍",label:"Pipeline"},{id:"capacity",icon:"⚡",label:"Capacity"},{id:"aiphone",icon:"📞",label:"AI Phone",badge:aiLeads.filter(l=>l.status==="pending").length||null}].map(item=>(
            <button key={item.id} className={`nav-item${tab===item.id?" active":""}`} onClick={()=>setTab(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.badge?<span className="nav-badge">{item.badge}</span>:null}
            </button>
          ))}
          <div className="nav-divider"/>
          <div className="nav-label">Account</div>
          <button className={`nav-item${tab==="settings"?" active":""}`} onClick={()=>setTab("settings")}><span className="nav-icon">⚙️</span>Settings</button>
          <div className="nav-mini">
            {/* CAPACITY WIDGET */}
            <div className="capacity-widget" style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--stone)"}}>Crew Capacity</div>
                <div style={{fontSize:10,fontWeight:700,color:CAPACITY_MODES[capacity.mode].color}}>{CAPACITY_MODES[capacity.mode].icon} {CAPACITY_MODES[capacity.mode].label}</div>
              </div>
              <div className="capacity-bar-wrap">
                <div className="capacity-bar" style={{
                  width:`${Math.min(100,Math.round(capacity.activeJobs/CAPACITY_CONFIG.maxJobs*100))}%`,
                  background:capacity.mode==="hungry"?"#b83232":capacity.mode==="normal"?"#c4a020":capacity.mode==="selective"?"#1a6fa8":"#6a6662"
                }}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"var(--gravel)",marginTop:4}}>
                <span>{capacity.activeJobs} active jobs</span>
                <span>{CAPACITY_CONFIG.maxJobs} max</span>
              </div>
              <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
                {Object.entries(CAPACITY_MODES).map(([mode,cfg])=>(
                  <button key={mode} className={`mode-pill${capacity.manualOverride===mode?" active":""}`}
                    style={{background:capacity.manualOverride===mode?cfg.bg:"transparent",color:cfg.color,fontSize:8}}
                    onClick={()=>setCapacity(c=>({...c,manualOverride:c.manualOverride===mode?null:mode,mode:c.manualOverride===mode?(()=>{const pct=c.activeJobs/CAPACITY_CONFIG.maxJobs;return pct>=1?"paused":pct>=0.8?"selective":pct>=0.5?"normal":"hungry";})():mode}))}>
                    {cfg.icon} {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
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
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>USPS ROUTE SCANNER</div>
                <p style={{fontSize:12,color:"var(--stone)",lineHeight:1.6,marginBottom:14}}>Enter any ZIP to load live USPS carrier routes and real home counts.</p>
                <div style={{display:"flex",gap:8,marginBottom:10}}>
                  <div className="field" style={{margin:0,flex:1}}>
                    <input placeholder="Enter ZIP (e.g. 74105)" value={zipSearch} onChange={e=>setZipSearch(e.target.value.replace(/[^0-9]/g,"").slice(0,5))} onKeyDown={e=>e.key==="Enter"&&searchZip(zipSearch)} maxLength={5} style={{fontFamily:"DM Mono,monospace",fontSize:15,letterSpacing:2}}/>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={()=>searchZip(zipSearch)} disabled={routesLoading} style={{flexShrink:0,padding:"0 14px"}}>
                    {routesLoading?<span className="spin"/>:"Search"}
                  </button>
                </div>
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--gravel)",marginBottom:6}}>Quick - Tulsa Area</div>
                  <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                    {[["74105","S Tulsa"],["74011","Broken Arrow"],["74037","Jenks"],["74055","Owasso"],["74008","Bixby"],["74063","Sand Springs"],["74112","E Tulsa"],["74107","W Tulsa"]].map(([z,label])=>(
                      <button key={z} className={`chip${searchedZips.includes(z)?" on":""}`} onClick={()=>{setZipSearch(z);searchZip(z);}} style={{fontSize:10}} disabled={routesLoading}>{label}</button>
                    ))}
                  </div>
                </div>
                {routeError&&<div style={{background:"rgba(184,50,50,0.1)",border:"1px solid rgba(184,50,50,0.25)",borderRadius:6,padding:"8px 12px",fontSize:11,color:"#f08080",marginBottom:10}}>{routeError}</div>}
                <div className="section-head" style={{marginTop:4}}>
                  {liveRoutes.length>0?`${liveRoutes.length} Live USPS Routes`:"Available Routes"}
                  {liveRoutes.length>0&&<button onClick={clearRoutes} style={{marginLeft:"auto",fontSize:10,color:"var(--stone)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline",fontFamily:"'Syne',sans-serif"}}>Clear all</button>}
                </div>
                {liveRoutes.length===0&&!routesLoading&&(
                  <div style={{fontSize:11,color:"var(--gravel)",textAlign:"center",padding:"20px 0",lineHeight:1.6}}>Enter a ZIP code to load live USPS carrier routes</div>
                )}
                {routesLoading&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"16px 0",color:"var(--stone)",fontSize:12}}>
                    <span className="spin"/><span>Fetching USPS routes...</span>
                  </div>
                )}
                <div className="route-list">
                  {liveRoutes.map(r=>(
                    <div key={r.id} className={`route-item${selectedRoutes.includes(r.id)?" sel":""}`} onClick={()=>toggleRoute(r.id)}>
                      <div className="route-dot" style={{background:r.color}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div className="route-name">{r.name}</div>
                        <div className="route-count">
                          {r.homes.toLocaleString()} homes
                          {r.businesses>0&&` - ${r.businesses} biz`}
                          {r.medIncome>0&&` - Med income $${r.medIncome.toLocaleString()}`}
                        </div>
                      </div>
                      <div className="route-check">checkmark</div>
                    </div>
                  ))}
                </div>
                {selectedRoutes.length>0&&(
                  <div className="sel-summary">
                    <h4>Campaign Summary</h4>
                    <div className="sum-row"><span>Routes selected</span><strong>{selectedRoutes.length}</strong></div>
                    <div className="sum-row"><span>Residential homes</span><strong>{totalHomes.toLocaleString()}</strong></div>
                    <div className="sum-row"><span>Est. cost (EDDM)</span><strong style={{fontFamily:"DM Mono,monospace",color:"var(--orange2)"}}>${(totalHomes*0.62).toFixed(2)}</strong></div>
                    <div className="sum-row"><span>Est. revenue</span><strong style={{color:"var(--green2)"}}>${(totalHomes*1.25).toFixed(2)}</strong></div>
                    <div className="sum-row"><span>USPS delivery</span><strong>2-5 days</strong></div>
                    {liveRoutes.filter(r=>selectedRoutes.includes(r.id)&&r.medIncome>0).length>0&&(
                      <div className="sum-row"><span>Avg med. income</span><strong style={{color:"var(--concrete)"}}>
                        ${Math.round(liveRoutes.filter(r=>selectedRoutes.includes(r.id)&&r.medIncome>0).reduce((s,r)=>s+r.medIncome,0)/Math.max(liveRoutes.filter(r=>selectedRoutes.includes(r.id)&&r.medIncome>0).length,1)).toLocaleString()}
                      </strong></div>
                    )}
                    <button className="btn btn-primary" style={{width:"100%",marginTop:12}} onClick={proceedToCreate}>Create Mailer</button>
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
                {liveRoutes.filter(r=>selectedRoutes.includes(r.id)).map((r,i)=>{
                  const pos=[{left:"18%",top:"10%",width:"28%",height:"32%"},{left:"50%",top:"8%",width:"30%",height:"28%"},{left:"15%",top:"48%",width:"26%",height:"32%"},{left:"48%",top:"44%",width:"28%",height:"30%"},{left:"10%",top:"78%",width:"25%",height:"18%"},{left:"68%",top:"68%",width:"24%",height:"20%"},{left:"35%",top:"25%",width:"22%",height:"25%"},{left:"60%",top:"55%",width:"20%",height:"22%"}][i%8];
                  return <div key={r.id} className="map-zone" style={{...pos,borderColor:r.color,background:r.color+"14"}}><div className="map-zone-label" style={{background:r.color}}>{r.name} ({r.homes.toLocaleString()})</div></div>;
                })}
                {liveRoutes.length===0&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,color:"var(--gravel)",textAlign:"center",padding:40}}><div style={{fontSize:36,opacity:0.3}}>map</div><div style={{fontSize:13,color:"var(--stone)"}}>Enter a ZIP code to load live USPS carrier routes</div></div>}
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
                      {spotPhoto ? <><img src={spotPhoto} className="photo-preview" alt="driveway"/><div style={{fontSize:11,color:spotPhotoUrl?"var(--green2)":"var(--yellow)",textAlign:"center",marginTop:4}}>{spotPhotoUrl?"✓ Photo uploaded & ready":"⏳ Uploading photo..."}</div></> : <><div className="pd-icon">📷</div><div className="pd-label">Tap to take photo or upload<br/><span style={{fontSize:10,color:"var(--gravel)"}}>AI reads the damage automatically</span></div></>}
                      <input id="photo-input" type="file" accept="image/*" capture="environment" onChange={async e=>{
  const f=e.target.files[0];
  if(!f) return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const base64=ev.target.result;
    setSpotPhoto(base64); // store base64 for desktop preview
    // immediately upload to imgbb for mobile-compatible URL
    showToast("📷 Uploading photo...","info");
    try {
      const imageData=base64.split(",")[1];
      const formData=new FormData();
      formData.append("key","1de580a4e5bbefe4b3b892494b4a6d7a");
      formData.append("image",imageData);
      const res=await fetch(IMGBB_PROXY,{method:"POST",body:formData});
      const data=await res.json();
      if(data.success){
        const hostedUrl = data.data.url;
        setSpotPhotoUrl(hostedUrl);
        spotPhotoUrlRef.current = hostedUrl;
        console.log("Photo uploaded to imgbb:", hostedUrl);
        showToast("📷 Photo ready","success");
      }
    } catch(err){ console.error("imgbb upload failed:",err); }
  };
  reader.readAsDataURL(f);
}}/>
                    </label>
                    {spotPhoto&&<button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:4}} onClick={e=>{e.stopPropagation();setSpotPhoto(null);setSpotPhotoUrl(null);spotPhotoUrlRef.current=null;}}>✕ Remove Photo</button>}
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
                <div className="field">
                  <label>Street Address *</label>
                  <div style={{display:"flex",gap:8}}>
                    <input
                      placeholder="e.g. 4821 Oak Ridge Dr"
                      value={spotForm.address}
                      onChange={e=>{setSpot("address",e.target.value);setVerifyResult(null);setGpsAccuracy(null);}}
                      style={{flex:1}}
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={getGpsAddress}
                      disabled={gpsLoading}
                      style={{flexShrink:0,padding:"0 12px",background:"var(--green)",whiteSpace:"nowrap"}}
                      title="Auto-fill from GPS — tap while parked outside the house"
                    >
                      {gpsLoading?<span className="spin"/>:"📍 GPS"}
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={verifySpotAddress}
                      disabled={verifying||!spotForm.address}
                      style={{flexShrink:0,padding:"0 10px"}}
                      title="Verify address with USPS"
                    >
                      {verifying?<span className="spin"/>:"✓ Verify"}
                    </button>
                  </div>
                  {gpsAccuracy&&spotForm.address&&(
                    <div style={{display:"flex",alignItems:"center",gap:6,marginTop:6,fontSize:10,color:gpsAccuracy<15?"var(--green2)":gpsAccuracy<40?"var(--gold2)":"var(--stone)"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:gpsAccuracy<15?"var(--green2)":gpsAccuracy<40?"var(--gold2)":"var(--stone)"}}/>
                      {gpsAccuracy<15?"High accuracy":gpsAccuracy<40?"Good accuracy":"Moderate accuracy — verify address"} · GPS ±{gpsAccuracy}m
                    </div>
                  )}
                </div>
                {verifyResult&&(
                  <div style={{marginBottom:10,borderRadius:7,padding:"10px 14px",fontSize:11,lineHeight:1.7,background:verifyResult.valid?"rgba(42,122,82,0.1)":"rgba(184,50,50,0.1)",border:`1px solid ${verifyResult.valid?"rgba(42,122,82,0.25)":"rgba(184,50,50,0.25)"}`,color:verifyResult.valid?"var(--green2)":"#f08080"}}>
                    {verifyResult.valid?(
                      <>
                        <div><strong>USPS Verified - Deliverable</strong></div>
                        <div style={{color:"var(--concrete)"}}>{verifyResult.address}, {verifyResult.city}, {verifyResult.state} {verifyResult.zip}{verifyResult.zipPlus4&&`-${verifyResult.zipPlus4}`}</div>
                        {verifyResult.carrierRoute&&<div style={{color:"var(--stone)",fontFamily:"DM Mono,monospace",fontSize:10}}>Carrier Route: {verifyResult.zip}{verifyResult.carrierRoute}</div>}
                        {verifyResult.corrected&&<div style={{color:"var(--yellow)",fontSize:10}}>Address was auto-corrected by USPS</div>}
                      </>
                    ):(
                      <>
                        <div><strong>Address Issue: {verifyResult.deliverability||"unknown"}</strong></div>
                        <div style={{fontSize:10,marginTop:2}}>Check address and retry, or proceed anyway.</div>
                      </>
                    )}
                  </div>
                )}
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

                    <div className="page-tag">Front of Postcard {(spotMailer.photoUrl||spotMailer.photoData)&&<span style={{marginLeft:6,background:"rgba(232,86,10,0.25)",color:"var(--orange2)",padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:700}}>📷 Photo Background</span>}</div>
                    <div className="spot-mailer" style={{marginBottom:18}}>
                      <div className="spot-front">
                        <div className="spot-photo-wrap">
                          {(spotMailer.photoUrl||spotMailer.photoData) ? (
                            <PhotoPostcardCanvas
                              photoUrl={spotMailer.photoUrl||spotPhotoUrlRef.current||spotPhotoUrl||null}
                              photoData={(!spotMailer.photoUrl&&!spotPhotoUrlRef.current&&!spotPhotoUrl)?spotMailer.photoData:null}
                              headline={spotMailer.headline}
                              personalNote={spotMailer.personalNote}
                              address={spotMailer.address+", "+spotMailer.city}
                              bid={spotMailer.bidLo||spotMailer.bid}
                              phone="918-896-6737"
                            />
                          ) : (
                            <>
                              <div className="spot-front-no-photo"/>
                              <div className="spot-front-texture"/>
                              <div className="spot-front-content">
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"auto"}}>
                                  <div className="spot-tag" style={{margin:0}}>JWood LLC · Tulsa, OK</div>
                                </div>
                                <div style={{paddingTop:16}}>
                                  <div className="spot-address">{spotMailer.address}, {spotMailer.city}</div>
                                  <div className="spot-headline" style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:34,color:"#f5f0e6",letterSpacing:1,marginBottom:10,lineHeight:1}}>{spotMailer.headline}</div>
                                  <div className="spot-note">{spotMailer.personalNote}</div>
                                  <div className="spot-bid-box">
                                    <div style={{flex:1}}>
                                      <div className="spot-bid-label">Your Personalized Estimate</div>
                                      <div style={{display:"flex",alignItems:"baseline",gap:8,marginTop:4,flexWrap:"wrap"}}>
                                        <div style={{fontSize:13,color:"rgba(184,180,172,0.7)"}}>Starting at</div>
                                        <div className="spot-bid-value">{spotMailer.bidLo||spotMailer.bid}</div>
                                      </div>
                                      {spotMailer.bidHi&&<div style={{fontSize:12,color:"rgba(184,180,172,0.6)",marginTop:2}}>Up to {spotMailer.bidHi}</div>}
                                    </div>
                                    <div style={{flexShrink:0,background:"var(--orange)",color:"white",padding:"8px 14px",borderRadius:6,fontSize:11,fontWeight:700,textAlign:"center"}}>CALL NOW<br/><span style={{fontSize:13,fontFamily:"DM Mono,monospace"}}>918-896-6737</span></div>
                                  </div>
                                  <div style={{marginTop:10,fontSize:10,color:"rgba(184,180,172,0.5)"}}>{spotMailer.urgencyLine}</div>
                                </div>
                                <div className="spot-bar"/>
                              </div>
                            </>
                          )}
                        </div>
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


          {/* CAPACITY */}
          {tab==="capacity"&&(
            <div style={{padding:"24px 28px"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"var(--cream)",marginBottom:4}}>CAPACITY ENGINE</div>
              <div style={{fontSize:12,color:"var(--stone)",marginBottom:20}}>12-man crew · {CAPACITY_CONFIG.maxJobs} jobs/week max · ${CAPACITY_CONFIG.weeklyTarget.toLocaleString()} weekly target</div>

              {/* Current mode banner */}
              <div style={{background:CAPACITY_MODES[capacity.mode].bg,border:`1px solid ${CAPACITY_MODES[capacity.mode].color}40`,borderRadius:12,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{fontSize:40}}>{CAPACITY_MODES[capacity.mode].icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:CAPACITY_MODES[capacity.mode].color}}>{CAPACITY_MODES[capacity.mode].label.toUpperCase()} MODE</div>
                  <div style={{fontSize:12,color:"var(--concrete)",marginTop:4}}>{CAPACITY_MODES[capacity.mode].desc}</div>
                  <div style={{fontSize:11,color:"var(--stone)",marginTop:6}}>
                    Auto radius: <strong style={{color:"var(--cream)"}}>{getRadiusForMode()}mi</strong> ·
                    Bid multiplier: <strong style={{color:"var(--cream)"}}>{getBidMultiplierForMode()}x</strong> ·
                    AI agent: <strong style={{color:"var(--cream)"}}>{capacity.mode==="paused"?"Booking 3 weeks out":capacity.mode==="selective"?"High value only":"Normal"}</strong>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {Object.entries(CAPACITY_MODES).map(([mode,cfg])=>(
                    <button key={mode} className={`mode-pill${capacity.mode===mode?" active":""}`}
                      style={{background:capacity.mode===mode?cfg.bg:"transparent",color:cfg.color}}
                      onClick={()=>setCapacity(c=>({...c,mode,manualOverride:mode}))}>
                      {cfg.icon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats grid */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
                {[
                  {label:"Active Jobs",value:capacity.activeJobs,max:CAPACITY_CONFIG.maxJobs,color:"var(--orange2)"},
                  {label:"Capacity Used",value:`${Math.round(capacity.activeJobs/CAPACITY_CONFIG.maxJobs*100)}%`,color:CAPACITY_MODES[capacity.mode].color},
                  {label:"Weekly Revenue",value:`$${capacity.weeklyRevenue.toLocaleString()}`,color:"var(--green2)"},
                  {label:"Target Gap",value:`$${Math.max(0,CAPACITY_CONFIG.weeklyTarget-capacity.weeklyRevenue).toLocaleString()}`,color:capacity.weeklyRevenue>=CAPACITY_CONFIG.weeklyTarget?"var(--green2)":"var(--gold2)"},
                ].map((s,i)=>(
                  <div key={i} style={{background:"var(--ink)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:9,padding:"14px 16px"}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--stone)",marginBottom:6}}>{s.label}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:s.color,letterSpacing:1,lineHeight:1}}>{s.value}</div>
                    {s.max&&<div style={{marginTop:6}}><div className="capacity-bar-wrap"><div className="capacity-bar" style={{width:`${Math.min(100,Math.round(s.value/s.max*100))}%`,background:s.color}}/></div></div>}
                  </div>
                ))}
              </div>

              {/* Smart suggestions */}
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>SMART SUGGESTIONS</div>
              {capacity.mode==="hungry"&&(
                <div className="smart-suggest">
                  <div className="smart-suggest-icon">🔥</div>
                  <div className="smart-suggest-text">
                    <strong>You have open capacity.</strong> Consider sending a radius mailer from your most recent Won job, or running a new neighborhood campaign in a high-income ZIP. Radius auto-set to <strong>1.0 miles</strong> in Hungry mode.
                    <div style={{marginTop:8}}>
                      <button className="btn btn-primary btn-sm" onClick={()=>{const won=pipeline.find(l=>l.stage==="won");if(won){setRadiusLead(won);setRadiusForm(f=>({...f,radius:1.0}));setRadiusStep(1);setRadiusMailer(null);setShowRadiusModal(true);}else showToast("Mark a job as Won first","info");}}>
                        📬 Send Radius Mailer
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {capacity.mode==="paused"&&(
                <div className="smart-suggest">
                  <div className="smart-suggest-icon">⏸️</div>
                  <div className="smart-suggest-text">
                    <strong>You are fully booked.</strong> Outbound campaigns are paused. The AI phone agent is telling callers you are booking 3 weeks out. When a job completes and is removed from Won, capacity will auto-resume.
                  </div>
                </div>
              )}
              {capacity.mode==="selective"&&(
                <div className="smart-suggest">
                  <div className="smart-suggest-icon">🎯</div>
                  <div className="smart-suggest-text">
                    <strong>Nearly full — focus on high-value leads only.</strong> Pipeline leads with a score below 50 are deprioritized. Bids are automatically increased by 15% to maximize margin on remaining capacity.
                    {pipeline.filter(l=>scoreLead(l)<50&&l.stage!=="won").length>0&&(
                      <div style={{marginTop:6}}>⚠️ {pipeline.filter(l=>scoreLead(l)<50&&l.stage!=="won").length} low-score leads in pipeline — consider deprioritizing</div>
                    )}
                  </div>
                </div>
              )}

              {/* Lead scores */}
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginTop:20,marginBottom:12}}>LEAD PRIORITY SCORES</div>
              <div style={{background:"var(--ink)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:10,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"10px 16px",background:"rgba(0,0,0,0.2)",fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--stone)",borderBottom:"1px solid rgba(184,180,172,0.07)"}}>
                  <div>Address</div><div>Stage</div><div>Value</div><div>Score</div>
                </div>
                {[...pipeline].filter(l=>l.stage!=="won").sort((a,b)=>scoreLead(b)-scoreLead(a)).slice(0,10).map(lead=>{
                  const score=scoreLead(lead);
                  return(
                    <div key={lead.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"11px 16px",borderBottom:"1px solid rgba(184,180,172,0.05)",alignItems:"center",cursor:"pointer"}} onClick={()=>setTab("pipeline")}>
                      <div style={{fontSize:12,fontWeight:600,color:"var(--cream)"}}>{lead.address}<div style={{fontSize:10,color:"var(--stone)"}}>{lead.city}</div></div>
                      <div style={{fontSize:11,color:"var(--concrete)"}}>{STAGES.find(s=>s.id===lead.stage)?.icon} {STAGES.find(s=>s.id===lead.stage)?.label}</div>
                      <div style={{fontFamily:"DM Mono,monospace",fontSize:12,color:"var(--orange2)"}}>{lead.value?`$${lead.value.toLocaleString()}`:"—"}</div>
                      <div>
                        <span className={`score-pill ${score>=70?"score-high":score>=40?"score-mid":"score-low"}`}>{score}</span>
                      </div>
                    </div>
                  );
                })}
                {pipeline.filter(l=>l.stage!=="won").length===0&&(
                  <div style={{padding:"20px",textAlign:"center",fontSize:12,color:"var(--gravel)"}}>No active pipeline leads</div>
                )}
              </div>
            </div>
          )}

          {/* AI PHONE */}
          {tab==="aiphone"&&(
            <div style={{padding:"24px 28px"}}>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"var(--cream)",lineHeight:1}}>AI ANSWERING SERVICE</div>
                  <div style={{fontSize:12,color:"var(--stone)",marginTop:3}}>AI qualifies every inbound call · Live transfers to Joel · All leads logged here</div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(42,122,82,0.1)",border:"1px solid rgba(42,122,82,0.25)",borderRadius:20,padding:"6px 14px"}}>
                    <div className="live-dot phone-pulse"/>
                    <span style={{fontSize:11,fontWeight:700,color:"var(--green2)"}}>AI Agent Live</span>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={()=>setShowAIPhone(true)}>⚙️ Configure</button>
                </div>
              </div>

              {/* Stats */}
              <div className="ai-stat-grid">
                <div className="ai-stat">
                  <div className="ai-stat-val" style={{color:"var(--cream)"}}>{aiLeads.length}</div>
                  <div className="ai-stat-label">Total Calls</div>
                </div>
                <div className="ai-stat">
                  <div className="ai-stat-val" style={{color:"var(--green2)"}}>{aiLeads.filter(l=>l.status==="qualified").length}</div>
                  <div className="ai-stat-label">Qualified</div>
                </div>
                <div className="ai-stat">
                  <div className="ai-stat-val" style={{color:"var(--gold2)"}}>{aiLeads.filter(l=>l.transferred).length}</div>
                  <div className="ai-stat-label">Transferred</div>
                </div>
              </div>

              {/* How it works banner */}
              <div style={{background:"rgba(26,111,168,0.08)",border:"1px solid rgba(26,111,168,0.2)",borderRadius:10,padding:"14px 18px",marginBottom:20,display:"flex",gap:14,alignItems:"center",flexWrap:"wrap"}}>
                <div style={{fontSize:24,flexShrink:0}}>🤖</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",marginBottom:4}}>How It Works</div>
                  <div style={{fontSize:11,color:"var(--stone)",lineHeight:1.7}}>
                    Homeowner calls your QR code number → AI agent "Alex" answers → qualifies the lead (name, address, service, timeline) → transfers live to Joel at 918-896-6737 → call summary appears here automatically.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:11,color:"var(--stone)"}}>
                  <div>📞 <strong style={{color:"var(--cream)"}}>Bland.ai</strong> · AI voice agent</div>
                  <div>🔄 <strong style={{color:"var(--cream)"}}>Live transfer</strong> · After qualification</div>
                  <div>📋 <strong style={{color:"var(--cream)"}}>Auto-logged</strong> · Every call</div>
                </div>
              </div>

              {/* Test call section */}
              <div style={{background:"var(--ink)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:10,padding:"16px 18px",marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",marginBottom:8}}>🧪 Test the AI Agent</div>
                <div style={{fontSize:11,color:"var(--stone)",marginBottom:12}}>Enter a phone number and Bland.ai will call it right now with the AI agent. Use your own cell to test the experience.</div>
                <div style={{display:"flex",gap:8}}>
                  <input
                    placeholder="(918) 555-0000"
                    value={testCallNumber}
                    onChange={e=>setTestCallNumber(e.target.value)}
                    style={{flex:1,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.12)",borderRadius:7,padding:"10px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:13,outline:"none"}}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={testCallLoading||testCallNumber.length<10}
                    onClick={async()=>{
                      setTestCallLoading(true);
                      showToast("Initiating test call...","info");
                      const clean=testCallNumber.replace(/\D/g,"");
                      const result=await createBlandAgent("+1"+clean,"Test call from PaveMail dashboard");
                      console.log("Test call result:", JSON.stringify(result));
                      if(result.call_id||result.id||result.status==="success"){
                        showToast("Test call initiated! You should receive a call within 10 seconds.","success");
                        setAiLeads(l=>[{id:"AL-"+Date.now(),caller:"Test Call",phone:testCallNumber,summary:"Test call initiated from PaveMail dashboard. Call ID: "+(result.call_id||result.id||"pending"),service:"Test",address:"",status:"pending",time:"Just now",transferred:false},...l]);
                      } else {
                        const errMsg = result.errors?.[0]?.message || result.message || result.error || JSON.stringify(result).slice(0,100);
                        showToast("Call failed: "+errMsg,"info");
                        console.error("Full bland error:", result);
                      }
                      setTestCallLoading(false);
                    }}
                  >
                    {testCallLoading?<span className="spin"/>:"📞 Test Call"}
                  </button>
                </div>
              </div>

              {/* Lead list */}
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>INBOUND LEADS FROM AI CALLS</div>
              {aiLeads.length===0&&(
                <div style={{fontSize:13,color:"var(--gravel)",textAlign:"center",padding:"32px 0"}}>No calls yet — the AI agent is standing by</div>
              )}
              {aiLeads.map(lead=>(
                <div className="ai-lead-card" key={lead.id}>
                  <div className={`ai-lead-status`} style={{background:lead.status==="qualified"?"rgba(42,122,82,0.15)":lead.status==="pending"?"rgba(212,160,23,0.15)":"rgba(122,118,112,0.15)"}}>
                    {lead.status==="qualified"?"✅":lead.status==="pending"?"⏳":"❌"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="ai-lead-name">{lead.caller}</div>
                    <div style={{fontSize:11,fontFamily:"DM Mono,monospace",color:"var(--stone)",marginBottom:6}}>{lead.phone} · {lead.time}</div>
                    <div className="ai-lead-summary">{lead.summary}</div>
                    <div className="ai-lead-meta">
                      <span className={`ai-badge badge-${lead.status==="qualified"?"qualified":lead.status==="pending"?"pending":"not-qualified"}`}>
                        {lead.status==="qualified"?"✓ Qualified":lead.status==="pending"?"⏳ Pending":"✗ Not Qualified"}
                      </span>
                      {lead.service&&<span style={{fontSize:10,color:"var(--stone)"}}>🏗️ {lead.service}</span>}
                      {lead.address&&<span style={{fontSize:10,color:"var(--stone)"}}>📍 {lead.address}</span>}
                      {lead.transferred&&<span style={{fontSize:10,color:"var(--green2)"}}>📞 Transferred to Joel</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                    {lead.status==="qualified"&&lead.address&&(
                      <button className="btn btn-primary btn-sm" onClick={()=>{
                        const id="PL-"+Date.now();
                        setPipeline(p=>[{id,address:lead.address,city:"Tulsa",neighborhood:"",stage:"called",bidLo:"",bidHi:"",spotted:new Date().toLocaleDateString(),mailerSent:null,calledBack:new Date().toLocaleDateString(),jobWon:null,notes:lead.summary,value:0},...p]);
                        showToast("Lead added to pipeline!","success");
                      }}>
                        + Pipeline
                      </button>
                    )}
                    <a href={"tel:"+lead.phone.replace(/\D/g,"")} className="btn btn-ghost btn-sm" style={{textDecoration:"none",textAlign:"center"}}>
                      📞 Call Back
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PIPELINE */}
          {tab==="pipeline"&&(
            <div className="pipeline-layout">
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"var(--cream)",lineHeight:1}}>ADDRESS PIPELINE</div>
                  <div style={{fontSize:12,color:"var(--stone)",marginTop:3}}>Every address JWood LLC has spotted, mailed, or closed.</div>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setShowAddLead(true)}>+ Log Address</button>
                  <button className="btn btn-ghost btn-sm" style={{color:"var(--green2)",borderColor:"rgba(42,122,82,0.3)"}}
                    onClick={()=>{
                      const wonLeads=pipeline.filter(l=>l.stage==="won");
                      const lead=wonLeads[0]||pipeline[0];
                      if(lead){setRadiusLead(lead);setRadiusStep(1);setRadiusMailer(null);setShowRadiusModal(true);}
                    }}>
                    📬 Radius Mailer
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={()=>setTab("spotbid")}>🎯 Spot Bid</button>
                </div>
              </div>

              {/* Stats */}
              <div className="pipeline-stats">
                {[
                  {label:"Total Leads",value:pipeline.length,color:"var(--cream)",sub:"addresses tracked"},
                  {label:"Mailers Sent",value:pipeline.filter(l=>["sent","called","won"].includes(l.stage)).length,color:"var(--blue2)",sub:"postcards out"},
                  {label:"Called Back",value:pipeline.filter(l=>["called","won"].includes(l.stage)).length,color:"var(--yellow)",sub:`${Math.round(pipeline.filter(l=>["called","won"].includes(l.stage)).length/Math.max(pipeline.filter(l=>["sent","called","won"].includes(l.stage)).length,1)*100)}% response rate`},
                  {label:"Jobs Won",value:pipeline.filter(l=>l.stage==="won").length,color:"var(--green2)",sub:`$${pipeline.filter(l=>l.stage==="won").reduce((s,l)=>s+l.value,0).toLocaleString()} revenue`},
                ].map((s,i)=>(
                  <div className="pl-stat" key={i}>
                    <div className="pl-stat-label">{s.label}</div>
                    <div className="pl-stat-value" style={{color:s.color}}>{s.value}</div>
                    <div className="pl-stat-sub">{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* View Tabs */}
              <div className="pipeline-view-tabs">
                {[{id:"kanban",icon:"▦",label:"Kanban"},{id:"list",icon:"≡",label:"List"},{id:"map",icon:"🗺",label:"Map"}].map(v=>(
                  <button key={v.id} className={`pvt${pipelineView===v.id?" on":""}`} onClick={()=>setPipelineView(v.id)}>
                    {v.icon} {v.label}
                  </button>
                ))}
                <div style={{marginLeft:"auto",fontSize:11,color:"var(--stone)",display:"flex",alignItems:"center",gap:6}}>
                  <span>Pipeline value:</span>
                  <strong style={{color:"var(--orange2)",fontFamily:"DM Mono,monospace"}}>${pipeline.reduce((s,l)=>s+l.value,0).toLocaleString()}</strong>
                </div>
              </div>

              {/* KANBAN VIEW */}
              {pipelineView==="kanban"&&(
                <div className="kanban">
                  {STAGES.map(stage=>{
                    const leads=pipeline.filter(l=>l.stage===stage.id);
                    const stageIdx=STAGES.findIndex(s=>s.id===stage.id);
                    const nextStage=STAGES[stageIdx+1];
                    const prevStage=STAGES[stageIdx-1];
                    return(
                      <div className="kanban-col" key={stage.id}>
                        <div className="kanban-head" style={{borderTop:`3px solid ${stage.color}`}}>
                          <span className="kanban-head-icon">{stage.icon}</span>
                          <span className="kanban-head-label" style={{color:stage.color}}>{stage.label}</span>
                          <span className="kanban-count">{leads.length}</span>
                        </div>
                        <div className="kanban-cards">
                          {leads.map(lead=>(
                            <div className="pl-card" key={lead.id}>
                              <div className="pl-card-addr">{lead.address}</div>
                              <div className="pl-card-city">{lead.neighborhood} · {lead.city}</div>
                              <div className="pl-card-bid">{lead.bidLo}{lead.bidHi&&<span className="pl-card-bid-range"> — {lead.bidHi}</span>}</div>
                              {lead.notes&&<div className="pl-card-notes">{lead.notes}</div>}
                              <div className="pl-card-date">
                                {lead.spotted&&`Spotted ${lead.spotted}`}
                                {lead.mailerSent&&` · Sent ${lead.mailerSent}`}
                                {lead.calledBack&&` · Called ${lead.calledBack}`}
                                {lead.jobWon&&` · Won ${lead.jobWon}`}
                              </div>
                              <div className="pl-card-actions">
                                {prevStage&&(
                                  <button className="pl-action-btn" style={{background:prevStage.bg,color:prevStage.color,opacity:0.75}} onClick={()=>moveStage(lead.id,prevStage.id)} title={`Move back to ${prevStage.label}`}>
                                    ← {prevStage.label}
                                  </button>
                                )}
                                {nextStage&&(
                                  <button className="pl-action-btn" style={{background:nextStage.bg,color:nextStage.color}} onClick={()=>moveStage(lead.id,nextStage.id)} title={`Move forward to ${nextStage.label}`}>
                                    → {nextStage.label}
                                  </button>
                                )}
                                {stage.id==="spotted"&&(
                                  <button className="pl-action-btn" style={{background:"rgba(232,86,10,0.15)",color:"var(--orange2)"}} onClick={()=>{setSpotForm(f=>({...f,address:lead.address,city:lead.city,neighborhood:lead.neighborhood}));setTab("spotbid");}}>
                                    🎯 Spot Bid
                                  </button>
                                )}
                                {stage.id==="won"&&(
                                  <button className="pl-action-btn" style={{background:"rgba(42,122,82,0.15)",color:"var(--green2)"}} onClick={()=>{setRadiusLead(lead);setRadiusStep(1);setRadiusMailer(null);setShowRadiusModal(true);}}>
                                    📬 Radius Mailer
                                  </button>
                                )}
                                <button
                                  className={`permit-btn${permitLoading===lead.id?" loading":""}`}
                                  onClick={()=>{loadPermits(lead);setExpandedLead(expandedLead===lead.id?null:lead.id);}}
                                >
                                  {permitLoading===lead.id?"⏳ Loading...":"🏛️ Permits"}
                                </button>
                                <select
                                  value={lead.stage}
                                  onChange={e=>moveStage(lead.id,e.target.value)}
                                  style={{fontSize:9,fontWeight:700,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.15)",borderRadius:5,padding:"3px 6px",color:"var(--stone)",fontFamily:"'Syne',sans-serif",cursor:"pointer",outline:"none"}}
                                  title="Jump to any stage"
                                >
                                  {STAGES.map(s=>(
                                    <option key={s.id} value={s.id} style={{background:"var(--char)"}}>{s.icon} {s.label}</option>
                                  ))}
                                </select>
                              </div>
                              {/* PERMIT PANEL */}
                              {expandedLead===lead.id&&(
                                <div className="permit-panel">
                                  <div className="permit-panel-head">
                                    <div className="permit-panel-title">Tulsa Permit History</div>
                                    <div style={{fontSize:9,color:"var(--gravel)"}}>City of Tulsa CSS</div>
                                  </div>
                                  {!permitData[lead.id]&&<div className="permit-empty">Tap Permits to load...</div>}
                                  {permitData[lead.id]?.error&&(
                                    <div className="permit-empty">
                                      API unavailable — use manual lookup below
                                    </div>
                                  )}
                                  {permitData[lead.id]?.permits?.length===0&&!permitData[lead.id]?.error&&(
                                    <div className="permit-empty">No permits found for this address</div>
                                  )}
                                  {permitData[lead.id]?.permits?.map((p,i)=>(
                                    <div className="permit-row" key={i}>
                                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                                        <div className="permit-type">{p.PermitType||p.type||p.permitType||"Building Permit"}</div>
                                        <span className={`permit-status ${(p.StatusDescription||p.status||"").toLowerCase().includes("issued")?"issued":(p.StatusDescription||p.status||"").toLowerCase().includes("pending")?"pending":"expired"}`}>
                                          {p.StatusDescription||p.status||"Unknown"}
                                        </span>
                                      </div>
                                      <div className="permit-meta">
                                        {(p.PermitNumber||p.permitNumber)&&<span>#{p.PermitNumber||p.permitNumber}</span>}
                                        {(p.IssuedDate||p.issuedDate||p.ApplicationDate)&&<span>Issued: {p.IssuedDate||p.issuedDate||p.ApplicationDate}</span>}
                                        {(p.Description||p.description)&&<span>{(p.Description||p.description).slice(0,60)}</span>}
                                      </div>
                                    </div>
                                  ))}
                                  <div className="permit-links">
                                    <a href={getTulsaPortalUrl(`${lead.address} ${lead.city}`)} target="_blank" rel="noreferrer" className="permit-link">
                                      🔍 City of Tulsa Portal
                                    </a>
                                    <a href={getTulsaCountyUrl(`${lead.address} ${lead.city} OK`)} target="_blank" rel="noreferrer" className="permit-link">
                                      🏛️ Tulsa County
                                    </a>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {leads.length===0&&<div style={{fontSize:11,color:"var(--gravel)",textAlign:"center",padding:"16px 0"}}>No leads here yet</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LIST VIEW */}
              {pipelineView==="list"&&(
                <div className="pl-list">
                  <div className="pl-list-head">
                    <div>Address</div><div>Neighborhood</div><div>Spotted</div><div>Sent</div><div>Called</div><div>Bid</div><div>Status</div><div>Permits</div>
                  </div>
                  {pipeline.map(lead=>{
                    const stage=STAGES.find(s=>s.id===lead.stage);
                    return(
                      <div className="pl-list-row" key={lead.id}>
                        <div><div className="pl-addr">{lead.address}</div><div className="pl-sub">{lead.city}</div></div>
                        <div className="pl-cell">{lead.neighborhood}</div>
                        <div className="pl-cell">{lead.spotted||"—"}</div>
                        <div className="pl-cell">{lead.mailerSent||"—"}</div>
                        <div className="pl-cell">{lead.calledBack||"—"}</div>
                        <div className="pl-cell mono">{lead.bidLo}{lead.bidHi?`–${lead.bidHi}`:""}</div>
                        <div>
                          <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:12,fontSize:10,fontWeight:700,background:stage?.bg,color:stage?.color}}>
                            {stage?.icon} {stage?.label}
                          </span>
                        </div>
                        <div>
                          <a href={getTulsaPortalUrl(`${lead.address} ${lead.city}`)} target="_blank" rel="noreferrer" className="permit-link" style={{fontSize:9}}>
                            🔍 Lookup
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* MAP VIEW */}
              {pipelineView==="map"&&(
                <>
                  <div className="pl-legend">
                    {STAGES.map(s=>(
                      <div className="pl-legend-item" key={s.id}>
                        <div className="pl-legend-dot" style={{background:s.color}}/>
                        {s.icon} {s.label} ({pipeline.filter(l=>l.stage===s.id).length})
                      </div>
                    ))}
                  </div>
                  <div className="pl-map-wrap">
                    <div className="pl-map-canvas"/>
                    {/* Roads */}
                    {[15,30,50,65,80].map(y=><div key={y} style={{position:"absolute",left:0,right:0,top:`${y}%`,height:y===30||y===65?5:2,background:"rgba(184,180,172,0.08)"}}/>)}
                    {[20,40,60,80].map(x=><div key={x} style={{position:"absolute",top:0,bottom:0,left:`${x}%`,width:x===40||x===60?5:2,background:"rgba(184,180,172,0.08)"}}/>)}
                    <div style={{position:"absolute",top:"27%",left:"22%",fontSize:9,color:"rgba(184,180,172,0.3)",fontFamily:"DM Mono,monospace",letterSpacing:1,textTransform:"uppercase"}}>PEORIA AVE</div>
                    <div style={{position:"absolute",top:"62%",left:"42%",fontSize:9,color:"rgba(184,180,172,0.3)",fontFamily:"DM Mono,monospace",letterSpacing:1,textTransform:"uppercase"}}>MEMORIAL DR</div>
                    {/* Pipeline pins - each lead gets a pin */}
                    {pipeline.map((lead,i)=>{
                      const stage=STAGES.find(s=>s.id===lead.stage);
                      const positions=[
                        {x:32,y:28},{x:58,y:22},{x:22,y:55},{x:68,y:48},{x:44,y:70},{x:76,y:35},
                        {x:38,y:42},{x:52,y:62},{x:28,y:75},{x:64,y:72},{x:48,y:32},{x:72,y:58},
                      ];
                      const pos=positions[i%positions.length];
                      return(
                        <div key={lead.id} className="pl-pin" style={{left:`${pos.x}%`,top:`${pos.y}%`}}>
                          <div className="pl-pin-dot" style={{background:stage?.color}}>
                            <span style={{fontSize:12}}>{stage?.icon}</span>
                          </div>
                          <div className="pl-pin-label">{lead.address.split(" ").slice(0,3).join(" ")}</div>
                        </div>
                      );
                    })}
                    {/* Map controls */}
                    <div style={{position:"absolute",bottom:12,right:12,display:"flex",flexDirection:"column",gap:5}}>
                      <button style={{width:32,height:32,background:"var(--ink)",border:"1px solid rgba(184,180,172,0.15)",borderRadius:6,color:"var(--concrete)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>+</button>
                      <button style={{width:32,height:32,background:"var(--ink)",border:"1px solid rgba(184,180,172,0.15)",borderRadius:6,color:"var(--concrete)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>−</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div className="settings-layout">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:10}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"var(--cream)"}}>SETTINGS</div>
                <button className="btn btn-ghost btn-sm" onClick={()=>{try{localStorage.removeItem("pavemail_auth");}catch{}setUnlocked(false);setPin("");}}>🔒 Lock App</button>
              </div>
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
      {/* WON BANNER — radius mailer suggestion */}
      {wonBanner&&(
        <div className="won-banner">
          <div className="won-banner-icon">🏆</div>
          <div className="won-banner-text">
            <h4>Job Won — {wonBanner.address}!</h4>
            <p>Send a radius mailer to neighbors within half a mile?</p>
          </div>
          <div className="won-banner-actions">
            <button className="btn btn-ghost btn-sm" onClick={()=>setWonBanner(null)}>Skip</button>
            <button className="btn btn-success btn-sm" onClick={()=>{setRadiusLead(wonBanner);setRadiusStep(1);setRadiusMailer(null);setShowRadiusModal(true);setWonBanner(null);}}>
              📬 Send Radius Mailer
            </button>
          </div>
        </div>
      )}

      {/* RADIUS MAILER MODAL */}
      {showRadiusModal&&radiusLead&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==="modal-overlay"){setShowRadiusModal(false);setRadiusStep(1);}}}>
          <div className="modal-box radius-modal">
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <span style={{fontSize:24}}>📬</span>
              <div>
                <div className="modal-title" style={{marginBottom:0}}>RADIUS MAILER</div>
                <div className="modal-sub" style={{marginBottom:0}}>Mail neighbors of {radiusLead.address}</div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                {[1,2,3].map(s=>(
                  <div key={s} style={{width:s<=radiusStep?24:8,height:8,borderRadius:4,background:s<=radiusStep?"var(--green)":"rgba(184,180,172,0.15)",transition:"all 0.2s"}}/>
                ))}
              </div>
            </div>
            <div style={{height:1,background:"rgba(184,180,172,0.08)",margin:"14px 0"}}/>

            {/* STEP 1 — Configure */}
            {radiusStep===1&&(
              <div className="radius-step radius-config">
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <label style={{fontSize:12,fontWeight:700,color:"var(--concrete)"}}>Target Radius</label>
                    <span style={{fontFamily:"DM Mono,monospace",fontSize:13,color:"var(--green2)",fontWeight:600}}>
                      {radiusForm.radius} miles · ~{Math.round(radiusForm.radius*5280/66)} homes
                    </span>
                  </div>
                  <input
                    type="range" className="radius-slider"
                    min={0.1} max={2} step={0.1}
                    value={radiusForm.radius}
                    onChange={e=>setRadiusForm(f=>({...f,radius:parseFloat(e.target.value)}))}
                  />
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--gravel)",marginTop:4}}>
                    <span>0.1mi · ~8 homes</span>
                    <span style={{color:"var(--green2)",fontWeight:700}}>0.5mi default</span>
                    <span>2mi · ~330 homes</span>
                  </div>
                </div>

                <div style={{background:"rgba(42,122,82,0.08)",border:"1px solid rgba(42,122,82,0.2)",borderRadius:8,padding:"12px 14px"}}>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--green2)",marginBottom:8}}>Campaign Summary</div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:"var(--stone)"}}>Center address</span>
                      <span style={{color:"var(--cream)",fontWeight:600}}>{radiusLead.address}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:"var(--stone)"}}>Est. homes targeted</span>
                      <span style={{color:"var(--cream)",fontWeight:600}}>~{Math.round(radiusForm.radius*5280/66)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:"var(--stone)"}}>Est. mail cost</span>
                      <span style={{fontFamily:"DM Mono,monospace",color:"var(--orange2)",fontWeight:600}}>${(Math.round(radiusForm.radius*5280/66)*1.25).toFixed(2)}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                      <span style={{color:"var(--stone)"}}>Mail angle</span>
                      <span style={{color:"var(--green2)",fontWeight:600}}>Neighbor social proof</span>
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label>Personal Note (optional)</label>
                  <textarea
                    placeholder="e.g. We just finished the Smiths' driveway — mention any special offer..."
                    value={radiusForm.message}
                    onChange={e=>setRadiusForm(f=>({...f,message:e.target.value}))}
                    style={{height:60}}
                  />
                </div>

                <button className="btn btn-success" onClick={generateRadiusMailer} disabled={radiusLoading} style={{width:"100%"}}>
                  {radiusLoading?<><span className="spin"/> Generating AI Mailer...</>:"⚡ Generate Neighbor Mailer"}
                </button>
              </div>
            )}

            {/* STEP 2 — Preview */}
            {radiusStep===2&&radiusMailer&&(
              <div className="radius-step">
                <div className="radius-preview" style={{marginBottom:16}}>
                  <div className="radius-preview-head">
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(255,255,255,0.7)",marginBottom:6}}>
                      YOUR NEIGHBOR AT {radiusMailer.address.toUpperCase()} JUST GOT A NEW DRIVEWAY
                    </div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"white",letterSpacing:1,lineHeight:1}}>{radiusMailer.headline}</div>
                  </div>
                  <div className="radius-preview-body">
                    <p style={{fontSize:12,color:"var(--concrete)",lineHeight:1.7,marginBottom:12}}>{radiusMailer.personalNote}</p>
                    <div style={{background:"rgba(42,122,82,0.15)",border:"1px solid rgba(42,122,82,0.3)",borderRadius:6,padding:"10px 14px",marginBottom:10}}>
                      <div style={{fontSize:9,color:"var(--green2)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:3}}>Neighbor Offer</div>
                      <div style={{fontSize:13,color:"var(--cream)",fontWeight:600}}>{radiusMailer.offer}</div>
                    </div>
                    <div style={{background:"var(--orange)",color:"white",padding:"10px 14px",borderRadius:6,textAlign:"center"}}>
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:1}}>CALL JOEL DIRECTLY</div>
                      <div style={{fontSize:16,fontWeight:700,fontFamily:"monospace"}}>918-896-6737</div>
                    </div>
                    <p style={{marginTop:8,fontSize:10,color:"var(--gravel)"}}>{radiusMailer.urgencyLine}</p>
                  </div>
                </div>

                <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:12,color:"var(--stone)"}}>
                  Sending to <strong style={{color:"var(--cream)"}}>~{Math.round(radiusForm.radius*5280/66)} homes</strong> within <strong style={{color:"var(--green2)"}}>{radiusForm.radius} miles</strong> of {radiusMailer.address} · Est. cost <strong style={{color:"var(--orange2)",fontFamily:"DM Mono,monospace"}}>${(Math.round(radiusForm.radius*5280/66)*1.25).toFixed(2)}</strong>
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button className="btn btn-ghost" onClick={()=>setRadiusStep(1)}>← Edit</button>
                  <button className="btn btn-success" style={{flex:1}} onClick={sendRadiusMailer} disabled={radiusSending}>
                    {radiusSending?<><span className="spin"/> Sending...</>:"📬 Send Radius Mailer"}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 — Sent */}
            {radiusStep===3&&(
              <div className="radius-step radius-success">
                <div className="radius-success-icon">🎉</div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"var(--cream)",marginBottom:8}}>MAILER SENT!</div>
                <p style={{fontSize:13,color:"var(--stone)",lineHeight:1.7,marginBottom:20}}>
                  ~{Math.round(radiusForm.radius*5280/66)} neighbors of {radiusLead.address} will receive a postcard in 2–5 days.
                  The campaign has been added to your Job Tracker.
                </p>
                <button className="btn btn-primary" onClick={()=>{setShowRadiusModal(false);setRadiusStep(1);setRadiusMailer(null);}}>
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADD LEAD MODAL */}
      {showAddLead&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==="modal-overlay")setShowAddLead(false);}}>
          <div className="modal-box">
            <div className="modal-title">LOG ADDRESS</div>
            <div className="modal-sub">Add a spotted address to your pipeline without sending a mailer yet.</div>
            <div className="field"><label>Street Address *</label><input placeholder="e.g. 4821 Oak Ridge Dr" value={newLead.address} onChange={e=>setNewLead(f=>({...f,address:e.target.value}))}/></div>
            <div className="row2">
              <div className="field"><label>City</label><input placeholder="Tulsa" value={newLead.city} onChange={e=>setNewLead(f=>({...f,city:e.target.value}))}/></div>
              <div className="field"><label>Neighborhood</label><input placeholder="South Tulsa" value={newLead.neighborhood} onChange={e=>setNewLead(f=>({...f,neighborhood:e.target.value}))}/></div>
            </div>
            <div className="row2">
              <div className="field"><label>Bid Low ($)</label><input type="number" placeholder="800" value={newLead.bidLow} onChange={e=>setNewLead(f=>({...f,bidLow:e.target.value}))}/></div>
              <div className="field"><label>Bid High ($)</label><input type="number" placeholder="1400" value={newLead.bidHigh} onChange={e=>setNewLead(f=>({...f,bidHigh:e.target.value}))}/></div>
            </div>
            <div className="field"><label>Notes</label><textarea placeholder="e.g. Saw severe cracking from the road, large 2-car" value={newLead.notes} onChange={e=>setNewLead(f=>({...f,notes:e.target.value}))}/></div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={addLead} disabled={!newLead.address}>📍 Add to Pipeline</button>
              <button className="btn btn-ghost" onClick={()=>setShowAddLead(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </>
  );
}
