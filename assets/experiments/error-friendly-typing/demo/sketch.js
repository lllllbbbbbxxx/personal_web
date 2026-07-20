let dictionary = [];
let dictionarySet;
let wordInput;
let submitButton;
let correctWords = [];
let readableWords = [];
let noiseBursts = [];
let soundCorrect;
let soundReadable;

function preload() {
  dictionary = loadStrings("./words.txt");
  soundCorrect = loadSound("./correct.mp3");
  soundReadable = loadSound("./readable.mp3");
}

function setup() {
  const canvas = createCanvas(780, 480);
  canvas.parent("sketch-shell");
  pixelDensity(1);
  textFont("Arial");

  dictionary = dictionary.map((word) => word.trim().toLowerCase()).filter(Boolean);
  dictionarySet = new Set(dictionary);

  wordInput = createInput("");
  wordInput.parent("typing-controls");
  wordInput.addClass("typing-input");
  wordInput.attribute("placeholder", "type herre...");
  wordInput.attribute("aria-label", "Type one English word");

  submitButton = createButton("submmit");
  submitButton.parent("typing-controls");
  submitButton.addClass("typing-submit");
  submitButton.mousePressed(classifyWord);

  wordInput.elt.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      classifyWord();
    }
  });
  wordInput.elt.focus();
}

function classifyWord() {
  userStartAudio();
  const word = wordInput.value().trim().toLowerCase();
  if (!word) return;

  if (dictionarySet.has(word)) {
    correctWords.push({
      text: word,
      x: width / 2,
      y: 120,
      alpha: 255,
      velocity: 2
    });
    playFeedback(soundCorrect, 0.45);
  } else if (isReadableMistake(word)) {
    readableWords.push({
      text: word,
      baseX: random(90, width - 180),
      baseY: random(120, height - 70),
      dx: random(-7, 7),
      dy: random(-7, 7),
      size: random(24, 44),
      alpha: random(120, 240),
      phase: random(TWO_PI)
    });
    playFeedback(soundReadable, 0.38);
  } else {
    noiseBursts.push({
      x: random(80, width - 80),
      y: random(100, height - 70),
      life: 38
    });
  }

  wordInput.value("");
  wordInput.elt.focus();
}

function playFeedback(sound, volume) {
  if (!sound || !sound.isLoaded()) return;
  sound.setVolume(volume);
  sound.play();
}

function draw() {
  clear();
  drawGuide();
  drawReadableWords();
  drawCorrectWords();
  drawNoise();
}

function drawGuide() {
  noStroke();
  fill(86, 114, 185, 120);
  textSize(11);
  textStyle(BOLD);
  text("WORDS THE SYSTEM ALLOWS TO REMAIN", 24, 34);
  stroke(86, 114, 185, 55);
  line(24, 48, width - 24, 48);
}

function drawReadableWords() {
  noStroke();
  textStyle(NORMAL);
  for (const word of readableWords) {
    word.phase += 0.018;
    word.dx += random(-0.08, 0.08);
    word.dy += random(-0.08, 0.08);
    const x = word.baseX + word.dx + sin(word.phase) * 4;
    const y = word.baseY + word.dy + cos(word.phase) * 3;
    textSize(word.size);
    fill(47, 111, 237, word.alpha);
    text(word.text, x, y);
  }
}

function drawCorrectWords() {
  textStyle(BOLD);
  textAlign(CENTER);
  for (let i = correctWords.length - 1; i >= 0; i -= 1) {
    const word = correctWords[i];
    word.alpha -= 8;
    word.velocity += 0.28;
    word.y += word.velocity;
    textSize(44);
    fill(22, 33, 61, word.alpha);
    noStroke();
    text(word.text, word.x, word.y);
    if (word.alpha <= 0 || word.y > height + 30) correctWords.splice(i, 1);
  }
  textAlign(LEFT);
}

function drawNoise() {
  noFill();
  for (let i = noiseBursts.length - 1; i >= 0; i -= 1) {
    const burst = noiseBursts[i];
    stroke(113, 124, 151, burst.life * 4);
    circle(burst.x, burst.y, 42 - burst.life);
    burst.life -= 1;
    if (burst.life <= 0) noiseBursts.splice(i, 1);
  }
}

function isReadableMistake(word) {
  if (new Set(word).size < 2) return false;
  if (/([a-z])\1{4,}/.test(word)) return false;
  if (word.length < 4 || !/[aeiouy]/.test(word) || /[^a-z]/.test(word)) return false;

  const vowelCount = (word.match(/[aeiouy]/g) || []).length;
  if (vowelCount / word.length > 0.8 || dictionarySet.has(word)) return false;

  for (const real of dictionary) {
    if (Math.abs(real.length - word.length) > 2) continue;
    let same = 0;
    const minimumLength = Math.min(real.length, word.length);
    for (let i = 0; i < minimumLength; i += 1) {
      if (real[i] === word[i]) same += 1;
    }
    if (same / minimumLength >= 0.5) return true;
  }
  return false;
}
