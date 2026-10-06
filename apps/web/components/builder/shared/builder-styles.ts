/**
 * Shared builder stylesheet — Amber's Alchemy Apothecary.
 *
 * Extracted verbatim from components/builder/SoapBuilder.tsx (the soap
 * ritual's BUILDER_CSS) so every builder shares one visual language.
 * The formula-builder sections are appended at the end, marked above.
 * SoapBuilder imports BUILDER_CSS from here — no duplication.
 */
export const BUILDER_CSS = `
.builder-root{--bg:#140b26;--bg2:#1c1133;--surface:#221741;--surface2:#2a1c4e;--gold:#c9a24b;--gold-soft:#e3c87e;--gold-dim:#8a6f35;--cream:#f5eedc;--cream-dim:#d9cdb2;--muted:#b3a3d6;--radius:14px;background:var(--bg);color:var(--cream);font-family:"Segoe UI",system-ui,-apple-system,sans-serif;line-height:1.6;min-height:100vh}
.builder-root h1,.builder-root h2,.builder-root h3,.builder-root h4{font-family:Georgia,serif;font-weight:600;line-height:1.3}
.builder-root .wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.builder-header{position:sticky;top:0;z-index:50;background:rgba(20,11,38,.94);backdrop-filter:blur(8px);border-bottom:1px solid rgba(201,162,75,.25)}
.builder-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px}
.builder-root .brand{font-family:Georgia,serif;font-size:1.2rem;color:var(--gold-soft);text-decoration:none}
.builder-root .nav{display:flex;gap:16px}
.builder-root .nav a{color:var(--cream-dim);text-decoration:none;font-size:.92rem}
.progress{padding:22px 0 6px}
.progress ol{display:flex;list-style:none;justify-content:center;gap:4px;flex-wrap:wrap;padding:0}
.progress li{display:flex;align-items:center;font-size:.82rem;color:var(--muted);padding:8px 10px;border-radius:999px;border:1px solid transparent}
.progress .n{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--gold-dim);display:inline-flex;align-items:center;justify-content:center;font-size:.78rem;margin-right:8px;flex:none}
.progress li.done{color:var(--cream-dim)}
.progress li.done .n{background:var(--gold);border-color:var(--gold);color:#1c1133;font-weight:700}
.progress li.now{color:var(--gold-soft);border-color:rgba(201,162,75,.5);background:rgba(201,162,75,.08)}
.progress li.now .n{border-color:var(--gold-soft);box-shadow:0 0 10px rgba(201,162,75,.6)}
.progress-btn{background:none;border:none;color:inherit;font:inherit;cursor:pointer;display:flex;align-items:center;padding:0}
.progress-btn:focus-visible,.builder-root button:focus-visible,.builder-root input:focus-visible,.builder-root select:focus-visible,.builder-root a:focus-visible{outline:2px solid var(--gold-soft);outline-offset:2px}
.bundle-banner{background:linear-gradient(135deg,rgba(201,162,75,.18),rgba(201,162,75,.05));border:1.5px solid var(--gold);border-radius:var(--radius);padding:16px;margin-bottom:20px;text-align:center}
.builder{display:grid;gap:26px;grid-template-columns:1fr;padding:26px 0 60px}
@media(min-width:960px){.builder{grid-template-columns:1.35fr .9fr;align-items:start}}
.step-panel{background:var(--surface);border:1px solid rgba(201,162,75,.22);border-radius:18px;padding:28px;min-height:420px}
.step-panel h2{font-size:clamp(1.4rem,3.5vw,1.9rem);color:var(--gold-soft);margin-bottom:6px}
.step-panel h2:focus{outline:none}
.step-panel .sub{color:var(--muted);font-size:.95rem;margin-bottom:20px}
.preview-panel{position:sticky;top:86px;background:var(--bg2);border:1px solid rgba(201,162,75,.25);border-radius:18px;padding:22px;text-align:center}
@media(max-width:959px){.preview-panel{position:static;order:-1}}
.preview-panel h3{color:var(--gold-soft);margin-bottom:8px;font-size:1.05rem}
.preview-panel svg{width:100%;max-width:340px;margin:0 auto;display:block}
.preview-cap{font-size:.82rem;color:var(--muted);margin-top:10px}
.scent-caption{margin-top:10px;font-size:.95rem;color:var(--gold-soft);font-family:Georgia,serif;font-style:italic;min-height:1.6em}
.pick-grid{display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.pick-grid.bases{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}
.pick-grid.compact{grid-template-columns:repeat(auto-fill,minmax(130px,1fr))}
.pick{position:relative;background:var(--surface2);border:2px solid rgba(201,162,75,.2);border-radius:var(--radius);padding:16px 12px;cursor:pointer;text-align:center;color:var(--cream);font-family:inherit;font-size:.92rem;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;gap:6px;min-height:44px}
.pick:hover{border-color:rgba(201,162,75,.6);transform:translateY(-2px)}
.pick[aria-pressed="true"]{border-color:var(--gold-soft);box-shadow:0 0 0 2px rgba(227,200,126,.35),0 6px 18px rgba(0,0,0,.4)}
.pick:disabled{opacity:.45;cursor:not-allowed;transform:none}
.pick .p-name{font-weight:700;color:var(--cream)}
.pick .p-sub{font-size:.8rem;color:var(--muted)}
.pick .p-hint{font-size:.8rem;color:var(--gold-soft)}
.pick .p-price{color:var(--gold-soft);font-weight:700;margin-top:4px}
.pick.scent{text-align:left;padding:14px}
.pick.scent .p-sens{font-size:.82rem;color:var(--cream-dim);font-style:italic}
.pick.scent .p-safety{font-size:.78rem;color:#e3a87e}
.swatch-mini{height:34px;border-radius:8px;margin-bottom:8px;border:1px solid rgba(255,255,255,.15);display:block}
.tabs{display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap}
.tab{background:transparent;border:1.5px solid var(--gold-dim);color:var(--cream-dim);border-radius:999px;padding:10px 20px;font-size:.95rem;cursor:pointer;font-family:inherit;min-height:44px}
.tab[aria-selected="true"]{background:rgba(201,162,75,.15);border-color:var(--gold-soft);color:var(--gold-soft);font-weight:700}
.seasonal-card{display:block;width:100%;text-align:left;background:linear-gradient(135deg,rgba(201,162,75,.22),rgba(201,162,75,.06));border:1.5px solid var(--gold);border-radius:var(--radius);padding:16px;margin-bottom:20px;cursor:pointer;color:var(--cream);font-family:inherit}
.seasonal-card .seasonal-badge{display:inline-block;background:var(--gold);color:#1c1133;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em;border-radius:999px;padding:3px 10px;margin-bottom:8px}
.seasonal-card .p-name{display:block;font-weight:700;font-size:1.05rem;color:var(--gold-soft)}
.seasonal-card .p-sub{display:block;font-size:.9rem;color:var(--cream-dim);margin-top:4px}
.honesty-note{display:block;font-size:.8rem;color:var(--muted);margin-top:10px;font-style:italic}
.proposed-note{border-left:3px solid var(--gold);padding-left:12px}
.blend-display{background:var(--bg2);border:1px solid rgba(201,162,75,.3);border-radius:var(--radius);padding:16px;margin:16px 0;min-height:90px}
.blend-display h4{color:var(--gold-soft);font-size:1.05rem;margin-bottom:4px}
.blend-display .oils{font-weight:700}
.blend-display .tags{color:var(--muted);font-size:.9rem;margin-top:4px}
.blend-hint{font-size:.85rem;color:var(--muted)}
.blend-hint .gold,.gold{color:var(--gold-soft)}
.oil-chip{display:inline-flex;align-items:center;gap:8px;margin:5px;padding:9px 14px 9px 9px;border-radius:999px;border:1.5px solid rgba(201,162,75,.3);background:var(--surface2);color:var(--cream);cursor:pointer;font-size:.9rem;font-family:inherit;min-height:44px}
.oil-chip .dot{width:24px;height:24px;border-radius:50%;flex:none;border:1px solid rgba(255,255,255,.25);background:radial-gradient(circle at 35% 35%,var(--gold-soft),var(--gold-dim))}
.oil-chip[aria-pressed="true"]{border-color:var(--gold-soft);background:rgba(201,162,75,.15)}
.oil-chip:disabled{opacity:.4;cursor:not-allowed}
.color-grid{display:flex;flex-wrap:wrap;gap:12px}
.color-btn{width:56px;height:56px;border-radius:50%;border:3px solid transparent;cursor:pointer;position:relative;padding:0;min-width:56px;min-height:56px}
.color-btn[aria-pressed="true"]{border-color:var(--gold-soft);box-shadow:0 0 0 3px rgba(227,200,126,.35)}
.color-btn.custom{background:conic-gradient(#B0303C,#E8C95C,#2E7D5B,#3B6EA5,#A78BDA,#B0303C);overflow:hidden}
.color-btn.custom input{opacity:0;width:100%;height:100%;cursor:pointer}
.color-name{text-align:center;margin-top:14px;color:var(--gold-soft);font-weight:700;min-height:1.6em}
.color-note{font-size:.85rem;color:var(--muted);margin-top:10px;text-align:center}
.step-nav{display:flex;justify-content:space-between;gap:12px;margin-top:26px}
.btn{display:inline-block;background:linear-gradient(135deg,var(--gold),#a8823a);color:#1c1133;font-weight:700;text-decoration:none;padding:13px 30px;border-radius:999px;border:none;cursor:pointer;font-size:1rem;font-family:inherit;min-height:44px}
.btn:disabled{opacity:.4;cursor:not-allowed}
.btn.ghost{background:transparent;color:var(--gold-soft);border:1.5px solid var(--gold)}
.hint{font-size:.85rem;color:var(--muted);margin-top:10px;text-align:center}
.reveal{text-align:center}
.summary-title{color:var(--gold-soft);margin:18px 0 6px}
.summary{background:var(--bg2);border:1px solid rgba(201,162,75,.3);border-radius:var(--radius);padding:20px;text-align:left;margin:20px 0;font-size:.98rem}
.summary dt{color:var(--gold);font-size:.78rem;text-transform:uppercase;letter-spacing:.12em;margin-top:12px}
.summary dd{margin:2px 0 0;color:var(--cream)}
.summary dd.price{font-size:1.4rem;color:var(--gold-soft);font-weight:800}
.safety-note{color:#e3a87e;font-size:.9rem}
.maker-notes{font-size:.85rem;color:var(--muted);text-align:left;background:rgba(201,162,75,.06);border-radius:10px;padding:12px 16px;margin:16px 0}
.cart-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:8px;align-items:center}
.qty-label{display:flex;align-items:center;gap:8px;color:var(--cream-dim)}
.qty-label input{width:64px;padding:8px;border-radius:8px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:1rem}
details.payload{margin:18px 0;text-align:left}
details.payload summary{cursor:pointer;color:var(--gold-soft)}
details.payload pre{background:#0d0718;border-radius:10px;padding:16px;overflow:auto;font-size:.78rem;color:#cfe3cf;margin-top:10px}
.form-error{color:#e3a87e;font-size:.9rem;margin-top:12px}
.bundle-config h3{color:var(--gold-soft);margin:18px 0 6px}
.bundle-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0;align-items:center}
.slot-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin:16px 0}
.slot{background:var(--bg2);border:1px solid rgba(201,162,75,.25);border-radius:var(--radius);padding:14px;font-size:.88rem;text-align:left}
.slot h4{color:var(--gold-soft);font-size:.95rem;margin-bottom:6px}
.slot p{margin:4px 0}
.slot .tags{color:var(--muted);font-size:.82rem}
.slot button{background:none;border:1px solid var(--gold-dim);color:var(--gold-soft);border-radius:999px;padding:8px 16px;cursor:pointer;font-size:.82rem;margin-top:8px;font-family:inherit;min-height:44px}
.slot-editor label{display:block;font-size:.8rem;color:var(--muted);margin-top:10px}
.slot-editor select{width:100%;margin:4px 0 8px;padding:10px;border-radius:8px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:.9rem;min-height:44px}
.slot-editor .pick-grid{margin-top:8px}
.custom-color-row{display:flex!important;align-items:center;gap:10px}
.custom-color-row input{width:44px;height:44px;padding:0;border:none;background:none;cursor:pointer}
.bundle-totals{margin:18px 0}
.price-row{display:flex;justify-content:center;align-items:baseline;gap:14px;margin:14px 0;flex-wrap:wrap}
.price-row .struck{text-decoration:line-through;color:var(--muted)}
.bundle-price{font-size:2rem;font-weight:800;color:var(--gold-soft)}
.save-badge{background:#2E7D5B;color:#fff;font-size:.8rem;font-weight:700;padding:5px 12px;border-radius:999px}
.builder-footer{border-top:1px solid rgba(201,162,75,.25);padding:26px 0;text-align:center;color:var(--muted);font-size:.88rem}
@media(prefers-reduced-motion:reduce){.builder-root *{transition:none!important;animation:none!important}}
`
export const FORMULA_BUILDER_CSS = BUILDER_CSS + "\n/* ---- custom formula builders (G2 capsules, G10 tea) ---- */\n.herb-tools{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}\n.herb-tools input[type=search]{flex:2;min-width:200px;padding:12px 14px;border-radius:10px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:.95rem;font-family:inherit;min-height:44px}\n.herb-tools select{flex:1;min-width:160px;padding:12px;border-radius:10px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:.95rem;font-family:inherit;min-height:44px}\n.herb-count{font-size:.85rem;color:var(--muted);margin-bottom:10px}\n.herb-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}\n.herb-card{position:relative;background:var(--surface2);border:2px solid rgba(201,162,75,.2);border-radius:var(--radius);padding:14px;cursor:pointer;text-align:left;color:var(--cream);font-family:inherit;font-size:.9rem;transition:border-color .15s,transform .15s;display:flex;flex-direction:column;gap:6px;min-height:44px;width:100%}\n.herb-card:hover{border-color:rgba(201,162,75,.6);transform:translateY(-2px)}\n.herb-card[aria-pressed=true]{border-color:var(--gold-soft);box-shadow:0 0 0 2px rgba(227,200,126,.35),0 6px 18px rgba(0,0,0,.4)}\n.herb-card:disabled{opacity:.45;cursor:not-allowed;transform:none}\n.herb-card .h-emoji{font-size:1.6rem}\n.herb-card .h-name{font-weight:700;color:var(--cream)}\n.herb-card .h-latin{font-size:.78rem;color:var(--muted);font-style:italic}\n.herb-card .h-cats{display:flex;gap:6px;flex-wrap:wrap}\n.herb-card .h-cat{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--gold-soft);border:1px solid rgba(201,162,75,.4);border-radius:999px;padding:2px 8px}\n.herb-card .h-note{font-size:.82rem;color:var(--cream-dim)}\n.herb-card .h-price{font-size:.8rem;color:var(--gold-soft);font-weight:700;margin-top:auto}\n.herb-card .h-check{position:absolute;top:10px;right:10px;width:26px;height:26px;border-radius:50%;background:var(--gold);color:#1c1133;font-weight:800;display:none;align-items:center;justify-content:center;font-size:.85rem}\n.herb-card[aria-pressed=true] .h-check{display:inline-flex}\n.safety-list{display:flex;flex-direction:column;gap:12px;margin:16px 0;text-align:left}\n.safety-flag{border-radius:var(--radius);padding:14px 16px;border:1.5px solid;font-size:.9rem}\n.safety-flag .s-title{font-weight:700;display:block;margin-bottom:4px}\n.safety-flag .s-detail{color:var(--cream-dim);font-size:.86rem}\n.safety-flag .s-herbs{font-size:.78rem;color:var(--muted);margin-top:6px;font-style:italic}\n.safety-flag.info{border-color:rgba(167,139,218,.5);background:rgba(167,139,218,.08)}\n.safety-flag.info .s-title{color:#c9b8ea}\n.safety-flag.review{border-color:rgba(201,162,75,.6);background:rgba(201,162,75,.08)}\n.safety-flag.review .s-title{color:var(--gold-soft)}\n.safety-flag.caution{border-color:#e3a87e;background:rgba(227,168,126,.08)}\n.safety-flag.caution .s-title{color:#e3a87e}\n.safety-ack{display:flex;gap:12px;align-items:flex-start;background:var(--bg2);border:1px solid rgba(201,162,75,.3);border-radius:var(--radius);padding:16px;margin:16px 0;text-align:left;cursor:pointer;font-size:.92rem}\n.safety-ack input{width:22px;height:22px;margin-top:2px;flex:none;accent-color:var(--gold)}\n.field{margin:14px 0;text-align:left}\n.field label{display:block;font-size:.82rem;color:var(--gold);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px}\n.field input[type=text],.field textarea{width:100%;padding:12px 14px;border-radius:10px;background:var(--surface2);color:var(--cream);border:1px solid var(--gold-dim);font-size:.95rem;font-family:inherit}\n.field textarea{min-height:88px;resize:vertical}\n.field .f-hint{font-size:.78rem;color:var(--muted);margin-top:4px}\n.verify-note{border-left:3px solid var(--gold);padding:10px 14px;background:rgba(201,162,75,.07);border-radius:0 10px 10px 0;font-size:.85rem;color:var(--cream-dim);margin:16px 0;text-align:left}\n.price-breakdown{background:var(--bg2);border:1px solid rgba(201,162,75,.3);border-radius:var(--radius);padding:16px;margin:16px 0;font-size:.92rem;text-align:left}\n.price-breakdown .pb-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;color:var(--cream-dim)}\n.price-breakdown .pb-total{display:flex;justify-content:space-between;gap:10px;padding-top:10px;margin-top:8px;border-top:1px solid rgba(201,162,75,.3);font-weight:800;color:var(--gold-soft);font-size:1.1rem}\n.disclaimer{font-size:.8rem;color:var(--muted);margin-top:14px}\n.builder-title{font-size:clamp(1.8rem,4vw,2.6rem);color:var(--gold-soft);text-align:center;margin:34px 0 8px}.builder-lede{text-align:center;color:var(--muted);max-width:640px;margin:0 auto 8px}.preview-herbs{list-style:none;padding:0;margin:12px 0;text-align:left;font-size:.9rem;display:flex;flex-direction:column;gap:6px;max-height:260px;overflow:auto}.preview-herbs li{background:var(--surface2);border:1px solid rgba(201,162,75,.2);border-radius:8px;padding:6px 10px}";
