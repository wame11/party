const canvas = document.getElementById("spark-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let width = 0;
let height = 0;
let sparks = [];
const pointer = { x: 0, y: 0, active: false };

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  createSparks();
}

function createSparks() {
  const count = Math.max(42, Math.floor((width * height) / 28000));
  sparks = Array.from({ length: count }, (_, index) => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.32,
    vy: (Math.random() - 0.5) * 0.32,
    size: 1 + Math.random() * 1.8,
    hue: [184, 78, 351, 44, 260][index % 5],
  }));
}

function drawSparks() {
  if (prefersReducedMotion) return;
  ctx.clearRect(0, 0, width, height);

  for (const spark of sparks) {
    spark.x += spark.vx;
    spark.y += spark.vy;

    if (spark.x < -20) spark.x = width + 20;
    if (spark.x > width + 20) spark.x = -20;
    if (spark.y < -20) spark.y = height + 20;
    if (spark.y > height + 20) spark.y = -20;

    ctx.beginPath();
    ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${spark.hue}, 95%, 68%, 0.56)`;
    ctx.fill();

    if (pointer.active) {
      const dx = spark.x - pointer.x;
      const dy = spark.y - pointer.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 130) {
        ctx.beginPath();
        ctx.moveTo(spark.x, spark.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.strokeStyle = `hsla(${spark.hue}, 95%, 70%, ${0.18 - distance / 900})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  requestAnimationFrame(drawSparks);
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointermove", (event) => {
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  pointer.active = true;
});
window.addEventListener("pointerleave", () => {
  pointer.active = false;
});

resizeCanvas();
drawSparks();

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.18 }
);

document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

const planPanel = document.querySelector(".check-panel");
const checkboxes = [...document.querySelectorAll(".check-panel input")];
const progress = document.getElementById("plan-progress");
const score = document.getElementById("plan-score");

function updatePlanProgress() {
  const completed = checkboxes.filter((box) => box.checked).length;
  const total = checkboxes.length;
  const percent = Math.round((completed / total) * 100);
  progress.style.width = `${percent}%`;
  score.textContent = completed === total ? "ready to go" : `${completed}/${total} ready`;
  planPanel.dataset.complete = completed === total ? "true" : "false";
}

checkboxes.forEach((box) => box.addEventListener("change", updatePlanProgress));
updatePlanProgress();

document.querySelectorAll(".tilt-card").forEach((card) => {
  card.addEventListener("pointermove", (event) => {
    if (prefersReducedMotion) return;
    const rect = card.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const rotateY = ((x / rect.width) - 0.5) * 8;
    const rotateX = ((y / rect.height) - 0.5) * -8;
    card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
  });

  card.addEventListener("pointerleave", () => {
    card.style.transform = "";
  });
});
