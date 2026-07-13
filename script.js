// ── Project data ──────────────────────────────────────────────────────────────

const PROJECTS = [
  {
    num: '01',
    title: '灵活规划',
    tagline: '持续规划，而非一次生成',
    h3: '计划生成之后，世界就变了',
    desc: '传统日程工具的问题不是记录，而是计划生成之后，世界就变了。LLM 负责理解与拆解自然语言任务，规则状态机负责排期与重排——因为时间数据容不得歧义。每日反馈作为状态输入，驱动局部重排，而不是重新生成整份计划。',
    status: '2026.7 冻结版',
    github: 'https://github.com/lllllbbbbbxxx/ai-schedule-butler',
    caseUrl: './replan.html',
    cover: './assets/covers/replan.jpg',
    tags: ['LangGraph', 'FastAPI', 'React', 'PostgreSQL', 'OpenAI API'],
    link: '查看完整案例 →'
  },
  {
    num: '02',
    title: '书签助手',
    tagline: '让收藏再次被用上 · 零迁移',
    h3: '收藏的瞬间，遗忘就开始了',
    desc: '把浏览器书签变成可对话的知识库：自动聚类、语义搜索、RAG 问答；Chrome 扩展直接读现有书签，零迁移成本。我关心的不是收纳，是「再次被用上」。',
    status: '核心链路跑通 · 聚类优化中',
    github: 'https://github.com/lllllbbbbbxxx/bookmark',
    caseUrl: './bookmark.html',
    cover: './assets/covers/bookmark.jpg',
    tags: ['Chrome Extension', 'Python', 'BGE-M3', 'LLM'],
    link: '查看项目详情 →'
  },
  {
    num: '03',
    title: '随手做菜',
    tagline: '库存驱动的做饭决策 · 微信小程序',
    h3: '「有食材但不知道做什么」是每天的决策疲劳',
    desc: '微信小程序：库存管理、OCR 入库、按现有食材推荐。定位不是炫技 AI，是帮普通人真的每天做饭。',
    status: 'MVP · 朋友内测中',
    github: 'https://github.com/lllllbbbbbxxx/recipe',
    caseUrl: './recipe.html',
    cover: './assets/covers/recipe.jpg',
    tags: ['微信小程序', '云开发', '腾讯云 OCR', '数据埋点'],
    link: '查看项目详情 →'
  }
];

// ── DOM refs ──────────────────────────────────────────────────────────────────

const story      = document.querySelector('.scroll-story');
const orbitWrap  = document.querySelector('[data-orbit-wrap]');
const dial       = document.querySelector('[data-dial]');
const scrollHint = document.querySelector('[data-scroll-hint]');
const trackItems = [...document.querySelectorAll('[data-track-item]')];
const trackDot   = document.querySelector('[data-track-dot]');
const navItems   = [...document.querySelectorAll('.top-nav a')];

// hero ↔ demo morph
const heroBlock    = document.querySelector('[data-hero-block]');
const demoBlock    = document.querySelector('[data-demo-block]');
const demoStrip    = document.querySelector('[data-demo-strip]');
const demoViewport = document.querySelector('.demo-viewport');
const openDetail   = document.querySelector('[data-open-detail]');
const DEMO_GAP     = 56;   // px gap between demo cards (matches .demo-strip gap)

// disc extras
const discThumb  = document.querySelector('[data-disc-thumb]');
const wedgeEl    = document.querySelector('[data-wedge]');
const wedgePathEl = document.querySelector('[data-wedge-path]');

// sticky note tags
const stickyTags = [...document.querySelectorAll('.sticky-tags li')];

const NUM_PROJECTS  = 3;
const HERO_END      = 0.14;   // hero fully faded, browsing begins
const PROJECTS_END  = 0.92;
const RIGHT_SHIFT   = 26;      // % the ring slides right in browse state
const DOT_R         = 0.30;    // ring radius (fraction of disc) the dot/wedge tip rides on
const LABEL_R       = 0.42;    // arc radius the project labels sit on
const SLOT_ANGLE    = 24 * Math.PI / 180;  // angular gap between adjacent projects
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Demo carousel slides ──────────────────────────────────────────────────────

function buildDemoSlides() {
  if (!demoStrip) return;
  demoStrip.innerHTML = PROJECTS.map(p => `
    <div class="demo-slide">
      <span class="demo-proj-tag">${p.num} · ${p.title}</span>
      ${p.cover
        ? `<img class="demo-cover" src="${p.cover}" alt="${p.title} 封面" loading="lazy" />`
        : `<span class="demo-proj-tag" style="position:static">${p.title}</span>`}
    </div>`).join('');
}
buildDemoSlides();

// ── Utilities ─────────────────────────────────────────────────────────────────

function clamp(v, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, v));
}

function smoothstep(t) {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
}

// ── Project detail rendering ──────────────────────────────────────────────────

function renderProject(index) {
  const p = PROJECTS[index];
  if (!p) return;

  // disc center: project cover if provided, else the green placeholder blob
  if (discThumb) {
    discThumb.style.backgroundImage = p.cover ? `url("${p.cover}")` : '';
    discThumb.classList.toggle('has-cover', !!p.cover);
  }

  // sticky note tags
  const tags = p.tags.slice(0, 3);
  stickyTags.forEach((li, i) => { li.textContent = tags[i] || ''; });
}

// ── Rotating dial: labels ride the left arc, selected sits at 9 o'clock ────────

// Place every label along the ring's left arc. `fpos` is the continuous active
// position (0..N-1); the item at off=0 lands at 9 o'clock (the selected slot),
// and scrolling advances fpos so items rotate up through that slot.
// `focus` 0 → even hero spread (all labels equal); 1 → browse, faded by distance
function layoutTrack(fpos, focus = 1) {
  if (!orbitWrap) return;
  const wr = orbitWrap.getBoundingClientRect();
  if (wr.width < 2) return;
  const cx = wr.width / 2, cy = wr.height / 2;
  const R  = wr.width * LABEL_R;

  trackItems.forEach((el, i) => {
    const off   = i - fpos;
    const theta = Math.PI - off * SLOT_ANGLE;          // 180° (9 o'clock) at off 0
    el.style.left = `${(cx + R * Math.cos(theta)).toFixed(1)}px`;
    el.style.top  = `${(cy + R * Math.sin(theta)).toFixed(1)}px`;
    const faded   = Math.max(0.14, 1 - Math.abs(off) * 0.34);
    const opacity = 0.6 * (1 - focus) + faded * focus;  // even → distance-faded
    el.style.opacity = opacity.toFixed(2);
    el.style.zIndex  = String(20 - Math.round(Math.abs(off) * 3));
  });
}

// Annular-sector path (two arcs + two radii) — the curved wedge
function sectorPath(cx, cy, rIn, rOut, a0, a1) {
  const P = (r, a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  return `M ${P(rOut, a0)} A ${rOut} ${rOut} 0 0 1 ${P(rOut, a1)} ` +
         `L ${P(rIn, a1)} A ${rIn} ${rIn} 0 0 0 ${P(rIn, a0)} Z`;
}

// The dot + wedge live permanently at the 9-o'clock slot (selected is centred).
function placeSelection() {
  if (!orbitWrap) return;
  const wr = orbitWrap.getBoundingClientRect();
  if (wr.width < 2) return;
  const cx = wr.width / 2, cy = wr.height / 2;
  const Rdot = wr.width * DOT_R;
  const Rlab = wr.width * LABEL_R;

  if (trackDot) {
    const ds = trackDot.offsetWidth || 15;
    trackDot.style.left = `${cx - Rdot - ds / 2}px`;
    trackDot.style.top  = `${cy - ds / 2}px`;
  }
  if (wedgePathEl) {
    const half = 12 * Math.PI / 180;
    const rOut = wr.width * 0.65;   // reaches left past the enlarged active title
    wedgePathEl.setAttribute('d',
      sectorPath(cx, cy, Rdot - 2, rOut, Math.PI - half, Math.PI + half));
  }
}

let lastIndex = -2;   // -2 = uninitialised, -1 = hero (no selection)

function setActiveIndex(index) {
  if (index === lastIndex) return;
  lastIndex = index;

  const selected = index >= 0;
  trackItems.forEach((el, i) => el.classList.toggle('active', i === index));

  trackDot?.classList.toggle('is-on', selected);
  wedgeEl?.classList.toggle('is-on', selected);
  discThumb?.classList.add('is-on');   // centre always shows: green blob on hero, cover when browsing

  if (selected) {
    renderProject(index);              // sets the project cover (or blob if none)
  } else if (discThumb) {
    discThumb.classList.remove('has-cover');   // hero → green blob
    discThumb.style.backgroundImage = '';
  }
}

// ── Scroll driver ─────────────────────────────────────────────────────────────

function updateStory() {
  if (!story) return;

  const rect       = story.getBoundingClientRect();
  const scrollable = Math.max(1, rect.height - window.innerHeight);
  const progress   = clamp(-rect.top / scrollable);

  // Hero → demo crossfade
  const heroFade = smoothstep((progress - 0.02) / (HERO_END - 0.02));
  if (heroBlock) {
    heroBlock.style.opacity   = (1 - heroFade).toFixed(3);
    heroBlock.style.transform = `translateY(calc(-50% - ${(heroFade * 22).toFixed(1)}px))`;
  }
  if (demoBlock) {
    demoBlock.style.opacity       = heroFade.toFixed(3);
    demoBlock.style.transform     = `translateY(calc(-50% + ${((1 - heroFade) * 22).toFixed(1)}px))`;
    demoBlock.style.pointerEvents = heroFade > 0.6 ? 'auto' : 'none';
  }

  scrollHint?.classList.toggle('is-hidden', progress > 0.03);

  // Dial position & focus.
  //  · hero  (progress 0 → HERO_END): even spread, project 03 centred, no highlight,
  //    rotating toward project 01 so browsing begins on 01.
  //  · browse (HERO_END → PROJECTS_END): fpos 0 → N-1, distance-faded, highlight on.
  const mid = (NUM_PROJECTS - 1) / 2;
  let fpos, focus, idx;
  if (progress >= HERO_END) {
    const pp = clamp((progress - HERO_END) / (PROJECTS_END - HERO_END));
    fpos  = pp * (NUM_PROJECTS - 1);
    focus = 1;
    idx   = clamp(Math.round(fpos), 0, NUM_PROJECTS - 1);
  } else {
    const h = clamp(progress / HERO_END);        // 0 → 1 across the hero zone
    fpos  = mid * (1 - h);                        // 2 → 0
    focus = h;                                    // even spread → focused
    // switch the highlight on as project 01 settles into the centre, so the
    // wedge/dot/cover are present even if the snap lands just shy of HERO_END
    idx   = fpos < 0.18 ? 0 : -1;
  }
  layoutTrack(fpos, focus);
  placeSelection();
  setActiveIndex(idx);

  // Demo carousel: the whole framed card slides through, active one centred.
  // During the hero zone it stays parked on project 01 (just fades in) instead of
  // riding the ring's spread→01 rotation, so the first demo doesn't slide down.
  const demoFpos = progress < HERO_END ? 0 : fpos;
  if (demoStrip && demoViewport) {
    const vpW  = demoViewport.clientWidth;
    const vpH  = demoViewport.clientHeight;
    const cardH = vpW * 10 / 16;             // slide aspect is 16/10
    const pitch = cardH + DEMO_GAP;
    const ty = vpH / 2 - cardH / 2 - demoFpos * pitch;
    demoStrip.style.transform = `translateY(${ty.toFixed(1)}px)`;
    const cards = demoStrip.children;
    for (let i = 0; i < cards.length; i++) {
      const off = i - demoFpos;
      cards[i].style.opacity = clamp(1 - off * off, 0, 1).toFixed(3);
    }
  }

  // Ring exit at the very end
  const exitRaw   = clamp((progress - PROJECTS_END) / (1 - PROJECTS_END));
  const exitEased = smoothstep(exitRaw);
  if (orbitWrap) {
    orbitWrap.style.opacity   = (1 - exitEased).toFixed(3);
    const shiftX = reduced ? 0 : (heroFade * RIGHT_SHIFT + exitEased * 10);
    orbitWrap.style.transform = `translateX(${shiftX.toFixed(1)}%)`;
  }

  navItems.forEach(el => el.classList.remove('active'));
  if (progress < PROJECTS_END) navItems[0]?.classList.add('active'); // Systems
}

// ── Case File overlay ─────────────────────────────────────────────────────────

// Structure per PRD §8.3. Section bodies come from 项目档案.md (loaded at runtime),
// keyed by the Chinese section name `k` — edit that file to update the content.
const CASE_SECTIONS = [
  { n: '01', en: 'Problem',    k: '问题' },
  { n: '02', en: 'Context',    k: '背景' },
  { n: '03', en: 'User',       k: '用户' },
  { n: '04', en: 'Workflow',   k: '工作流程' },
  { n: '05', en: 'Tech',       k: '技术方案' },
  { n: '06', en: 'Prompt',     k: 'Prompt 设计' },
  { n: '07', en: 'Eval',       k: '评估方法' },
  { n: '08', en: 'Reflection', k: '反思' },
];

// Per-project case-file text, parsed from 项目档案.md at runtime.
let caseData = {};

function parseCaseFiles(md) {
  const data = {};
  md.split(/^##\s+/m).slice(1).forEach(block => {
    const nl = block.indexOf('\n');
    const header = (nl < 0 ? block : block.slice(0, nl)).trim();   // e.g. "01 灵活规划"
    const num = (header.match(/^(\d{2})/) || [])[1];
    if (!num) return;
    const sections = {};
    block.split(/^###\s+/m).slice(1).forEach(sec => {
      const snl = sec.indexOf('\n');
      const name = (snl < 0 ? sec : sec.slice(0, snl)).trim();
      const body = (snl < 0 ? '' : sec.slice(snl + 1)).trim();
      sections[name] = body;
    });
    data[num] = sections;
  });
  return data;
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// cache-bust so edits to 项目档案.md show up on a normal reload
fetch(encodeURI('./项目档案.md') + '?t=' + Date.now(), { cache: 'no-store' })
  .then(r => r.ok ? r.text() : Promise.reject(r.status))
  .then(t => { caseData = parseCaseFiles(t); })
  .catch(() => { /* fall back to the built-in placeholder */ });

const casefile   = document.querySelector('[data-casefile]');
const cfPanel     = document.querySelector('[data-cf-panel]');
const cfSections  = document.querySelector('[data-cf-sections]');
const cfLines     = document.querySelector('[data-cf-lines]');
const cfTag       = document.querySelector('[data-cf-tag]');
const cfGh        = document.querySelector('[data-cf-gh]');
const cfCover     = document.querySelector('[data-cf-cover]');
const cfFull      = document.querySelector('[data-cf-full]');
const cfCloseEls  = [...document.querySelectorAll('[data-cf-close]')];
const SVGNS       = 'http://www.w3.org/2000/svg';

function buildCaseSections(num) {
  if (!cfSections) return;
  const proj = caseData[num] || {};
  cfSections.innerHTML = CASE_SECTIONS.map(s => {
    const raw  = (proj[s.k] || '').trim() || '（内容加载中——也可直接点下方「查看完整档案」）';
    const body = escapeHtml(raw).replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
    return `
    <article class="cf-sec" data-cf-sec>
      <div class="cf-sec-head"><span class="cf-sec-n">${s.n}</span><span class="cf-sec-en">${s.en}</span></div>
      <h3 class="cf-sec-title">${s.k}</h3>
      <p class="cf-sec-body">${body}</p>
    </article>`;
  }).join('');
}

// Thin connectors from the demo out to each case-file section
function drawLines(animate = true) {
  if (!cfPanel || !cfLines || !cfSections) return;
  const frame = cfPanel.querySelector('.cf-demo-frame');
  if (!frame) return;
  const panel = cfPanel.getBoundingClientRect();
  const demo  = frame.getBoundingClientRect();
  if (panel.width < 2) return;

  const x1 = demo.right - panel.left;
  const y1 = demo.top + demo.height / 2 - panel.top;

  cfLines.setAttribute('viewBox', `0 0 ${panel.width} ${panel.height}`);
  while (cfLines.firstChild) cfLines.removeChild(cfLines.firstChild);

  const secs = [...cfSections.querySelectorAll('[data-cf-sec]')];
  secs.forEach((sec, i) => {
    const r  = sec.getBoundingClientRect();
    const x2 = r.left - panel.left;
    const y2 = r.top + r.height / 2 - panel.top;
    // skip sections scrolled out of the panel
    if (y2 < -20 || y2 > panel.height + 20) return;
    const mx = x1 + (x2 - x1) * 0.5;
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', 'cf-line');
    cfLines.appendChild(path);
    if (animate && !reduced) {
      const len = path.getTotalLength();
      path.style.strokeDasharray  = len;
      path.style.strokeDashoffset = len;
      requestAnimationFrame(() => {
        path.style.transition = `stroke-dashoffset 520ms ${120 + i * 55}ms var(--ease-out)`;
        path.style.strokeDashoffset = '0';
      });
    }
  });

  const hub = document.createElementNS(SVGNS, 'circle');
  hub.setAttribute('cx', x1);
  hub.setAttribute('cy', y1);
  hub.setAttribute('r', '4');
  hub.setAttribute('class', 'cf-line-hub');
  cfLines.appendChild(hub);
}

let cfTimers = [];
function clearCfTimers() { cfTimers.forEach(clearTimeout); cfTimers = []; }

function openCaseFile() {
  if (!casefile) return;
  clearCfTimers();

  const p = PROJECTS[lastIndex >= 0 ? lastIndex : 0];
  if (cfTag) cfTag.textContent = `${p.num} · ${p.title}`;
  if (cfGh) {
    cfGh.href = p.github || '#';
    cfGh.style.display = p.github ? '' : 'none';
  }
  if (cfFull) {
    cfFull.href = p.caseUrl || '#';
    cfFull.style.display = p.caseUrl ? '' : 'none';
  }
  if (cfCover) {
    cfCover.src = p.cover || '';
    cfCover.style.display = p.cover ? '' : 'none';
  }
  buildCaseSections(p.num);   // rebuild for the current project (content differs)

  // capture the active browse card as the FLIP source before the overlay opens
  const activeCard = demoStrip?.children[lastIndex >= 0 ? lastIndex : 0];
  const source = activeCard?.getBoundingClientRect();

  casefile.classList.add('is-open');
  casefile.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const frame = cfPanel?.querySelector('.cf-demo-frame');

  const connect = () => {
    casefile.classList.add('cf-connected');   // reveal sections (staggered)
    drawLines(true);                           // grow the connecting lines
  };

  if (frame && source && source.width > 2 && !reduced) {
    // FLIP: start the frame exactly where the browse demo is, then animate to rest
    const target = frame.getBoundingClientRect();
    const dx = source.left - target.left;
    const dy = source.top  - target.top;
    const sx = source.width  / target.width;
    const sy = source.height / target.height;
    frame.style.transition = 'none';
    frame.style.transform  = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    void frame.offsetWidth;                    // commit the start state
    requestAnimationFrame(() => {
      frame.style.transition = 'transform 480ms var(--ease-out)';
      frame.style.transform  = 'none';         // → shrink/slide into place
    });
    cfTimers.push(setTimeout(connect, 500));    // lines + sections after it settles
  } else {
    connect();
    requestAnimationFrame(() => requestAnimationFrame(() => drawLines(true)));
  }
}

function closeCaseFile() {
  if (!casefile) return;
  clearCfTimers();

  const frame = cfPanel?.querySelector('.cf-demo-frame');
  const activeCard = demoStrip?.children[lastIndex >= 0 ? lastIndex : 0];
  const dest  = activeCard?.getBoundingClientRect();

  // sections + lines leave first
  casefile.classList.remove('cf-connected');

  const hardHide = () => {
    casefile.classList.remove('is-open');
    casefile.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (frame) { frame.style.transition = ''; frame.style.transform = ''; }
  };

  if (frame && dest && dest.width > 2 && !reduced) {
    // reverse FLIP: grow the archive frame back to the browse demo, then fade out
    const cur = frame.getBoundingClientRect();
    const dx = dest.left - cur.left;
    const dy = dest.top  - cur.top;
    const sx = dest.width  / cur.width;
    const sy = dest.height / cur.height;
    frame.style.transition = 'transform 420ms var(--ease-out)';
    frame.style.transform  = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    // start the scrim fade as the frame nears the browse position…
    cfTimers.push(setTimeout(() => {
      casefile.classList.remove('is-open');
      casefile.setAttribute('aria-hidden', 'true');
    }, 260));
    // …then clean up transform only once fully hidden
    cfTimers.push(setTimeout(() => {
      document.body.style.overflow = '';
      if (frame) { frame.style.transition = ''; frame.style.transform = ''; }
    }, 620));
  } else {
    hardHide();
  }
}

openDetail?.addEventListener('click', e => { e.preventDefault(); openCaseFile(); });
cfCloseEls.forEach(el => el.addEventListener('click', closeCaseFile));
cfSections?.addEventListener('scroll', () => {
  if (casefile?.classList.contains('cf-connected')) drawLines(false);
}, { passive: true });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && casefile?.classList.contains('is-open')) closeCaseFile();
});
window.addEventListener('resize', () => {
  if (casefile?.classList.contains('cf-connected')) drawLines(false);
});

// ── Hero CTA: enter the Systems browse zone (project 01 snap point) ───────────

document.querySelector('[data-explore]')?.addEventListener('click', e => {
  e.preventDefault();
  if (!story) return;
  const max = story.offsetHeight - window.innerHeight;
  window.scrollTo({ top: story.offsetTop + max * HERO_END, behavior: 'smooth' });
});

// ── Nav smooth scroll ─────────────────────────────────────────────────────────

navItems.forEach(item => {
  item.addEventListener('click', e => {
    const t = item.dataset.navTarget;
    if (!t) return;               // 真实链接（子页面）→ 交给浏览器正常跳转
    e.preventDefault();
    if (!story) return;
    const max = story.offsetHeight - window.innerHeight;
    let top;
    if (t === 'systems') {
      top = story.offsetTop;
    } else {
      const el = document.getElementById(t);
      top = el ? el.offsetTop : story.offsetTop + max;
    }
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

// ── Track item click ──────────────────────────────────────────────────────────

trackItems.forEach((item, i) => {
  item.addEventListener('click', () => {
    if (!story) return;
    const max = story.offsetHeight - window.innerHeight;
    // scroll so project i lands at the centred (selected) slot: fpos === i
    const targetProgress = HERO_END + (i / (NUM_PROJECTS - 1)) * (PROJECTS_END - HERO_END);
    window.scrollTo({ top: story.offsetTop + max * targetProgress, behavior: 'smooth' });
  });
});

// ── Scroll reveal ─────────────────────────────────────────────────────────────

if (!reduced) {
  const revealTargets = [...document.querySelectorAll('.portal-grid article')];

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.07 });

  revealTargets.forEach((el, i) => {
    el.classList.add('reveal-item');
    el.style.transitionDelay = `${i * 70}ms`;
    revealObserver.observe(el);
  });
}

// ── Live clock ────────────────────────────────────────────────────────────────

function updateClock() {
  const el = document.getElementById('live-time');
  if (!el) return;
  el.textContent = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Shanghai'
  });
}
updateClock();
setInterval(updateClock, 30000);

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('scroll', updateStory, { passive: true });
window.addEventListener('resize', updateStory);
updateStory();
// re-run once fonts settle so label widths/positions are exact
window.addEventListener('load', updateStory);

// ── Auto-snap: settle on the nearest project when scrolling stops ──────────────
let snapTimer = null;
function snapToNearest() {
  if (!story || casefile?.classList.contains('is-open')) return;
  const rect = story.getBoundingClientRect();
  const scrollable = Math.max(1, rect.height - window.innerHeight);
  const progress = clamp(-rect.top / scrollable);
  if (progress < HERO_END || progress > PROJECTS_END) return;   // only inside the browse zone
  const pp = clamp((progress - HERO_END) / (PROJECTS_END - HERO_END));
  const nearest = clamp(Math.round(pp * (NUM_PROJECTS - 1)), 0, NUM_PROJECTS - 1);
  const targetProgress = HERO_END + (nearest / (NUM_PROJECTS - 1)) * (PROJECTS_END - HERO_END);
  const targetY = story.offsetTop + scrollable * targetProgress;
  if (Math.abs(window.scrollY - targetY) > 6) {
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
}
if (!reduced) {
  window.addEventListener('scroll', () => {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(snapToNearest, 160);
  }, { passive: true });
}
