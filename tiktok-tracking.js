(function () {
  var PIXEL_ID = "D8BNOO3C77U6KT5BR3B0";
  var ATTR_KEY = "nicole_tiktok_attribution_v1";
  var SESSION_KEY = "nicole_tiktok_session_v1";
  var CLICK_ID_PARAMS = [
    "ttclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "campaign_id",
    "adgroup_id",
    "ad_id",
    "adid",
    "adname",
    "adset",
    "cname",
    "placement",
    "site",
  ];

  function storage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function setCookie(name, value) {
    if (!value) return;
    var maxAge = 60 * 60 * 24 * 90;
    document.cookie =
      name +
      "=" +
      encodeURIComponent(value) +
      "; path=/; max-age=" +
      maxAge +
      "; SameSite=Lax";
  }

  function randomId(prefix) {
    var bytes = new Uint32Array(2);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return prefix + "_" + Date.now() + "_" + bytes[0].toString(36) + bytes[1].toString(36);
    }
    return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2);
  }

  function getSessionId() {
    var store = storage();
    if (!store) return randomId("sess");
    var existing = store.getItem(SESSION_KEY);
    if (existing) return existing;
    var created = randomId("sess");
    store.setItem(SESSION_KEY, created);
    return created;
  }

  function readAttribution() {
    var store = storage();
    if (!store) return {};
    try {
      return JSON.parse(store.getItem(ATTR_KEY) || "{}") || {};
    } catch (error) {
      return {};
    }
  }

  function writeAttribution(data) {
    var store = storage();
    if (!store) return;
    store.setItem(ATTR_KEY, JSON.stringify(data));
  }

  function captureAttribution() {
    var current = readAttribution();
    var params = new URLSearchParams(window.location.search || "");
    var changed = false;

    CLICK_ID_PARAMS.forEach(function (key) {
      var value = params.get(key);
      if (value) {
        current[key] = value;
        changed = true;
      }
    });

    if (current.ttclid) {
      setCookie("ttclid", current.ttclid);
      setCookie("_ttclid", current.ttclid);
    }

    current.landing_url = current.landing_url || window.location.href;
    current.last_url = window.location.href;
    current.referrer = current.referrer || document.referrer || "";
    current.session_id = current.session_id || getSessionId();
    current.updated_at = new Date().toISOString();

    if (changed || !readAttribution().session_id) {
      writeAttribution(current);
    }

    return current;
  }

  function ensurePixel() {
    window.TiktokAnalyticsObject = "ttq";
    var ttq = (window.ttq = window.ttq || []);

    if (!ttq.methods) {
      ttq.methods = [
        "page",
        "track",
        "identify",
        "instances",
        "debug",
        "on",
        "off",
        "once",
        "ready",
        "alias",
        "group",
        "enableCookie",
        "disableCookie",
        "holdConsent",
        "revokeConsent",
        "grantConsent",
      ];
      ttq.setAndDefer = function (target, method) {
        target[method] = function () {
          target.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i += 1) {
        ttq.setAndDefer(ttq, ttq.methods[i]);
      }
      ttq.instance = function (id) {
        var instance = ttq._i[id] || [];
        for (var j = 0; j < ttq.methods.length; j += 1) {
          ttq.setAndDefer(instance, ttq.methods[j]);
        }
        return instance;
      };
      ttq.load = function (id, options) {
        var url = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = url;
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = options || {};
        var script = document.createElement("script");
        script.type = "text/javascript";
        script.async = true;
        script.src = url + "?sdkid=" + id + "&lib=ttq";
        var firstScript = document.getElementsByTagName("script")[0];
        firstScript.parentNode.insertBefore(script, firstScript);
      };
    }

    ttq._i = ttq._i || {};
    if (!ttq._i[PIXEL_ID]) {
      ttq.load(PIXEL_ID);
      ttq.page();
    }
  }

  function numberValue(value) {
    var numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : undefined;
  }

  function compactObject(value) {
    var output = {};
    Object.keys(value || {}).forEach(function (key) {
      if (value[key] !== undefined && value[key] !== null && value[key] !== "") {
        output[key] = value[key];
      }
    });
    return output;
  }

  function buildEvent(eventName, payload, options) {
    var attribution = captureAttribution();
    var eventId =
      (options && options.eventId) ||
      payload.event_id ||
      (payload.order_id ? eventName + "_" + payload.order_id : randomId(eventName));
    var value = numberValue(payload.value);
    var contentId = payload.content_id || payload.order_id || payload.external_id || eventId;
    var contentName = payload.content_name || payload.description || payload.title || document.title;

    var properties = compactObject({
      value: value,
      currency: payload.currency || "BRL",
      content_type: payload.content_type || "product",
      content_id: contentId,
      content_name: contentName,
      quantity: payload.quantity || 1,
      order_id: payload.order_id || payload.external_id || "",
      description: payload.description || "",
      contents: [
        compactObject({
          content_id: contentId,
          content_name: contentName,
          quantity: payload.quantity || 1,
          price: value,
        }),
      ],
      utm_source: attribution.utm_source,
      utm_medium: attribution.utm_medium,
      utm_campaign: attribution.utm_campaign,
      utm_content: attribution.utm_content,
      utm_term: attribution.utm_term,
      campaign_id: attribution.campaign_id,
      adgroup_id: attribution.adgroup_id,
      ad_id: attribution.ad_id || attribution.adid,
      ad_name: attribution.adname,
      adset: attribution.adset,
      placement: attribution.placement,
    });

    var user = compactObject({
      ttclid: attribution.ttclid || getCookie("ttclid") || getCookie("_ttclid"),
      ttp: getCookie("_ttp"),
      email: payload.email || (payload.customer && payload.customer.email),
      phone: payload.phone || (payload.customer && payload.customer.phone),
      external_id:
        payload.external_user_id ||
        payload.customer_id ||
        (payload.customer && (payload.customer.id || payload.customer.document)) ||
        attribution.session_id,
    });

    return {
      event: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      pixel_code: PIXEL_ID,
      properties: properties,
      user: user,
      page: {
        url: window.location.href,
        referrer: document.referrer || attribution.referrer || "",
      },
    };
  }

  function apiBases() {
    var bases = [];
    var add = function (base) {
      if (base && bases.indexOf(base) === -1) bases.push(base);
    };

    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      add(window.location.origin);
    }
    if (
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost" ||
      window.location.protocol === "file:"
    ) {
      add("http://localhost:8000");
      add("http://127.0.0.1:8000");
      add("http://127.0.0.1:8002");
    }
    return bases;
  }

  function sendServerEvent(eventData) {
    var body = JSON.stringify(eventData);
    var paths = [
      "/api/tiktok/event",
      "/api/tiktok/event.php",
      "/.netlify/functions/tiktok-event",
      "/tiktok-event.php",
    ];

    apiBases().some(function (base) {
      return paths.some(function (path) {
        try {
          if (navigator.sendBeacon) {
            var blob = new Blob([body], { type: "application/json" });
            return navigator.sendBeacon(base + path, blob);
          }
          fetch(base + path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: body,
            keepalive: true,
          }).catch(function () {});
          return true;
        } catch (error) {
          return false;
        }
      });
    });
  }

  function browserTrack(eventName, eventData) {
    try {
      ensurePixel();
      var pixelPayload = Object.assign({}, eventData.properties, {
        event_id: eventData.event_id,
      });
      window.ttq.track(eventName, pixelPayload);
    } catch (error) {}
  }

  function track(eventName, payload, options) {
    payload = payload || {};
    options = options || {};
    var eventData = buildEvent(eventName, payload, options);

    if (options.browser !== false) browserTrack(eventName, eventData);
    if (options.server !== false) sendServerEvent(eventData);

    return eventData.event_id;
  }

  function trackCheckout(payload) {
    return track("InitiateCheckout", payload || {});
  }

  function trackPixGenerated(payload) {
    return track("AddPaymentInfo", payload || {});
  }

  function trackPaymentConfirmed(payload) {
    return track("CompletePayment", payload || {});
  }

  window.nicoleTikTok = {
    pixelId: PIXEL_ID,
    captureAttribution: captureAttribution,
    track: track,
    trackCheckout: trackCheckout,
    trackPixGenerated: trackPixGenerated,
    trackPaymentConfirmed: trackPaymentConfirmed,
    eventId: randomId,
  };

  captureAttribution();
  ensurePixel();
  track("ViewContent", {
    content_id: document.body && document.body.dataset && document.body.dataset.step
      ? document.body.dataset.step
      : window.location.pathname || "page",
    content_name: document.title || "Nicole Rodrigues",
    value: 0,
  });

  document.addEventListener(
    "click",
    function (event) {
      var button = event.target && event.target.closest
        ? event.target.closest("button,a")
        : null;
      if (!button) return;

      var text = (button.innerText || button.textContent || button.getAttribute("aria-label") || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);

      if (!/pix|pagar|assine|assinar|liberar|verificar|robo|continuar|entrar/i.test(text)) {
        return;
      }

      track("ClickButton", {
        content_id: button.id || button.className || "button",
        content_name: text || "button_click",
        value: 0,
      }, { server: false });
    },
    true
  );
})();
