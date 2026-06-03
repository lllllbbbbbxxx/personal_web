const story = document.querySelector(".scroll-story");
const copy = document.querySelector("[data-story-copy]");
const reader = document.querySelector("[data-project-reader]");
const detail = document.querySelector("[data-project-detail]");
const dial = document.querySelector("[data-dial]");
const scrollHint = document.querySelector("[data-scroll-hint]");
const projectCopies = [...document.querySelectorAll("[data-project]")];
const caseCards = [...document.querySelectorAll("[data-case]")];
const dialItems = [...document.querySelectorAll(".dial-list li")];
const navItems = [...document.querySelectorAll(".top-nav a")];

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function setActiveProject(index) {
  dialItems.forEach((item, i) => item.classList.toggle("active", i === index));
}

function setProjectTransition(projectProgress) {
  const leaveFirst = clamp((projectProgress - 0.24) / 0.16);
  const enterSecond = clamp((projectProgress - 0.64) / 0.18);
  const activeProject = enterSecond > 0.45 ? 1 : 0;

  projectCopies.forEach((item, index) => {
    const isFirst = index === 0;
    const opacity = isFirst ? 1 - leaveFirst : enterSecond;
    const translate = isFirst ? -96 * leaveFirst : 96 * (1 - enterSecond);
    const scale = isFirst ? 1 - leaveFirst * 0.025 : 0.985 + enterSecond * 0.015;
    item.classList.add("active");
    item.style.opacity = opacity.toFixed(3);
    item.style.transform = `translateY(${translate.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    item.style.zIndex = isFirst ? 1 : 2;
    item.style.visibility = opacity < 0.08 ? "hidden" : "visible";
    item.style.pointerEvents = opacity > 0.55 ? "auto" : "none";
  });

  caseCards.forEach((item, index) => {
    const isFirst = index === 0;
    const opacity = isFirst ? 1 - leaveFirst : enterSecond;
    const translate = isFirst ? -84 * leaveFirst : 84 * (1 - enterSecond);
    const scale = isFirst ? 1 - leaveFirst * 0.02 : 0.986 + enterSecond * 0.014;
    item.classList.add("active");
    item.style.opacity = opacity.toFixed(3);
    item.style.transform = `translateY(${translate.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    item.style.zIndex = isFirst ? 1 : 2;
    item.style.visibility = opacity < 0.08 ? "hidden" : "visible";
    item.style.pointerEvents = opacity > 0.55 ? "auto" : "none";
  });

  setActiveProject(activeProject);
}

function updateStory() {
  if (!story) return;

  const rect = story.getBoundingClientRect();
  const scrollable = Math.max(1, rect.height - window.innerHeight);
  const progress = clamp(-rect.top / scrollable);
  const projectProgress = clamp((progress - 0.18) / 0.62);

  copy?.classList.toggle("is-exiting", progress > 0.13);
  scrollHint?.classList.toggle("is-hidden", progress > 0.08);
  reader?.classList.toggle("is-visible", progress > 0.14);
  detail?.classList.toggle("is-visible", progress > 0.16);
  setProjectTransition(projectProgress);

  if (dial) {
    const rotation = progress * 72;
    const exit = clamp((progress - 0.12) / 0.26);
    dial.style.transform = `translate(${exit * 14}vw, -50%) rotate(${rotation}deg)`;
  }

  const listShift = clamp((progress - 0.16) / 0.24);
  document.documentElement.style.setProperty("--dial-list-right", `${96 - listShift * 84}px`);

  navItems.forEach((item) => item.classList.remove("active"));
  const activeNav = progress < 0.2 ? navItems[0] : progress < 0.82 ? navItems[1] : navItems[2];
  activeNav?.classList.add("active");
}

navItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const target = item.dataset.navTarget;
    const max = story.offsetHeight - window.innerHeight;
    const progress = target === "home" ? 0 : target === "project" ? 0.34 : 1;
    const top = target === "other" ? document.querySelector(".portal-grid").offsetTop : story.offsetTop + max * progress;
    window.scrollTo({ top, behavior: "smooth" });
  });
});

window.addEventListener("scroll", updateStory, { passive: true });
window.addEventListener("resize", updateStory);
updateStory();
