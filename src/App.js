import React, { useState } from "react";

// ─────────────────────────────────────────────
// ANALYTICS + ERROR MONITORING
// Initialized via useEffect in App component
// ─────────────────────────────────────────────
const POSTHOG_KEY   = "phc_kqPn9wagFCAw9QaUF4XJxKMNEnHRooEX7uBvt4wdv29z";
const ADMIN_EMAIL   = "${ACTIVE_COMPANY.email}";
const SENTRY_DSN  = "https://7dbac4cf1178f77cd4f219c54e11225f@o4511197222797312.ingest.us.sentry.io/4511197260021760";

function track(event, props) {
  try { if(window.posthog) window.posthog.capture(event, props||{}); } catch(e){}
}

function initAnalytics() {
  try {
    // PostHog
    if(!window.posthog) {
      var ph = window.posthog = window.posthog || [];
      ph._i = []; ph.init = function(k,c){ ph._i.push([k,c]); };
      ph.__SV = 1;
      var s = document.createElement('script');
      s.type = 'text/javascript'; s.async = true;
      s.src = 'https://us.i.posthog.com/static/array.js';
      document.head.appendChild(s);
      s.onload = function() {
        try {
          window.posthog.init(POSTHOG_KEY, {
            api_host: 'https://us.i.posthog.com',
            autocapture: true,
          });
        } catch(e){}
      };
    }
  } catch(e){ console.warn('PostHog failed:', e); }
  try {
    // Sentry
    var sen = document.createElement('script');
    sen.src = 'https://browser.sentry-cdn.com/7.99.0/bundle.min.js';
    sen.crossOrigin = 'anonymous';
    sen.onload = function() {
      try {
        window.Sentry && window.Sentry.init({
          dsn: SENTRY_DSN,
          tracesSampleRate: 0.1,
          environment: 'production',
        });
      } catch(e){}
    };
    document.head.appendChild(sen);
  } catch(e){ console.warn('Sentry failed:', e); }
}

// ─────────────────────────────────────────────
// LOB API INTEGRATION
// ─────────────────────────────────────────────
const PROXY_BASE      = "https://joelmwood--b166b8c432db11f19dff42b51c65c3df.web.val.run";

// ─────────────────────────────────────────────
// SUPABASE CLIENT
// ─────────────────────────────────────────────
const SUPABASE_URL = "https://pzbvvohedpgeiynqoujr.supabase.co";
const SUPABASE_KEY = "sb_publishable_H6U94DoMxk7_Cap6ftIoew_14fhh8Qe";

function getAuthToken() {
  try {
    const s = localStorage.getItem("pm_session");
    return s ? JSON.parse(s).token : null;
  } catch { return null; }
}

function getRefreshToken() {
  try {
    const s = localStorage.getItem("pm_session");
    return s ? JSON.parse(s).refresh_token : null;
  } catch { return null; }
}

async function refreshSessionIfNeeded() {
  try {
    const s = localStorage.getItem("pm_session");
    if (!s) return null;
    const session = JSON.parse(s);
    // Check if token expires within 5 minutes
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    if (expiresAt && (expiresAt - now) > 300) return session.token; // still valid
    // Need to refresh
    const rt = session.refresh_token;
    if (!rt) return session.token; // no refresh token, use existing
    const data = await auth.refreshToken(rt);
    if (data.access_token) {
      const newSession = {
        token: data.access_token,
        refresh_token: data.refresh_token || rt,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        user: data.user || session.user,
      };
      localStorage.setItem("pm_session", JSON.stringify(newSession));
      return newSession.token;
    }
    return session.token;
  } catch(e) {
    return getAuthToken();
  }
}

async function sbFetch(path, options={}, _retry=false) {
  const token = await refreshSessionIfNeeded();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 && !_retry) {
    // JWT expired — force refresh and retry once
    try {
      const s = localStorage.getItem("pm_session");
      const session = s ? JSON.parse(s) : null;
      if (session?.refresh_token) {
        const data = await auth.refreshToken(session.refresh_token);
        if (data.access_token) {
          const newSession = {
            token: data.access_token,
            refresh_token: data.refresh_token || session.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
            user: data.user || session.user,
          };
          localStorage.setItem("pm_session", JSON.stringify(newSession));
          return sbFetch(path, options, true); // retry once
        }
      }
    } catch(e) {}
    // Refresh failed — clear session and force re-login
    localStorage.removeItem("pm_session");
    localStorage.removeItem("pm_profile");
    window.location.reload();
    return null;
  }
  if (!res.ok) {
    const err = await res.text();
    console.error("Supabase error:", res.status, err);
    return null;
  }
  return res.json();
}

// ─────────────────────────────────────────────
// SUPABASE AUTH
// ─────────────────────────────────────────────
const auth = {
  async signUp(email, password, meta) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, data: meta }),
    });
    return res.json();
  },
  async signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },
  async signOut(token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` },
    });
  },
  async refreshToken(refreshToken) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return res.json();
  },
  async resetPassword(email) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    return res.json();
  },
  async getProfile(token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractor_profiles?select=*&limit=1`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const data = await res.json();
    return data[0] || null;
  },
  async updateProfile(token, profile) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractor_profiles`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(profile),
    });
    return res.json();
  },
};

// ─────────────────────────────────────────────
// PAVEMAIL v1.0.0 — CONTRACTOR CONFIG
// To set up a new contractor — change ONLY these values.
// Everything else in the app pulls from here automatically.
// ─────────────────────────────────────────────
const COMPANY = {
  // Identity
  name:        "JWood LLC",
  ownerName:   "Joel",
  phone:       "918-896-6737",
  phoneRaw:    "9188966737",             // digits only, for QR codes + Bland transfer
  email:       "${ACTIVE_COMPANY.email}",
  city:        "Tulsa",
  state:       "OK",
  promo:       "JWOOD",
  // Lob.com — address ID for return address on postcards
  lobFromId:   "adr_910e8abc86e78815",
  // Bland.ai — phone number to transfer qualified leads to
  transferPhone: "+19188966737",
  // Supabase — contractor identifier for data isolation
  contractorId: "jwood",
  // Capacity defaults
  crewSize:    12,
  maxJobsWeek: 6,
  weeklyTarget: 40000,
  // Branding
  accentColor: "#e8560a",            // orange — change for each contractor
  tagline:     "Tulsa's Concrete Specialists",
};


// DB helpers
const db = {
  // Pipeline
  async getPipeline() {
    const token = getAuthToken();
    if(!token) return [];
    const user = (() => { try { return JSON.parse(localStorage.getItem("pm_session"))?.user; } catch { return null; } })();
    if(!user?.id) return [];
    return sbFetch(`pipeline_leads?user_id=eq.${user.id}&order=created_at.desc`);
  },
  async upsertLead(lead) {
    return sbFetch("pipeline_leads", {
      method: "POST",
      prefer: "return=representation",
      headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        id: lead.id,
        contractor_id: COMPANY.contractorId,
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
      prefer: "return=minimal",
    });
  },
  async deleteLead(id) {
    return sbFetch(`pipeline_leads?id=eq.${id}`, { method: "DELETE" });
  },

  // Campaigns
  async getCampaigns() {
    const token = getAuthToken();
    if(!token) return [];
    const user = (() => { try { return JSON.parse(localStorage.getItem("pm_session"))?.user; } catch { return null; } })();
    if(!user?.id) return [];
    return sbFetch(`campaigns?user_id=eq.${user.id}&order=created_at.desc`);
  },
  async saveCampaign(campaign) {
    return sbFetch("campaigns", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: COMPANY.contractorId,
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
    const token = getAuthToken();
    if(!token) return [];
    const user = (() => { try { return JSON.parse(localStorage.getItem("pm_session"))?.user; } catch { return null; } })();
    if(!user?.id) return [];
    return sbFetch(`spot_bids?user_id=eq.${user.id}&order=created_at.desc`);
  },
  async saveSpotBid(bid) {
    return sbFetch("spot_bids", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: COMPANY.contractorId,
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
    const token = getAuthToken();
    if(!token) return [];
    const user = (() => { try { return JSON.parse(localStorage.getItem("pm_session"))?.user; } catch { return null; } })();
    if(!user?.id) return [];
    return sbFetch(`ai_calls?user_id=eq.${user.id}&order=created_at.desc`);
  },
  async saveAiCall(call) {
    return sbFetch("ai_calls", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: COMPANY.contractorId,
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
    const token = getAuthToken();
    if(!token) return [];
    const user = (() => { try { return JSON.parse(localStorage.getItem("pm_session"))?.user; } catch { return null; } })();
    if(!user?.id) return [];
    return sbFetch(`jobs?user_id=eq.${user.id}&order=created_at.desc`);
  },
  async saveJob(job) {
    return sbFetch("jobs", {
      method: "POST",
      body: JSON.stringify({
        contractor_id: COMPANY.contractorId,
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

  // ── ADMIN ONLY ──
  async getAllContractors(token) {
    const freshToken = await refreshSessionIfNeeded();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contractor_profiles?select=*&order=created_at.desc`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${freshToken || token}`, "Content-Type": "application/json" },
    });
    return res.ok ? res.json() : [];
  },
  async getAllPipeline(token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_leads?select=*&order=created_at.desc&limit=500`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.ok ? res.json() : [];
  },
  async getAllSpotBids(token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/spot_bids?select=*&order=created_at.desc&limit=500`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.ok ? res.json() : [];
  },
  async getAllCampaigns(token) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=*&order=created_at.desc&limit=500`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    });
    return res.ok ? res.json() : [];
  },
};
const BLAND_PROXY     = PROXY_BASE + "/?target=bland-call";
const BLAND_STATUS    = PROXY_BASE + "/?target=bland-status";

// ─────────────────────────────────────────────
// BLAND.AI AGENT CONFIG
// ─────────────────────────────────────────────
const BLAND_AGENT_SCRIPT = `You are a friendly assistant answering calls for JWood LLC, a concrete contractor in Tulsa, Oklahoma. Your name is Alex.

When someone calls:
1. Greet them warmly: "Thanks for calling JWood LLC! This is Alex. Are you calling about a concrete project?"
2. Get their name and callback number
3. Ask what service they need: crack repair, new concrete, resurfacing, or sealing
4. Ask for the property address
5. Ask their timeline: "Are you looking to get this done in the next few weeks?"
6. Ask roughly the approximate size of the project (single car, double car, or larger)
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
        transfer_phone_number: COMPANY.transferPhone,
        webhook: PROXY_BASE + "/?target=bland",
        metadata: { source: "pavemail", lead: leadContext },
        first_sentence: "Thanks for calling JWood LLC, this is Alex! Are you calling about a concrete project?",
        record: true,
        reduce_latency: false,
      })
    });
    const data = await res.json();

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
      { headers: { "User-Agent": "PaveMail/1.0 (${ACTIVE_COMPANY.email})" } }
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
const LOB_FROM_ID = COMPANY.lobFromId; // JWood LLC
const LOB_TO_ID   = "adr_cef32a4b4157e9df"; // Tulsa Test Homeowner

async function sendMailer({ neighborhood, headline, sub }) {
  return lobRequest("/postcards", {
    description: `JWood LLC - ${neighborhood || "Tulsa"} Campaign`,
    to:   LOB_TO_ID,
    from: LOB_FROM_ID,
    size: "6x9",
    front: `<html><body style="margin:0;padding:30px;background:#1c1a17;color:#f5f0e6;font-family:Arial,sans-serif;"><div style="color:#e8560a;font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:10px;">JWood LLC · Tulsa, OK</div><h1 style="font-size:32px;color:#f5f0e6;margin:0;line-height:1.1;">${headline || "UPGRADE YOUR CONCRETE THIS SEASON"}</h1><p style="font-size:12px;color:#b8b4ac;margin-top:10px;line-height:1.6;">${sub || "Tulsa concrete specialists. Free estimates, written warranty, local crew."}</p><div style="margin-top:18px;background:#e8560a;color:white;padding:10px 16px;border-radius:6px;display:inline-block;"><strong style="font-size:13px;">FREE ESTIMATE — CALL 918-896-6737</strong></div><p style="margin-top:10px;font-size:10px;color:#7a7670;">Mention code JWOOD · ${ACTIVE_COMPANY.email}</p></body></html>`,
    back: `<html><body style="margin:0;padding:30px;background:#f5f0e6;color:#1c1a17;font-family:Arial,sans-serif;"><h2 style="font-size:20px;color:#1c1a17;margin-bottom:12px;">Why Tulsa Homeowners Choose JWood LLC</h2><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;"><div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:8px 12px;border-radius:4px;"><strong style="font-size:11px;">Oklahoma Weather Experts</strong><p style="font-size:10px;color:#6a6864;margin:2px 0 0;">We know Tulsa freeze-thaw cycles and use the right materials.</p></div><div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:8px 12px;border-radius:4px;"><strong style="font-size:11px;">Commercial-Grade Materials</strong><p style="font-size:10px;color:#6a6864;margin:2px 0 0;">Reinforced concrete built to last 30+ years in Oklahoma soil.</p></div><div style="background:#f0ebe0;border-left:4px solid #e8560a;padding:8px 12px;border-radius:4px;"><strong style="font-size:11px;">Written Warranty on Every Job</strong><p style="font-size:10px;color:#6a6864;margin:2px 0 0;">2-year workmanship guarantee. If something fails, we fix it free.</p></div></div><div style="background:#1c1a17;color:white;padding:12px;border-radius:8px;text-align:center;"><div style="font-size:15px;font-weight:700;">${ACTIVE_COMPANY.phone}</div><div style="font-size:10px;color:#b8b4ac;margin-top:2px;">${ACTIVE_COMPANY.email}</div><div style="margin-top:5px;font-size:10px;background:#e8560a;display:inline-block;padding:3px 8px;border-radius:4px;">Code: JWOOD — FREE estimate</div></div></body></html>`,
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


// ─────────────────────────────────────────────
// PRICING ENGINE
// ─────────────────────────────────────────────
const PROJECT_SIZES = [
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
    page1: { eyebrow:"Your Neighbors Are Already Upgrading", headline:"TULSA WINTERS ARE TOUGH ON CONCRETE", subheadline:"Freeze-thaw cycles across Tulsa have left concrete cracked and crumbling this spring. Don't let small damage turn into a full replacement — JWood LLC is already working in your neighborhood.", badgeTop:"FREE", badgeMain:"ESTIMATE", badgeBottom:"No Obligation" },
    page2: { headline:"WHY YOUR CONCRETE CAN'T WAIT", intro:"Oklahoma's temperature swings — from icy winters to 100°F summers — are brutal on concrete. Cracks ignored now become costly replacements by fall.", benefits:[{icon:"▲",title:"Oklahoma Weather Damage",desc:"Tulsa's freeze-thaw cycles crack concrete fast. Spring is the best time to repair before summer heat sets in."},{icon:"◉",title:"Stop Water Intrusion",desc:"Cracks let water in. Water expands when frozen. That destroys your base and doubles repair costs."},{icon:"◫",title:"Boost Curb Appeal",desc:"A repaired surface instantly upgrades your home's appearance and protects its value."},{icon:"◌",title:"One-Day Turnaround",desc:"Most crack repairs completed same day. Driveable within 24 hours."}], whyTitle:"Why JWood LLC?", whyText:"We're local Tulsans — we know Oklahoma soil, Oklahoma weather, and Oklahoma homeowners. Every job is done with commercial-grade materials and backed by our written warranty." },
    page3: { headline:"OUR SIMPLE 4-STEP PROCESS", intro:"From your first call to pulling your car back in — we make it effortless.", steps:[{title:"Free On-Site Estimate",desc:"We visit, assess the damage, and give you a written quote. No pressure, no surprises."},{title:"Schedule at Your Convenience",desc:"We work around your schedule, including Saturdays."},{title:"Expert Repair",desc:"Our crew arrives on time, protects your lawn, and gets to work with commercial-grade materials."},{title:"Done & Guaranteed",desc:"We clean up completely and hand you a written warranty before we leave."}], offerHeadline:"FREE ESTIMATE — CALL TODAY", offerSub:"Spring slots filling fast — mention code JWOOD when you call" },
    page4: { eyebrow:"Ready to Get Started?", headline:"CALL JWOOD LLC TODAY", sub:"Serving Tulsa and surrounding areas. Spring is our busiest season — call now to lock in your free estimate before your neighbors do.", guarantee:"We guarantee our work for 2 full years. If anything fails due to workmanship, we come back and fix it — no questions asked." }
  },
  "Summer-New Installation-Free Estimate": {
    page1: { eyebrow:"Upgrade Before Summer Cookout Season", headline:"NEW CONCRETE PROJECT COMPLETED THIS SUMMER", subheadline:"Long Tulsa summer days mean faster curing and better results. JWood LLC is completing concrete projects across your neighborhood — and we have a free estimate ready for you.", badgeTop:"FREE", badgeMain:"ESTIMATE", badgeBottom:"Call Today" },
    page2: { headline:"TRANSFORM YOUR HOME'S FIRST IMPRESSION", intro:"A new concrete project is one of the highest-ROI investments a Tulsa homeowner can make — averaging 98% return at resale.", benefits:[{icon:"◈",title:"Summer Is Ideal",desc:"Oklahoma's warm temps and dry summers create perfect conditions for long-lasting concrete pours."},{icon:"◆",title:"Best ROI",desc:"New concrete projects return nearly 100% of cost at resale — better than most home renovations."},{icon:"▦",title:"Custom Finish",desc:"Choose width, texture, color, and edging to perfectly match your Tulsa home."},{icon:"▣",title:"Done in Days",desc:"Most residential projects installed and driveable within 3–5 days."}], whyTitle:"Why JWood LLC?", whyText:"Tulsa homeowners trust JWood LLC because we show up on time, communicate clearly, and stand behind every pour. We use reinforced concrete with proper base prep." },
    page3: { headline:"HOW IT WORKS", intro:"A new concrete project is easier than you think.", steps:[{title:"Free Design Consultation",desc:"We measure your space and help you choose the right width, finish, and budget."},{title:"Demo & Excavation",desc:"We remove your old surface and properly prepare the base — the most critical step."},{title:"Pour & Finish",desc:"Commercial-grade concrete poured by our experienced Tulsa crew."},{title:"Cure, Seal & Warranty",desc:"We apply a professional sealer and hand you a written warranty before we leave."}], offerHeadline:"FREE ESTIMATE — NO OBLIGATION", offerSub:"Summer slots limited — call 918-896-6737 and mention JWOOD" },
    page4: { eyebrow:"Let's Build Something Great", headline:"CALL 918-896-6737 THIS WEEK", sub:"Summer slots fill fast across Tulsa. We can usually start within 2 weeks of your estimate.", guarantee:"5-year structural warranty on all new installations. We stand behind every pour." }
  },
  "Fall-Sealing-Free Estimate": {
    page1: { eyebrow:"Protect Your Concrete Before Winter Hits", headline:"SEAL IT NOW BEFORE OKLAHOMA WINTER CRACKS IT", subheadline:"Fall is the last chance to protect your concrete before Tulsa's freeze-thaw season begins. JWood LLC is sealing concrete across your neighborhood right now.", badgeTop:"FREE", badgeMain:"ESTIMATE", badgeBottom:"Limited Slots" },
    page2: { headline:"WHY FALL SEALING IS CRITICAL IN TULSA", intro:"Oklahoma's winters are unpredictable — ice, snow, and freeze-thaw cycles can destroy unsealed concrete in a single season.", benefits:[{icon:"◈",title:"Winter Protection",desc:"Sealing blocks water before it freezes and expands inside your concrete."},{icon:"◆",title:"UV & Heat Shield",desc:"Tulsa summers hit 100°F+. Sealer protects against UV damage and surface deterioration."},{icon:"✦",title:"Like-New Appearance",desc:"Professional sealing restores color and gives your concrete a clean, finished look."},{icon:"▣",title:"Prevent Costly Repairs",desc:"A $300 seal job now prevents a $3,000 replacement later."}], whyTitle:"Why JWood LLC?", whyText:"We use commercial-grade penetrating sealers — not the hardware store stuff that peels in one season. Our sealing jobs are done right, and we're Tulsa locals." },
    page3: { headline:"SIMPLE SEALING PROCESS", intro:"In and out in a few hours. Your concrete is protected all winter.", steps:[{title:"Free Assessment",desc:"We inspect your concrete and check for cracks that need repair before sealing."},{title:"Surface Prep & Clean",desc:"We power wash and prep the surface for maximum sealer adhesion."},{title:"Professional Application",desc:"Commercial-grade sealer applied evenly by our trained crew."},{title:"24-Hour Cure",desc:"Stay off it for 24 hours and you're fully protected for the season."}], offerHeadline:"FREE ESTIMATE THIS WEEK", offerSub:"Fall slots filling fast — mention JWOOD when you call 918-896-6737" },
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
.topbar-center{display:flex;align-items:center;gap:6px;flex:1;justify-content:center;flex-wrap:nowrap;overflow:hidden;}
.topbar-stat{display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;color:var(--stone);border:1px solid rgba(184,180,172,0.1);background:rgba(184,180,172,0.04);white-space:nowrap;transition:all 0.15s;user-select:none;}
.topbar-stat:hover{background:rgba(184,180,172,0.08);border-color:rgba(184,180,172,0.18);color:var(--concrete);}
.topbar-right{margin-left:0;display:flex;align-items:center;gap:10px;flex-shrink:0;}
.co-pill{background:rgba(232,86,10,0.15);border:1px solid rgba(232,86,10,0.3);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--orange2);font-weight:700;}
.lob-pill{background:rgba(42,122,82,0.15);border:1px solid rgba(42,122,82,0.3);border-radius:20px;padding:4px 12px;font-size:11px;color:var(--green2);font-weight:700;display:flex;align-items:center;gap:5px;}
.lob-dot{width:6px;height:6px;border-radius:50%;background:var(--green2);animation:blink 1.4s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideInLeft{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideInRight{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
.avatar{width:34px;height:34px;background:var(--orange);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;cursor:pointer;transition:all 0.15s;flex-shrink:0;border:2px solid transparent;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
.avatar:hover{border-color:rgba(232,86,10,0.5);box-shadow:0 0 0 3px rgba(232,86,10,0.15);}
.user-menu-wrap{position:relative;}
.user-menu{position:fixed;top:52px;right:8px;background:var(--ink);border:1px solid rgba(184,180,172,0.12);border-radius:12px;padding:6px;min-width:220px;max-width:calc(100vw - 16px);z-index:500;box-shadow:0 8px 32px rgba(0,0,0,0.5);animation:fadeInFast 0.15s ease;}
.user-menu-header{padding:10px 12px 8px;border-bottom:1px solid rgba(184,180,172,0.07);margin-bottom:4px;}
.user-menu-name{font-size:13px;font-weight:700;color:var(--cream);margin-bottom:2px;}
.user-menu-email{font-size:10px;color:var(--stone);font-family:'DM Mono',monospace;}
.user-menu-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:12px;color:var(--concrete);transition:all 0.12s;border:none;background:none;width:100%;text-align:left;font-family:'Syne',sans-serif;touch-action:manipulation;}
.user-menu-item:hover{background:rgba(184,180,172,0.06);color:var(--cream);}
.user-menu-item.danger{color:var(--red);}
.user-menu-item.danger:hover{background:rgba(184,50,50,0.08);}
.user-menu-divider{height:1px;background:rgba(184,180,172,0.07);margin:4px 0;}
.nav{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);display:flex;flex-direction:column;padding:14px 0;overflow-y:auto;}
.nav-label{font-size:9px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:var(--gravel);padding:10px 18px 5px;}
.nav-item{display:flex;align-items:center;gap:10px;padding:9px 18px;cursor:pointer;transition:all 0.15s;position:relative;font-size:13px;font-weight:500;color:var(--stone);border:none;background:none;text-align:left;width:100%;font-family:'Syne',sans-serif;touch-action:manipulation;}
.nav-item:hover{background:rgba(184,180,172,0.05);color:var(--concrete);}
.nav-item.active{color:var(--cream);background:rgba(232,86,10,0.14);}
.nav-item.active::before{content:'';position:absolute;left:0;top:4px;bottom:4px;width:3px;background:var(--orange);border-radius:0 2px 2px 0;}
.nav-icon{width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.15s;}
.nav-item:hover .nav-icon,.nav-item.active .nav-icon{opacity:1;}
.nav-item.active .nav-icon svg{filter:drop-shadow(0 0 4px rgba(232,86,10,0.4));}
.nav-badge{margin-left:auto;background:var(--orange);color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;min-width:18px;text-align:center;}
.nav-divider{height:1px;background:rgba(184,180,172,0.08);margin:10px 0;}
.nav-mini{margin-top:auto;padding:14px 16px 6px;}
.mini-card{background:rgba(0,0,0,0.25);border:1px solid rgba(184,180,172,0.08);border-radius:8px;padding:12px 14px;font-size:11px;color:var(--stone);display:flex;flex-direction:column;gap:4px;}
.mini-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--gravel);margin-bottom:6px;}
.mini-row{display:flex;justify-content:space-between;}
.content{overflow-y:auto;background:var(--black);position:relative;}
.btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:7px;font-family:'Syne',sans-serif;font-size:12px;font-weight:600;cursor:pointer;border:none;transition:all 0.15s;}
.btn-primary{background:var(--orange);color:white;box-shadow:0 2px 8px rgba(232,86,10,0.3);}
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
.spin{display:inline-block;width:15px;height:15px;border:2px solid rgba(255,255,255,0.25);border-top-color:white;border-radius:50%;animation:spinning 0.55s linear infinite;flex-shrink:0;}
/* content children animated via individual component classes */
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
.map-layout{display:grid;grid-template-columns:320px 1fr;height:calc(100vh - 52px);height:calc(100dvh - 52px);overflow:hidden;}
.map-sidebar{background:var(--ink);border-right:1px solid rgba(184,180,172,0.07);overflow-y:auto;}
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
.create-layout{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 52px);height:calc(100dvh - 52px);overflow:hidden;}
.create-form{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);overflow-y:auto;padding:20px;}
.create-preview{overflow-y:auto;padding:24px 28px;background:#111009;}
.cost-bar{background:rgba(0,0,0,0.3);border:1px solid rgba(184,180,172,0.1);border-radius:8px;padding:12px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
.cb-label{font-size:11px;color:var(--stone);}
.cb-value{font-family:'DM Mono',monospace;font-size:20px;color:var(--orange2);}
.cb-sub{font-size:10px;color:var(--gravel);margin-top:1px;}
.gen-btn{width:100%;background:var(--orange);color:white;border:none;border-radius:8px;padding:13px;font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:2.5px;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:8px;}
.gen-btn:hover:not(:disabled){background:var(--orange2);transform:translateY(-2px);box-shadow:0 6px 20px rgba(232,86,10,0.4);}
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
.tracker-layout{padding:24px 28px;animation:fadeIn 0.2s ease;}
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
.spot-layout{display:grid;grid-template-columns:360px 1fr;height:calc(100vh - 52px);height:calc(100dvh - 52px);overflow:hidden;animation:fadeIn 0.2s ease;}
.spot-form{background:var(--ink);border-right:1px solid rgba(184,180,172,0.08);overflow-y:auto;padding:20px;}
.spot-preview{overflow-y:auto;padding:24px 28px;background:#111009;}
.mode-tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:18px;}
.mode-tab{background:rgba(0,0,0,0.3);border:1px solid rgba(184,180,172,0.12);border-radius:7px;padding:10px 8px;text-align:center;cursor:pointer;transition:all 0.15s;font-family:'Syne',sans-serif;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
.mode-tab:hover{border-color:rgba(232,86,10,0.3);}
.mode-tab.on{border-color:var(--orange);background:rgba(232,86,10,0.1);}
.mode-tab .mt-icon{font-size:20px;margin-bottom:4px;display:flex;align-items:center;justify-content:center;color:currentColor;}
.mode-tab .mt-label{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--stone);}
.mode-tab.on .mt-label{color:var(--orange2);}
.photo-drop{border:2px dashed rgba(184,180,172,0.2);border-radius:8px;padding:28px;text-align:center;cursor:pointer;transition:all 0.15s;background:rgba(0,0,0,0.2);margin-bottom:12px;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
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
.spot-mailer{background:#faf7f2;border-radius:8px;overflow:hidden;box-shadow:0 6px 30px rgba(0,0,0,0.6);font-family:'Syne',sans-serif;max-width:100%;}
.spot-front{padding:0;position:relative;border-radius:inherit;background:#111009;}
.spot-photo-wrap{position:relative;border-radius:inherit;background:#111009;}
.spot-photo-bg{width:100%;height:320px;object-fit:cover;object-position:center;display:block;border:none;margin:0;padding:0;}
.spot-photo-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to bottom,rgba(10,9,8,0.35) 0%,rgba(10,9,8,0.75) 50%,rgba(10,9,8,0.97) 100%);pointer-events:none;}
.spot-front-content{position:absolute;top:0;left:0;right:0;bottom:0;padding:28px;display:flex;flex-direction:column;}
.spot-front-no-photo{position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(145deg,#111009 0%,#2a2720 100%);}
.spot-canvas-preview{width:100%;height:auto;aspect-ratio:600/320;display:block;border-radius:inherit;}
.spot-front-texture{position:absolute;inset:0;background-image:repeating-linear-gradient(-45deg,rgba(184,180,172,0.025) 0,rgba(184,180,172,0.025) 1px,transparent 0,transparent 8px);}
.spot-tag{font-size:10px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:var(--orange);margin-bottom:10px;position:relative;}
.spot-address{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#f5f0e6;position:relative;letter-spacing:1px;margin-bottom:8px;}
.spot-note{font-size:13px;color:#b8b4ac;line-height:1.65;position:relative;margin-bottom:16px;}
.spot-bid-box{background:rgba(232,86,10,0.15);border:1px solid rgba(232,86,10,0.4);border-radius:8px;padding:14px 18px;position:relative;display:flex;align-items:flex-start;gap:12px;}
.spot-bid-label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--orange2);}
.spot-bid-value{font-family:'Bebas Neue',sans-serif;font-size:32px;color:#f5f0e6;letter-spacing:1px;line-height:1;}
.spot-bar{position:absolute;bottom:0;left:0;right:0;height:4px;background:var(--orange);}
.spot-back{background:linear-gradient(145deg,#1a1814 0%,#0e0d0b 60%,#1c1a17 100%);padding:0;overflow:hidden;position:relative;}
.spot-back::before{content:'';position:absolute;top:-60px;right:-60px;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(232,86,10,0.08) 0%,transparent 70%);pointer-events:none;}
.spot-back::after{content:'';position:absolute;bottom:-40px;left:-40px;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(232,86,10,0.05) 0%,transparent 70%);pointer-events:none;}
.spot-back-header{background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(232,86,10,0.2);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;}
.spot-back-header-title{font-family:'Bebas Neue',sans-serif;font-size:15px;letter-spacing:2px;color:#f5f0e6;}
.spot-back-header-sub{font-size:9px;color:rgba(184,180,172,0.45);letter-spacing:1px;text-transform:uppercase;margin-top:2px;}
.spot-back-body{padding:14px 16px;position:relative;z-index:1;}
.spot-damage-list{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.spot-damage-item{display:flex;align-items:flex-start;gap:8px;font-size:11px;color:rgba(184,180,172,0.75);line-height:1.5;}
.spot-damage-dot{width:5px;height:5px;border-radius:50%;background:rgba(232,86,10,0.6);flex-shrink:0;margin-top:5px;}
.spot-bid-strip{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-left:3px solid rgba(232,86,10,0.7);border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.spot-bid-strip-left{display:flex;flex-direction:column;gap:2px;}
.spot-bid-strip-label{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(232,86,10,0.7);}
.spot-bid-strip-amount{font-family:'Bebas Neue',sans-serif;font-size:28px;color:#f5f0e6;letter-spacing:1px;line-height:1;}
.spot-bid-strip-includes{font-size:9px;color:rgba(184,180,172,0.35);margin-top:2px;}
.spot-cta-box{background:rgba(232,86,10,0.08);border:1px solid rgba(232,86,10,0.2);border-left:3px solid rgba(232,86,10,0.7);border-radius:8px;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;}
.spot-cta-text h4{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px;color:#f5f0e6;margin-bottom:2px;}
.spot-cta-text p{font-size:10px;color:rgba(184,180,172,0.45);font-family:'DM Mono',monospace;}
.spot-guarantee{display:flex;align-items:center;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05);}
.spot-guarantee-icon{font-size:12px;}
.spot-guarantee-text{font-size:9px;color:rgba(184,180,172,0.3);line-height:1.5;}
.spot-jobs{margin-top:20px;}
.spot-job-row{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;padding:14px 18px;margin-bottom:8px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all 0.15s;}
.spot-job-row:hover{background:rgba(184,180,172,0.05);border-color:rgba(184,180,172,0.15);transform:translateY(-1px);}
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

/* ── ADMIN ── */
.admin-layout{padding:28px 32px;animation:fadeIn 0.2s ease;}
.admin-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;}
.admin-stat{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;padding:16px;text-align:center;}
.admin-stat-val{font-family:"Bebas Neue",sans-serif;font-size:36px;line-height:1;margin-bottom:4px;}
.admin-stat-label{font-size:10px;color:var(--stone);letter-spacing:1px;text-transform:uppercase;}
.contractor-card{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:12px;padding:18px 20px;margin-bottom:10px;display:flex;align-items:center;gap:16px;transition:border-color 0.15s,transform 0.15s;animation:slideInUp 0.2s ease;}
.contractor-avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:white;flex-shrink:0;}
.contractor-name{font-size:14px;font-weight:700;color:var(--cream);}
.contractor-meta{font-size:11px;color:var(--stone);margin-top:2px;}
.contractor-stats{margin-left:auto;display:flex;gap:16px;text-align:right;}
.contractor-stat-val{font-family:"DM Mono",monospace;font-size:14px;font-weight:600;color:var(--cream);}
.contractor-stat-lbl{font-size:9px;color:var(--gravel);letter-spacing:1px;text-transform:uppercase;}
.admin-table{background:var(--ink);border:1px solid rgba(184,180,172,0.08);border-radius:10px;overflow:hidden;}
.admin-thead{display:grid;padding:10px 16px;background:rgba(0,0,0,0.2);font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--stone);border-bottom:1px solid rgba(184,180,172,0.07);}
.admin-row{display:grid;padding:12px 16px;border-bottom:1px solid rgba(184,180,172,0.04);font-size:12px;color:var(--concrete);align-items:center;}
.admin-row:last-child{border-bottom:none;}
.admin-nav{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap;}
.admin-nav-btn{padding:6px 14px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid rgba(184,180,172,0.12);background:transparent;color:var(--stone);font-family:"Syne",sans-serif;transition:all 0.12s;}
.admin-nav-btn.active{background:rgba(232,86,10,0.15);color:var(--orange2);border-color:rgba(232,86,10,0.3);}
@media(max-width:768px){.admin-stat-grid{grid-template-columns:1fr 1fr;}.admin-layout{padding:16px;}}

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
.kanban-head-icon{font-size:14px;opacity:0.7;letter-spacing:-0.5px;}
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
.lead-flag{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:10px;font-size:9px;font-weight:700;letter-spacing:0.3px;white-space:nowrap;}
.flag-picker{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.flag-picker-btn{display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;border:1px solid;background:transparent;transition:all 0.12s;font-family:'Syne',sans-serif;}
.lead-detail-modal{background:var(--ink);border:1px solid rgba(184,180,172,0.12);border-radius:16px;width:100%;max-width:480px;max-height:90dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;}
.lead-detail-header{padding:20px 22px 16px;border-bottom:1px solid rgba(184,180,172,0.08);}
.lead-detail-addr{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;color:var(--cream);line-height:1.1;}
.lead-detail-sub{font-size:12px;color:var(--stone);margin-top:4px;}
.lead-detail-section{padding:16px 22px;border-bottom:1px solid rgba(184,180,172,0.06);}
.lead-detail-section:last-child{border-bottom:none;}
.lead-detail-label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--stone);margin-bottom:10px;}
.county-btn{display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid rgba(184,180,172,0.1);border-radius:8px;color:var(--concrete);font-size:12px;cursor:pointer;transition:all 0.15s;width:100%;text-align:left;font-family:'Syne',sans-serif;margin-bottom:6px;}
.county-btn:hover{background:rgba(184,180,172,0.06);border-color:rgba(184,180,172,0.18);color:var(--cream);}
.county-btn-icon{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.pl-list-row{display:grid;grid-template-columns:2fr 1.2fr 1fr 1fr 1fr 1fr 120px 80px;gap:10px;padding:11px 16px;border-bottom:1px solid rgba(184,180,172,0.05);align-items:center;transition:background 0.12s;cursor:pointer;}
.pl-list-row:last-child{border-bottom:none;}
.pl-list-row:hover{background:rgba(184,180,172,0.04);}
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
.modal-box{background:var(--ink);border:1px solid rgba(184,180,172,0.15);border-radius:16px;padding:28px;width:100%;max-width:440px;max-height:90vh;max-height:90dvh;overflow-y:auto;}
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
  /* Prevent iOS auto-zoom on focus */
  input,select,textarea{font-size:16px !important;}
  .field input,.field select,.field textarea{font-size:16px !important;}
}

/* ── LOGIN SCREEN ── */
.login-screen{position:fixed;inset:0;inset:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);background:var(--black);display:flex;align-items:center;justify-content:center;z-index:9999;flex-direction:column;gap:0;min-height:100dvh;overflow-y:auto;}
.login-bg{position:absolute;inset:0;background:linear-gradient(145deg,#0e0d0b 0%,#1c1a17 60%,#0e0d0b 100%);}
.login-texture{position:absolute;inset:0;background-image:repeating-linear-gradient(-45deg,rgba(184,180,172,0.02) 0,rgba(184,180,172,0.02) 1px,transparent 0,transparent 8px);}
.login-box{position:relative;width:100%;max-width:360px;padding:32px 28px;animation:scaleIn 0.3s ease;}
.demo-dots{display:flex;gap:12px;justify-content:center;margin:20px 0 24px;}
.demo-dot{width:14px;height:14px;border-radius:50%;border:2px solid rgba(184,180,172,0.2);background:transparent;transition:all 0.15s;}
.demo-dot.filled{background:var(--orange);border-color:var(--orange);box-shadow:0 0 8px rgba(232,86,10,0.4);}
.demo-dot.error{background:#c0392b;border-color:#c0392b;}
.pin-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
.pin-key{height:52px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(184,180,172,0.1);color:var(--cream);font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;cursor:pointer;transition:all 0.12s;display:flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
.pin-key:hover{background:rgba(232,86,10,0.1);border-color:rgba(232,86,10,0.3);}
.pin-key:active{transform:scale(0.94);background:rgba(232,86,10,0.18);}
.pin-key.del{color:var(--stone);font-size:16px;}
@keyframes shake{0%,100%{transform:translateX(0);}20%{transform:translateX(-6px);}40%{transform:translateX(6px);}60%{transform:translateX(-4px);}80%{transform:translateX(4px);}}
.shake{animation:shake 0.35s ease;}
.login-logo{font-family:'Bebas Neue',sans-serif;font-size:48px;letter-spacing:6px;color:var(--cream);text-align:center;margin-bottom:6px;}
.login-logo span{color:var(--orange);}
.login-tagline{font-size:10px;color:var(--stone);text-align:center;letter-spacing:3px;text-transform:uppercase;margin-bottom:32px;opacity:0.7;}
.login-label{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--stone);text-align:center;margin-bottom:14px;}
.pin-dots{display:flex;justify-content:center;gap:14px;margin-bottom:24px;}
.pin-dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(184,180,172,0.2);background:transparent;transition:all 0.15s;}
.pin-dot.filled{background:var(--orange);border-color:var(--orange);box-shadow:0 0 10px rgba(232,86,10,0.4);}
.pin-dot.error{background:var(--red);border-color:var(--red);}
.keypad{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;}
.key-btn{background:rgba(184,180,172,0.07);border:1px solid rgba(184,180,172,0.1);border-radius:10px;padding:16px;font-family:'Syne',sans-serif;font-size:20px;font-weight:600;color:var(--cream);cursor:pointer;transition:all 0.12s;text-align:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent;}
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
  body { overflow: auto; overscroll-behavior: none; }

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
  .topbar-center { display: none; }
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
  .nav { scrollbar-width: none; }
  .nav-label, .nav-divider, .nav-mini { display: none; }
  .capacity-widget { display: none; }
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
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
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
  .nav-icon { width: 22px; height: 22px; }
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
  .spot-back { padding: 0; }
  .spot-cta-box { flex-direction: column; gap: 12px; align-items: flex-start; }

  /* GENERAL */
  .gen-btn { font-size: 16px; padding: 14px; min-height: 54px; }
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
// Inject styles into document head at module load time
(function injectStyles() {
  if(typeof document === 'undefined') return;
  const existing = document.getElementById('pavemail-styles');
  if(existing) return;
  const el = document.createElement('style');
  el.id = 'pavemail-styles';
  el.textContent = STYLES;
  document.head.appendChild(el);
})();

// ─────────────────────────────────────────────
// DEMO COMPANY — replaces JWood in demo mode
// ─────────────────────────────────────────────
const DEMO_COMPANY = {
  name:"Pave Pro LLC", ownerName:"Alex", phone:"918-555-0199",
  phoneRaw:"9185550199", email:"hello@paveprollc.com",
  city:"Tulsa", state:"OK", promo:"DEMO25",
  tagline:"Tulsa's Concrete Specialists",
  accentColor:"#e8560a", lobFromId:"", transferPhone:"",
  contractorId:"demo", crewSize:8, maxJobsWeek:5, weeklyTarget:35000,
};

const ROUTES = [
  {id:1,name:"South Tulsa / Midtown",zip:"74105",homes:0,color:"#e8560a"},
  {id:2,name:"Broken Arrow",         zip:"74011",homes:0,color:"#2a7a52"},
  {id:3,name:"Jenks / Riverview",    zip:"74037",homes:0,color:"#1a6fa8"},
  {id:4,name:"Owasso",               zip:"74055",homes:0,color:"#8b5e3c"},
  {id:5,name:"Bixby",                zip:"74008",homes:0,color:"#6a3a8a"},
  {id:6,name:"Sand Springs",         zip:"74063",homes:0,color:"#2a6a6a"},
];

const MOCK_JOBS = [];

// ─────────────────────────────────────────────
// DEMO MODE DATA — realistic Tulsa contractor data
// ─────────────────────────────────────────────
const DEMO_PIPELINE = [
  {id:"demo-1",address:"4821 Oak Ridge Dr",city:"Broken Arrow",neighborhood:"Broken Arrow",stage:"won",bidLo:"$1,200",bidHi:"$1,800",spotted:"Mar 12",mailerSent:"Mar 18",calledBack:"Mar 22",jobWon:"Mar 28",notes:"Full driveway replacement. Easy job, great customer.",value:1600,flags:["repeat"]},
  {id:"demo-2",address:"7234 S Memorial Dr",city:"Tulsa",neighborhood:"South Tulsa",stage:"called",bidLo:"$800",bidHi:"$1,100",spotted:"Apr 01",mailerSent:"Apr 06",calledBack:"Apr 09",jobWon:null,notes:"Interested — getting HOA approval first.",value:950,flags:["hoa"]},
  {id:"demo-3",address:"1892 E 91st St",city:"Tulsa",neighborhood:"South Tulsa",stage:"sent",bidLo:"$2,400",bidHi:"$3,200",spotted:"Apr 03",mailerSent:"Apr 07",calledBack:null,jobWon:null,notes:"Large 3-car garage, significant cracking.",value:2800,flags:[]},
  {id:"demo-4",address:"3341 S Peoria Ave",city:"Tulsa",neighborhood:"Midtown",stage:"won",bidLo:"$600",bidHi:"$900",spotted:"Mar 20",mailerSent:"Mar 25",calledBack:"Mar 28",jobWon:"Apr 02",notes:"Crack repair only. Paid same day.",value:750,flags:["repeat"]},
  {id:"demo-5",address:"9102 N 129th E Ave",city:"Owasso",neighborhood:"Owasso",stage:"spotted",bidLo:"$1,800",bidHi:"$2,600",spotted:"Apr 06",mailerSent:null,calledBack:null,jobWon:null,notes:"Saw severe cracking from road. Large property.",value:2200,flags:[]},
  {id:"demo-6",address:"2847 E 51st St",city:"Tulsa",neighborhood:"Midtown",stage:"spotted",bidLo:"$400",bidHi:"$700",spotted:"Apr 07",mailerSent:null,calledBack:null,jobWon:null,notes:"Minor sealing job. Good neighborhood.",value:550,flags:[]},
  {id:"demo-7",address:"5512 S Harvard Ave",city:"Tulsa",neighborhood:"South Tulsa",stage:"won",bidLo:"$3,100",bidHi:"$4,200",spotted:"Mar 08",mailerSent:"Mar 14",calledBack:"Mar 17",jobWon:"Mar 24",notes:"Full replacement + driveway extension.",value:3800,flags:["referral"]},
  {id:"demo-8",address:"1103 W 38th St",city:"Tulsa",neighborhood:"Midtown",stage:"sent",bidLo:"$950",bidHi:"$1,400",spotted:"Apr 04",mailerSent:"Apr 08",calledBack:null,jobWon:null,notes:"Surface spalling across entire pad.",value:1175,flags:["negotiator"]},
];

const DEMO_SPOT_JOBS = [
  {id:"demo-sb-1",address:"4821 Oak Ridge Dr",city:"Broken Arrow",bid:"$1,200–$1,800",damage:["Freeze-thaw cracking across slab","Spalling near garage apron"],sent:"Mar 18",status:"delivered",mailerContent:{headline:"WE NOTICED YOUR CONCRETE NEEDS ATTENTION",personalNote:"We were in your neighborhood and noticed some significant cracking that's only going to get worse through Oklahoma's freeze-thaw cycles. We can fix this before it becomes a full replacement.",bidLo:"$1,200",bidHi:"$1,800",bid:"$1,200–$1,800",urgencyLine:"Oklahoma winters don't wait — neither should your concrete.",address:"4821 Oak Ridge Dr",city:"Broken Arrow",damage:["Freeze-thaw cracking across slab","Spalling near garage apron"]}},
  {id:"demo-sb-2",address:"7234 S Memorial Dr",city:"Tulsa",bid:"$800–$1,100",damage:["Surface cracks running NE-SW","Minor drainage issue at base"],sent:"Apr 06",status:"sent",mailerContent:{headline:"YOUR CONCRETE HAS CRACKS WE CAN FIX",personalNote:"Spotted two crack patterns that suggest settling under your pad. Catching this now is a fraction of replacement cost.",bidLo:"$800",bidHi:"$1,100",bid:"$800–$1,100",urgencyLine:"Small cracks become big problems fast in Tulsa summers.",address:"7234 S Memorial Dr",city:"Tulsa",damage:["Surface cracks running NE-SW","Minor drainage issue at base"]}},
  {id:"demo-sb-3",address:"1892 E 91st St",city:"Tulsa",bid:"$2,400–$3,200",damage:["Severe cracking across 3 panels","Root damage from oak tree","Surface deterioration"],sent:"Apr 07",status:"queued",mailerContent:{headline:"THREE ISSUES SPOTTED ON YOUR CONCRETE",personalNote:"Your property has some of the worst tree root damage I've seen this season. The oak roots have lifted two panels and cracked a third. This needs to be addressed before the summer heat.",bidLo:"$2,400",bidHi:"$3,200",bid:"$2,400–$3,200",urgencyLine:"Root damage gets exponentially worse — act before summer.",address:"1892 E 91st St",city:"Tulsa",damage:["Severe cracking across 3 panels","Root damage from oak tree","Surface deterioration"]}},
  {id:"demo-sb-4",address:"5512 S Harvard Ave",city:"Tulsa",bid:"$3,100–$4,200",damage:["Full slab replacement needed","Edge crumbling on 3 sides","Oil staining throughout"],sent:"Mar 14",status:"delivered",mailerContent:{headline:"YOUR CONCRETE IS PAST THE POINT OF REPAIR",personalNote:"After 20+ years, this slab has reached end of life. A full replacement will increase your curb appeal and home value immediately.",bidLo:"$3,100",bidHi:"$4,200",bid:"$3,100–$4,200",urgencyLine:"Replacement now costs less than waiting another year.",address:"5512 S Harvard Ave",city:"Tulsa",damage:["Full slab replacement needed","Edge crumbling on 3 sides","Oil staining throughout"]}},
];

const DEMO_AI_CALLS = [
  {id:"demo-c1",caller:"Sarah Mitchell",phone:"918-555-0142",summary:"Wants full replacement, double car garage. Timeline: next month. Address: 3421 S Peoria Ave. Homeowner for 12 years.",service:"New Concrete",address:"3421 S Peoria Ave, Tulsa",status:"qualified",time:"2 hrs ago",transferred:true},
  {id:"demo-c2",caller:"Robert Chen",phone:"918-555-0287",summary:"Called about crack repair on driveway. Left callback number. Mentioned budget around $600-800.",service:"Crack Repair",address:"",status:"pending",time:"Yesterday",transferred:false},
  {id:"demo-c3",caller:"Linda Graves",phone:"918-555-0391",summary:"Referral from Oak Ridge job. Wants estimate on 2-car garage. Very motivated, wants work done before daughter's graduation party.",service:"New Concrete",address:"4902 E 81st St, Tulsa",status:"qualified",time:"2 days ago",transferred:true},
];

const DEMO_JOBS = [
  {id:"demo-j1",lobId:"lob_7f8a2e",name:"South Tulsa / Midtown",homes:312,sent:"Mar 12",status:"delivered",cost:"193.44",calls:11},
  {id:"demo-j2",lobId:"lob_4c2b1d",name:"Broken Arrow East",homes:428,sent:"Mar 20",status:"delivered",cost:"265.36",calls:18},
  {id:"demo-j3",lobId:"lob_9e5f3a",name:"Owasso / Collinsville",homes:198,sent:"Apr 01",status:"sent",cost:"122.76",calls:4},
];

const TRACK_STEPS = [
  {label:"Approved",  icon:"✓"},
  {label:"Printing",  icon:"▣"},
  {label:"In Transit",icon:"→"},
  {label:"Delivered", icon:"✦"},
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
            <div className="mp-icon"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="3" y="10" width="30" height="22" rx="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17L18 25L33 17" stroke="currentColor" strokeWidth="1.5"/><path d="M13 10V6C13 4.3 15.2 3 18 3C20.8 3 23 4.3 23 6V10" stroke="currentColor" strokeWidth="1.5"/></svg></div>
            <div><div className="mp-co">{ACTIVE_COMPANY.name}</div><div className="mp-ph">{ACTIVE_COMPANY.phone}</div></div>
            <div className="mp-qr-wrap"><QRCode value={`tel:${ACTIVE_COMPANY.phone.replace(/-/g,"")}`} size={72}/><div className="mp-qr-label">Scan to Call</div></div>
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
            <div className="promo-box"><div className="promo-code">{form.promoCode||ACTIVE_COMPANY.promo}<small>Say this when you call</small></div></div>
          </div>
        </div></div>
      </div>
      <div><div className="page-tag">Page 4 — Call to Action</div>
        <div className="mailer-page"><div className="mp-cta">
          <div className="ey">{p4?.eyebrow}</div>
          <h2>{p4?.headline}</h2>
          <p className="sub">{p4?.sub}</p>
          <div className="cta-qr"><QRCode value={`tel:${ACTIVE_COMPANY.phone.replace(/-/g,"")}`} size={100}/><div className="cta-qr-label">📱 Scan to call {ACTIVE_COMPANY.phone} instantly</div></div>
          <div className="contact-row">
            <div className="contact-box"><div className="lbl">Call / Text</div><div className="val">{ACTIVE_COMPANY.phone}</div></div>
            <div className="contact-box"><div className="lbl">Email</div><div className="val" style={{fontSize:11}}>{ACTIVE_COMPANY.email}</div></div>
            <div className="contact-box"><div className="lbl">Promo Code</div><div className="val">{form.promoCode||ACTIVE_COMPANY.promo}</div></div>
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
// Capacity config - module scope for stability
const CAPACITY_CONFIG = { crewSize:12, maxJobs:6, weeklyTarget:40000 };

const CAPACITY_MODES = {
    hungry:   { label:"Hungry",   color:"#e05252", bg:"rgba(224,82,82,0.12)",   icon:"🔴", svgIcon:<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L10 6.5H15.5L11 9.8L13 15.5L8 12.2L3 15.5L5 9.8L0.5 6.5H6L8 1Z" fill="#e05252"/></svg>, desc:"Aggressive outbound — large radius, fast follow-up, low bid threshold" },
    normal:   { label:"Normal",   color:"#d4a017", bg:"rgba(212,160,23,0.12)",  icon:"🟡", svgIcon:<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L9.5 6H14.5L10.5 9L12 13.5L8 10.8L4 13.5L5.5 9L1.5 6H6.5L8 1.5Z" fill="#d4a017"/></svg>, desc:"Standard outbound — normal radius, normal pricing" },
    selective:{ label:"Selective",color:"#3a8fd4", bg:"rgba(58,143,212,0.12)",  icon:"🔵", svgIcon:<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" fill="#3a8fd4" fillOpacity="0.2" stroke="#3a8fd4" strokeWidth="1.5"/><circle cx="8" cy="8" r="3.5" fill="#3a8fd4" fillOpacity="0.4" stroke="#3a8fd4" strokeWidth="1"/><circle cx="8" cy="8" r="1.5" fill="#3a8fd4"/></svg>, desc:"High-value leads only — bids +15%, radius reduced" },
    paused:   { label:"Paused",   color:"#8a8682", bg:"rgba(138,134,130,0.12)", icon:"⚫", svgIcon:<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" fill="#8a8682" fillOpacity="0.3" stroke="#8a8682" strokeWidth="1.5"/><rect x="5" y="4.5" width="2.2" height="7" rx="1" fill="#8a8682"/><rect x="8.8" y="4.5" width="2.2" height="7" rx="1" fill="#8a8682"/></svg>, desc:"Fully booked — campaigns paused, AI agent books 3 weeks out" },
  };

function renderPostcardCanvas(photoSrc, mailer, setDataUrl) {
  const canvas = document.createElement('canvas');
  const SCALE = 2;
  canvas.width = 600 * SCALE; canvas.height = 320 * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);
  const W = 600, H = 320;

  function draw(img) {
    ctx.fillStyle='#111009'; ctx.fillRect(0,0,W,H);
    if(img) {
      const iR=img.naturalWidth/img.naturalHeight, cR=W/H;
      let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
      if(iR>cR){sw=img.naturalHeight*cR;sx=(img.naturalWidth-sw)/2;}
      else{sh=img.naturalWidth/cR;sy=(img.naturalHeight-sh)/2;}
      ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);
    }
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(10,9,8,0.25)');
    g.addColorStop(0.45,'rgba(10,9,8,0.65)');
    g.addColorStop(1,'rgba(10,9,8,0.97)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
    // Dynamic badge — based on primary damage type
    if(img){
      var dmg=(mailer.damage&&mailer.damage[0])||'';
      var dmgL=dmg.toLowerCase();
      var badge=dmgL.includes('crack')?'CRACKS DETECTED'
        :dmgL.includes('spall')?'SURFACE DAMAGE'
        :dmgL.includes('drain')?'DRAINAGE ISSUE'
        :dmgL.includes('root')?'ROOT DAMAGE'
        :dmgL.includes('sink')||dmgL.includes('sunken')?'SINKING SLAB'
        :dmgL.includes('oil')?'OIL DAMAGE'
        :dmgL.includes('full')||dmgL.includes('replace')?'NEEDS REPLACEMENT'
        :dmgL.includes('seal')?'NEEDS SEALING'
        :dmgL.includes('edge')?'EDGE CRUMBLING'
        :'YOUR PROJECT';
      // Fit badge width to text
      ctx.font='bold 7px Arial';
      var bw=ctx.measureText(badge).width+16;
      ctx.fillStyle='rgba(232,86,10,0.92)'; ctx.fillRect(W-bw-8,12,bw+4,20);
      ctx.fillStyle='white'; ctx.textAlign='right';
      ctx.fillText(badge,W-10,25); ctx.textAlign='left';
    }
    // Company tag
    ctx.fillStyle='#e8560a'; ctx.font='bold 8px Arial';
    ctx.fillText('JWOOD LLC \xb7 TULSA, OK',18,28);
    // Address
    ctx.fillStyle='rgba(245,240,230,0.7)'; ctx.font='500 11px Arial';
    ctx.fillText((mailer.address||'')+', '+(mailer.city||''),18,H-195);
    // Headline word wrap max 2 lines
    ctx.fillStyle='#f5f0e6'; ctx.font='bold 22px Arial';
    var hw=(mailer.headline||'').split(' '),hl='',hy=H-175,hlines=0;
    for(var j=0;j<hw.length;j++){
      var t=hl+hw[j]+' ';
      if(ctx.measureText(t).width>W-36&&hl){ctx.fillText(hl.trim(),18,hy);hl=hw[j]+' ';hy+=26;hlines++;if(hlines>=2){hl='';break;}}
      else hl=t;
    }
    if(hl&&hlines<2)ctx.fillText(hl.trim(),18,hy);
    // Personal note max 2 lines — kept above footer
    ctx.fillStyle='rgba(200,196,188,0.9)'; ctx.font='11px Arial';
    var nw=(mailer.personalNote||'').slice(0,120).split(' '),nl='',ny=hy+20,nc=0;
    for(var k=0;k<nw.length;k++){
      if(nc>=2)break;
      var nt=nl+nw[k]+' ';
      if(ctx.measureText(nt).width>W-36&&nl){ctx.fillText(nl.trim(),18,ny);nl=nw[k]+' ';ny+=15;nc++;}
      else nl=nt;
    }
    if(nl&&nc<2)ctx.fillText(nl.trim(),18,ny);
    // Dark footer strip
    var by=H-105;
    ctx.fillStyle='rgba(8,7,6,0.85)'; ctx.fillRect(0,by-8,W,H-(by-8));
    // Bid box
    ctx.fillStyle='rgba(232,86,10,0.15)'; ctx.fillRect(12,by,W-130,48);
    ctx.strokeStyle='rgba(232,86,10,0.4)'; ctx.lineWidth=1; ctx.strokeRect(12,by,W-130,48);
    ctx.fillStyle='#e8560a'; ctx.font='bold 7px Arial';
    ctx.fillText('YOUR ESTIMATE',20,by+11);
    ctx.fillStyle='#f5f0e6'; ctx.font='bold 18px Arial';
    ctx.fillText(mailer.bidLo||mailer.bid||'Call for estimate',20,by+36);
    // Call button
    ctx.fillStyle='#e8560a'; ctx.fillRect(W-112,by+4,98,40);
    ctx.fillStyle='white'; ctx.font='bold 8px Arial'; ctx.textAlign='center';
    ctx.fillText('CALL NOW',W-63,by+17);
    ctx.font='bold 11px monospace'; ctx.fillText(mailer.ownerPhone||mailer.phone||'',W-63,by+34);
    ctx.textAlign='left';
    try {
      setDataUrl(canvas.toDataURL('image/jpeg',0.92));
    } catch(e) {
      // Canvas tainted by cross-origin image — show raw photo instead

      setDataUrl(null);
    }
  }

  if(photoSrc){
    // First try with crossOrigin for canvas export
    var img=new Image();
    img.crossOrigin='anonymous';
    img.onload=function(){ 
      try {
        draw(img);
        // Test if canvas is tainted by trying toDataURL
        canvas.toDataURL('image/jpeg',0.1);
      } catch(e) {
        // Canvas tainted — retry without crossOrigin
        // Safari blocks cross-origin canvas reads
        var img2=new Image();
        img2.onload=function(){ draw(img2); };
        img2.onerror=function(){ draw(null); };
        img2.src=photoSrc;
      }
    };
    img.onerror=function(){
      // crossOrigin failed to load — try without it
      var img2=new Image();
      img2.onload=function(){ 
        try { draw(img2); } catch(e){ draw(null); }
      };
      img2.onerror=function(){ draw(null); };
      img2.src=photoSrc;
    };
    // Add cache buster for Safari
    img.src=photoSrc+(photoSrc.includes('?')?'&':'?')+'cb='+Date.now();
  } else {
    draw(null);
  }
}

// ─────────────────────────────────────────────
// NAV ICON COMPONENT — SVG icons for sidebar
// ─────────────────────────────────────────────
function NavIcon({id}) {
  const icons = {
    // Neighborhood Scan — bold filled pin with radiating signal rings
    map: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1C6.24 1 4 3.24 4 6C4 9.75 9 17 9 17C9 17 14 9.75 14 6C14 3.24 11.76 1 9 1Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <circle cx="9" cy="6" r="2.2" fill="currentColor"/>
    </svg>,
    // Create Mailer — envelope with a spark/star on it
    create: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1.5" y="4.5" width="15" height="11" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M1.5 6.5L9 11L16.5 6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M11.5 1.5L12.2 3.3L14 4L12.2 4.7L11.5 6.5L10.8 4.7L9 4L10.8 3.3L11.5 1.5Z" fill="currentColor"/>
    </svg>,
    // Job Tracker — three rising bars, tallest filled solid
    tracker: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1.5" y="10" width="4" height="6.5" rx="1.2" fill="currentColor" fillOpacity="0.4"/>
      <rect x="7" y="6.5" width="4" height="10" rx="1.2" fill="currentColor" fillOpacity="0.7"/>
      <rect x="12.5" y="2" width="4" height="14.5" rx="1.2" fill="currentColor"/>
    </svg>,
    // Spot Bid — camera with viewfinder crosshair
    spotbid: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1.5" y="5" width="15" height="11" rx="2" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.6"/>
      <path d="M6 5V4C6 3.45 6.45 3 7 3H11C11.55 3 12 3.45 12 4V5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      <circle cx="9" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="9" cy="10.5" r="1.2" fill="currentColor"/>
    </svg>,
    // Pipeline — flowing funnel with stages
    pipeline: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M2 3H16L11 9V15L7 13V9L2 3Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
      <line x1="9" y1="9" x2="9" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>,
    // Capacity — lightning bolt, bold and filled
    capacity: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M10.5 1.5L4 10H8.5L7.5 16.5L14 7.5H9.5L10.5 1.5Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round"/>
    </svg>,
    // AI Phone — handset with sound waves, bold
    aiphone: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M4 3.5C4 3.5 5.2 2 7 2C8 2 8.8 3 9.5 4.5L10 6C10.3 6.8 10 7.8 9.2 8.3L8 9C8.8 10.3 10 11.5 11.2 12.2L12.3 11C13 10.4 14 10.2 14.8 10.5L16.5 11.5C17.5 12 18 13 18 14C18 16 16 17.5 16 17.5C13 20 2 10 4 3.5Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M13 1.5C14.5 2 16.2 3.2 17.2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12.5 4.5C13.5 5 14.5 5.8 15.2 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>,
    // Admin — grid of 4 squares, top-right filled solid
    admin: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="1.5" y="1.5" width="6.5" height="6.5" rx="1.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="1.5" width="6.5" height="6.5" rx="1.5" fill="currentColor"/>
      <rect x="1.5" y="10" width="6.5" height="6.5" rx="1.5" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10" y="10" width="6.5" height="6.5" rx="1.5" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>,
    // Settings — gear with solid center dot
    settings: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5L10.2 4.2C10.8 4.4 11.3 4.7 11.8 5.1L14.7 4.5L16.5 7.5L14.4 9.3C14.5 9.5 14.5 9.8 14.5 10C14.5 10.2 14.5 10.5 14.4 10.7L16.5 12.5L14.7 15.5L11.8 14.9C11.3 15.3 10.8 15.6 10.2 15.8L9 18.5L7.8 15.8C7.2 15.6 6.7 15.3 6.2 14.9L3.3 15.5L1.5 12.5L3.6 10.7C3.5 10.5 3.5 10.2 3.5 10C3.5 9.8 3.5 9.5 3.6 9.3L1.5 7.5L3.3 4.5L6.2 5.1C6.7 4.7 7.2 4.4 7.8 4.2L9 1.5Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <circle cx="9" cy="10" r="2.5" fill="currentColor"/>
    </svg>,
  };
  return <span className="nav-icon">{icons[id]||<span style={{color:"currentColor"}}>●</span>}</span>;
}

export default function App(){
  // ── AUTH ──
  // ── AUTH STATE ──
  const[isDemoMode,setIsDemoMode]=useState(false);
  const[authUser,setAuthUser]=useState(()=>{
    try{ const s=localStorage.getItem("pm_session"); return s?JSON.parse(s):null; }catch{ return null; }
  });
  const[contractor,setContractor]=useState(()=>{
    try{ const s=localStorage.getItem("pm_profile"); return s?JSON.parse(s):null; }catch{ return null; }
  });
  const[authScreen,setAuthScreen]=useState("login"); // login | signup | forgot | profile-setup | demo-code
  const[demoCode,setDemoCode]=useState("");
  const[demoShake,setDemoShake]=useState(false);
  const[authForm,setAuthForm]=useState({email:"",password:"",confirmPassword:"",inviteCode:"",ownerName:"",companyName:"",phone:"",city:"Tulsa"});
  const[authLoading,setAuthLoading]=useState(false);
  const[authError,setAuthError]=useState("");
  const[authSuccess,setAuthSuccess]=useState("");
  const isAdmin = authUser?.user?.email === ADMIN_EMAIL;


  // Login handler
  async function handleLogin() {
    if(!authForm.email||!authForm.password){ setAuthError("Enter your email and password"); return; }
    setAuthLoading(true); setAuthError("");
    const data = await auth.signIn(authForm.email, authForm.password);
    if(data.access_token) {
      const session = {
        token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        user: data.user
      };
      setAuthUser(session);
      try{ localStorage.setItem("pm_session", JSON.stringify(session)); }catch{}
      // Load profile
      const profile = await auth.getProfile(data.access_token);
      if(profile) {
        setContractor(profile);
        try{ localStorage.setItem("pm_profile", JSON.stringify(profile)); }catch{}
      } else {
        setAuthScreen("profile-setup");
      }
      track("login", { email: authForm.email });
    } else {
      setAuthError(data.error_description || data.msg || "Login failed — check your email and password");
    }
    setAuthLoading(false);
  }

  // Signup handler
  async function handleSignup() {
    if(authForm.inviteCode.trim().toUpperCase() !== "PAVE2026") { setAuthError("Invalid invite code — contact Joel for access"); return; }
    if(!authForm.email||!authForm.password) { setAuthError("Enter your email and password"); return; }
    if(authForm.password !== authForm.confirmPassword) { setAuthError("Passwords don't match"); return; }
    if(authForm.password.length < 6) { setAuthError("Password must be at least 6 characters"); return; }
    if(!authForm.ownerName||!authForm.companyName) { setAuthError("Enter your name and company name"); return; }
    setAuthLoading(true); setAuthError("");
    const data = await auth.signUp(authForm.email, authForm.password, {
      owner_name: authForm.ownerName,
      company_name: authForm.companyName,
    });
    if(data.id || data.user?.id) {
      // Auto sign in after signup
      const loginData = await auth.signIn(authForm.email, authForm.password);
      if(loginData.access_token) {
        const session = {
          token: loginData.access_token,
          refresh_token: loginData.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + (loginData.expires_in || 3600),
          user: loginData.user
        };
        setAuthUser(session);
        try{ localStorage.setItem("pm_session", JSON.stringify(session)); }catch{}
        setAuthScreen("profile-setup");
        track("signup", { email: authForm.email, company: authForm.companyName });
      }
    } else {
      setAuthError(data.error_description || data.msg || "Signup failed — try again");
    }
    setAuthLoading(false);
  }

  // Profile setup handler
  async function handleProfileSetup() {
    if(!authUser?.token) return;
    setAuthLoading(true);
    const profile = {
      id: authUser.user.id,
      company_name: authForm.companyName || contractor?.company_name || "My Company",
      owner_name: authForm.ownerName || contractor?.owner_name || "Owner",
      phone: authForm.phone || contractor?.phone || "",
      email: authForm.email || authUser.user.email,
      city: authForm.city || "Tulsa",
      state: "OK",
      accent_color: "#e8560a",
    };
    const saved = await auth.updateProfile(authUser.token, profile);
    const updatedProfile = Array.isArray(saved) ? saved[0] : saved;
    setContractor(updatedProfile);
    try{ localStorage.setItem("pm_profile", JSON.stringify(updatedProfile)); }catch{}
    setAuthLoading(false);
  }

  // Logout
  async function handleLogout() {
    if(authUser?.token && authUser.token !== "demo") await auth.signOut(authUser.token);
    setAuthUser(null); setContractor(null); setIsDemoMode(false);
    setPipeline([]); setSpotJobs([]); setAiLeads([]); setJobs([]);
    try{ localStorage.removeItem("pm_session"); localStorage.removeItem("pm_profile"); }catch{}
    setAuthScreen("login");
    setAuthForm({email:"",password:"",confirmPassword:"",inviteCode:"",ownerName:"",companyName:"",phone:"",city:"Tulsa"});
  }

  async function handleDemoMode() {
    setIsDemoMode(true);
    setAuthUser({token:"demo",user:{id:"demo-user",email:"demo@pavemail.io"}});
    setContractor({
      company_name:"Tulsa Concrete Co",owner_name:"Demo",phone:"918-555-0100",
      email:"demo@pavemail.io",city:"Tulsa",state:"OK",plan:"pro",
      lob_from_id:"",bland_transfer:"",accent_color:"#e8560a",
      crew_size:8,max_jobs_week:5,weekly_target:35000,
    });
    // Load all demo data immediately — no Supabase needed
    setPipeline(DEMO_PIPELINE);
    setSpotJobs(DEMO_SPOT_JOBS);
    setAiLeads(DEMO_AI_CALLS);
    setJobs(DEMO_JOBS);
    try{ localStorage.setItem("pm_session",JSON.stringify({token:"demo",refresh_token:"demo",expires_at:9999999999,user:{id:"demo-user",email:"demo@pavemail.io"}})); }catch{}
    await new Promise(r=>setTimeout(r,300));
    showToast("🎯 Demo loaded — explore PaveMail","success");
  }


  const[tab,setTab]=useState("map");
  function switchTab(t){ track('tab_viewed',{tab:t}); setTab(t); }
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
  const[form,setForm]=useState({company:"",phone:"",neighborhood:"",city:"Tulsa",season:"Spring",offer:"Free Estimate",angle:"Crack Repair",homes:"200",promoCode:"",extraNotes:""});
  const[loading,setLoading]=useState(false);
  const[sending,setSending]=useState(false);
  const[mailer,setMailer]=useState(null);
  const[lobResult,setLobResult]=useState(null);
  const[jobs,setJobs]=useState(MOCK_JOBS);
  const[selectedJob,setSelectedJob]=useState(null);
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
  const[canvasDataUrl,setCanvasDataUrl]=useState(null); // canvas-composited preview image
  const spotPhotoUrlRef=React.useRef(null); // ref for sync access in async functions
  const[spotMailer,setSpotMailer]=useState(null);
  const[spotLoading,setSpotLoading]=useState(false);
  const[spotSending,setSpotSending]=useState(false);
  const[spotJobs,setSpotJobs]=useState([]);
  const[previewJob,setPreviewJob]=useState(null); // spot bid being previewed
  const[showHistoryPreview,setShowHistoryPreview]=useState(false);
  const[historyCanvasUrl,setHistoryCanvasUrl]=useState(null);

  const[pipelineView,setPipelineView]=useState("kanban");

  // ── ADMIN STATE ──
  const[adminView,setAdminView]=useState("overview"); // overview | contractors | pipeline | bids
  const[adminData,setAdminData]=useState({contractors:[],pipeline:[],bids:[],campaigns:[],loaded:false});
  const[adminLoading,setAdminLoading]=useState(false);

  async function loadAdminData() {
    if(!authUser?.token) return;
    setAdminLoading(true);
    const [contractors, pipeline, bids, campaigns] = await Promise.all([
      db.getAllContractors(authUser.token),
      db.getAllPipeline(authUser.token),
      db.getAllSpotBids(authUser.token),
      db.getAllCampaigns(authUser.token),
    ]);
    setAdminData({ contractors, pipeline, bids, campaigns, loaded:true });
    setAdminLoading(false);
  }

  // ── CAPACITY ENGINE ──
  // CAPACITY_CONFIG moved to module scope
  const[capacity,setCapacity]=useState({
    activeJobs: 0,
    weeklyRevenue: 0,
    weeksBooked: 0,
    mode: "hungry", // hungry | normal | selective | paused
    manualOverride: null,
  });
  function showToast(msg,type="success") {setToast({msg,type});setTimeout(()=>setToast(null),4000);}
  function toggleRoute(id){ setSelectedRoutes(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]); }


  const[pipeline,setPipeline]=useState([]);

  // Real capacity engine — data-driven, auto-sets mode
  React.useEffect(()=>{
    const C = ACTIVE_COMPANY;
    const maxJobs = C.maxJobsWeek || 6;
    const crewSize = C.crewSize || 12;
    const weeklyTarget = C.weeklyTarget || 40000;
    const AVG_JOB_DAYS = 2; // avg days per concrete job

    const wonJobs     = pipeline.filter(l=>l.stage==="won");
    const activeJobs  = wonJobs.length;
    const wonRevenue  = wonJobs.reduce((s,l)=>s+(l.value||0),0);
    const pipeValue   = pipeline.filter(l=>l.stage!=="won").reduce((s,l)=>s+(l.value||0),0);

    // Crew-day math: how many days of work is committed?
    const committedDays = activeJobs * AVG_JOB_DAYS;
    const availDays     = crewSize * 5; // 5-day work week
    const utilizationPct = Math.min(100, Math.round((committedDays / availDays) * 100));

    // Revenue velocity: on pace for weekly target?
    const revenueGap  = Math.max(0, weeklyTarget - wonRevenue);
    const onPace      = wonRevenue >= weeklyTarget;

    // Auto mode from real utilization
    let autoMode = "hungry";
    if(utilizationPct >= 100) autoMode = "paused";
    else if(utilizationPct >= 75) autoMode = "selective";
    else if(utilizationPct >= 45) autoMode = "normal";

    setCapacity(c=>({
      ...c,
      activeJobs,
      wonRevenue,
      pipeValue,
      weeklyRevenue: wonRevenue,
      revenueGap,
      onPace,
      utilizationPct,
      committedDays,
      availDays,
      weeksBooked: activeJobs > 0 ? Math.ceil(activeJobs / maxJobs) : 0,
      mode: c.manualOverride || autoMode,
      autoMode,
    }));
  },[pipeline, contractor, isDemoMode]);

  // CAPACITY_MODES moved to module scope

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
  const[showUserMenu,setShowUserMenu]=useState(false);
  const[aiLeads,setAiLeads]=useState([]);
  const[testCallNumber,setTestCallNumber]=useState("");
  const[testCallLoading,setTestCallLoading]=useState(false);
  const[radiusLead,setRadiusLead]=useState(null);
  const[radiusForm,setRadiusForm]=useState({radius:0.5,unit:"miles",message:""});
  const[radiusMailer,setRadiusMailer]=useState(null);
  const[radiusLoading,setRadiusLoading]=useState(false);
  const[radiusSending,setRadiusSending]=useState(false);
  const[radiusStep,setRadiusStep]=useState(1); // 1=config 2=preview 3=sent
  const[wonBanner,setWonBanner]=useState(null); // lead that just moved to won
  const[showLeadDetail,setShowLeadDetail]=useState(null); // lead id for detail modal
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

  const LEAD_FLAGS = [
    {id:"no_pay",    label:"No Pay",        color:"#c0392b", bg:"rgba(192,57,43,0.15)",  icon:<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="5.5" r="4.5" fill="#c0392b" fillOpacity="0.2" stroke="#c0392b" strokeWidth="1.3"/><line x1="3" y1="3" x2="8" y2="8" stroke="#c0392b" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="3" x2="3" y2="8" stroke="#c0392b" strokeWidth="1.4" strokeLinecap="round"/></svg>, desc:"Did not pay or disputed invoice"},
    {id:"repeat",    label:"Repeat Client", color:"#2a7a52", bg:"rgba(42,122,82,0.15)",  icon:<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L6.7 4.2H10.2L7.45 6.1L8.55 9.2L5.5 7.4L2.45 9.2L3.55 6.1L0.8 4.2H4.3L5.5 1Z" fill="#2a7a52"/></svg>, desc:"Returning customer — priority service"},
    {id:"hoa",       label:"HOA Issues",    color:"#d4a017", bg:"rgba(212,160,23,0.15)", icon:<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L10 9.5H1L5.5 1Z" fill="#d4a017" fillOpacity="0.2" stroke="#d4a017" strokeWidth="1.3" strokeLinejoin="round"/><line x1="5.5" y1="4" x2="5.5" y2="6.5" stroke="#d4a017" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5.5" cy="8" r="0.6" fill="#d4a017"/></svg>, desc:"HOA approval required before work"},
    {id:"negotiator",label:"Negotiator",    color:"#c47a1a", bg:"rgba(196,122,26,0.15)", icon:<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 7.5L4 4.5L6.5 7L10 2" stroke="#c47a1a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>, desc:"Haggles on price — stick to estimate"},
    {id:"referral",  label:"Referral",      color:"#1a6fa8", bg:"rgba(26,111,168,0.15)", icon:<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><circle cx="5.5" cy="3" r="2" fill="#1a6fa8" fillOpacity="0.3" stroke="#1a6fa8" strokeWidth="1.2"/><path d="M2 10C2 8.3 3.6 7 5.5 7C7.4 7 9 8.3 9 10" stroke="#1a6fa8" strokeWidth="1.2" strokeLinecap="round"/><path d="M8 4.5L10 5.5L8 6.5" stroke="#1a6fa8" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>, desc:"Referred by existing customer"},
    {id:"lien_risk", label:"Lien Risk",     color:"#8b2fc9", bg:"rgba(139,47,201,0.15)", icon:<svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 1L9.5 3V6C9.5 8.5 7.5 10.2 5.5 11C3.5 10.2 1.5 8.5 1.5 6V3L5.5 1Z" fill="#8b2fc9" fillOpacity="0.2" stroke="#8b2fc9" strokeWidth="1.2" strokeLinejoin="round"/><line x1="5.5" y1="4" x2="5.5" y2="6.5" stroke="#8b2fc9" strokeWidth="1.3" strokeLinecap="round"/><circle cx="5.5" cy="8" r="0.6" fill="#8b2fc9"/></svg>, desc:"Property has financial complications"},
  ];

  const STAGE_ICONS = {
    spotted: <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4"/><circle cx="6" cy="6" r="2.5" fill="currentColor" fillOpacity="0.6"/></svg>,
    sent:    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M1 5L6 8L11 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>,
    called:  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2C2.5 2 3.3 1 4.5 1C5.2 1 5.7 1.8 6.1 2.7L6.5 3.9C6.7 4.4 6.5 5 6 5.4L5.3 5.9C5.7 6.6 6.4 7.4 7.2 7.8L7.8 7.2C8.2 6.8 8.8 6.6 9.3 6.8L10.5 7.4C11.2 7.8 11.5 8.5 11.5 9C11.5 10.2 10.5 11 10.5 11C8.5 13 1 6.5 2.5 2Z" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.3"/></svg>,
    won:     <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1L7.2 4.2H10.7L7.95 6.1L9.1 9.3L6 7.5L2.9 9.3L4.05 6.1L1.3 4.2H4.8L6 1Z" fill="currentColor"/></svg>,
  };
  const STAGES = [
    {id:"spotted", label:"Spotted",    icon:"◉", color:"#7a7670", bg:"rgba(122,118,112,0.15)"},
    {id:"sent",    label:"Mailer Sent",icon:"◫", color:"#1a6fa8", bg:"rgba(26,111,168,0.15)"},
    {id:"called",  label:"Called Back", icon:"◌", color:"#d4a017", bg:"rgba(212,160,23,0.15)"},
    {id:"won",     label:"Job Won",    icon:"✦", color:"#2a7a52", bg:"rgba(42,122,82,0.15)"},
  ];

  const moveStage=(id,newStage)=>{
    track('stage_moved', {from:pipeline.find(l=>l.id===id)?.stage, to:newStage});
    // Save to Supabase
    db.updateLeadStage(id, newStage).catch(e=>console.error("Stage update failed:", e));
    setPipeline(p=>p.map(l=>l.id===id?{...l,stage:newStage,
      mailerSent:newStage==="sent"&&!l.mailerSent?new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}):l.mailerSent,
      calledBack:newStage==="called"&&!l.calledBack?new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}):l.calledBack,
      jobWon:newStage==="won"&&!l.jobWon?new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}):l.jobWon,
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
          messages:[{role:"user",content:`Write a direct mail postcard for ${ACTIVE_COMPANY.name} (concrete contractor, ${ACTIVE_COMPANY.city} OK, ${ACTIVE_COMPANY.phone}). We just completed a concrete project at ${radiusLead.address}, ${radiusLead.city}. This postcard goes to their neighbors within ${radiusForm.radius} miles. The angle: we are already working in the neighborhood, equipment is here, we can offer a neighbor discount this week. Be warm, neighbor-to-neighbor tone. Return ONLY JSON: {"headline":"string","personalNote":"string","urgencyLine":"string","offer":"string"}`}]
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
    showToast("Sending radius mailer...","info");
    try{
      // Lob radius mail — uses center address + distance
      const radiusMiles=radiusForm.radius;
      const radiusFt=Math.round(radiusMiles*5280);
      const front=`<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#1c1a17;color:#f5f0e6;position:relative;">
        <div style="background:linear-gradient(135deg,#2a7a52 0%,#1c5a3a 100%);padding:10px 20px;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.8);">
          YOUR NEIGHBOR AT ${radiusMailer.address.toUpperCase()} JUST GOT A NEW PROJECT DONE
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
            <div style="font-size:16px;font-weight:700;font-family:monospace;">{ACTIVE_COMPANY.phone}</div>
          </div>
          <p style="margin-top:10px;font-size:10px;color:rgba(184,180,172,0.5);">${radiusMailer.urgencyLine}</p>
        </div>
      </body></html>`;

      const back=`<html><body style="margin:0;padding:20px;font-family:Arial,sans-serif;background:#f5f0e6;color:#1c1a17;">
        <div style="background:#2a7a52;color:white;padding:10px 16px;border-radius:6px;margin-bottom:16px;text-align:center;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;">WE JUST FINISHED YOUR NEIGHBOR'S PROJECT</div>
          <div style="font-size:10px;opacity:0.8;margin-top:2px;">${radiusMailer.address}, ${radiusMailer.city}</div>
        </div>
        <p style="font-size:12px;line-height:1.7;margin-bottom:14px;">While our equipment is in your neighborhood, we'd love to give you a <strong>free estimate</strong> on your project. As your neighbor's contractor, you get our neighbor rate this week.</p>
        <div style="background:#1c1a17;color:white;padding:12px;border-radius:8px;text-align:center;">
          <div style="font-size:14px;font-weight:700;">{ACTIVE_COMPANY.phone}</div>
          <div style="font-size:10px;color:#b8b4ac;margin-top:2px;">Call or text {ACTIVE_COMPANY.ownerName} · {ACTIVE_COMPANY.name} · {ACTIVE_COMPANY.city}, OK</div>
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
          from:ACTIVE_COMPANY.lobFromId,
          front,back,
          size:"6x11",
          metadata:{type:"radius",radius_miles:String(radiusMiles),center_address:radiusMailer.address}
        })
      });
      const lobData=await lobRes.json();
      if(lobData.id){
        track('radius_sent', {center: radiusMailer.address, radius_miles: radiusMiles, est_homes: Math.round(radiusMiles*5280/66)});
        showToast(`Radius mailer sent to neighbors within ${radiusMiles}mi!`,"success");
        setRadiusStep(3);
        // Add to job tracker
        setJobs(j=>[{id:`RM-${Date.now()}`,name:`Radius — ${radiusMailer.address}`,area:`${radiusMiles}mi radius`,homes:"~"+(Math.round(radiusMiles*5280/66)).toString(),sent:new Date().toLocaleDateString(),status:"queued",cost:(Math.round(radiusMiles*5280/66)*0.62).toFixed(2),calls:0,lob:lobData.id},...j]);
      } else {
        showToast("Send failed — try again","info");
      }
    }catch(e){ showToast("Send failed: "+e.message,"info"); }
    setRadiusSending(false);
  };

  function addLead(){
    const id=`PL-00${pipeline.length+1}`;
    const lo=newLead.bidLow?`$${parseInt(newLead.bidLow).toLocaleString()}`:"";
    const hi=newLead.bidHigh?`$${parseInt(newLead.bidHigh).toLocaleString()}`:"";
    const value=newLead.bidLow?parseInt(newLead.bidLow):0;
    const newLeadObj={id,address:newLead.address,city:newLead.city,neighborhood:newLead.neighborhood||newLead.city,stage:"spotted",bidLo:lo,bidHi:hi,spotted:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),mailerSent:null,calledBack:null,jobWon:null,notes:newLead.notes,value};
    setPipeline(p=>[newLeadObj,...p]);
    track('lead_added', {address:newLeadObj.address, city:newLeadObj.city});
    db.upsertLead(newLeadObj).catch(e=>console.error("Save lead failed:", e));
    setNewLead({address:"",city:"Tulsa",neighborhood:"",bidLow:"",bidHigh:"",notes:""});
    setShowAddLead(false);
    showToast("📍 Lead added to pipeline","success");
  }
  const setSpot=(k,v)=>setSpotForm(f=>({...f,[k]:v}));

  // ── LOAD ALL DATA FROM SUPABASE ON MOUNT ──
  // Keyboard input for demo code screen
  React.useEffect(()=>{
    if(authScreen !== "demo-code") return;
    const handler = (e) => {
      if(e.key >= "0" && e.key <= "9") {
        setDemoCode(c => {
          const next = (c + e.key).slice(0, 4);
          if(next.length === 4) {
            setTimeout(() => {
              if(next === "1234") { handleDemoMode(); }
              else { setDemoShake(true); setDemoCode(""); setTimeout(()=>setDemoShake(false),400); }
            }, 100);
          }
          return next;
        });
      } else if(e.key === "Backspace") {
        setDemoCode(c => c.slice(0, -1));
      } else if(e.key === "Escape") {
        setAuthScreen("login"); setDemoCode("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [authScreen]);

  React.useEffect(()=>{
    initAnalytics();
    // Demo mode — data already loaded, skip Supabase entirely
    if(isDemoMode) {
      track('app_open',{tab:'map',demo:true});
      return;
    }
    // Load admin data if admin user
    if(authUser?.user?.email === ADMIN_EMAIL && authUser?.token) {      setAdminData(d=>({...d,loading:true}));
      Promise.all([
        db.getAllContractors(authUser.token),
        db.getAllPipeline(authUser.token),
        db.getAllSpotBids(authUser.token),
        db.getAllCampaigns(authUser.token),
      ]).then(([contractors,pipeline,spotBids,campaigns])=>{
        setAdminData({
          contractors: Array.isArray(contractors)?contractors:[],
          pipeline: Array.isArray(pipeline)?pipeline:[],
          spotBids: Array.isArray(spotBids)?spotBids:[],
          campaigns: Array.isArray(campaigns)?campaigns:[],
          loading:false,
        });
      }).catch(e=>{
        console.error("Admin data load failed:", e);
        setAdminData(d=>({...d,loading:false}));
      });
    }
    track('app_open', {tab: 'map', device: /iPhone|Android/i.test(navigator.userAgent)?'mobile':'desktop'});
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

      } catch(e){ console.error("Supabase load error:", e); }
    };
    loadAll();
  },[isDemoMode]);

  // Auto-recalculate price whenever inputs change
  React.useEffect(()=>{
    const sqft = spotForm.customSqft ? parseInt(spotForm.customSqft) : spotForm.sqft;
    if(sqft && spotForm.service && spotForm.damageLevel && !spotForm.overridePrice){
      const mult = getBidMultiplierForMode();
      const raw  = calcPrice(sqft,spotForm.service,spotForm.damageLevel);
      const{lo,hi}={lo:Math.round(raw.lo*mult/50)*50, hi:Math.round(raw.hi*mult/50)*50};
      setAutoPrice({lo,hi});
      setSpotForm(f=>({...f,bidLow:String(lo),bidHigh:String(hi)}));
    }
  },[spotForm.sqft,spotForm.customSqft,spotForm.service,spotForm.damageLevel,spotForm.overridePrice]);
  function toggleDamage(d){ setSpotForm(f=>({...f,damage:f.damage.includes(d)?f.damage.filter(x=>x!==d):[...f.damage,d]})); }
  const DAMAGES=["Freeze-thaw cracking","Surface spalling","Tree root damage","Drainage issues","Sunken sections","Edge crumbling","Oil stains","Full replacement needed"];

  const set=(k,v)=>setForm(f=>({...f,[k]:v}));

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
      const prompt=`You are a direct mail copywriter for a concrete contractor in Tulsa, Oklahoma. Company: ${ACTIVE_COMPANY.name}, Phone: ${ACTIVE_COMPANY.phone}. Neighborhood: ${form.neighborhood}, OK. Season: ${form.season}, Service: ${form.angle}, Offer: ${form.offer}, Promo: ${form.promoCode}. Notes: ${form.extraNotes||"Tulsa area, Oklahoma weather"}.
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
    showToast(`✨ Demo mailer loaded — ${ACTIVE_COMPANY.name} branded & ready`,"info");
  };

  const sendToPress=async()=>{
    if(!mailer||sending)return;
    setSending(true);
    setLobResult(null);
    showToast("📤 Sending mailer...","info");

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
        sent:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
        status:"queued",
        cost:((parseInt(form.homes)||0)*0.62).toFixed(2),
        calls:0,
      };
      setJobs(p=>[newJob,...p]);
      setSelectedJob(newJob);
      setLobResult(result);
      showToast(`✅ Mailer confirmed! Printing now.`,"success");
      setTimeout(()=>setTab("tracker"),1200);
    }catch(e){
      // Graceful fallback — still add to tracker as queued
      const newJob={
        id:`JW-00${jobs.length+1}`,
        lobId:"",
        name:form.neighborhood||"New Campaign",
        homes:parseInt(form.homes)||0,
        sent:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),
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

        const visionRaw=visionData.content?.map(b=>b.text||"").join("");
        const visionParsed=parseJSON(visionRaw);
        if(visionParsed?.damage){
          detectedDamage=[...new Set([...spotForm.damage,...visionParsed.damage])];
                const newLevel = visionParsed.severity==="severe"?"Severe":visionParsed.severity==="minor"?"Minor":"Moderate";
          setSpotForm(f=>({...f,damage:detectedDamage,damageLevel:newLevel,overridePrice:false}));
          showToast("AI detected: "+visionParsed.summary,"info");
        } else {

        }
      }

      // STEP 2: Generate the personal note using detected damage
      const damageList=detectedDamage.length>0?detectedDamage.join(", "):"general concrete wear";
      const photoContext=capturedPhoto?" We photographed the damage for reference.":"";
      const sqftDesc=`${spotForm.customSqft||spotForm.sqft} sq ft ${spotForm.service} job`;
      const prompt=`Write a personal note for a direct mail postcard from ${ACTIVE_COMPANY.name} (concrete contractor, ${spotForm.city} OK, ${ACTIVE_COMPANY.phone}) to a homeowner at ${spotForm.address}, ${spotForm.city} OK. The contractor noticed: ${damageList}.${photoContext} This is a ${sqftDesc} with ${spotForm.damageLevel} damage. Bid range: ${bidRange}. Notes: ${spotForm.notes||"none"}. Write a warm, personal 2-3 sentence note that mentions we drove past their home, noticed the specific damage, and want to help. Sound like a neighbor, not a corporation. Do NOT be salesy. Return ONLY JSON: {"personalNote":"string","headline":"string","urgencyLine":"string"}`;

      const res=await fetch(ANTHROPIC_PROXY,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-5-20250929",max_tokens:400,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      const raw=data.content?.map(b=>b.text||"").join("");
      const parsed=parseJSON(raw);
      if(parsed){


        track('spot_generated', {address:spotForm.address, hasPhoto:!!capturedPhoto, damage:detectedDamage?.length||0});
        const mailerObj={...parsed,address:spotForm.address,city:spotForm.city,bid:bidRange,bidLo:bidStarting,bidHi:bidUpTo,includes:includesText,damage:detectedDamage,photoUsed:!!capturedPhoto,photoData:capturedPhoto||null,photoUrl:capturedPhotoUrl||null,ownerPhone:ACTIVE_COMPANY.phone,ownerName:ACTIVE_COMPANY.ownerName,companyName:ACTIVE_COMPANY.name};
        setSpotMailer(mailerObj);
        // Draw canvas preview
        renderPostcardCanvas(capturedPhotoUrl||capturedPhoto||null, mailerObj, setCanvasDataUrl);
        setSpotLoading(false);
        return;
      }
    }catch(_){}

    // Demo fallback
    await new Promise(r=>setTimeout(r,1600));
    const damageList=spotForm.damage.length>0?spotForm.damage.join(", "):"general concrete wear";
    const detectedDemo=spotForm.damage;

    const demoMailer={
      headline:"WE NOTICED YOUR PROJECT",
      personalNote:`We were working in your neighborhood recently and noticed your concrete at ${spotForm.address} has ${damageList}. As local Tulsa concrete specialists, we would love to help you get ahead of this before it gets worse — and we can usually start within a week.`,
      urgencyLine:"Oklahoma winters do not wait — neither should your concrete.",
      address:spotForm.address,city:spotForm.city,bid:bidRange,bidLo:bidStarting,bidHi:bidUpTo,includes:includesText,
      damage:detectedDemo,
      photoUsed:!!capturedPhoto,
      photoData:capturedPhoto||null,
      photoUrl:capturedPhotoUrl||null,
      ownerPhone:ACTIVE_COMPANY.phone,
      ownerName:ACTIVE_COMPANY.ownerName,
      companyName:ACTIVE_COMPANY.name
    };
    setSpotMailer(demoMailer);
    renderPostcardCanvas(capturedPhotoUrl||capturedPhoto||null, demoMailer, setCanvasDataUrl);
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

    showToast("📤 Sending spot bid...","info");
    try{
      await lobRequest("/postcards",{
        description:`${ACTIVE_COMPANY.name} Spot Bid - ${spotMailer.address}`,
        to:LOB_TO_ID,from:LOB_FROM_ID,size:"6x9",
        front:`<html><body style="margin:0;padding:0;font-family:Arial,sans-serif;position:relative;width:100%;height:100%;overflow:hidden;">
  ${hostedPhotoUrl
    ? `<div style="position:absolute;inset:0;background:url('${hostedPhotoUrl}') center/cover no-repeat;"></div>
       <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(14,13,11,0.55) 0%, rgba(14,13,11,0.85) 60%, rgba(14,13,11,0.97) 100%);"></div>`
    : `<div style="position:absolute;inset:0;background:linear-gradient(145deg,#111009 0%,#2a2720 60%,#1c1a17 100%);"></div>`
  }
  <div style="position:relative;padding:26px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;">
    <div style="position:absolute;top:22px;left:26px;right:26px;display:flex;justify-content:space-between;align-items:center;">
      <div style="color:#e8560a;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;">${spotMailer.companyName||ACTIVE_COMPANY.name} · ${spotMailer.city||ACTIVE_COMPANY.city}, OK</div>
      ${hostedPhotoUrl?`<div style="background:rgba(232,86,10,0.9);color:white;font-size:8px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:1px;">📷 YOUR PROJECT</div>`:""}
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
          <div style="font-size:14px;font-weight:700;font-family:monospace;">${ACTIVE_COMPANY.phone}</div>
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
        ${spotMailer.damage?.map(d=>`<div style="background:#f0ebe0;border-left:3px solid #e8560a;padding:5px 9px;border-radius:3px;margin-bottom:4px;font-size:9px;color:#3a3835;">${d}</div>`).join("")||`<div style="font-size:10px;color:#6a6864;">General surface wear</div>`}
      </div>
      <div style="width:120px;flex-shrink:0;">
        <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2a7a52;margin-bottom:4px;">After ${spotMailer.companyName||ACTIVE_COMPANY.name}</div>
        <img src="${BEFORE_AFTER_URL}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;border:2px solid #2a7a52;" alt="Finished project"/>
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
        <div style="font-size:13px;font-weight:700;">${ACTIVE_COMPANY.phone}</div>
        <div style="font-size:8px;color:#b8b4ac;margin-top:1px;">${"Call or text " + ACTIVE_COMPANY.ownerName + " direc"}tly · ${ACTIVE_COMPANY.email}</div>
      </div>
      <div style="background:#e8560a;color:white;font-size:9px;font-weight:700;padding:5px 10px;border-radius:5px;text-align:center;">FREE<br/>ESTIMATE</div>
    </div>
  </div>
</body></html>`,
        use_type:"marketing"
      });
      const newSpotJob={id:`SB-00${spotJobs.length+1}`,address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage,sent:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),status:"queued"};
      setSpotJobs(p=>[newSpotJob,...p]);
      // Save spot bid to Supabase
      db.saveSpotBid({address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage,photoUrl:capturedPhotoUrl||"",lobId:lobData?.id||"",mailerContent:spotMailer}).catch(e=>console.error("Save spot bid failed:",e));
      // Auto-add to pipeline as "sent"
      const plId=`PL-${Date.now()}`;
      const newPipelineLead={id:plId,address:spotMailer.address,city:spotMailer.city,neighborhood:spotForm.neighborhood||spotMailer.city,stage:"sent",bidLo:spotMailer.bidLo||spotMailer.bid,bidHi:spotMailer.bidHi||"",spotted:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),mailerSent:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),calledBack:null,jobWon:null,notes:spotMailer.damage?.join(", ")||"",value:parseInt(spotForm.bidLow)||0};
      setPipeline(p=>[newPipelineLead,...p]);
      db.upsertLead(newPipelineLead).catch(e=>console.error("Save pipeline lead failed:",e));
      track('spot_sent', {address:spotMailer.address, bid:spotMailer.bidLo, hasPhoto:!!capturedPhotoUrl});
      showToast("✅ Spot bid sent + saved to database!","success");
      setSpotMailer(null);
      setSpotForm({address:"",city:"Tulsa",state:"OK",zip:"",sqft:400,customSqft:"",service:"Crack Repair",damageLevel:"Moderate",bidLow:"",bidHigh:"",overridePrice:false,includes:"",damage:[],notes:""});
      setSpotPhoto(null);
      setSpotPhotoUrl(null);
    }catch(e){
      showToast("Spot bid queued (demo mode)","info");
      const newSpotJob={id:`SB-00${spotJobs.length+1}`,address:spotMailer.address,city:spotMailer.city,bid:spotMailer.bid,damage:spotMailer.damage||[],sent:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric"}),status:"queued"};
      setSpotJobs(p=>[newSpotJob,...p]);
    }finally{setSpotSending(false);}
  };

  // ── CANVAS POSTCARD RENDERER ──

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
          track('gps_used', {accuracy: Math.round(accuracy), address: result.address});
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

  // Test call handler
  async function handleTestCall() {
    setTestCallLoading(true);
    showToast("Initiating test call...","info");
    const clean=testCallNumber.replace(/\D/g,"");
    track('ai_call_made', {phone: testCallNumber});
    const result=await createBlandAgent("+1"+clean,"Test call from PaveMail dashboard");

    if(result.call_id||result.id||result.status==="success"){
      showToast("Test call initiated! You should receive a call within 10 seconds.","success");
      setAiLeads(l=>[{id:"AL-"+Date.now(),caller:"Test Call",phone:testCallNumber,summary:"Test call initiated from PaveMail dashboard. Call ID: "+(result.call_id||result.id||"pending"),service:"Test",address:"",status:"pending",time:"Just now",transferred:false},...l]);
    } else {
      const errMsg = result.errors?.[0]?.message || result.message || result.error || JSON.stringify(result).slice(0,100);
      showToast("Call failed: "+errMsg,"info");
      console.error("Full bland error:", result);
    }
    setTestCallLoading(false);
  }

  // Build dynamic COMPANY from contractor profile
  const BASE = isDemoMode ? DEMO_COMPANY : (contractor ? {
    name:          contractor.company_name || ACTIVE_COMPANY.name,
    ownerName:     contractor.owner_name || ACTIVE_COMPANY.ownerName,
    phone:         contractor.phone || ACTIVE_COMPANY.phone,
    phoneRaw:      (contractor.phone||ACTIVE_COMPANY.phone).replace(/\D/g,""),
    email:         contractor.email || ACTIVE_COMPANY.email,
    city:          contractor.city || ACTIVE_COMPANY.city,
    state:         contractor.state || ACTIVE_COMPANY.state,
    lobFromId:     contractor.lob_from_id || ACTIVE_COMPANY.lobFromId,
    transferPhone: contractor.bland_transfer || ACTIVE_COMPANY.transferPhone,
    contractorId:  authUser?.user?.id || ACTIVE_COMPANY.contractorId,
    crewSize:      contractor.crew_size || ACTIVE_COMPANY.crewSize,
    maxJobsWeek:   contractor.max_jobs_week || ACTIVE_COMPANY.maxJobsWeek,
    weeklyTarget:  contractor.weekly_target || ACTIVE_COMPANY.weeklyTarget,
    accentColor:   contractor.accent_color || ACTIVE_COMPANY.accentColor,
  } : COMPANY);
  const ACTIVE_COMPANY = BASE;

  // Show auth screen if not logged in
  if(!authUser) return(
    <div className="login-screen">
        <div className="login-bg"/>
        <div className="login-texture"/>
        <div className="login-box">
          <div className="login-logo" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
              <rect width="52" height="52" rx="14" fill="rgba(232,86,10,0.1)"/>
              <rect x="8" y="22" width="36" height="22" rx="3" fill="rgba(232,86,10,0.15)" stroke="rgba(232,86,10,0.5)" strokeWidth="1.5"/>
              <rect x="13" y="27" width="26" height="3.5" rx="1.5" fill="#e8560a" opacity="0.9"/>
              <rect x="13" y="33.5" width="16" height="3.5" rx="1.5" fill="#e8560a" opacity="0.5"/>
              <path d="M18 22V16C18 12.7 21 10 26 10C31 10 34 12.7 34 16V22" stroke="rgba(232,86,10,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="26" cy="16" r="2" fill="rgba(232,86,10,0.4)"/>
            </svg>
            PAVE<span>MAIL</span>
          </div>
          <div className="login-tagline">The Postcard That Knows Their Project</div>

          {/* ── LOGIN ── */}
          {authScreen==="login"&&(
            <>
              <div className="login-label" style={{marginTop:24}}>Sign In</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                <input type="email" placeholder="your@email.com" autoComplete="email"
                  value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:8,padding:"12px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none"}}
                />
                <input type="password" placeholder="Password" autoComplete="current-password"
                  value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
                  onKeyDown={e=>e.key==="Enter"&&handleLogin()}
                  style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:8,padding:"12px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none"}}
                />
              </div>
              {authError&&<div style={{color:"#f08080",fontSize:12,marginBottom:10,textAlign:"center"}}>{authError}</div>}
              <button className="gen-btn" onClick={handleLogin} disabled={authLoading} style={{marginBottom:12}}>
                {authLoading?<span className="spin"/>:"Sign In"}
              </button>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <button onClick={()=>{setAuthScreen("signup");setAuthError("");}} style={{background:"none",border:"none",color:"var(--stone)",cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>New contractor? Sign up</button>
                <button onClick={()=>{setAuthScreen("forgot");setAuthError("");}} style={{background:"none",border:"none",color:"var(--stone)",cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>Forgot password?</button>
              </div>
            </>
          )}

          {/* ── SIGN UP ── */}
          {authScreen==="signup"&&(
            <>
              <div className="login-label" style={{marginTop:20}}>Create Account</div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {[
                  {ph:"Invite Code *",key:"inviteCode",type:"text",ac:"off"},
                  {ph:"Your First Name *",key:"ownerName",type:"text",ac:"given-name"},
                  {ph:"Company Name *",key:"companyName",type:"text",ac:"organization"},
                  {ph:"Email Address *",key:"email",type:"email",ac:"email"},
                  {ph:"Password (min 6 chars) *",key:"password",type:"password",ac:"new-password"},
                  {ph:"Confirm Password *",key:"confirmPassword",type:"password",ac:"new-password"},
                ].map(f=>(
                  <input key={f.key} type={f.type} placeholder={f.ph} autoComplete={f.ac}
                    value={authForm[f.key]} onChange={e=>setAuthForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:8,padding:"11px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:13,outline:"none"}}
                  />
                ))}
              </div>
              {authError&&<div style={{color:"#f08080",fontSize:12,marginBottom:8,textAlign:"center"}}>{authError}</div>}
              <button className="gen-btn" onClick={handleSignup} disabled={authLoading} style={{marginBottom:10}}>
                {authLoading?<span className="spin"/>:"Create Account"}
              </button>
              <button onClick={()=>{setAuthScreen("login");setAuthError("");}} style={{background:"none",border:"none",color:"var(--stone)",cursor:"pointer",fontSize:12,fontFamily:"'Syne',sans-serif",width:"100%"}}>← Back to Sign In</button>
            </>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {authScreen==="forgot"&&(
            <>
              <div className="login-label" style={{marginTop:24}}>Reset Password</div>
              <div style={{fontSize:12,color:"var(--stone)",marginBottom:12,textAlign:"center",lineHeight:1.6}}>Enter your email and we'll send a reset link</div>
              <input type="email" placeholder="your@email.com" autoComplete="email"
                value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}
                style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:8,padding:"12px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none",width:"100%",marginBottom:12,boxSizing:"border-box"}}
              />
              {authError&&<div style={{color:"#f08080",fontSize:12,marginBottom:8,textAlign:"center"}}>{authError}</div>}
              {authSuccess&&<div style={{color:"var(--green2)",fontSize:12,marginBottom:8,textAlign:"center"}}>{authSuccess}</div>}
              <button className="gen-btn" disabled={authLoading} onClick={()=>{
                if(!authForm.email){setAuthError("Enter your email");return;}
                setAuthLoading(true);
                auth.resetPassword(authForm.email).then(()=>{
                  setAuthSuccess("Reset link sent! Check your email.");
                  setAuthLoading(false);
                });
              }} style={{marginBottom:10}}>
                {authLoading?<span className="spin"/>:"Send Reset Link"}
              </button>
              <button onClick={()=>{setAuthScreen("login");setAuthError("");setAuthSuccess("");}} style={{background:"none",border:"none",color:"var(--stone)",cursor:"pointer",fontSize:12,fontFamily:"'Syne',sans-serif",width:"100%"}}>← Back to Sign In</button>
            </>
          )}

          {/* ── DEMO ACCESS CODE ── */}
          {authScreen==="demo-code"&&(
            <>
              <div style={{textAlign:"center",marginTop:16,marginBottom:4}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:3,color:"var(--cream)"}}>DEMO ACCESS</div>
                <div style={{fontSize:11,color:"var(--stone)",marginTop:4}}>Enter the 4-digit demo code</div>
              </div>
              {/* Dots */}
              <div className={`demo-dots${demoShake?" shake":""}`}>
                {[0,1,2,3].map(i=>(
                  <div key={i} className={`demo-dot${demoCode.length>i?(demoShake?" error":" filled"):""}`}/>
                ))}
              </div>
              {/* PIN Grid */}
              <div className="pin-grid">
                {["1","2","3","4","5","6","7","8","9","",  "0","⌫"].map((k,i)=>(
                  k===""
                  ? <div key={i}/>
                  : <button key={i} className={`pin-key${k==="⌫"?" del":""}`}
                      onClick={()=>{
                        if(k==="⌫"){
                          setDemoCode(c=>c.slice(0,-1));
                        } else {
                          setDemoCode(c=>{
                            const next=(c+k).slice(0,4);
                            if(next.length===4){
                              setTimeout(()=>{
                                if(next==="1234"){ handleDemoMode(); }
                                else{ setDemoShake(true); setDemoCode(""); setTimeout(()=>setDemoShake(false),400); }
                              },100);
                            }
                            return next;
                          });
                        }
                      }}
                    >{k}</button>
                ))}
              </div>
              {demoShake&&<div style={{color:"#f08080",fontSize:12,textAlign:"center",marginBottom:8}}>Incorrect code — try again</div>}
              <div style={{fontSize:10,color:"var(--gravel)",textAlign:"center",marginBottom:12,opacity:0.6}}>Keyboard input supported · Press Esc to go back</div>
              <button onClick={()=>{setAuthScreen("login");setDemoCode("");}} style={{background:"none",border:"none",color:"var(--stone)",cursor:"pointer",fontSize:12,fontFamily:"'Syne',sans-serif",width:"100%",padding:"4px 0"}}>← Back</button>
            </>
          )}

          {/* ── PROFILE SETUP ── */}
          {authScreen==="profile-setup"&&(
            <>
              <div style={{textAlign:"center",marginTop:16,marginBottom:8}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:2,color:"var(--cream)"}}>WELCOME TO PAVEMAIL</div>
                <div style={{fontSize:12,color:"var(--stone)",marginTop:4,lineHeight:1.7}}>Tell us about your business so every<br/>postcard sounds like it came from you</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:12}}>
                {[
                  {ph:"Your First Name",key:"ownerName",type:"text"},
                  {ph:"Company Name",key:"companyName",type:"text"},
                  {ph:"Phone Number",key:"phone",type:"tel"},
                  {ph:"City",key:"city",type:"text"},
                ].map(f=>(
                  <input key={f.key} type={f.type} placeholder={f.ph}
                    value={authForm[f.key]} onChange={e=>setAuthForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:8,padding:"11px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:13,outline:"none"}}
                  />
                ))}
              </div>
              {authError&&<div style={{color:"#f08080",fontSize:12,marginBottom:8,textAlign:"center"}}>{authError}</div>}
              <button className="gen-btn" onClick={handleProfileSetup} disabled={authLoading}>
                {authLoading?<span className="spin"/>:"Launch PaveMail →"}
              </button>
            </>
          )}

          {authScreen!=="demo-code"&&(
            <div style={{textAlign:"center",marginTop:20}}>
              <div style={{height:1,background:"rgba(184,180,172,0.08)",marginBottom:16}}/>
              <button
                onClick={()=>{setAuthScreen("demo-code");setDemoCode("");setDemoShake(false);}}
                style={{background:"none",border:"none",color:"var(--stone)",fontFamily:"'Syne',sans-serif",fontSize:12,cursor:"pointer",letterSpacing:0.3,display:"flex",alignItems:"center",gap:6,margin:"0 auto",padding:"4px 0",opacity:0.7,transition:"opacity 0.15s"}}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 5.5C4 4.4 4.9 3.5 6 3.5C7.1 3.5 8 4.4 8 5.5C8 6.3 7.5 7 6.8 7.4L6 7.8V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="6" cy="10" r="0.6" fill="currentColor"/></svg>
                Have a demo access code?
              </button>
            </div>
          )}
          <div className="login-footer" style={{marginTop:12}}>🔒 Secured · PaveMail</div>
        </div>
    </div>
  );

  return(
    <div className="shell">

        {/* TOPBAR */}
        <div className="topbar">
          <div className="logo" style={{display:"flex",alignItems:"center",gap:8}}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{flexShrink:0}}>
                <rect x="1" y="8" width="20" height="13" rx="2" fill="rgba(232,86,10,0.15)" stroke="rgba(232,86,10,0.6)" strokeWidth="1.2"/>
                <rect x="4" y="11" width="14" height="2" rx="1" fill="#e8560a" opacity="0.8"/>
                <rect x="4" y="14.5" width="9" height="2" rx="1" fill="#e8560a" opacity="0.5"/>
                <path d="M7 8V5C7 3.3 8.3 2 11 2C13.7 2 15 3.3 15 5V8" stroke="rgba(232,86,10,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              PAVE<span>MAIL</span>
            </div>
          <div className="topbar-sep"/>

          {/* ── CENTER: Live stats strip ── */}
          <div className="topbar-center">
            {/* Capacity status pill */}
            <div className="topbar-stat" onClick={()=>switchTab("capacity")} style={{cursor:"pointer",borderColor:CAPACITY_MODES[capacity.mode].color+"40",color:CAPACITY_MODES[capacity.mode].color}}>
              <span style={{width:6,height:6,borderRadius:"50%",background:CAPACITY_MODES[capacity.mode].color,flexShrink:0,display:"inline-block"}}/>
              <span>{CAPACITY_MODES[capacity.mode].label}</span>
            </div>
            {/* Divider */}
            <span style={{width:1,height:14,background:"rgba(184,180,172,0.12)",flexShrink:0}}/>
            {/* Won */}
            <div className="topbar-stat" onClick={()=>switchTab("pipeline")} style={{cursor:"pointer",color:"var(--green2)"}}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1L6.2 4H9L6.8 5.8L7.6 8.5L5 7L2.4 8.5L3.2 5.8L1 4H3.8L5 1Z" fill="currentColor" opacity="0.8"/></svg>
              <span style={{fontFamily:"'DM Mono',monospace",color:"var(--green2)"}}>${pipeline.filter(l=>l.stage==="won").reduce((s,l)=>s+(l.value||0),0).toLocaleString()}</span>
              <span style={{opacity:0.5,color:"var(--stone)"}}>won</span>
            </div>
            {/* Active */}
            <div className="topbar-stat" onClick={()=>switchTab("pipeline")} style={{cursor:"pointer"}}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" opacity="0.6"/><circle cx="5" cy="5" r="1.5" fill="currentColor"/></svg>
              <span style={{fontFamily:"'DM Mono',monospace"}}>{pipeline.filter(l=>l.stage!=="won").length}</span>
              <span style={{opacity:0.5}}>active</span>
            </div>
            {/* Spot bids */}
            <div className="topbar-stat" onClick={()=>switchTab("spotbid")} style={{cursor:"pointer"}}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1" opacity="0.5"/><circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1" opacity="0.7"/><circle cx="5" cy="5" r="1" fill="currentColor"/></svg>
              <span style={{fontFamily:"'DM Mono',monospace"}}>{spotJobs.length}</span>
              <span style={{opacity:0.5}}>bids</span>
            </div>
          </div>

          <div className="topbar-right">
            {isAdmin&&<div className="lob-pill"><div className="lob-dot"/>Mail: Test Mode</div>}
            {isDemoMode&&<div style={{background:"rgba(212,160,23,0.15)",border:"1px solid rgba(212,160,23,0.3)",borderRadius:20,padding:"3px 10px",fontSize:10,color:"#d4a017",fontWeight:700,display:"flex",alignItems:"center",gap:5}}>◎ DEMO</div>}
            <div className="user-menu-wrap">
              <div
                className="avatar"
                onClick={()=>setShowUserMenu(m=>!m)}
                title={contractor?.company_name||ACTIVE_COMPANY.name}
              >
                {(contractor?.owner_name||ACTIVE_COMPANY.ownerName||"J")[0].toUpperCase()}{(contractor?.company_name||ACTIVE_COMPANY.name).split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
              </div>
              {showUserMenu&&(
                <>
                  {/* Click outside to close */}
                  <div onClick={()=>setShowUserMenu(false)} style={{position:"fixed",inset:0,zIndex:498}}/>
                  <div className="user-menu">
                    <div className="user-menu-header">
                      <div className="user-menu-name">{contractor?.company_name||ACTIVE_COMPANY.name}</div>
                      <div className="user-menu-email">{authUser?.user?.email||ACTIVE_COMPANY.email}</div>
                      {isAdmin&&<div style={{marginTop:6,fontSize:9,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--orange2)"}}>⚙ Super Admin</div>}
                    </div>
                    <button className="user-menu-item" onClick={()=>{setShowUserMenu(false);switchTab("settings");}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1v1M7 12v1M1 7h1M12 7h1M2.5 2.5l.7.7M10.8 10.8l.7.7M2.5 11.5l.7-.7M10.8 3.2l.7-.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Settings
                    </button>
                    {isAdmin&&(
                      <button className="user-menu-item" onClick={()=>{setShowUserMenu(false);switchTab("admin");}}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="1" y="7.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/><rect x="7.5" y="7.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/></svg>
                        Admin Dashboard
                      </button>
                    )}
                    <div className="user-menu-divider"/>
                    <button className="user-menu-item danger" onClick={()=>{setShowUserMenu(false);handleLogout();}}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2H2a1 1 0 00-1 1v8a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M9.5 10L13 7l-3.5-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/><line x1="13" y1="7" x2="5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* NAV */}
        <nav className="nav">
          <div className="nav-label">Campaigns</div>
          {[{id:"map",label:"Neighborhood Scan",badge:null},{id:"create",label:"Create Mailer",badge:null},{id:"tracker",label:"Job Tracker",badge:jobs.filter(j=>j.status==="sent"||j.status==="queued").length||null},{id:"spotbid",label:"Spot Bid",badge:null},{id:"pipeline",label:"Pipeline",badge:null},{id:"capacity",label:"Capacity",badge:null},{id:"aiphone",label:"AI Phone",badge:aiLeads.filter(l=>l.status==="pending").length||null}].map(item=>(
            <button key={item.id} className={`nav-item${tab===item.id?" active":""}`} onClick={()=>switchTab(item.id)}>
              <NavIcon id={item.id}/>{item.label}
              {item.badge?<span className="nav-badge">{item.badge}</span>:null}
            </button>
          ))}
          {isAdmin&&(
            <button className={`nav-item${tab==="admin"?" active":""}`} onClick={()=>switchTab("admin")}>
              <NavIcon id="admin"/>Admin
            </button>
          )}
          <div className="nav-divider"/>
          <div className="nav-label">Account</div>
          <button className={`nav-item${tab==="settings"?" active":""}`} onClick={()=>setTab("settings")}><NavIcon id="settings"/>Settings</button>
          <div className="nav-mini">
            {/* CAPACITY WIDGET */}
            <div className="capacity-widget" style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--stone)"}}>Crew Capacity</div>
                <div style={{fontSize:10,fontWeight:700,color:CAPACITY_MODES[capacity.mode].color}}>{CAPACITY_MODES[capacity.mode].svgIcon} {CAPACITY_MODES[capacity.mode].label}</div>
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
                    {cfg.svgIcon} {cfg.label}
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
                    <input placeholder="Enter ZIP (e.g. 74105)" value={zipSearch} onChange={e=>setZipSearch(e.target.value.replace(/[^0-9]/g,"").slice(0,5))} onKeyDown={e=>e.key==="Enter"&&searchZip(zipSearch)} maxLength={5} style={{fontFamily:"'DM Mono',monospace",fontSize:15,letterSpacing:2}}/>
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
                  <div style={{padding:"12px 0 4px"}}>
                    <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--stone)",marginBottom:8}}>Quick Select</div>
                    <div style={{display:"flex",flexDirection:"column",gap:5}}>
                      {[{zip:"74105",name:"South Tulsa"},{zip:"74011",name:"Broken Arrow"},{zip:"74037",name:"Jenks"},{zip:"74055",name:"Owasso"},{zip:"74008",name:"Bixby"},{zip:"74063",name:"Sand Springs"}].map(r=>(
                        <button key={r.zip} onClick={()=>{setZipSearch(r.zip); setTimeout(()=>searchZip(r.zip),50);}} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(232,86,10,0.05)",border:"1px solid rgba(232,86,10,0.12)",borderRadius:7,padding:"8px 12px",cursor:"pointer",transition:"all 0.12s",width:"100%",textAlign:"left"}}>
                          <span style={{fontSize:12,color:"var(--concrete)",fontWeight:500}}>{r.name}</span>
                          <span style={{fontSize:11,color:"var(--orange2)",fontFamily:"'DM Mono',monospace"}}>{r.zip}</span>
                        </button>
                      ))}
                    </div>
                  </div>
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
                      <div className="route-check"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                    </div>
                  ))}
                </div>
                {selectedRoutes.length>0&&(
                  <div className="sel-summary">
                    <h4>Campaign Summary</h4>
                    <div className="sum-row"><span>Routes selected</span><strong>{selectedRoutes.length}</strong></div>
                    <div className="sum-row"><span>Residential homes</span><strong>{totalHomes.toLocaleString()}</strong></div>
                    <div className="sum-row"><span>Est. cost (EDDM)</span><strong style={{fontFamily:"'DM Mono',monospace",color:"var(--orange2)"}}>${(totalHomes*0.62).toFixed(2)}</strong></div>
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
                {liveRoutes.length===0&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,color:"var(--gravel)",textAlign:"center",padding:40}}><div style={{opacity:0.2}}><svg width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 4C14.5 4 10 8.5 10 14C10 21.5 20 36 20 36C20 36 30 21.5 30 14C30 8.5 25.5 4 20 4Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="20" cy="14" r="4" fill="currentColor" opacity="0.6"/></svg></div><div style={{fontSize:13,color:"var(--stone)"}}>Enter a ZIP code to load live USPS carrier routes</div></div>}
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
                <p style={{fontSize:12,color:"var(--stone)",marginBottom:16,lineHeight:1.6}}>AI writes your mailer. Hit Send to print and mail it to real addresses.</p>
                <div className="section-head">Target Area</div>
                <div className="field"><label>Neighborhood *</label><input placeholder="e.g. South Tulsa, Broken Arrow, Jenks..." value={form.neighborhood} onChange={e=>set("neighborhood",e.target.value)}/></div>
                <div className="row2">
                  <div className="field"><label>Homes to Mail</label><input type="number" placeholder="200" value={form.homes} onChange={e=>set("homes",e.target.value)}/></div>
                  <div className="field"><label>Promo Code</label><input placeholder="JWOOD" value={form.promoCode} onChange={e=>set("promoCode",e.target.value)}/></div>
                </div>
                <div className="section-head">Campaign Settings</div>
                <div className="field"><label>Season</label><div className="chips">{SEASONS.map(s=><button key={s} className={`chip${form.season===s?" on":""}`} onClick={()=>set("season",s)}>{s}</button>)}</div></div>
                <div className="field" style={{marginTop:10}}><label>Service Focus</label><div className="chips">{ANGLES.map(a=><button key={a} className={`chip${form.angle===a?" on":""}`} onClick={()=>set("angle",a)}>{a}</button>)}</div></div>
                <div className="field" style={{marginTop:10}}><label>Special Offer</label><div className="chips">{OFFERS.map(o=><button key={o} className={`chip${form.offer===o?" on":""}`} onClick={()=>set("offer",o)}>{o}</button>)}</div></div>
                <div className="section-head">AI Guidance</div>
                <div className="field"><label>Extra Notes</label><textarea placeholder="e.g. Just finished a job on 71st St. Mention freeze-thaw damage." value={form.extraNotes} onChange={e=>set("extraNotes",e.target.value)}></textarea></div>
                <div className="divider"/>
                <div className="cost-bar"><div><div className="cb-label">Est. Print + Mail Cost</div><div className="cb-sub">{form.homes||0} homes x $0.62 (EDDM rate)</div></div><div className="cb-value">${estCost}</div></div>
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
                    ✅ <strong>Mailer confirmed!</strong><br/>
                    Job ID: <span className="lob-id-pill">{lobResult.id}</span><br/>
                    Status: <strong>{lobResult.expected_delivery_date ? `Delivers ${lobResult.expected_delivery_date}` : "Queued for printing"}</strong>
                  </div>
                )}
              </div>
              <div className="create-preview">
                {!mailer&&!loading&&<div className="empty"><div className="icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="4" y="10" width="40" height="28" rx="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 16L24 28L44 16" stroke="currentColor" strokeWidth="1.5"/></svg></div><h3>Your Mailer Appears Here</h3><p>Enter a Tulsa neighborhood and hit Generate. Your business info and QR code load automatically.</p></div>}
                {loading&&<div className="mailer-stack">{[1,2,3,4].map(i=><div key={i}><div className="page-tag">Page {i}</div><div className="skel-page"><div className="skel" style={{height:16,width:"40%",marginBottom:14}}/><div className="skel" style={{height:36,width:"70%",marginBottom:10}}/><div className="skel" style={{height:13,width:"55%",marginBottom:7}}/><div className="skel" style={{height:13,width:"45%"}}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:20}}><div className="skel" style={{height:72}}/><div className="skel" style={{height:72}}/></div></div></div>)}</div>}
                {mailer&&!loading&&<>
                  <div className="preview-actions">
                    <button className="btn btn-ghost btn-sm" onClick={generate}>↺ Regenerate</button>
                    <button className="btn btn-primary btn-sm" onClick={sendToPress} disabled={sending}>{sending?"Sending...":"📬 Print & Mail"}</button>
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
              <p style={{fontSize:13,color:"var(--stone)",marginBottom:20}}>{ACTIVE_COMPANY.name} campaign — from print queue to Tulsa doorstep.</p>
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
                    <span>💵 <strong style={{fontFamily:"'DM Mono',monospace",color:"var(--orange2)"}}>${selectedJob.cost}</strong></span>
                    <span>📞 <strong style={{color:"var(--green2)"}}>{selectedJob.calls}</strong> calls</span>
                    <span>📅 <strong>{selectedJob.sent}</strong></span>
                    {selectedJob.lobId&&<span>🆔 <span style={{fontFamily:"'DM Mono',monospace",fontSize:11,color:"var(--stone)"}}>{selectedJob.lobId}</span></span>}
                  </div>
                </div>
              )}
              <div className="jobs-table">
                <div className="jobs-thead"><div>Campaign</div><div>Neighborhood</div><div>Homes</div><div>Sent</div><div>Spend</div><div>Calls</div><div>Status</div></div>
                {jobs.length===0&&(
                  <div style={{padding:"32px",textAlign:"center",color:"var(--gravel)",fontSize:13}}>
                    <div style={{fontSize:28,marginBottom:8}}>📬</div>
                    No campaigns yet — send your first neighborhood mailer to see results here
                  </div>
                )}
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
                <p style={{fontSize:12,color:"var(--stone)",marginBottom:16,lineHeight:1.6}}>See a cracked concrete surface? Send that homeowner a personal bid mailer from your truck.</p>
                <div className="section-head">Input Method</div>
                <div className="mode-tabs">
                  {[{id:"address",icon:"addr",label:"Type Address"},{id:"map",icon:"map",label:"Pin on Map"},{id:"photo",icon:"cam",label:"Photo"}].map(m=>(
                    <div key={m.id} className={`mode-tab${spotMode===m.id?" on":""}`} onClick={()=>setSpotMode(m.id)}>
                      <div className="mt-icon">{
                        m.icon==="addr" ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2C7.2 2 5 4.2 5 7C5 10.5 10 18 10 18C10 18 15 10.5 15 7C15 4.2 12.8 2 10 2Z" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="7" r="2" fill="currentColor"/></svg>
                        : m.icon==="map" ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.4" opacity="0.5"/><line x1="10" y1="2" x2="10" y2="18" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/><line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1.4" opacity="0.3"/></svg>
                        : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="11" r="3.5" stroke="currentColor" strokeWidth="1.4"/><path d="M7 5V4C7 3 8 2 10 2C12 2 13 3 13 4V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      }</div>
                      <div className="mt-label">{m.label}</div>
                    </div>
                  ))}
                </div>

                {spotMode==="photo"&&(
                  <div>
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/*"
                      style={{display:"none"}}
                      onClick={e=>{ e.target.value=null; }}
                      onChange={async e=>{
                        const f=e.target.files[0];
                        if(!f) return;
                        const reader=new FileReader();
                        reader.onload=async ev=>{
                          const base64=ev.target.result;
                          setSpotPhoto(base64);
                          showToast("📷 Uploading photo...","info");
                          try {
                            const imageData=base64.split(",")[1];
                            const formData=new FormData();
                            formData.append("key","1de580a4e5bbefe4b3b892494b4a6d7a");
                            formData.append("image",imageData);
                            const res=await fetch(IMGBB_PROXY,{method:"POST",body:formData});
                            const data=await res.json();
                            if(data.success){
                              const hostedUrl=data.data.url;
                              setSpotPhotoUrl(hostedUrl);
                              spotPhotoUrlRef.current=hostedUrl;
                              track('photo_uploaded', {url: hostedUrl?.slice(0,30)});
        showToast("📷 Photo ready","success");
                            }
                          } catch(err){ console.error("imgbb upload failed:",err); }
                        };
                        reader.readAsDataURL(f);
                      }}
                    />
                    <div
                      className="photo-drop"
                      onClick={()=>document.getElementById('photo-input').click()}
                    >
                      {spotPhoto ? (
                        <>
                          <img src={spotPhoto} className="photo-preview" alt="project photo"/>
                          <div style={{fontSize:11,color:spotPhotoUrl?"var(--green2)":"var(--yellow)",textAlign:"center",marginTop:4}}>
                            {spotPhotoUrl?"✓ Photo uploaded & ready":"⏳ Uploading photo..."}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="pd-icon"><svg width="36" height="36" viewBox="0 0 36 36" fill="none"><rect x="2" y="9" width="32" height="22" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.8"/><path d="M12 9V7C12 5.9 12.9 5 14 5H22C23.1 5 24 5.9 24 7V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="18" cy="20" r="6" stroke="currentColor" strokeWidth="1.8"/><circle cx="18" cy="20" r="2.5" fill="currentColor" fillOpacity="0.6"/><circle cx="27" cy="14" r="1.8" fill="currentColor" fillOpacity="0.5"/></svg></div>
                          <div className="pd-label">Tap to take photo or upload<br/><span style={{fontSize:10,color:"var(--gravel)"}}>AI reads the damage automatically</span></div>
                        </>
                      )}
                    </div>
                    {spotPhoto&&(
                      <button className="btn btn-ghost btn-sm" style={{width:"100%",marginTop:4}} onClick={()=>{setSpotPhoto(null);setSpotPhotoUrl(null);spotPhotoUrlRef.current=null;setCanvasDataUrl(null);}}>
                        ✕ Remove Photo
                      </button>
                    )}
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
                      placeholder="e.g. 1234 Main St"
                      autoComplete="street-address"
                      style={{fontSize:16}}
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
                        {verifyResult.carrierRoute&&<div style={{color:"var(--stone)",fontFamily:"'DM Mono',monospace",fontSize:10}}>Carrier Route: {verifyResult.zip}{verifyResult.carrierRoute}</div>}
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

                <div className="section-head">Project Size</div>
                <div className="chips" style={{marginBottom:8}}>
                  {PROJECT_SIZES.map(s=>(
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
                        style={{width:"100%",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:6,padding:"8px 10px",color:"var(--orange2)",fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:600,outline:"none"}}/>
                    </div>
                    <div style={{color:"var(--stone)",fontSize:13,paddingTop:20}}>to</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:11,color:"var(--stone)",marginBottom:4}}>Up to</div>
                      <input type="number" value={spotForm.bidHigh}
                        onChange={e=>setSpotForm(f=>({...f,bidHigh:e.target.value,overridePrice:true}))}
                        style={{width:"100%",background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.2)",borderRadius:6,padding:"8px 10px",color:"var(--orange2)",fontFamily:"'DM Mono',monospace",fontSize:18,fontWeight:600,outline:"none"}}/>
                    </div>
                  </div>
                  <div style={{fontSize:10,color:"var(--gravel)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>{spotForm.customSqft||spotForm.sqft} sq ft · {spotForm.service} · {spotForm.damageLevel} damage</span>
                    {spotForm.overridePrice&&<button onClick={()=>setSpotForm(f=>({...f,overridePrice:false}))} style={{fontSize:10,color:"var(--orange2)",background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>Reset to auto</button>}
                  </div>
                </div>

                <div className="field"><label>What's Included</label><input placeholder="e.g. Demo, haul away, pour, finish & seal" value={spotForm.includes||""} onChange={e=>setSpot("includes",e.target.value)}/></div>

                <div className="field"><label>Extra Notes for AI</label><textarea placeholder="e.g. Large crack near garage door, looks like tree root damage" value={spotForm.notes} onChange={e=>setSpot("notes",e.target.value)}></textarea></div>

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
                      {spotJobs.length===0&&(
                        <div style={{padding:"20px",textAlign:"center",color:"var(--gravel)",fontSize:12}}>
                          <div style={{marginBottom:6,opacity:0.3}}><svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5"/><circle cx="14" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/><circle cx="14" cy="14" r="3" fill="currentColor"/></svg></div>
                          No spot bids sent yet
                        </div>
                      )}
                      {spotJobs.slice(0,4).map(j=>(
                        <div key={j.id} className="spot-job-row" onClick={()=>{
                          setPreviewJob(j);
                          setHistoryCanvasUrl(null);
                          setShowHistoryPreview(true);
                          // Re-render canvas from saved data
                          if(j.mailerContent||j.photoUrl) {
                            renderPostcardCanvas(
                              j.photoUrl||j.photoData||null,
                              j.mailerContent||{
                                headline:"Your Personalized Estimate",
                                personalNote:`Thank you for considering ${ACTIVE_COMPANY.name}.`,
                                address:j.address, city:j.city,
                                bidLo:j.bid, bid:j.bid,
                              },
                              setHistoryCanvasUrl
                            );
                          }
                        }} style={{cursor:"pointer"}}>
                          <div style={{flex:1}}>
                            <div className="spot-job-addr">{j.address}</div>
                            <div className="spot-job-sub">{j.city} · {j.sent} · <span className={`badge badge-${j.status}`} style={{fontSize:9,padding:"2px 6px"}}>{j.status}</span></div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <div className="spot-job-bid">{j.bid}</div>
                            <div style={{fontSize:10,color:"var(--stone)",background:"rgba(184,180,172,0.08)",padding:"3px 8px",borderRadius:5}}>👁 Preview</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="spot-preview">
                {!spotMailer&&!spotLoading&&(
                  <div className="empty">
                    <div className="icon"><svg width="48" height="48" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5"/><circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/><circle cx="24" cy="24" r="5" fill="currentColor" opacity="0.8"/></svg></div>
                    <h3>Spot Bid Preview</h3>
                    <p>Enter an address and damage details — AI writes a personal note that sounds like it came from Joel himself, not a corporation.</p>
                    <div style={{marginTop:16,background:"rgba(232,86,10,0.08)",border:"1px solid rgba(232,86,10,0.2)",borderRadius:8,padding:"14px 18px",textAlign:"left",maxWidth:320}}>
                      <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--orange2)",marginBottom:8}}>How It Works</div>
                      <div style={{fontSize:12,color:"var(--stone)",lineHeight:1.8}}>
                        <div>1. Drive past a property that needs work</div>
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
                          {canvasDataUrl ? (
                            <img
                              src={canvasDataUrl}
                              alt="Postcard preview"
                              style={{width:"100%",height:"auto",aspectRatio:"600/320",display:"block",borderRadius:"8px 8px 0 0"}}
                            />
                          ) : (spotMailer.photoUrl||spotMailer.photoData) ? (
                            // Safari fallback — raw photo with CSS overlay
                            <div style={{position:"relative",width:"100%",aspectRatio:"600/320",overflow:"hidden",borderRadius:"8px 8px 0 0"}}>
                              <img
                                src={spotMailer.photoUrl||spotMailer.photoData}
                                alt="project photo"
                                style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}
                              />
                              <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(10,9,8,0.25) 0%,rgba(10,9,8,0.7) 50%,rgba(10,9,8,0.97) 100%)"}}/>
                              <div style={{position:"absolute",inset:0,padding:20,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
                                <div style={{fontSize:10,color:"rgba(245,240,230,0.6)",marginBottom:4}}>{spotMailer.address}, {spotMailer.city}</div>
                                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:"#f5f0e6",letterSpacing:1,lineHeight:1,marginBottom:8}}>{spotMailer.headline}</div>
                                <div style={{background:"rgba(0,0,0,0.5)",borderLeft:"3px solid rgba(232,86,10,0.7)",borderRadius:6,padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                                  <div>
                                    <div style={{fontSize:7,color:"rgba(232,86,10,0.8)",fontWeight:700,letterSpacing:2,textTransform:"uppercase"}}>Your Estimate</div>
                                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#f5f0e6"}}>{spotMailer.bidLo||spotMailer.bid}</div>
                                  </div>
                                  <div style={{background:"#e8560a",borderRadius:5,padding:"6px 10px",textAlign:"center"}}>
                                    <div style={{fontSize:8,fontWeight:700,color:"white"}}>CALL NOW</div>
                                    <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"white"}}>${ACTIVE_COMPANY.phone}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="spot-front-no-photo"/>
                              <div className="spot-front-texture"/>
                              <div className="spot-front-content">
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"auto"}}>
                                  <div className="spot-tag" style={{margin:0}}>{ACTIVE_COMPANY.name} · {ACTIVE_COMPANY.city}, OK</div>
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
                                    <div style={{flexShrink:0,background:"var(--orange)",color:"white",padding:"8px 14px",borderRadius:6,fontSize:11,fontWeight:700,textAlign:"center"}}>CALL NOW<br/><span style={{fontSize:13,fontFamily:"'DM Mono',monospace"}}>${ACTIVE_COMPANY.phone}</span></div>
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
                        {/* Header bar — dynamic based on damage type */}
                        <div className="spot-back-header">
                          <div>
                            <div className="spot-back-header-title">
                              {(()=>{
                                const dmgList = spotMailer.damage||[];
                                const allDmg = dmgList.join(' ').toLowerCase();
                                const hasPhoto = spotMailer.photoUsed;
                                if(allDmg.includes('full')||allDmg.includes('replace')) return "Full Replacement Recommended";
                                if(allDmg.includes('sink')||allDmg.includes('sunken')) return "Sinking Slab — Act Now";
                                if(allDmg.includes('root')) return "Tree Root Damage Detected";
                                if(allDmg.includes('drain')) return "Drainage Issue Detected";
                                if(allDmg.includes('spall')) return "Surface Deterioration Detected";
                                if(allDmg.includes('oil')) return "Oil Damage — Treatment Needed";
                                if(allDmg.includes('edge')) return "Edge Deterioration Detected";
                                if(allDmg.includes('seal')) return "Professional Sealing Required";
                                if(allDmg.includes('crack')&&dmgList.length>1) return `${dmgList.length} Issues Found on Your Property`;
                                if(allDmg.includes('crack')) return "Cracks Spotted — Free Estimate Inside";
                                if(dmgList.length>2) return `${dmgList.length} Issues Found — Free Estimate Inside`;
                                if(dmgList.length>0) return "Concrete Issues Spotted on Your Property";
                                if(hasPhoto) return "Your Property Was Assessed — Free Estimate Inside";
                                return "You Qualify for a Free Estimate";
                              })()}
                            </div>
                            <div className="spot-back-header-sub">{spotMailer.address} · {spotMailer.city}, OK</div>
                          </div>
                          <div style={{background:"rgba(232,86,10,0.15)",border:"1px solid rgba(232,86,10,0.3)",borderRadius:6,padding:"4px 10px",fontSize:9,fontWeight:700,color:"rgba(232,86,10,0.9)",letterSpacing:1,flexShrink:0}}>FREE ESTIMATE</div>
                        </div>
                        <div className="spot-back-body">
                          {/* Damage findings */}
                          <div style={{fontSize:8,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#8a8680",marginBottom:8}}>What We Observed</div>
                          <div className="spot-damage-list">
                            {spotMailer.damage?.length>0 ? spotMailer.damage.slice(0,3).map((d,i)=>(
                              <div key={i} className="spot-damage-item">
                                <div className="spot-damage-dot"/>
                                {d}
                              </div>
                            )) : (
                              <div className="spot-damage-item"><div className="spot-damage-dot"/>General surface wear and aging concrete</div>
                            )}
                          </div>
                          {/* Bid strip */}
                          <div className="spot-bid-strip">
                            <div className="spot-bid-strip-left">
                              <div className="spot-bid-strip-label">Your Estimate</div>
                              <div className="spot-bid-strip-amount">{spotMailer.bidLo||spotMailer.bid}{spotMailer.bidHi&&<span style={{fontSize:15,color:"rgba(245,240,230,0.4)"}}>–{spotMailer.bidHi}</span>}</div>
                              {spotMailer.includes&&<div className="spot-bid-strip-includes">✓ {spotMailer.includes}</div>}
                            </div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontSize:9,color:"rgba(184,180,172,0.4)",marginBottom:4}}>Scan to call</div>
                              <QRCode value={`tel:${ACTIVE_ACTIVE_COMPANY.phoneRaw}`} size={50} fgColor="#f5f0e6" bgColor="#1c1a17"/>
                            </div>
                          </div>
                          {/* CTA */}
                          <div className="spot-cta-box">
                            <div className="spot-cta-text">
                              <h4>CALL OR TEXT {ACTIVE_COMPANY.ownerName.toUpperCase()}</h4>
                              <p>{ACTIVE_COMPANY.phone} · Free estimate · No obligation</p>
                            </div>
                            <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:700,color:"rgba(184,180,172,0.7)",letterSpacing:0.5,flexShrink:0}}>{ACTIVE_COMPANY.phone}</div>
                          </div>
                          {/* Trust line */}
                          <div className="spot-guarantee">
                            <div className="spot-guarantee-icon"><svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1L11 3V7C11 9.8 9 11.8 6.5 12.5C4 11.8 2 9.8 2 7V3L6.5 1Z" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M4.5 6.5L6 8L9 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                            <div className="spot-guarantee-text">Licensed & insured · {ACTIVE_COMPANY.city}, OK · {ACTIVE_COMPANY.name} · We stand behind every pour</div>
                          </div>
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
              <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginBottom:4}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"var(--cream)"}}>CAPACITY ENGINE</div>
                {capacity.manualOverride&&(
                  <button onClick={()=>setCapacity(c=>({...c,manualOverride:null}))}
                    style={{fontSize:10,color:"var(--stone)",background:"rgba(184,180,172,0.08)",border:"1px solid rgba(184,180,172,0.15)",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"'Syne',sans-serif"}}>
                    ↺ Back to Auto
                  </button>
                )}
              </div>
              <div style={{fontSize:12,color:"var(--stone)",marginBottom:20}}>
                {ACTIVE_COMPANY.crewSize||12}-man crew · {ACTIVE_COMPANY.maxJobsWeek||6} jobs/week max · ${(ACTIVE_COMPANY.weeklyTarget||40000).toLocaleString()} weekly target
                {capacity.autoMode&&!capacity.manualOverride&&<span style={{marginLeft:8,color:"var(--green2)",fontSize:10}}>● Auto mode active</span>}
                {capacity.manualOverride&&<span style={{marginLeft:8,color:"var(--gold2)",fontSize:10}}>⚑ Manual override</span>}
              </div>

              {/* Current mode banner */}
              <div style={{background:CAPACITY_MODES[capacity.mode].bg,border:`1px solid ${CAPACITY_MODES[capacity.mode].color}40`,borderRadius:12,padding:"20px 24px",marginBottom:20,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                <div style={{position:"relative",width:80,height:80,margin:"0 auto 8px"}}>
                  <svg width="80" height="80" viewBox="0 0 80 80" style={{transform:"rotate(-90deg)"}}>
                    <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(184,180,172,0.1)" strokeWidth="8"/>
                    <circle cx="40" cy="40" r="32" fill="none"
                      stroke={CAPACITY_MODES[capacity.mode].color}
                      strokeWidth="8"
                      strokeDasharray={`${2*Math.PI*32}`}
                      strokeDashoffset={`${2*Math.PI*32*(1-Math.min(1,(capacity.utilizationPct||0)/100))}`}
                      strokeLinecap="round"
                      style={{transition:"stroke-dashoffset 0.6s ease,stroke 0.3s ease"}}
                    />
                  </svg>
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:0}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:CAPACITY_MODES[capacity.mode].color,lineHeight:1}}>{capacity.utilizationPct||0}%</div>
                    <div style={{fontSize:8,color:"var(--stone)",letterSpacing:1,textTransform:"uppercase"}}>used</div>
                  </div>
                </div>
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
                      {cfg.svgIcon} {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats grid — real data */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:20}}>
                {[
                  {label:"Won Jobs",         value:capacity.activeJobs||0,      suffix:`/${ACTIVE_COMPANY.maxJobsWeek||6}`, color:"var(--orange2)", bar:true, barPct:Math.min(100,((capacity.activeJobs||0)/(ACTIVE_COMPANY.maxJobsWeek||6))*100)},
                  {label:"Crew Days Booked", value:capacity.committedDays||0,    suffix:`/${capacity.availDays||60} days`,   color:CAPACITY_MODES[capacity.mode].color, bar:true, barPct:capacity.utilizationPct||0},
                  {label:"Revenue Won",      value:`$${(capacity.wonRevenue||0).toLocaleString()}`, suffix:"", color:"var(--green2)", bar:false},
                  {label:"To Target",        value:`$${(capacity.revenueGap||0).toLocaleString()}`, suffix:"", color:capacity.onPace?"var(--green2)":"var(--gold2)", bar:false},
                ].map((s,i)=>(
                  <div key={i} style={{background:"var(--ink)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:9,padding:"14px 16px"}}>
                    <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--stone)",marginBottom:6}}>{s.label}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:s.bar?28:24,color:s.color,letterSpacing:1,lineHeight:1}}>{s.value}<span style={{fontSize:11,opacity:0.5,fontFamily:"'Syne',sans-serif"}}>{s.suffix}</span></div>
                    {s.bar&&<div style={{marginTop:6}}><div className="capacity-bar-wrap"><div className="capacity-bar" style={{width:`${s.barPct}%`,background:s.color,transition:"width 0.5s ease"}}/></div></div>}
                  </div>
                ))}
              </div>
              {/* Pipeline intelligence row */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
                <div style={{background:"rgba(42,122,82,0.08)",border:"1px solid rgba(42,122,82,0.15)",borderRadius:9,padding:"12px 16px"}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--green2)",marginBottom:4}}>Pipeline Value</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--green2)"}}>${(capacity.pipeValue||0).toLocaleString()}</div>
                  <div style={{fontSize:10,color:"var(--stone)",marginTop:2}}>{pipeline.filter(l=>l.stage!=="won").length} leads in play</div>
                </div>
                <div style={{background:"rgba(26,111,168,0.08)",border:"1px solid rgba(26,111,168,0.15)",borderRadius:9,padding:"12px 16px"}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:"var(--blue2)",marginBottom:4}}>Win Rate</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--blue2)"}}>
                    {pipeline.length > 0 ? Math.round((pipeline.filter(l=>l.stage==="won").length / pipeline.length) * 100) : 0}%
                  </div>
                  <div style={{fontSize:10,color:"var(--stone)",marginTop:2}}>{pipeline.filter(l=>l.stage==="won").length} of {pipeline.length} leads won</div>
                </div>
                <div style={{background:capacity.onPace?"rgba(42,122,82,0.08)":"rgba(212,160,23,0.08)",border:`1px solid ${capacity.onPace?"rgba(42,122,82,0.15)":"rgba(212,160,23,0.15)"}`,borderRadius:9,padding:"12px 16px"}}>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",color:capacity.onPace?"var(--green2)":"var(--gold2)",marginBottom:4}}>Weekly Pace</div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:capacity.onPace?"var(--green2)":"var(--gold2)"}}>
                    {capacity.onPace?"ON TARGET":"BEHIND"}
                  </div>
                  <div style={{fontSize:10,color:"var(--stone)",marginTop:2}}>${(ACTIVE_COMPANY.weeklyTarget||40000).toLocaleString()} target</div>
                </div>
              </div>

              {/* Smart suggestions */}
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>SMART SUGGESTIONS</div>
              {capacity.mode==="hungry"&&(
                <div className="smart-suggest">
                  <div className="smart-suggest-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1L11 7.5H17.5L12.2 11L14.2 17.5L9 14L3.8 17.5L5.8 11L0.5 7.5H7L9 1Z" fill="#e05252"/></svg></div>
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
                  <div className="smart-suggest-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="3" y="3" width="12" height="12" rx="2" fill="#8a8682" fillOpacity="0.3" stroke="#8a8682" strokeWidth="1.5"/><rect x="6" y="5.5" width="2.2" height="7" rx="1" fill="#8a8682"/><rect x="9.8" y="5.5" width="2.2" height="7" rx="1" fill="#8a8682"/></svg></div>
                  <div className="smart-suggest-text">
                    <strong>You are fully booked.</strong> Outbound campaigns are paused. The AI phone agent is telling callers you are booking 3 weeks out. When a job completes and is removed from Won, capacity will auto-resume.
                  </div>
                </div>
              )}
              {capacity.mode==="selective"&&(
                <div className="smart-suggest">
                  <div className="smart-suggest-icon"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" fill="#3a8fd4" fillOpacity="0.15" stroke="#3a8fd4" strokeWidth="1.5"/><circle cx="9" cy="9" r="4" fill="#3a8fd4" fillOpacity="0.3" stroke="#3a8fd4" strokeWidth="1"/><circle cx="9" cy="9" r="1.8" fill="#3a8fd4"/></svg></div>
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
                      <div style={{fontSize:11,color:"var(--concrete)"}}>{STAGE_ICONS[lead.stage]} {STAGES.find(s=>s.id===lead.stage)?.label}</div>
                      <div style={{fontFamily:"'DM Mono',monospace",fontSize:12,color:"var(--orange2)"}}>{lead.value?`$${lead.value.toLocaleString()}`:"—"}</div>
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

          {/* ADMIN */}
          {tab==="admin"&&isAdmin&&(
            <div className="admin-layout">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"var(--cream)",lineHeight:1}}>ADMIN DASHBOARD</div>
                  <div style={{fontSize:12,color:"var(--stone)",marginTop:3}}>${ACTIVE_COMPANY.email} · Full access</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={loadAdminData} disabled={adminLoading}>
                  {adminLoading?<span className="spin"/>:"↺ Refresh Data"}
                </button>
              </div>

              {/* Nav */}
              <div className="admin-nav">
                {["overview","contractors","pipeline","bids"].map(v=>(
                  <button key={v} className={`admin-nav-btn${adminView===v?" active":""}`} onClick={()=>{ setAdminView(v); if(!adminData.loaded) loadAdminData(); }}>
                    {v==="overview"?"📊 Overview":v==="contractors"?"👷 Contractors":v==="pipeline"?"📍 Pipeline":"🎯 Spot Bids"}
                  </button>
                ))}
              </div>

              {!adminData.loaded&&(
                <div style={{textAlign:"center",padding:"40px 0",color:"var(--gravel)"}}>
                  <div style={{fontSize:32,marginBottom:12}}>⚙️</div>
                  <div style={{fontSize:13,marginBottom:16}}>Click Refresh Data to load all contractor data</div>
                  <button className="btn btn-primary" onClick={loadAdminData} disabled={adminLoading}>
                    {adminLoading?<><span className="spin"/> Loading...</>:"Load All Data"}
                  </button>
                </div>
              )}

              {/* OVERVIEW */}
              {adminView==="overview"&&adminData.loaded&&(
                <>
                  <div className="admin-stat-grid">
                    {[
                      {label:"Contractors",val:adminData.contractors.length,color:"var(--cream)"},
                      {label:"Total Leads",val:adminData.pipeline.length,color:"var(--blue2)"},
                      {label:"Spot Bids Sent",val:adminData.bids.length,color:"var(--orange2)"},
                      {label:"Campaigns",val:adminData.campaigns.length,color:"var(--green2)"},
                    ].map((s,i)=>(
                      <div key={i} className="admin-stat">
                        <div className="admin-stat-val" style={{color:s.color}}>{s.val}</div>
                        <div className="admin-stat-label">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>CONTRACTOR ACTIVITY</div>
                  {adminData.contractors.map((c,i)=>{
                    const cLeads = adminData.pipeline.filter(l=>l.user_id===c.id).length;
                    const cBids = adminData.bids.filter(b=>b.user_id===c.id).length;
                    const cWon = adminData.pipeline.filter(l=>l.user_id===c.id&&l.stage==="won").length;
                    const colors=["#e8560a","#2a7a52","#1a6fa8","#8b5e3c","#6a3a8a"];
                    return(
                      <div key={c.id} className="contractor-card">
                        <div className="contractor-avatar" style={{background:colors[i%colors.length]}}>
                          {(c.owner_name||c.company_name||"?")[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="contractor-name">{c.company_name||"Unnamed"}</div>
                          <div className="contractor-meta">{c.owner_name} · {c.city}, {c.state} · {c.email}</div>
                          <div className="contractor-meta" style={{marginTop:4}}>
                            <span style={{color:"var(--concrete)"}}>Plan: </span>
                            <span style={{fontWeight:700,color:"var(--orange2)"}}>{(c.plan||"starter").toUpperCase()}</span>
                            <span style={{marginLeft:8}}>Joined: {new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="contractor-stats">
                          <div><div className="contractor-stat-val">{cLeads}</div><div className="contractor-stat-lbl">Leads</div></div>
                          <div><div className="contractor-stat-val">{cWon}</div><div className="contractor-stat-lbl">Won</div></div>
                          <div><div className="contractor-stat-val">{cBids}</div><div className="contractor-stat-lbl">Bids Sent</div></div>
                        </div>
                      </div>
                    );
                  })}
                  {adminData.contractors.length===0&&(
                    <div style={{textAlign:"center",padding:"32px 20px"}}>
                      <div style={{fontSize:32,marginBottom:12,opacity:0.3}}>◈</div>
                      <div style={{fontSize:13,fontWeight:600,color:"var(--concrete)",marginBottom:6}}>No contractors yet</div>
                      <div style={{fontSize:11,color:"var(--stone)",marginBottom:16}}>Share invite code <strong style={{color:"var(--orange2)",fontFamily:"'DM Mono',monospace"}}>PAVE2026</strong> to onboard your first contractor</div>
                      <div style={{background:"rgba(232,86,10,0.08)",border:"1px solid rgba(232,86,10,0.2)",borderRadius:8,padding:"10px 16px",fontSize:12,color:"var(--orange2)",fontFamily:"'DM Mono',monospace",letterSpacing:2}}>PAVE2026</div>
                    </div>
                  )}
                </>
              )}

              {/* CONTRACTORS */}
              {adminView==="contractors"&&adminData.loaded&&(
                <>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>ALL CONTRACTORS ({adminData.contractors.length})</div>
                  <div className="admin-table">
                    <div className="admin-thead" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr"}}>
                      <div>Company</div><div>Email</div><div>City</div><div>Plan</div><div>Joined</div>
                    </div>
                    {adminData.contractors.map(c=>(
                      <div key={c.id} className="admin-row" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr"}}>
                        <div><div style={{fontWeight:600,color:"var(--cream)"}}>{c.company_name}</div><div style={{fontSize:10,color:"var(--stone)"}}>{c.owner_name}</div></div>
                        <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"var(--stone)"}}>{c.email}</div>
                        <div>{c.city}, {c.state}</div>
                        <div><span style={{background:"rgba(232,86,10,0.15)",color:"var(--orange2)",padding:"2px 8px",borderRadius:4,fontSize:10,fontWeight:700}}>{(c.plan||"starter").toUpperCase()}</span></div>
                        <div style={{fontSize:11}}>{new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                    ))}
                    {adminData.contractors.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--gravel)",fontSize:12}}>No contractors yet</div>}
                  </div>
                </>
              )}

              {/* PIPELINE */}
              {adminView==="pipeline"&&adminData.loaded&&(
                <>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>ALL PIPELINE LEADS ({adminData.pipeline.length})</div>
                  <div className="admin-table">
                    <div className="admin-thead" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr"}}>
                      <div>Address</div><div>Contractor</div><div>Stage</div><div>Bid</div><div>Date</div>
                    </div>
                    {adminData.pipeline.slice(0,100).map(l=>{
                      const stage=STAGES.find(s=>s.id===l.stage);
                      const contractor=adminData.contractors.find(c=>c.id===l.user_id);
                      return(
                        <div key={l.id} className="admin-row" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr 1fr"}}>
                          <div><div style={{fontWeight:600,color:"var(--cream)"}}>{l.address}</div><div style={{fontSize:10,color:"var(--stone)"}}>{l.city}</div></div>
                          <div style={{fontSize:11,color:"var(--stone)"}}>{contractor?.company_name||"Unknown"}</div>
                          <div><span style={{background:stage?.bg,color:stage?.color,padding:"2px 6px",borderRadius:4,fontSize:10,fontWeight:700}}>{stage?.icon} {stage?.label}</span></div>
                          <div style={{fontFamily:"'DM Mono',monospace",color:"var(--orange2)"}}>{l.bid_lo||"—"}</div>
                          <div style={{fontSize:11}}>{l.spotted||new Date(l.created_at).toLocaleDateString()}</div>
                        </div>
                      );
                    })}
                    {adminData.pipeline.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--gravel)",fontSize:12}}>No pipeline leads yet</div>}
                  </div>
                </>
              )}

              {/* SPOT BIDS */}
              {adminView==="bids"&&adminData.loaded&&(
                <>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>ALL SPOT BIDS ({adminData.bids.length})</div>
                  <div className="admin-table">
                    <div className="admin-thead" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr"}}>
                      <div>Address</div><div>Contractor</div><div>Bid</div><div>Date</div>
                    </div>
                    {adminData.bids.slice(0,100).map(b=>{
                      const contractor=adminData.contractors.find(c=>c.id===b.user_id);
                      return(
                        <div key={b.id} className="admin-row" style={{gridTemplateColumns:"2fr 1.5fr 1fr 1fr"}}>
                          <div><div style={{fontWeight:600,color:"var(--cream)"}}>{b.address}</div><div style={{fontSize:10,color:"var(--stone)"}}>{b.city}</div></div>
                          <div style={{fontSize:11,color:"var(--stone)"}}>{contractor?.company_name||"Unknown"}</div>
                          <div style={{fontFamily:"'DM Mono',monospace",color:"var(--orange2)"}}>{b.bid||"—"}</div>
                          <div style={{fontSize:11}}>{b.sent_date||new Date(b.created_at).toLocaleDateString()}</div>
                        </div>
                      );
                    })}
                    {adminData.bids.length===0&&<div style={{padding:"20px",textAlign:"center",color:"var(--gravel)",fontSize:12}}>No spot bids yet</div>}
                  </div>
                </>
              )}
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
                    Homeowner calls your QR code number → AI agent answers → qualifies the lead (name, address, service, timeline) → transfers live to your phone → call summary appears here automatically.
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:11,color:"var(--stone)"}}>
                  <div>📞 <strong style={{color:"var(--cream)"}}>AI Voice Agent</strong> · Standing by</div>
                  <div>🔄 <strong style={{color:"var(--cream)"}}>Live transfer</strong> · After qualification</div>
                  <div>📋 <strong style={{color:"var(--cream)"}}>Auto-logged</strong> · Every call</div>
                </div>
              </div>

              {/* Test call section */}
              <div style={{background:"var(--ink)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:10,padding:"16px 18px",marginBottom:20}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--cream)",marginBottom:8}}>🧪 Test the AI Agent</div>
                <div style={{fontSize:11,color:"var(--stone)",marginBottom:12}}>Enter a phone number and the AI agent will call it right now. Use your own cell to test the experience.</div>
                <div style={{display:"flex",gap:8}}>
                  <input
                    placeholder="(918) 000-0000" type="tel" inputMode="tel"
                    value={testCallNumber}
                    onChange={e=>setTestCallNumber(e.target.value)}
                    style={{flex:1,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(184,180,172,0.12)",borderRadius:7,padding:"10px 14px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:13,outline:"none"}}
                  />
                  <button
                    className="btn btn-primary"
                    disabled={testCallLoading||testCallNumber.length<10}
                    onClick={handleTestCall}
                  >
                    {testCallLoading?<span className="spin"/>:"📞 Test Call"}
                  </button>
                </div>
              </div>

              {/* Lead list */}
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1,color:"var(--concrete)",marginBottom:12}}>INBOUND LEADS FROM AI CALLS</div>
              {aiLeads.length===0&&(
                <div style={{padding:"32px 0",textAlign:"center",color:"var(--gravel)"}}>
                  <div style={{marginBottom:12,opacity:0.3}}><svg width="32" height="32" viewBox="0 0 32 32" fill="none"><path d="M6 6C6 6 8 4 11 4C13 4 14 6 15 8L16 11C16.4 12.2 16 13.6 15 14.4L13 16C14 18 16 20.6 18 22L20 20C21 19.2 22.4 19 23.6 19.4L27 21C29 22 30 23 30 25C30 28 27 31 27 31C22 36 6 19 6 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg></div>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--concrete)",marginBottom:6}}>No calls yet</div>
                  <div style={{fontSize:12,color:"var(--stone)",marginBottom:16}}>The AI agent answers calls 24/7 — test it with your own number above</div>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(42,122,82,0.1)",border:"1px solid rgba(42,122,82,0.25)",borderRadius:8,padding:"8px 14px",fontSize:11,color:"var(--green2)"}}>
                    <span>●</span> Agent standing by — waiting for first call
                  </div>
                </div>
              )}
              {aiLeads.map(lead=>(
                <div className="ai-lead-card" key={lead.id}>
                  <div className={`ai-lead-status`} style={{background:lead.status==="qualified"?"rgba(42,122,82,0.15)":lead.status==="pending"?"rgba(212,160,23,0.15)":"rgba(122,118,112,0.15)"}}>
                    {lead.status==="qualified"?"✅":lead.status==="pending"?"⏳":"❌"}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="ai-lead-name">{lead.caller}</div>
                    <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"var(--stone)",marginBottom:6}}>{lead.phone} · {lead.time}</div>
                    <div className="ai-lead-summary">{lead.summary}</div>
                    <div className="ai-lead-meta">
                      <span className={`ai-badge badge-${lead.status==="qualified"?"qualified":lead.status==="pending"?"pending":"not-qualified"}`}>
                        {lead.status==="qualified"?"✓ Qualified":lead.status==="pending"?"⏳ Pending":"✗ Not Qualified"}
                      </span>
                      {lead.service&&(
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,color:"var(--stone)"}}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="4" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.1"/><path d="M3 4V3C3 1.9 3.9 1 5 1C6.1 1 7 1.9 7 3V4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                        {lead.service}
                      </span>
                    )}
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
              {/* PIPELINE STATS */}
              <div className="pipeline-stats" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,padding:"16px 20px 0"}}>
                {(()=>{
                  const won=pipeline.filter(l=>l.stage==="won").length;
                  const total=pipeline.length;
                  const winRate=total>0?Math.round((won/total)*100):0;
                  return [{label:"In Play",value:pipeline.filter(l=>l.stage!=="won").length,color:"var(--cream)"},{label:"Win Rate",value:winRate+"%",color:won>0?"var(--green2)":"var(--stone)"},{label:"Jobs Won",value:won,color:"var(--green2)"},{label:"Pipeline Value",value:"$"+pipeline.reduce((s,l)=>s+(l.value||0),0).toLocaleString(),color:"var(--orange2)"}];
                })().map((s,i)=>(
                  <div key={i} style={{background:"var(--ink)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:s.color,lineHeight:1}}>{s.value}</div>
                    <div style={{fontSize:10,color:"var(--stone)",letterSpacing:1,textTransform:"uppercase",marginTop:3}}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:2,color:"var(--cream)",lineHeight:1}}>ADDRESS PIPELINE</div>
                  <div style={{fontSize:12,color:"var(--stone)",marginTop:3}}>{`Every address ${ACTIVE_COMPANY.name} `}LLC has spotted, mailed, or closed.</div>
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
                  <strong style={{color:"var(--orange2)",fontFamily:"'DM Mono',monospace"}}>${pipeline.reduce((s,l)=>s+l.value,0).toLocaleString()}</strong>
                </div>
              </div>

              {/* KANBAN VIEW */}
              {pipelineView==="kanban"&&(
                <div className="kanban">
                  {pipeline.length===0&&(
                    <div style={{gridColumn:"1/-1",padding:"48px 24px",textAlign:"center",color:"var(--gravel)"}}>
                      <div style={{fontSize:36,marginBottom:12}}>📍</div>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--concrete)",marginBottom:6}}>No leads yet</div>
                      <div style={{fontSize:12,color:"var(--stone)",marginBottom:16}}>Add an address from Spot Bid or tap + Log Address</div>
                      <button className="btn btn-primary" onClick={()=>setShowAddLead(true)}>+ Log First Address</button>
                    </div>
                  )}
                  {STAGES.map(stage=>{
                    const leads=pipeline.filter(l=>l.stage===stage.id);
                    const stageIdx=STAGES.findIndex(s=>s.id===stage.id);
                    const nextStage=STAGES[stageIdx+1];
                    const prevStage=STAGES[stageIdx-1];
                    return(
                      <div className="kanban-col" key={stage.id}>
                        <div className="kanban-head" style={{borderTop:`3px solid ${stage.color}`}}>
                          <span className="kanban-head-icon">{STAGE_ICONS[stage.id]}</span>
                          <span className="kanban-head-label" style={{color:stage.color}}>{stage.label}</span>
                          <span className="kanban-count">{leads.length}</span>
                        </div>
                        <div className="kanban-cards">
                          {leads.map(lead=>(
                            <div className="pl-card" key={lead.id}>
                              <div className="pl-card-addr">{lead.address}</div>
                              <div className="pl-card-city">{lead.neighborhood} · {lead.city}</div>
                              <div className="pl-card-bid">{lead.bidLo}{lead.bidHi&&<span className="pl-card-bid-range"> — {lead.bidHi}</span>}</div>
                              {/* Customer flags */}
              {lead.flags?.length>0&&(
                <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4,marginBottom:2}}>
                  {lead.flags.map(fid=>{
                    const f=LEAD_FLAGS.find(x=>x.id===fid);
                    return f?<span key={fid} className="lead-flag" style={{background:f.bg,color:f.color,border:`1px solid ${f.color}30`,display:"inline-flex",alignItems:"center",gap:3}}>{f.icon}{f.label}</span>:null;
                  })}
                </div>
              )}
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
                                    ◎ Spot Bid
                                  </button>
                                )}
                                <button className="pl-action-btn" style={{background:"rgba(184,180,172,0.07)",color:"var(--stone)"}} onClick={()=>setShowLeadDetail(lead.id)}>
                                  ⋯ Detail
                                </button>
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
                    <div style={{position:"absolute",top:"27%",left:"22%",fontSize:9,color:"rgba(184,180,172,0.3)",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>PEORIA AVE</div>
                    <div style={{position:"absolute",top:"62%",left:"42%",fontSize:9,color:"rgba(184,180,172,0.3)",fontFamily:"'DM Mono',monospace",letterSpacing:1,textTransform:"uppercase"}}>MEMORIAL DR</div>
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
                            <span style={{display:"inline-flex"}}>{STAGE_ICONS[lead.stage]}</span>
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

          {/* ADMIN */}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div className="settings-layout">
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4,flexWrap:"wrap",gap:10}}>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:2,color:"var(--cream)"}}>SETTINGS</div>
                <button className="btn btn-ghost btn-sm" onClick={handleLogout}>🔒 Sign Out</button>
              </div>
              <p style={{fontSize:13,color:"var(--stone)",marginBottom:26}}>{contractor?.company_name||ACTIVE_COMPANY.name} · {contractor?.city||ACTIVE_COMPANY.city}, {contractor?.state||ACTIVE_COMPANY.state} · {contractor?.phone||ACTIVE_COMPANY.phone}</p>

              {/* ── ADMIN ONLY: Production Checklist ── */}
              {isAdmin&&(
                <div className="settings-section">
                  <h3>Production Checklist</h3>
                  <div style={{fontSize:12,color:"var(--stone)",lineHeight:2.4}}>
                    <div>✅ <strong style={{color:"var(--cream)"}}>AI Mailer Generation</strong> — Live</div>
                    <div>✅ <strong style={{color:"var(--cream)"}}>QR Code Auto-Dial</strong> — On every mailer</div>
                    <div>✅ <strong style={{color:"var(--cream)"}}>Print & Mail API</strong> — Test mode connected</div>
                    <div>✅ <strong style={{color:"var(--cream)"}}>USPS Route Data</strong> — Live address counts</div>
                    <div>✅ <strong style={{color:"var(--cream)"}}>AI Phone Agent</strong> — Standing by</div>
                    <div>✅ <strong style={{color:"var(--cream)"}}>Error Monitoring</strong> — Active</div>
                    <div>✅ <strong style={{color:"var(--cream)"}}>Analytics</strong> — Tracking 11 events</div>
                    <div>🔧 <strong style={{color:"var(--orange2)"}}>Print & Mail Live Mode</strong> — Flip to live key when ready</div>
                    <div>🔧 <strong style={{color:"var(--orange2)"}}>Inbound Phone Number</strong> — Purchase ~$2/mo to activate</div>
                    <div>🔧 <strong style={{color:"var(--orange2)"}}>Billing</strong> — Per-contractor subscription pending</div>
                  </div>
                </div>
              )}

              {/* ── ALL CONTRACTORS: Company Info ── */}
              <div className="settings-section">
                <h3>Your Business</h3>
                <div style={{background:"rgba(232,86,10,0.07)",border:"1px solid rgba(232,86,10,0.18)",borderRadius:9,padding:"16px 18px",fontSize:13,lineHeight:2,color:"var(--concrete)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <rect x="1" y="6" width="12" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M4 6V4.5C4 2.8 5.3 1.5 7 1.5C8.7 1.5 10 2.8 10 4.5V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="3" y1="9" x2="5.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <line x1="3" y1="11" x2="4.5" y2="11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      <rect x="7.5" y="8" width="3" height="5" rx="0.5" fill="currentColor" opacity="0.5"/>
                    </svg>
                    <strong style={{color:"var(--cream)"}}>{ACTIVE_COMPANY.name}</strong>
                  </div>
                  <div>📞 <strong style={{color:"var(--cream)",fontFamily:"'DM Mono',monospace"}}>{ACTIVE_COMPANY.phone}</strong></div>
                  <div>✉️ <strong style={{color:"var(--cream)"}}>{ACTIVE_COMPANY.email}</strong></div>
                  <div>📍 <strong style={{color:"var(--cream)"}}>{ACTIVE_COMPANY.city}, {ACTIVE_COMPANY.state}</strong></div>
                  {ACTIVE_COMPANY.promo&&<div>🏷️ Promo Code: <strong style={{color:"var(--orange2)",fontFamily:"'DM Mono',monospace"}}>{ACTIVE_COMPANY.promo}</strong></div>}
                  <div style={{marginTop:12,display:"flex",alignItems:"center",gap:12}}>
                    <QRCode value={`tel:${ACTIVE_ACTIVE_COMPANY.phoneRaw}`} size={72}/>
                    <div style={{fontSize:11,color:"var(--stone)",lineHeight:1.8}}>Your QR code appears on every mailer<br/>Homeowners scan to call you instantly<br/>Works on all smartphones</div>
                  </div>
                </div>
              </div>

              {/* ── ALL CONTRACTORS: Notifications ── */}
              <div className="settings-section">
                <h3>Notifications & Automation</h3>
                {[
                  {key:"autoSend",label:"Auto-Send After Job Completion",desc:"Automatically mail neighbors when you finish a project in the area"},
                  {key:"weeklyReport",label:"Weekly Performance Report",desc:"Campaigns, calls, and ROI summary every Monday morning"},
                  {key:"trackOpens",label:"QR Code Scan Tracking",desc:"Know when homeowners scan your mailers and call"},
                  {key:"smsAlerts",label:"SMS Alerts",desc:"Get a text when your mail hits the neighborhood"},
                ].map(s=>(
                  <div className="setting-row" key={s.key}>
                    <div className="setting-info"><h4>{s.label}</h4><p>{s.desc}</p></div>
                    <button className={`toggle${settings[s.key]?" on":""}`} onClick={()=>setSettings(p=>({...p,[s.key]:!p[s.key]}))}/>
                  </div>
                ))}
              </div>

              {/* ── ALL CONTRACTORS: USPS Info ── */}
              <div className="settings-section">
                <h3>Mail Delivery</h3>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {label:"USPS Every Door Direct Mail",desc:"Neighborhood route data — real delivery counts for every ZIP",status:"live"},
                    {label:"Postcard Print & Mail",desc:"Physical 6x9 inch postcards printed and mailed to real addresses",status:"live"},
                    {label:"USPS Delivery Tracking",desc:"Know when your mail reaches the neighborhood",status:"soon"},
                  ].map((a,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(184,180,172,0.08)",borderRadius:8,padding:"12px 14px"}}>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"var(--cream)",marginBottom:2}}>{a.label}</div>
                        <div style={{fontSize:11,color:"var(--stone)"}}>{a.desc}</div>
                      </div>
                      <span style={{fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:12,flexShrink:0,marginLeft:12,
                        background:a.status==="live"?"rgba(42,122,82,0.15)":a.status==="soon"?"rgba(184,180,172,0.08)":"rgba(232,86,10,0.1)",
                        color:a.status==="live"?"var(--green2)":a.status==="soon"?"var(--stone)":"var(--orange2)"}}>
                        {a.status==="live"?"● Active":a.status==="soon"?"◌ Coming Soon":"◐ Demo"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* WON BANNER — radius mailer suggestion */}
      {wonBanner&&(
        <div className="won-banner">
          <div className="won-banner-icon"><svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M13 2L15.8 9.5H24L17.6 14.2L20.4 21.7L13 17L5.6 21.7L8.4 14.2L2 9.5H10.2L13 2Z" fill="#f9a825" stroke="#f9a825" strokeWidth="0.5" strokeLinejoin="round"/></svg></div>
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
                    <span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"var(--green2)",fontWeight:600}}>
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
                      <span style={{fontFamily:"'DM Mono',monospace",color:"var(--orange2)",fontWeight:600}}>${(Math.round(radiusForm.radius*5280/66)*1.25).toFixed(2)}</span>
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
                    placeholder="e.g. We just finished the Smiths' project — mention any special offer..."
                    value={radiusForm.message}
                    onChange={e=>setRadiusForm(f=>({...f,message:e.target.value}))}
                    style={{height:60}}
                  ></textarea>
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
                      YOUR NEIGHBOR AT {radiusMailer.address.toUpperCase()} JUST GOT A NEW PROJECT DONE
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
                      <div style={{fontSize:16,fontWeight:700,fontFamily:"'DM Mono',monospace"}}>${ACTIVE_COMPANY.phone}</div>
                    </div>
                    <p style={{marginTop:8,fontSize:10,color:"var(--gravel)"}}>{radiusMailer.urgencyLine}</p>
                  </div>
                </div>

                <div style={{background:"rgba(0,0,0,0.2)",borderRadius:8,padding:"12px 14px",marginBottom:14,fontSize:12,color:"var(--stone)"}}>
                  Sending to <strong style={{color:"var(--cream)"}}>~{Math.round(radiusForm.radius*5280/66)} homes</strong> within <strong style={{color:"var(--green2)"}}>{radiusForm.radius} miles</strong> of {radiusMailer.address} · Est. cost <strong style={{color:"var(--orange2)",fontFamily:"'DM Mono',monospace"}}>${(Math.round(radiusForm.radius*5280/66)*1.25).toFixed(2)}</strong>
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

      {/* SPOT BID HISTORY PREVIEW */}
      {showHistoryPreview&&previewJob&&(
        <div className="modal-overlay" onClick={e=>{if(e.target.className==="modal-overlay")setShowHistoryPreview(false);}}>
          <div className="modal-box" style={{maxWidth:560,padding:0,overflow:"hidden"}}>
            {/* Header */}
            <div style={{padding:"16px 20px",background:"var(--ink)",borderBottom:"1px solid rgba(184,180,172,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:"var(--cream)"}}>POSTCARD PREVIEW</div>
                <div style={{fontSize:11,color:"var(--stone)",marginTop:2}}>{previewJob.address} · {previewJob.city} · Sent {previewJob.sent}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={()=>setShowHistoryPreview(false)}>✕ Close</button>
            </div>

            {/* Front of card */}
            <div style={{padding:"16px 20px 8px"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--stone)",marginBottom:8}}>Front of Postcard</div>
              <div style={{borderRadius:8,overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.4)"}}>
                {historyCanvasUrl ? (
                  <img src={historyCanvasUrl} alt="Postcard front" style={{width:"100%",height:"auto",aspectRatio:"600/320",display:"block"}}/>
                ) : (previewJob.photoUrl) ? (
                  <div style={{position:"relative",aspectRatio:"600/320",background:"#111009",overflow:"hidden"}}>
                    <img src={previewJob.photoUrl} alt="project photo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,rgba(10,9,8,0.3),rgba(10,9,8,0.95))"}}/>
                    <div style={{position:"absolute",bottom:16,left:16,right:16}}>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"#f5f0e6",marginBottom:6}}>{previewJob.mailerContent?.headline||"Your Personalized Estimate"}</div>
                      <div style={{background:"rgba(232,86,10,0.2)",border:"1px solid rgba(232,86,10,0.4)",borderRadius:6,padding:"8px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{fontSize:9,color:"rgba(232,86,10,0.8)",fontWeight:700,letterSpacing:1}}>YOUR ESTIMATE<br/><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#f5f0e6"}}>{previewJob.bid}</span></div>
                        <div style={{background:"#e8560a",padding:"6px 10px",borderRadius:5,textAlign:"center"}}>
                          <div style={{fontSize:8,fontWeight:700,color:"white"}}>CALL NOW</div>
                          <div style={{fontSize:11,fontFamily:"'DM Mono',monospace",color:"white"}}>{ACTIVE_COMPANY.phone}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{aspectRatio:"600/320",background:"linear-gradient(145deg,#1c1a17,#111009)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:"#f5f0e6",letterSpacing:1}}>{previewJob.mailerContent?.headline||previewJob.address}</div>
                    <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:"var(--orange)"}}>Estimate: {previewJob.bid}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Back of card summary */}
            <div style={{padding:"8px 20px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"var(--stone)",marginBottom:8}}>Back of Postcard</div>
              <div style={{background:"linear-gradient(145deg,#1a1814,#0e0d0b)",borderRadius:8,overflow:"hidden"}}>
                <div style={{background:"linear-gradient(90deg,rgba(232,86,10,0.15),rgba(232,86,10,0.05))",borderBottom:"1px solid rgba(232,86,10,0.2)",padding:"10px 14px"}}>
                  <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:2,color:"#f5f0e6"}}>
                    {previewJob.damage?.length>0?"We Noticed Issues With Your Concrete":"Your Property Qualifies for a Free Estimate"}
                  </div>
                  <div style={{fontSize:9,color:"rgba(184,180,172,0.5)",marginTop:2,letterSpacing:1,textTransform:"uppercase"}}>{previewJob.address} · {previewJob.city}, OK</div>
                </div>
                <div style={{padding:"12px 14px"}}>
                  {previewJob.damage?.length>0&&(
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:8,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"#8a8680",marginBottom:6}}>What We Observed</div>
                      {previewJob.damage.slice(0,3).map((d,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:"#9a9690",marginBottom:4}}>
                          <div style={{width:5,height:5,borderRadius:"50%",background:"rgba(232,86,10,0.6)",flexShrink:0}}/>
                          {d}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderLeft:"3px solid rgba(232,86,10,0.7)",borderRadius:6,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:8,fontWeight:700,letterSpacing:2,textTransform:"uppercase",color:"rgba(232,86,10,0.7)"}}>Your Estimate</div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:"#f5f0e6"}}>{previewJob.bid}</div>
                    </div>
                    <QRCode value={`tel:${ACTIVE_ACTIVE_COMPANY.phoneRaw}`} size={44} fgColor="#f5f0e6" bgColor="#1a1814"/>
                  </div>
                  <div style={{background:"rgba(232,86,10,0.1)",border:"1px solid rgba(232,86,10,0.2)",borderLeft:"3px solid rgba(232,86,10,0.6)",borderRadius:6,padding:"10px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:15,letterSpacing:1,color:"#f5f0e6"}}>CALL OR TEXT {ACTIVE_COMPANY.ownerName.toUpperCase()}</div>
                      <div style={{fontSize:10,color:"rgba(184,180,172,0.5)",fontFamily:"'DM Mono',monospace"}}>{ACTIVE_COMPANY.phone} · Free estimate · No obligation</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lob ID if available */}
            {previewJob.lob&&(
              <div style={{padding:"0 20px 16px"}}>
                <div style={{fontSize:10,color:"var(--gravel)",fontFamily:"'DM Mono',monospace"}}>Lob ID: {previewJob.lob} · <a href={`https://dashboard.lob.com`} target="_blank" rel="noreferrer" style={{color:"var(--blue2)"}}>View in Lob Dashboard ↗</a></div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEAD DETAIL MODAL */}
      {showLeadDetail&&(()=>{
        const lead = pipeline.find(l=>l.id===showLeadDetail);
        if(!lead) return null;
        const stage = STAGES.find(s=>s.id===lead.stage);
        const tulsaAddr = encodeURIComponent(`${lead.address}, ${lead.city}, OK`);
        const countyUrl = `https://www.assessor.tulsacounty.org/assessor-property-search.php?strap=${tulsaAddr}`;
        const cssPortalUrl = `https://tulsaok-energovweb.tylerhost.net/apps/selfservice#/search?q=${encodeURIComponent(lead.address)}`;
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(`${lead.address} ${lead.city} OK property lien record`)}`;
        const toggleFlag = (fid) => {
          const flags = lead.flags||[];
          const next = flags.includes(fid) ? flags.filter(f=>f!==fid) : [...flags,fid];
          setPipeline(p=>p.map(l=>l.id===lead.id?{...l,flags:next}:l));
          db.updateLeadStage(lead.id, lead.stage).catch(()=>{});
        };
        return(
          <div className="modal-overlay" onClick={e=>{if(e.target.className==="modal-overlay")setShowLeadDetail(null);}}>
            <div className="lead-detail-modal">

              {/* HEADER */}
              <div className="lead-detail-header">
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                  <div style={{flex:1}}>
                    <div className="lead-detail-addr">{lead.address}</div>
                    <div className="lead-detail-sub">{lead.city}, OK · {lead.neighborhood}</div>
                  </div>
                  <button onClick={()=>setShowLeadDetail(null)} style={{background:"none",border:"none",color:"var(--stone)",fontSize:18,cursor:"pointer",padding:"0 0 0 8px",lineHeight:1,flexShrink:0}}>✕</button>
                </div>
                {/* Stage + bid inline */}
                <div style={{display:"flex",alignItems:"center",gap:8,marginTop:12,flexWrap:"wrap"}}>
                  <span style={{background:stage?.bg,color:stage?.color,padding:"3px 10px",borderRadius:12,fontSize:10,fontWeight:700}}>
                    {stage?.label}
                  </span>
                  {lead.bidLo&&<span style={{fontFamily:"'DM Mono',monospace",fontSize:13,color:"var(--orange2)",fontWeight:600}}>{lead.bidLo}{lead.bidHi&&<span style={{opacity:0.6}}> — {lead.bidHi}</span>}</span>}
                  {lead.flags?.map(fid=>{
                    const f=LEAD_FLAGS.find(x=>x.id===fid);
                    return f?<span key={fid} className="lead-flag" style={{background:f.bg,color:f.color,border:`1px solid ${f.color}30`,display:"inline-flex",alignItems:"center",gap:3}}>{f.icon}{f.label}</span>:null;
                  })}
                </div>
              </div>

              {/* TIMELINE */}
              <div className="lead-detail-section">
                <div className="lead-detail-label">Timeline</div>
                <div style={{display:"flex",gap:0,position:"relative"}}>
                  <div style={{position:"absolute",top:10,left:10,right:10,height:1,background:"rgba(184,180,172,0.1)",zIndex:0}}/>
                  {[
                    {label:"Spotted",date:lead.spotted,done:!!lead.spotted},
                    {label:"Mailer",date:lead.mailerSent,done:!!lead.mailerSent},
                    {label:"Called",date:lead.calledBack,done:!!lead.calledBack},
                    {label:"Won",date:lead.jobWon,done:!!lead.jobWon},
                  ].map((t,i)=>(
                    <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,position:"relative",zIndex:1}}>
                      <div style={{width:20,height:20,borderRadius:"50%",border:`2px solid ${t.done?"var(--orange)":"rgba(184,180,172,0.2)"}`,background:t.done?"var(--orange)":"var(--ink)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {t.done&&<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{fontSize:9,color:t.done?"var(--concrete)":"var(--gravel)",fontWeight:t.done?600:400,textAlign:"center"}}>{t.label}</div>
                      {t.date&&<div style={{fontSize:8,color:"var(--stone)",fontFamily:"'DM Mono',monospace"}}>{t.date}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* NOTES */}
              <div className="lead-detail-section">
                <div className="lead-detail-label">Notes</div>
                <textarea
                  value={lead.notes||""}
                  onChange={e=>setPipeline(p=>p.map(l=>l.id===lead.id?{...l,notes:e.target.value}:l))}
                  placeholder="Add notes about this property or customer..."
                  style={{width:"100%",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(184,180,172,0.1)",borderRadius:8,padding:"10px 12px",color:"var(--cream)",fontFamily:"'Syne',sans-serif",fontSize:12,resize:"vertical",minHeight:72,outline:"none",boxSizing:"border-box",lineHeight:1.6}}
                ></textarea>
              </div>

              {/* CUSTOMER FLAGS */}
              <div className="lead-detail-section">
                <div className="lead-detail-label">Customer Intelligence</div>
                <div className="flag-picker">
                  {LEAD_FLAGS.map(f=>{
                    const active=(lead.flags||[]).includes(f.id);
                    return(
                      <button key={f.id} className="flag-picker-btn"
                        onClick={()=>toggleFlag(f.id)}
                        style={{
                          borderColor: active ? f.color : "rgba(184,180,172,0.15)",
                          background: active ? f.bg : "transparent",
                          color: active ? f.color : "var(--stone)",
                        }}
                        title={f.desc}
                      >
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                        {active&&<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PROPERTY INTELLIGENCE */}
              <div className="lead-detail-section">
                <div className="lead-detail-label">Property Research</div>
                <button className="county-btn" onClick={()=>window.open(`https://assessor.tulsacounty.org/assessor-property-search.php?q=${encodeURIComponent(lead.address)}`, "_blank")}>
                  <div className="county-btn-icon" style={{background:"rgba(26,111,168,0.12)"}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="12" height="12" rx="2" stroke="#1a6fa8" strokeWidth="1.2"/><line x1="4" y1="4.5" x2="10" y2="4.5" stroke="#1a6fa8" strokeWidth="1.2" strokeLinecap="round"/><line x1="4" y1="7" x2="10" y2="7" stroke="#1a6fa8" strokeWidth="1.2" strokeLinecap="round"/><line x1="4" y1="9.5" x2="7" y2="9.5" stroke="#1a6fa8" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <div style={{fontWeight:600,color:"var(--cream)",marginBottom:1}}>Tulsa County Assessor</div>
                    <div style={{fontSize:10,color:"var(--stone)"}}>Ownership, assessed value, tax status</div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:"auto",flexShrink:0,opacity:0.4}}><path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="county-btn" onClick={()=>window.open(cssPortalUrl,"_blank")}>
                  <div className="county-btn-icon" style={{background:"rgba(232,86,10,0.1)"}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4.2 1 2 3.2 2 6C2 8.5 4 11 7 13C10 11 12 8.5 12 6C12 3.2 9.8 1 7 1Z" stroke="#e8560a" strokeWidth="1.2"/><circle cx="7" cy="6" r="1.5" fill="#e8560a" opacity="0.8"/></svg>
                  </div>
                  <div>
                    <div style={{fontWeight:600,color:"var(--cream)",marginBottom:1}}>Tulsa Permit History</div>
                    <div style={{fontSize:10,color:"var(--stone)"}}>Building permits, violations, inspections</div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:"auto",flexShrink:0,opacity:0.4}}><path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="county-btn" onClick={()=>window.open(googleUrl,"_blank")}>
                  <div className="county-btn-icon" style={{background:"rgba(139,47,201,0.1)"}}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2V4M7 10V12M2 7H4M10 7H12M3.5 3.5L4.9 4.9M9.1 9.1L10.5 10.5M3.5 10.5L4.9 9.1M9.1 4.9L10.5 3.5" stroke="#8b2fc9" strokeWidth="1.2" strokeLinecap="round"/><circle cx="7" cy="7" r="2" stroke="#8b2fc9" strokeWidth="1.2"/></svg>
                  </div>
                  <div>
                    <div style={{fontWeight:600,color:"var(--cream)",marginBottom:1}}>Search Liens & Records</div>
                    <div style={{fontSize:10,color:"var(--stone)"}}>Google: liens, judgments, foreclosure records</div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{marginLeft:"auto",flexShrink:0,opacity:0.4}}><path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>

              {/* QUICK ACTIONS */}
              <div className="lead-detail-section">
                <div className="lead-detail-label">Quick Actions</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {lead.stage!=="won"&&<button className="btn btn-primary btn-sm" onClick={()=>{moveStage(lead.id,"won");setShowLeadDetail(null);}}>✦ Mark Won</button>}
                  {lead.stage==="spotted"&&<button className="btn btn-ghost btn-sm" onClick={()=>{setSpotForm(f=>({...f,address:lead.address,city:lead.city,neighborhood:lead.neighborhood}));setTab("spotbid");setShowLeadDetail(null);}}>◎ Create Spot Bid</button>}
                  {lead.stage==="won"&&<button className="btn btn-ghost btn-sm" onClick={()=>{setRadiusLead(lead);setRadiusStep(1);setRadiusMailer(null);setShowRadiusModal(true);setShowLeadDetail(null);}}>◫ Radius Mailer</button>}
                  <button className="btn btn-ghost btn-sm" onClick={()=>{if(window.confirm("Delete this lead?"))setPipeline(p=>p.filter(l=>l.id!==lead.id));setShowLeadDetail(null);}}>✕ Delete</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
              <div className="field"><label>Bid Low ($)</label><input type="number" placeholder="800" inputMode="numeric" value={newLead.bidLow} onChange={e=>setNewLead(f=>({...f,bidLow:e.target.value}))}/></div>
              <div className="field"><label>Bid High ($)</label><input type="number" placeholder="1400" inputMode="numeric" value={newLead.bidHigh} onChange={e=>setNewLead(f=>({...f,bidHigh:e.target.value}))}/></div>
            </div>
            <div className="field"><label>Notes</label><textarea placeholder="e.g. Saw severe cracking from the road, large 2-car" value={newLead.notes} onChange={e=>setNewLead(f=>({...f,notes:e.target.value}))}></textarea></div>
            <div style={{display:"flex",gap:8,marginTop:4}}>
              <button className="btn btn-primary" style={{flex:1}} onClick={addLead} disabled={!newLead.address}>📍 Add to Pipeline</button>
              <button className="btn btn-ghost" onClick={()=>setShowAddLead(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
