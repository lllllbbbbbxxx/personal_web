(function () {
  "use strict";

  var config = window.CAMBIUM_CONFIG || {};
  var params = new URLSearchParams(window.location.search);
  var slug = params.get("slug");
  var state = document.getElementById("article-state");
  var content = document.getElementById("article-content");
  var title = document.getElementById("article-title");
  var date = document.getElementById("article-date");
  var excerpt = document.getElementById("article-excerpt");
  var body = document.getElementById("article-body");
  var rail = document.getElementById("article-rail");
  var evolution = document.getElementById("article-evolution");

  if (!config.projectId || !slug) {
    showError("这篇文章暂时无法打开。");
    return;
  }

  var query = [
    '*[_type == "cambiumArticle" && slug.current == $slug][0]',
    "{title, excerpt, body, publishedAt, _updatedAt, evolution}",
  ].join(" ");

  fetch(buildQueryUrl(query, { slug: slug }))
    .then(function (response) {
      if (!response.ok) throw new Error("Article request failed");
      return response.json();
    })
    .then(function (payload) {
      if (!payload.result) {
        showError("文章不存在，或者还没有发布。");
        return;
      }
      renderArticle(payload.result);
    })
    .catch(function () {
      showError("文章暂时无法加载，请稍后再试。");
    });

  function buildQueryUrl(groq, queryParams) {
    var host = "https://" + config.projectId + ".apicdn.sanity.io";
    var path = "/v" + config.apiVersion + "/data/query/" + config.dataset;
    var search = new URLSearchParams({
      perspective: "published",
      query: groq,
    });
    Object.keys(queryParams).forEach(function (key) {
      search.set("$" + key, JSON.stringify(queryParams[key]));
    });
    return host + path + "?" + search.toString();
  }

  function renderArticle(article) {
    document.title = article.title + " — Cambium";
    title.textContent = article.title;
    date.textContent = formatDate(article.publishedAt || article._updatedAt);
    excerpt.textContent = article.excerpt || "";
    renderPortableText(article.body || []);
    renderEvolution(article.evolution || []);
    state.hidden = true;
    content.hidden = false;
  }

  function renderPortableText(blocks) {
    var list = null;
    var listType = "";

    blocks.forEach(function (block) {
      if (block._type !== "block") return;

      if (block.listItem) {
        if (!list || listType !== block.listItem) {
          listType = block.listItem;
          list = document.createElement(block.listItem === "number" ? "ol" : "ul");
          body.appendChild(list);
        }
        var item = document.createElement("li");
        appendSpans(item, block);
        list.appendChild(item);
        return;
      }

      list = null;
      listType = "";
      var tag = { h2: "h2", h3: "h3", blockquote: "blockquote" }[block.style] || "p";
      var element = document.createElement(tag);
      appendSpans(element, block);
      body.appendChild(element);
    });
  }

  function appendSpans(parent, block) {
    var markDefs = {};
    (block.markDefs || []).forEach(function (definition) {
      markDefs[definition._key] = definition;
    });

    (block.children || []).forEach(function (child) {
      var node = document.createTextNode(child.text || "");
      (child.marks || []).slice().reverse().forEach(function (mark) {
        var wrapper;
        if (mark === "strong") wrapper = document.createElement("strong");
        if (mark === "em") wrapper = document.createElement("em");
        if (mark === "code") wrapper = document.createElement("code");
        if (markDefs[mark] && markDefs[mark]._type === "link") {
          wrapper = document.createElement("a");
          wrapper.href = safeUrl(markDefs[mark].href);
          wrapper.rel = "noreferrer";
          if (markDefs[mark].blank) wrapper.target = "_blank";
        }
        if (wrapper) {
          wrapper.appendChild(node);
          node = wrapper;
        }
      });
      parent.appendChild(node);
    });
  }

  function renderEvolution(items) {
    if (!items.length) return;
    items.forEach(function (item) {
      var row = document.createElement("div");
      row.className = "cb-tl-item";
      var itemDate = document.createElement("span");
      itemDate.className = "cb-tl-date";
      itemDate.textContent = item.label || formatDate(item.date);
      var note = document.createElement("p");
      note.className = "cb-tl-note";
      note.textContent = item.note || "";
      row.append(itemDate, note);
      evolution.appendChild(row);
    });
    rail.hidden = false;
  }

  function safeUrl(value) {
    try {
      var url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch (_error) {
      return "#";
    }
  }

  function formatDate(value) {
    if (!value) return "";
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(parsed);
  }

  function showError(message) {
    state.className = "article-error";
    state.textContent = message;
  }
})();
