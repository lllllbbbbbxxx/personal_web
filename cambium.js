(function () {
  "use strict";

  var config = window.CAMBIUM_CONFIG || {};
  var list = document.getElementById("cambium-list");
  var homeList = document.getElementById("home-cambium-list");
  var sourceNote = document.getElementById("cambium-source-note");

  if (!list && !homeList) {
    return;
  }

  if (!config.projectId) {
    renderRequestError();
    return;
  }

  var query = [
    '*[_type == "cambiumArticle" && defined(slug.current)]',
    "| order(featured desc, coalesce(publishedAt, _updatedAt) desc)",
    "{_id, title, \"slug\": slug.current, excerpt, publishedAt, _updatedAt, featured}",
  ].join(" ");

  fetch(buildQueryUrl(query), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Cambium request failed");
      }
      return response.json();
    })
    .then(function (payload) {
      var articles = Array.isArray(payload.result) ? payload.result : [];
      if (list) renderArticles(articles);
      if (homeList) renderHomeArticles(articles.slice(0, 2));
    })
    .catch(function () {
      renderRequestError();
    });

  function renderRequestError() {
    if (list) {
      list.replaceChildren(createState(
        "cb-empty cb-empty--error",
        "文章暂时无法读取。",
        "请稍后刷新页面。"
      ));
      list.setAttribute("aria-busy", "false");
    }

    if (homeList) {
      homeList.replaceChildren(createState(
        "thought-empty",
        "文章暂时无法读取。",
        ""
      ));
      homeList.setAttribute("aria-busy", "false");
    }

    if (sourceNote) {
      sourceNote.hidden = false;
      sourceNote.textContent = "Cambium 当前未能连接内容服务。";
    }
  }

  function buildQueryUrl(groq) {
    var host = "https://" + config.projectId + ".apicdn.sanity.io";
    var path = "/v" + config.apiVersion + "/data/query/" + config.dataset;
    return host + path + "?perspective=published&query=" + encodeURIComponent(groq);
  }

  function renderArticles(articles) {
    list.replaceChildren();
    list.setAttribute("aria-busy", "false");

    if (!articles.length) {
      list.appendChild(createState(
        "cb-empty",
        "文章正在生长中。",
        "第一篇发布后，会从这里出现。"
      ));
      return;
    }

    articles.forEach(function (article) {
      var card = document.createElement("a");
      card.className = "cb-article" + (article.featured ? " cb-article--accent" : "");
      card.href = "./cambium-article.html?slug=" + encodeURIComponent(article.slug);

      var meta = document.createElement("p");
      meta.className = "cb-article-meta";
      meta.textContent = formatDate(article.publishedAt || article._updatedAt);

      var title = document.createElement("h3");
      title.textContent = article.title;

      var excerpt = document.createElement("p");
      excerpt.textContent = article.excerpt || "";

      var arrow = document.createElement("span");
      arrow.className = "cb-article-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "→";

      card.append(meta, title, excerpt, arrow);
      list.appendChild(card);
    });
  }

  function renderHomeArticles(articles) {
    homeList.replaceChildren();
    homeList.setAttribute("aria-busy", "false");

    if (!articles.length) {
      homeList.appendChild(createState(
        "thought-empty",
        "文章正在生长中。",
        ""
      ));
      return;
    }

    articles.forEach(function (article, index) {
      var card = document.createElement("a");
      card.className = "thought-card" + (index === 0 ? " thought-card--accent" : "");
      card.href = "./cambium-article.html?slug=" + encodeURIComponent(article.slug);
      card.style.display = "block";
      card.textContent = article.title;

      var meta = document.createElement("small");
      var summary = truncate(article.excerpt || "", 54);
      meta.textContent = [formatDate(article.publishedAt || article._updatedAt), summary]
        .filter(Boolean)
        .join(" · ");
      card.appendChild(meta);
      homeList.appendChild(card);
    });

    var more = document.createElement("a");
    more.className = "thought-more";
    more.href = "./cambium.html";
    more.textContent = "全部文章 →";
    homeList.appendChild(more);
  }

  function createState(className, titleText, detailText) {
    var state = document.createElement("div");
    state.className = className;

    var title = document.createElement("strong");
    title.textContent = titleText;
    state.appendChild(title);

    if (detailText) {
      var detail = document.createElement("p");
      detail.textContent = detailText;
      state.appendChild(detail);
    }

    return state;
  }

  function truncate(value, maxLength) {
    return value.length > maxLength ? value.slice(0, maxLength).trimEnd() + "…" : value;
  }

  function formatDate(value) {
    if (!value) return "已发布";
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "已发布";
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }
})();
