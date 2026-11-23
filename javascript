const $ = (id) => document.getElementById(id);

const exerciseLibrary = {
  "Pecho": ["Flexiones de brazos", "Press de pecho con mancuernas", "Aperturas con mancuernas", "Press inclinado", "Flexiones inclinadas"],
  "Espalda": ["Remo con mancuerna", "Remo con banda elástica", "Superman", "Bird-dog", "Jalón con banda"],
  "Hombros": ["Press de hombros", "Elevaciones laterales", "Elevaciones frontales", "Pájaros inclinados"],
  "Bíceps": ["Curl de bíceps", "Curl martillo", "Curl concentrado", "Curl con banda"],
  "Tríceps": ["Fondos en banco", "Extensión sobre la cabeza", "Patada de tríceps", "Flexiones diamante"],
  "Piernas": ["Sentadillas", "Zancadas", "Peso muerto rumano", "Elevación de pantorrillas", "Sentadilla búlgara"],
  "Glúteos": ["Puente de glúteos", "Hip thrust", "Patada de glúteo", "Abducción de cadera", "Peso muerto sumo"],
  "Abdominales": ["Plancha", "Crunch abdominal", "Bicicleta abdominal", "Elevación de piernas", "Plancha lateral"],
  "Cuerpo completo": ["Burpees", "Sentadilla + press", "Mountain climbers", "Jumping jacks", "Thruster"]
};

const STORAGE = { routine: "nutrifit_routine_v1", meals: "nutrifit_meals_v1", history: "nutrifit_history_v1" };
let routine = readStore(STORAGE.routine, []);
let meals = readStore(STORAGE.meals, []);
let history = readStore(STORAGE.history, []);
let queue = [], queueIndex = 0, remaining = 0, phase = "work", running = false, interval = null;
let sessionCompleted = false;

function readStore(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveStore(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function updateExerciseOptions() {
  const group = $("muscleGroup").value;
  $("exerciseSelect").innerHTML = exerciseLibrary[group].map(name => `<option>${escapeHTML(name)}</option>`).join("");
}
function renderRoutine() {
  const list = $("routineList");
  if (!routine.length) {
    list.innerHTML = '<div class="empty-state"><span>＋</span><p>Aún no hay ejercicios.<br>Agrega el primero desde el constructor.</p></div>';
  } else {
    list.innerHTML = routine.map((item, index) => `
      <div class="exercise-row">
        <div><strong>${escapeHTML(item.name)}</strong><small>${escapeHTML(item.group)} · ${item.work}s trabajo · ${item.rest}s descanso</small></div>
        <span class="row-metrics">${item.sets} series</span>
        <button class="remove-exercise" data-remove="${index}" aria-label="Eliminar ${escapeHTML(item.name)}">×</button>
      </div>`).join("");
  }
  const sets = routine.reduce((sum, item) => sum + item.sets, 0);
  $("routineSummary").textContent = `${routine.length} ejercicios · ${sets} series`;
  $("startWorkout").disabled = !routine.length;
  $("exerciseCount").textContent = routine.length;
}
function addExercise() {
  const sets = Number($("setsInput").value), work = Number($("workInput").value), rest = Number($("restInput").value);
  if (!Number.isInteger(sets) || sets < 1 || sets > 12 || !Number.isInteger(work) || work < 5 || work > 900 || !Number.isInteger(rest) || rest < 0 || rest > 600) {
    alert("Revisa los valores: series 1–12, trabajo 5–900 segundos y descanso 0–600 segundos."); return;
  }
  if (running) stopTimer();
  routine.push({ group: $("muscleGroup").value, name: $("exerciseSelect").value, sets, work, rest });
  saveStore(STORAGE.routine, routine); renderRoutine();
}
function clearRoutine() {
  if (running) stopTimer();
  routine = []; saveStore(STORAGE.routine, routine); renderRoutine(); resetTimerUI();
}
function buildQueue() {
  queue = [];
  routine.forEach((item, exerciseIndex) => {
    for (let set = 1; set <= item.sets; set++) {
      queue.push({ ...item, exerciseIndex, set, phase: "work", duration: item.work });
      if (item.rest > 0 && !(exerciseIndex === routine.length - 1 && set === item.sets)) {
        queue.push({ ...item, exerciseIndex, set, phase: "rest", duration: item.rest });
      }
    }
  });
  queueIndex = 0; sessionCompleted = false;
}
function currentStep() { return queue[queueIndex]; }
function formatTime(seconds) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}
function updateTimerDisplay() {
  const step = currentStep();
  if (!step) return;
  $("timerExercise").textContent = step.name;
  $("timerMeta").textContent = `${step.group} · ${step.phase === "work" ? "Realiza el ejercicio" : "Recupera y prepárate"}`;
  $("timerPhase").textContent = step.phase === "work" ? "TRABAJO" : "DESCANSO";
  $("timerDisplay").textContent = formatTime(remaining);
  $("timerSet").textContent = `SERIE ${step.set} / ${step.sets}`;
  $("timerProgress").style.width = `${Math.max(0, Math.min(100, 100 * (1 - remaining / step.duration)))}%`;
}
function startWorkout() {
  if (!routine.length) return;
  stopTimer(); buildQueue(); remaining = currentStep().duration;
  $("timerStart").disabled = false; $("timerPause").disabled = true; $("timerNext").disabled = false; $("timerReset").disabled = false;
  updateTimerDisplay(); $("timerStart").textContent = "Comenzar";
  $("timerPanel").scrollIntoView({ behavior: "smooth", block: "center" });
}
function tick() {
  if (remaining > 0) remaining--;
  updateTimerDisplay();
  if (remaining <= 0) advanceStep();
}
function startTimer() {
  if (!queue.length) { startWorkout(); }
  if (!queue.length || running) return;
  running = true; $("timerStart").disabled = true; $("timerPause").disabled = false;
  interval = setInterval(tick, 1000);
}
function stopTimer() {
  running = false;
  if (interval) clearInterval(interval);
  interval = null;
}
function pauseTimer() {
  stopTimer(); $("timerStart").disabled = false; $("timerStart").textContent = "Continuar"; $("timerPause").disabled = true;
}
function advanceStep() {
  stopTimer();
  queueIndex++;
  if (queueIndex >= queue.length) { finishWorkout(); return; }
  remaining = currentStep().duration; updateTimerDisplay();
  $("timerStart").disabled = false; $("timerStart").textContent = "Continuar"; $("timerPause").disabled = true;
}
function finishWorkout() {
  stopTimer(); sessionCompleted = true;
  history.unshift({ date: new Date().toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }), exercises: routine.length, sets: routine.reduce((n, item) => n + item.sets, 0) });
  history = history.slice(0, 12); saveStore(STORAGE.history, history); renderHistory();
  $("timerExercise").textContent = "¡Sesión completada!";
  $("timerMeta").textContent = "Buen trabajo. Tu entrenamiento quedó registrado en tu historial.";
  $("timerPhase").textContent = "COMPLETADO"; $("timerDisplay").textContent = "✓"; $("timerSet").textContent = "SESIÓN FINALIZADA";
  $("timerProgress").style.width = "100%";
  $("timerStart").disabled = true; $("timerPause").disabled = true; $("timerNext").disabled = true;
}
function resetTimerUI() {
  stopTimer(); queue = []; queueIndex = 0;
  $("timerExercise").textContent = "Listo para comenzar"; $("timerMeta").textContent = "Agrega ejercicios y presiona «Iniciar sesión».";
  $("timerPhase").textContent = "PREPARADO"; $("timerDisplay").textContent = "00:00"; $("timerSet").textContent = "SERIE — / —";
  $("timerProgress").style.width = "0%";
  $("timerStart").disabled = $("timerPause").disabled = $("timerNext").disabled = $("timerReset").disabled = true;
}
function renderMeals() {
  const list = $("mealPlanList");
  if (!meals.length) list.innerHTML = '<p class="empty-meals">Todavía no has planificado comidas.</p>';
  else list.innerHTML = meals.map((meal, index) => `<div class="meal-item"><div><strong>${escapeHTML(meal.day)} · ${escapeHTML(meal.type)}</strong>${escapeHTML(meal.text)}</div><button data-meal-remove="${index}" aria-label="Eliminar comida">×</button></div>`).join("");
  $("mealCount").textContent = meals.length;
}
function addMeal() {
  const text = $("mealText").value.trim();
  if (!text) { $("mealText").focus(); return; }
  meals.push({ day: $("mealDay").value, type: $("mealType").value, text });
  meals.sort((a,b) => ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].indexOf(a.day) - ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"].indexOf(b.day));
  saveStore(STORAGE.meals, meals); $("mealText").value = ""; renderMeals();
}
function renderHistory() {
  $("completedCount").textContent = history.length;
  $("historyList").innerHTML = history.length ? history.map(item => `<div class="history-item"><span>${escapeHTML(item.date)}</span><span>${item.exercises} ejercicios · ${item.sets} series</span></div>`).join("") : '<p class="hint">Completa tu primera sesión para verla aquí.</p>';
}

$("muscleGroup").addEventListener("change", updateExerciseOptions);
$("addExercise").addEventListener("click", addExercise);
$("clearRoutine").addEventListener("click", clearRoutine);
$("routineList").addEventListener("click", event => {
  const button = event.target.closest("[data-remove]");
  if (!button) return;
  if (running) stopTimer();
  routine.splice(Number(button.dataset.remove), 1); saveStore(STORAGE.routine, routine); renderRoutine(); resetTimerUI();
});
$("startWorkout").addEventListener("click", startWorkout);
$("timerStart").addEventListener("click", startTimer);
$("timerPause").addEventListener("click", pauseTimer);
$("timerNext").addEventListener("click", advanceStep);
$("timerReset").addEventListener("click", startWorkout);
$("addMeal").addEventListener("click", addMeal);
$("mealText").addEventListener("keydown", event => { if (event.key === "Enter") addMeal(); });
$("mealPlanList").addEventListener("click", event => {
  const button = event.target.closest("[data-meal-remove]");
  if (!button) return;
  meals.splice(Number(button.dataset.mealRemove), 1); saveStore(STORAGE.meals, meals); renderMeals();
});
$("clearMeals").addEventListener("click", () => {
  if (!meals.length || confirm("¿Borrar toda la planificación semanal?")) { meals = []; saveStore(STORAGE.meals, meals); renderMeals(); }
});
$("mobileMenu").addEventListener("click", () => $("topbarNav")?.classList.toggle("open"));
const nav = document.querySelector(".topbar nav");
$("mobileMenu").addEventListener("click", () => nav.classList.toggle("open"));
nav.addEventListener("click", () => nav.classList.remove("open"));

updateExerciseOptions(); renderRoutine(); renderMeals(); renderHistory(); resetTimerUI();
