/*
 * EWC motion system. GSAP + ScrollTrigger (+ Flip for the nav pill).
 * One file. Sections opt in with data-animation-trigger="<name>" on their root.
 * Fail-open: if anything is missing, or reduced motion is on, the page stays static and complete.
 */
(function () {
  "use strict";

  var W = window,
    doc = document,
    html = doc.documentElement;

  function failOpen() {
    html.classList.add("gsap-not-found");
  }

  if (
    !W.gsap ||
    !W.ScrollTrigger ||
    (W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    failOpen();
    return;
  }
  if (html.classList.contains("gsap-not-found")) return; // footer failsafe already fired
  if (W.__ewcMotion) return;
  W.__ewcMotion = true;

  var gsap = W.gsap,
    ScrollTrigger = W.ScrollTrigger,
    Flip = W.Flip;

  gsap.registerPlugin(ScrollTrigger);
  if (Flip) gsap.registerPlugin(Flip);
  gsap.config({ nullTargetWarn: false });

  /* ------------------------------------------------------------------ utils */

  function $(sel, ctx) {
    return (ctx || doc).querySelector(sel);
  }
  function $$(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }

  var remCache = 0;
  function rem() {
    return remCache || (remCache = parseFloat(getComputedStyle(html).fontSize) || 16);
  }
  function narrow(el, em) {
    return el.getBoundingClientRect().width < em * rem();
  }
  var resizeTimer;
  W.addEventListener("resize", function () {
    remCache = 0;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      remCache = 0;
    }, 100);
  });

  // Never animate the same thing from CSS and GSAP: kill transitions on targets while tweening.
  var CLEAR = "transform,opacity,transition,overflow,clipPath";
  function list(t) {
    return gsap.utils.toArray(t).filter(Boolean);
  }
  function quiet(els) {
    els.forEach(function (e) {
      e.style.transition = "none";
    });
  }

  /* --------------------------------------------------------- injected styles */

  var style = doc.createElement("style");
  style.setAttribute("data-ewc-motion", "");
  style.textContent =
    ".word-mask{overflow:hidden;display:inline-block;vertical-align:top;padding-bottom:.15em;margin-bottom:-.15em}" +
    ".word-inner{display:inline-block}" +
    ".ewc-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}";
  doc.head.appendChild(style);

  /* ------------------------------------------------- shared motion vocabulary */

  function splitWords(el) {
    if (!el) return [];
    if (el.hasAttribute("data-split")) return el.__words || [];
    var label = el.textContent.replace(/\s+/g, " ").trim();
    if (!label) return [];
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT),
      nodes = [],
      n,
      inners = [];
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(function (t) {
      var parts = t.nodeValue.split(/(\s+)/),
        frag = doc.createDocumentFragment();
      parts.forEach(function (p) {
        if (!p) return;
        if (/^\s+$/.test(p)) {
          frag.appendChild(doc.createTextNode(" "));
          return;
        }
        // split after hyphens too ("Whole-Body"): adjacent masks keep the break opportunity
        p.match(/[^-]+-?|-/g).forEach(function (w) {
          var m = doc.createElement("span"),
            i = doc.createElement("span");
          m.className = "word-mask";
          m.setAttribute("aria-hidden", "true");
          i.className = "word-inner";
          i.textContent = w;
          m.appendChild(i);
          frag.appendChild(m);
          inners.push(i);
        });
      });
      t.parentNode.replaceChild(frag, t);
    });
    if (/^H[1-6]$/.test(el.tagName)) {
      el.setAttribute("aria-label", label);
    } else {
      var sr = doc.createElement("span");
      sr.className = "ewc-sr";
      sr.textContent = label;
      el.insertBefore(sr, el.firstChild);
    }
    el.setAttribute("data-split", "");
    el.__words = inners;
    return inners;
  }

  function riseWords(tl, el, at) {
    var words = splitWords(el);
    if (!words.length) return;
    tl.from(
      words,
      {
        yPercent: 115,
        rotate: 3,
        duration: 0.9,
        stagger: words.length > 18 ? { amount: 0.7 } : 0.04,
        ease: "power4.out",
        clearProps: "transform"
      },
      at
    );
  }

  function rise(tl, targets, at, ease, stagger) {
    var els = list(targets);
    if (!els.length) return;
    quiet(els);
    tl.from(
      els,
      {
        opacity: 0,
        y: 14,
        duration: 0.6,
        stagger: stagger || 0,
        ease: ease || "power2.out",
        clearProps: CLEAR
      },
      at
    );
  }

  function landButtons(tl, targets, at) {
    var els = list(targets);
    if (!els.length) return;
    quiet(els);
    tl.from(
      els,
      {
        opacity: 0,
        y: 10,
        duration: 0.5,
        stagger: 0.08,
        ease: "back.out(1.4)",
        clearProps: CLEAR
      },
      at
    );
  }

  function radiusOf(els) {
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      var r = getComputedStyle(els[i]).borderTopLeftRadius;
      if (parseFloat(r) > 0) return r;
    }
    return "1rem";
  }

  // Opens toward the wrap's outer edge. Percent units throughout so GSAP can interpolate.
  function wipeImage(tl, wrap, at) {
    if (!wrap) return;
    var img = wrap.tagName === "IMG" ? null : $("img", wrap),
      r = wrap.getBoundingClientRect(),
      off = (r.left + r.width / 2 - W.innerWidth / 2) / W.innerWidth,
      dir = Math.abs(off) < 0.12 ? "down" : off > 0 ? "right" : "left",
      rad = "round " + radiusOf([wrap, img || wrap]),
      open = "inset(-10% -10% -10% -10% " + rad + ")",
      closed = {
        right: "inset(-10% 110% -10% -10% " + rad + ")",
        left: "inset(-10% -10% -10% 110% " + rad + ")",
        down: "inset(-10% -10% 110% -10% " + rad + ")"
      }[dir];
    quiet([wrap]);
    wrap.style.overflow = "hidden";
    tl.fromTo(
      wrap,
      { clipPath: closed },
      { clipPath: open, duration: 1.2, ease: "power4.inOut", clearProps: "clipPath,overflow,transition" },
      at
    );
    if (img) {
      var drift = dir === "right" ? -6 : dir === "left" ? 6 : 0;
      tl.fromTo(
        img,
        { scale: 1.15, xPercent: drift, yPercent: dir === "down" ? -6 : 0 },
        { scale: 1, xPercent: 0, yPercent: 0, duration: 1.2, ease: "power4.inOut", clearProps: "transform" },
        at
      );
    }
  }

  // Dividers draw left to right, small marks draw from the top.
  function draw(tl, targets, at, axis) {
    var els = list(targets);
    if (!els.length) return;
    quiet(els);
    var v = { duration: 0.9, ease: "power3.inOut", clearProps: CLEAR };
    if (axis === "y") {
      v.scaleY = 0;
      v.transformOrigin = "50% 0%";
    } else {
      v.scaleX = 0;
      v.transformOrigin = "0% 50%";
    }
    tl.from(els, v, at);
  }

  /* ------------------------------------------------------------ reveal engine */

  var pending = [],
    pollTimer = 0,
    pollTicks = 0;

  function pctOf(start) {
    var m = /(\d+)%/.exec(start || "");
    return m ? parseFloat(m[1]) / 100 : 0.8;
  }

  function settle(rec, toEnd) {
    if (rec.done) return;
    rec.done = true;
    var i = pending.indexOf(rec);
    if (i > -1) pending.splice(i, 1);
    if (toEnd) rec.tl.progress(1);
    else rec.tl.play();
    // GSAP 3.15 can refresh and kill mid-loop when once:true is used. Kill it ourselves, one tick later.
    gsap.delayedCall(0, function () {
      try {
        rec.st && rec.st.kill();
      } catch (e) {}
    });
  }

  function check(rec) {
    if (rec.done) return;
    var trusted = rec.checks > 0; // first check may run before layout above has settled
    rec.checks++;
    var r = rec.root.getBoundingClientRect();
    var atBottom = W.scrollY + W.innerHeight >= doc.documentElement.scrollHeight - 2;
    if (trusted && r.bottom <= 0) settle(rec, true);
    else if (r.bottom > 0 && (r.top < W.innerHeight * rec.frac || (atBottom && r.top < W.innerHeight))) settle(rec, false);
  }

  function poll() {
    if (pollTimer) return;
    function run() {
      for (var i = pending.length - 1; i >= 0; i--) check(pending[i]);
      if (!pending.length) {
        clearInterval(pollTimer);
        pollTimer = 0;
        return;
      }
      pollTicks++;
      if (pollTicks === 20) {
        clearInterval(pollTimer);
        pollTimer = setInterval(run, 750);
      }
    }
    pollTicks = 0;
    pollTimer = setInterval(run, 150);
  }

  function revealSectionOnScroll(root, tl, start) {
    start = start || "top 80%";
    var rec = { root: root, tl: tl, done: false, checks: 0, frac: pctOf(start), st: null };
    pending.push(rec);
    rec.st = ScrollTrigger.create({
      trigger: root,
      start: "clamp(" + start + ")", // last sections on short pages can never reach the line otherwise
      onEnter: function () {
        settle(rec, false);
      },
      onEnterBack: function () {
        settle(rec, false);
      },
      onRefresh: function () {
        check(rec);
      }
    });
    poll();
    return rec;
  }

  /* --------------------------------------------------------- section plumbing */

  var deferredInits = [];

  function drain() {
    var t0 = performance.now();
    while (deferredInits.length && performance.now() - t0 < 10) deferredInits.shift()();
    if (deferredInits.length) setTimeout(drain, 0);
  }
  function defer(fn) {
    var first = !deferredInits.length;
    deferredInits.push(fn);
    if (first) setTimeout(drain, 0);
  }

  // Build one paused timeline for a root, then hand it to the reveal engine.
  function mount(root, build, opts) {
    opts = opts || {};
    var tl = gsap.timeline({ paused: true });
    tl.set(root, { visibility: "visible" }, 0);
    try {
      build(root, tl);
      gsap.set(root, { visibility: "visible" }); // same tick as every hidden start state
    } catch (e) {
      try {
        tl.progress(1);
        tl.kill();
      } catch (e2) {}
      root.style.visibility = "visible";
      if (W.console) console.warn("[ewc-motion] " + root.getAttribute("data-animation-trigger"), e);
      return;
    }
    revealSectionOnScroll(root, tl, opts.start);
  }

  // Hero builds after webfonts settle (3s cap) so the late font swap cannot shift the revealed hero.
  function afterFonts(fn) {
    var done = false,
      go = function () {
        if (!done) {
          done = true;
          fn();
        }
      };
    void doc.body.offsetHeight; // force layout so used fonts start loading
    if (doc.fonts && doc.fonts.status === "loading") {
      doc.fonts.ready.then(go, go);
      setTimeout(go, 3000);
    } else go();
  }

  var inits = {};
  function trigger(name, build, opts) {
    // Self-contained: returns early when its root is not on the page.
    inits[name] = function () {
      var roots = $$('[data-animation-trigger="' + name + '"]');
      if (!roots.length) return;
      roots.forEach(function (root) {
        var run = function () {
          mount(root, build, opts);
        };
        if (name === "hero") afterFonts(run);
        else if (root.getBoundingClientRect().top < W.innerHeight * 1.2) run();
        else defer(run);
      });
    };
  }

  /* ------------------------------------------------------------ shared pieces */

  var BOXES = ".cta_container,.max-width-xlarge,.max-width-large,.container-medium,.text-align-center";
  var ROWS = ".grid,.card,.steps_layout,.faq_list-wrap,.faq_list,.split_layout,.cards_layout,.keypoints_text";

  function firstHeading(root) {
    var hs = $$("h1,h2", root);
    for (var i = 0; i < hs.length; i++) {
      if (!hs[i].closest(".card,.split_layout,.faq_list-wrap,.w-richtext,.steps_layout")) return hs[i];
    }
    return null;
  }

  // Heading words, copy, buttons: the head of a section. Returns the end time.
  function head(root, tl, t0) {
    var h = firstHeading(root);
    if (!h) return t0;
    var box = h.closest(BOXES) || h.parentElement,
      outside = function (e) {
        return !e.closest(ROWS) && !e.closest(".split_layout");
      },
      copy = $$(".sub-text,.rich-text,.hero_text,.text-size-large,.text-style-italic", box).filter(outside),
      loose = Array.prototype.filter.call(box.children, function (c) {
        return c.tagName === "P" || c.querySelector(":scope > p");
      }),
      btns = $$(".button-group .button", box).filter(outside);
    copy = copy.filter(function (e) {
      return !copy.some(function (o) {
        return o !== e && o.contains(e);
      });
    });
    loose = loose.filter(function (e) {
      return copy.indexOf(e) < 0 && !h.contains(e) && !e.contains(h) && outside(e);
    });
    riseWords(tl, h, t0);
    rise(tl, copy.concat(loose), t0 + 0.4, "power2.out", 0.06);
    landButtons(tl, btns, t0 + 0.65);
    return t0 + 0.9;
  }

  function splitRows(root) {
    $$(".split_layout", root).forEach(function (layout) {
      var run = function () {
        var tl = gsap.timeline({ paused: true }),
          img = $(".split_img", layout),
          body = $(".split_content", layout) || layout;
        try {
          wipeImage(tl, img, 0);
          riseWords(tl, $("h2,h3,h4", body), 0.3);
          rise(tl, $$(".rich-text,.sub-text", body).filter(function (e) {
            return !e.closest("h2,h3,h4");
          }), 0.6, "power2.out", 0.08);
          landButtons(tl, $$(".button", body), 0.85);
        } catch (e) {
          tl.progress(1);
        }
        revealSectionOnScroll(layout, tl, "top 80%");
      };
      if (layout.getBoundingClientRect().top < W.innerHeight * 1.2) run();
      else defer(run);
    });
  }

  function cardsOf(root) {
    var all = $$(".grid > .card,.grid > .w-dyn-item,.steps_card_wrap,.w-dyn-items > .w-dyn-item,.keypoints_text", root);
    return all.filter(function (e) {
      return !e.closest(".split_layout") && !e.closest(".faq_list");
    });
  }

  function lonelyImages(root) {
    return $$("img", root).filter(function (i) {
      return (
        !i.closest(".split_layout,.hero_section,.nav_component,.faq_list-wrap") &&
        !/leaf|proof_dp|icon|logo/.test(i.className) &&
        !i.closest("svg")
      );
    });
  }

  // The common composition: head, media, rows, then split rows on their own triggers.
  function general(root, tl) {
    var t = head(root, tl, 0.05);
    lonelyImages(root).forEach(function (i, n) {
      wipeImage(tl, i.parentElement && i.parentElement !== root ? i.parentElement : i, 0.35 + n * 0.1);
    });
    rise(tl, cardsOf(root), Math.max(t, 0.85), "power2.out", 0.08);
    draw(tl, $$('[class*="divider"],[class*="steps_line"]', root), 0.9, "x");
    landButtons(tl, $$(".button-group > .button", root).filter(function (b) {
      return !b.closest(".split_layout") && !b.closest(".faq_list-wrap") && !firstHeading(root) ? true : false;
    }), 1.1);
    splitRows(root);
  }

  /* ------------------------------------------------------------------- hero */

  trigger("hero", function (root, tl) {
    rise(tl, $(".gbp_wrap", root), 0);
    riseWords(tl, $("h1", root), 0.08);
    rise(tl, $(".hero_text", root), 0.5, "power2.out");
    landButtons(tl, $$(".button-group .button", root), 0.72);
    var bg = $("img.hero_img", root);
    if (bg) {
      quiet([bg]);
      tl.from(bg, {
        scale: narrow(root, 48) ? 0.92 : 1.08,
        duration: 1.3,
        ease: "power3.out",
        clearProps: "transform,transition"
      }, 0);
    }
  });

  /* ---------------------------------------------------------- section triggers */

  trigger("keypoints", function (root, tl) {
    riseWords(tl, $("h2", root), 0);
    rise(tl, $(".keypoints_text", root), 0.4, "power1.out");
  });

  trigger("signs", general);
  trigger("stats", general);
  trigger("cards", general);
  trigger("steps", general);
  trigger("discover", general);
  trigger("story", general);
  trigger("home", general);
  trigger("compare", general);
  trigger("form", function (root, tl) {
    var t = head(root, tl, 0);
    rise(tl, $$("form,.w-form,[class*=contact_],[class*=time_]", root).filter(function (e) {
      return !e.closest("form") || e.tagName === "FORM";
    }), Math.max(t - 0.2, 0.3), "power2.out", 0.1);
  });

  trigger("split", function (root, tl) {
    head(root, tl, 0.05);
    splitRows(root);
  });

  trigger("proof", function (root, tl) {
    var t = head(root, tl, 0.05),
      q = $$(".rich-text", root).filter(function (e) {
        return !e.closest(".sub-text");
      })[0],
      stars = $(".flex.centered", root),
      dp = $(".proof_dp", root),
      names = $$("p.text-weight-bold", root);
    rise(tl, [q, stars, dp && dp.parentElement].concat(names), Math.max(t - 0.2, 0.4), "power2.out", 0.1);
  });

  trigger("quote", function (root, tl) {
    rise(tl, $$(".text-align-center > .margin-bottom", root), 0);
    riseWords(tl, $(".text-size-large", root), 0.15);
  });

  trigger("quiz", general);

  trigger("faq", function (root, tl) {
    var t = head(root, tl, 0);
    var items = $$('[faq-element="accordion"]', root);
    rise(tl, items, Math.max(t - 0.2, 0.5), "power2.out", { amount: Math.min(0.6, items.length * 0.06) });
    rise(tl, $$(".text-align-center h3", root).filter(function (h) {
      return !h.closest(".faq_list-wrap");
    }), 1, "power1.out");
    landButtons(tl, $$(".button-group .button", root).filter(function (b) {
      return !b.closest(".text-align-center") || !b.closest(".margin-bottom") ? true : false;
    }), 1.1);
  });

  trigger("testimonials", function (root, tl) {
    var t = head(root, tl, 0);
    rise(tl, $$("[data='testimonial-slider-wrapper'],.swiper", root).slice(0, 1), Math.max(t - 0.2, 0.4), "power2.out");
  });

  trigger("cta", function (root, tl) {
    var c = $(".cta_container", root) || root;
    riseWords(tl, $("h2,h1", c), 0);
    rise(tl, $$(".rich-text,.sub-text,.text-size-large,p", c).filter(function (e, _i, all) {
      return !e.closest("h1,h2,.button") && !all.some(function (o) { return o !== e && o.contains(e); });
    }), 0.4, "power2.out", 0.08);
    landButtons(tl, $$(".button", c), 0.65);
    rise(tl, $$(".margin-top", c), 0.9, "power1.out");
  });

  // Blog list is driven by Finsweet: re-run reveal in its afterRender hook.
  trigger("list", function (root, tl) {
    head(root, tl, 0);
    var done = [];
    function items(els) {
      els.forEach(function (el) {
        if (done.indexOf(el) > -1) return;
        done.push(el);
        var t = gsap.timeline({ paused: true });
        quiet([el]);
        t.from(el, { opacity: 0, y: 14, duration: 0.6, ease: "power2.out", clearProps: CLEAR }, 0);
        revealSectionOnScroll(el, t, "top 90%");
      });
    }
    items($$(".w-dyn-item", root));
    W.fsAttributes = W.fsAttributes || [];
    W.fsAttributes.push([
      "list",
      function (lists) {
        lists.forEach(function (l) {
          l.addHook("afterRender", function (rendered) {
            items(rendered.map(function (r) { return r.element; }).filter(Boolean));
            ScrollTrigger.refresh();
          });
        });
      }
    ]);
  });

  // Rich-text article bodies: no motion. Root just becomes visible.
  trigger("article", function () {});

  /* --------------------------------------------------------------------- nav */

  // Desktop only. One pill follows the hovered top-level link; first hover fades in place.
  function initNav() {
    var nav = $(".nav_component");
    if (!nav || !Flip) return;
    var TOP = ".nav_menu_list > .nav_menu_item > ",
      links = $$(TOP + "a.nav_menu_link," + TOP + ".dropdown_wrap > .dropdown_toggle > a.nav_menu_link", nav);
    if (!links.length) return;

    var s = doc.createElement("style");
    s.textContent =
      TOP + "a > .nav_line," + TOP + ".dropdown_wrap > .dropdown_toggle > a > .nav_line{display:none}" +
      ".ewc-nav-pill{position:absolute;left:0;top:0;z-index:-1;width:0;height:0;" +
      "border-radius:100vh;pointer-events:none;opacity:0;" +
      "background:color-mix(in srgb,var(--background-color--background-tertiary) 88%,#000 12%)}";
    doc.head.appendChild(s);

    var pill = doc.createElement("span"),
      shown = false,
      hideT = 0;
    pill.className = "ewc-nav-pill";
    pill.setAttribute("aria-hidden", "true");
    nav.appendChild(pill);

    function desktop() {
      var h = $(".nav_hamburger_button", nav);
      return !h || getComputedStyle(h).display === "none";
    }
    function place(a) {
      var r = a.getBoundingClientRect(),
        n = nav.getBoundingClientRect(),
        px = 0.8 * rem(),
        py = 0.45 * rem();
      pill.style.left = r.left - n.left - px + "px";
      pill.style.top = r.top - n.top - py + "px";
      pill.style.width = r.width + 2 * px + "px";
      pill.style.height = r.height + 2 * py + "px";
    }
    function go(a) {
      if (!desktop()) return;
      clearTimeout(hideT);
      if (!shown) {
        place(a);
        gsap.to(pill, { opacity: 1, duration: 0.2, ease: "power1.out", overwrite: true });
        shown = true;
      } else {
        var state = Flip.getState(pill);
        place(a);
        Flip.from(state, { duration: 0.4, ease: "power3.out", scale: false, overwrite: true });
      }
    }
    function leave() {
      clearTimeout(hideT);
      // setTimeout, not delayedCall: must restore state even if the ticker is paused.
      hideT = setTimeout(function () {
        shown = false;
        gsap.to(pill, { opacity: 0, duration: 0.2, ease: "power1.out", overwrite: true });
      }, 80);
    }
    links.forEach(function (a) {
      a.addEventListener("mouseenter", function () { go(a); });
      a.addEventListener("focus", function () { go(a); });
      a.addEventListener("mouseleave", leave);
      a.addEventListener("blur", leave);
    });
  }

  /* ----------------------------------------------------------- stray headings */

  function initStrayHeadings() {
    $$("section h2,section h3").forEach(function (h) {
      if (h.hasAttribute("data-split")) return;
      if (
        h.closest(
          ".card,.w-richtext,blockquote,[class*=callout],[class*=quote],[class*=faq],.steps_card_wrap,.keypoints_text,.nav_component,footer,[data-split]"
        )
      )
        return;
      var tl = gsap.timeline({ paused: true });
      riseWords(tl, h, 0);
      revealSectionOnScroll(h, tl, "top 85%");
    });
  }

  /* --------------------------------------------------------------- boot + sync */

  // Safety net: a section that lost (or never got) its attribute in Webflow is tagged here by class.
  // Hero is excluded on purpose: it sits above the fold and must be hidden by the head CSS from first paint.
  var BY_CLASS = {
    keypoints_section: "keypoints", signs_section: "signs", stats_section: "stats", about_stats_section: "stats",
    causes_section: "split", about_values_section: "split", why_section: "split", services_why_section: "split",
    services_section: "cards", conditions_section: "cards", approach_section: "cards", benefits_section: "cards",
    needs_section: "cards", resources_section: "cards", products_section: "cards",
    steps_setion: "steps", steps_section: "steps", process_section: "steps", timeline_section: "steps",
    proof_section: "proof", quote_section: "quote", quiz_section: "quiz",
    discover_section: "discover", about_discover_section: "discover",
    about_journey_section: "story", about_team_section: "story", about_difference_section: "story",
    about_success_section: "story", experience_section: "story", services_experience_section: "story",
    drive_section: "story", partner_section: "story", expect_section: "story", visit_section: "story",
    faq_section: "faq", testimonials_section: "testimonials", cta_section: "cta",
    contact_section: "form", time_section: "form", intake_section: "form",
    "before-after_section": "compare", measure_section: "compare", blog_section: "list", section_wrap: "story", blog_header: "story", blog_content: "article",
    home_appointment_setion: "home", home_welcome_setion: "home", home_results_setion: "home", home_care_section: "home"
  };

  function tagByClass() {
    $$("section:not([data-animation-trigger])").forEach(function (s) {
      var t = BY_CLASS[(s.className || "").split(/\s+/)[0]];
      if (t) s.setAttribute("data-animation-trigger", t);
    });
  }

  function boot() {
    tagByClass();
    Object.keys(inits).forEach(function (k) {
      inits[k]();
    });
    // Unknown trigger names must never leave a section hidden.
    $$("[data-animation-trigger]").forEach(function (r) {
      if (!inits[r.getAttribute("data-animation-trigger")]) r.style.visibility = "visible";
    });
    initNav();
    defer(initStrayHeadings);
  }

  function refresh() {
    ScrollTrigger.refresh();
  }

  try {
    boot();
  } catch (e) {
    // Last resort: land every timeline and show everything.
    gsap.globalTimeline.getChildren(true, false, true).forEach(function (t) {
      try { t.progress(1); } catch (x) {}
    });
    failOpen();
    if (W.console) console.warn("[ewc-motion] boot failed", e);
    return;
  }

  if (doc.readyState === "complete") refresh();
  else W.addEventListener("load", refresh);
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(refresh);

  if (W.ResizeObserver) {
    var lastH = doc.body.offsetHeight,
      debounce = 0;
    new ResizeObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(function () {
        var h = doc.body.offsetHeight;
        if (h === lastH) return;
        lastH = h;
        requestAnimationFrame(refresh);
      }, 150);
    }).observe(doc.body);
  }
})();
