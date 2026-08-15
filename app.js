const API_BASE = "https://niuma-wall-api.miyakko.de";
const SUBMITTED_KEY = "niuma-signature-submitted";
const signatureSlots = [
  [12, 18], [34, 12], [57, 17], [80, 12], [92, 28],
  [21, 36], [45, 33], [69, 38], [8, 54], [33, 57],
  [58, 55], [84, 57], [16, 75], [41, 78], [66, 74], [91, 79],
];
const signatureField = document.querySelector("#signatureField");
const modal = document.querySelector("#signModal");
const nameInput = document.querySelector("#nameInput");
const drawName = document.querySelector("#drawName");
const preview = document.querySelector("#signaturePreview");
const error = document.querySelector("#formError");
const submitButton = document.querySelector("#submitSignature");
const drawCanvas = document.querySelector("#drawCanvas");
const drawContext = drawCanvas.getContext("2d");
let mode = "auto";
let styleNonce = 0;
let isDrawing = false;
let hasDrawing = false;
let autoOpened = false;
let remoteSignatures = [];

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function randomFrom(seed, offset = 0) {
  const x = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function signatureStyle(name, index = 0, nonce = 0) {
  const seed = hash(`${name}:${index}:${nonce}`);
  const slot = signatureSlots[index % signatureSlots.length];
  const layer = Math.floor(index / signatureSlots.length);
  return {
    x: slot[0] + (randomFrom(seed, 1) - .5) * 5 + layer * 1.5,
    y: slot[1] + (randomFrom(seed, 2) - .5) * 5 + layer * 2,
    size: 25 + randomFrom(seed, 3) * 26,
    rotation: -8 + randomFrom(seed, 4) * 16,
    skew: -9 + randomFrom(seed, 5) * 18,
    tone: randomFrom(seed, 6) > 0.25 ? "#c7a970" : "#9cae97",
    underline: -5 + randomFrom(seed, 7) * 10,
  };
}

function handwritingFont(name) {
  return /[\u3400-\u9fff]/.test(name)
    ? '"Zhi Mang Xing", "STKaiti", "KaiTi", cursive'
    : '"Caveat", "Segoe Print", cursive';
}

function renderSignature(item, index, isNew = false) {
  const style = signatureStyle(item.name, index, item.nonce ?? item.style ?? 0);
  const element = document.createElement("span");
  const isDrawn = item.mode === "drawn" || Boolean(item.image);
  element.className = `signature${isNew ? " new" : ""}${isDrawn ? " drawn" : ""}`;
  element.style.setProperty("--x", `${style.x}%`);
  element.style.setProperty("--y", `${style.y}%`);
  element.style.setProperty("--size", `${style.size}px`);
  element.style.setProperty("--rot", `${style.rotation}deg`);
  element.style.setProperty("--skew", `${style.skew}deg`);
  element.style.setProperty("--tone", style.tone);
  element.style.setProperty("--underline-rot", `${style.underline}deg`);
  element.style.setProperty("--signature-font", handwritingFont(item.name));
  const nameLength = Array.from(item.name).length;
  const mobilePositions = [34, 66, 44, 72, 28];
  element.style.setProperty("--mobile-x", `${nameLength > 7 ? 50 : mobilePositions[index % mobilePositions.length]}%`);
  element.style.setProperty("--mobile-y", `${55 + index * 96}px`);
  element.style.setProperty("--mobile-size", `${Math.max(13, Math.min(style.size * .72, 280 / nameLength))}px`);
  if (item.image) {
    const image = document.createElement("img");
    image.src = item.image;
    image.alt = `${item.name} 的手写签名`;
    const caption = document.createElement("small");
    caption.textContent = item.name;
    element.append(image, caption);
  } else {
    element.textContent = item.name;
  }
  signatureField.append(element);
  return element;
}

function renderWall(newestId = null) {
  signatureField.replaceChildren();
  signatureField.style.setProperty("--mobile-field-height", `${Math.max(580, remoteSignatures.length * 96 + 110)}px`);
  remoteSignatures.forEach((item, index) => renderSignature(item, index, item.id === newestId));
  document.querySelector("#signatureCount").textContent = remoteSignatures.length
    ? `${remoteSignatures.length} 个名字，写在第一个年轮里`
    : "还没有名字，等你写下第一笔";
}

async function loadSignatures() {
  const counter = document.querySelector("#signatureCount");
  counter.textContent = "正在读取大家留下的名字…";
  try {
    const response = await fetch(`${API_BASE}/api/signatures`, { cache: "no-store" });
    if (!response.ok) throw new Error("暂时无法读取签名墙");
    const data = await response.json();
    remoteSignatures = Array.isArray(data.signatures) ? data.signatures : [];
    renderWall();
  } catch {
    renderWall();
    counter.textContent = "签名墙暂时失联，请稍后刷新重试";
  }
}

function updatePreview() {
  const value = nameInput.value.trim() || "你的名字";
  const style = signatureStyle(value, 99, styleNonce);
  preview.querySelector("span").textContent = value;
  preview.style.setProperty("--signature-font", handwritingFont(value));
  preview.style.setProperty("--preview-rot", `${style.rotation / 2}deg`);
  preview.style.setProperty("--preview-skew", `${style.skew}deg`);
}

function openModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  error.textContent = "";
  setTimeout(() => (mode === "auto" ? nameInput : drawName).focus(), 50);
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

function setMode(nextMode) {
  mode = nextMode;
  const isAuto = mode === "auto";
  document.querySelector("#autoTab").classList.toggle("active", isAuto);
  document.querySelector("#drawTab").classList.toggle("active", !isAuto);
  document.querySelector("#autoTab").setAttribute("aria-selected", isAuto);
  document.querySelector("#drawTab").setAttribute("aria-selected", !isAuto);
  document.querySelector("#autoPanel").hidden = !isAuto;
  document.querySelector("#drawPanel").hidden = isAuto;
  requestAnimationFrame(() => resizeDrawingCanvas(false));
}

function resizeDrawingCanvas(preserve = true) {
  const rect = drawCanvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const old = preserve && hasDrawing ? drawCanvas.toDataURL() : null;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  drawCanvas.width = Math.round(rect.width * ratio);
  drawCanvas.height = Math.round(rect.height * ratio);
  drawContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  drawContext.strokeStyle = "#d6b878";
  drawContext.lineWidth = 2.2;
  drawContext.lineCap = "round";
  drawContext.lineJoin = "round";
  if (old) {
    const image = new Image();
    image.onload = () => drawContext.drawImage(image, 0, 0, rect.width, rect.height);
    image.src = old;
  }
}

function pointerPosition(event) {
  const rect = drawCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function startDrawing(event) {
  isDrawing = true;
  hasDrawing = true;
  drawCanvas.setPointerCapture(event.pointerId);
  const point = pointerPosition(event);
  drawContext.beginPath();
  drawContext.moveTo(point.x, point.y);
  document.querySelector("#drawHint").hidden = true;
}

function continueDrawing(event) {
  if (!isDrawing) return;
  const point = pointerPosition(event);
  drawContext.lineTo(point.x, point.y);
  drawContext.stroke();
}

function clearDrawing() {
  drawContext.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  hasDrawing = false;
  document.querySelector("#drawHint").hidden = false;
}

async function submitSignature() {
  const name = (mode === "auto" ? nameInput.value : drawName.value).trim();
  if (!name) {
    error.textContent = "请先留下一个名字。";
    return;
  }
  if (mode === "draw" && !hasDrawing) {
    error.textContent = "请在手写区域留下你的笔迹。";
    return;
  }
  const payload = mode === "auto"
    ? { name, mode: "generated", style: styleNonce % 4 }
    : { name, mode: "drawn", image: drawCanvas.toDataURL("image/png") };

  error.textContent = "";
  submitButton.disabled = true;
  submitButton.textContent = "正在写入…";
  try {
    const response = await fetch(`${API_BASE}/api/signatures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.signature) {
      if (response.status === 429) throw new Error("写得太快了，请过一会儿再试。");
      if (response.status === 422) throw new Error("这个名字或笔迹无法保存，请调整后重试。");
      throw new Error("签名墙暂时没有回应，请稍后重试。");
    }
    remoteSignatures.push(data.signature);
    localStorage.setItem(SUBMITTED_KEY, "true");
    closeModal();
    renderWall(data.signature.id);
    document.querySelector("#wall").scrollIntoView({ behavior: "smooth" });
    nameInput.value = "";
    drawName.value = "";
    styleNonce = 0;
    clearDrawing();
    updatePreview();
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "写入签名墙";
  }
}

function updateScroll() {
  const documentHeight = document.documentElement.scrollHeight - innerHeight;
  const percent = documentHeight > 0 ? scrollY / documentHeight : 0;
  document.querySelector("#progressBar").style.width = `${Math.min(100, percent * 100)}%`;
  document.querySelector("#progressText").textContent = percent < .08 ? "序章" : percent < .72 ? `阅读 ${Math.round(percent * 100)}%` : "留名";
}

function setupParticles() {
  const canvas = document.querySelector("#particles");
  const context = canvas.getContext("2d");
  const particles = Array.from({ length: innerWidth < 700 ? 32 : 70 }, (_, index) => ({
    x: randomFrom(index + 4, 1), y: randomFrom(index + 4, 2), size: .4 + randomFrom(index + 4, 3) * 1.3, speed: .00004 + randomFrom(index + 4, 4) * .00011,
  }));
  function resize() { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; }
  function frame(time) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const particle of particles) {
      const y = (particle.y + time * particle.speed) % 1;
      context.beginPath();
      context.arc(particle.x * canvas.width, y * canvas.height, particle.size * devicePixelRatio, 0, Math.PI * 2);
      context.fillStyle = `rgba(206,185,139,${.12 + particle.size * .07})`;
      context.fill();
    }
    requestAnimationFrame(frame);
  }
  resize();
  addEventListener("resize", resize);
  requestAnimationFrame(frame);
}

renderWall();
loadSignatures();
updatePreview();
resizeDrawingCanvas();
setupParticles();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => entry.target.classList.toggle("visible", entry.isIntersecting));
}, { threshold: .18 });
document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));

const endingObserver = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !autoOpened && !localStorage.getItem(SUBMITTED_KEY)) {
    autoOpened = true;
    setTimeout(openModal, 800);
  }
}, { threshold: .72 });
endingObserver.observe(document.querySelector("#letterEnding"));

document.querySelector("#signCta").addEventListener("click", openModal);
document.querySelector("#signAgain").addEventListener("click", openModal);
document.querySelector("#modalClose").addEventListener("click", closeModal);
document.querySelector("#autoTab").addEventListener("click", () => setMode("auto"));
document.querySelector("#drawTab").addEventListener("click", () => setMode("draw"));
document.querySelector("#shuffleStyle").addEventListener("click", () => { styleNonce += 1; updatePreview(); });
document.querySelector("#clearDrawing").addEventListener("click", clearDrawing);
submitButton.addEventListener("click", submitSignature);
nameInput.addEventListener("input", updatePreview);
drawCanvas.addEventListener("pointerdown", startDrawing);
drawCanvas.addEventListener("pointermove", continueDrawing);
drawCanvas.addEventListener("pointerup", () => { isDrawing = false; });
drawCanvas.addEventListener("pointercancel", () => { isDrawing = false; });
modal.addEventListener("click", (event) => { if (event.target === modal) closeModal(); });
addEventListener("scroll", updateScroll, { passive: true });
addEventListener("resize", () => resizeDrawingCanvas());
addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) closeModal();
});
updateScroll();
