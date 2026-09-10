/* Read My Haftorah — reservation calendar, lookup and who's booked
   Ported from wame11/readmyhaftorah. The reservation logic, the Google
   Apps Script endpoint, the Hebcal lookup and the data sent are unchanged;
   only the markup and class names differ so it matches the site. */
(function () {
  "use strict";

  const USE_PROXY = false;
  const PROXY_URL = "https://corsproxy.io/?";
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby8Y5GCvJ9b9FiPEFduEvngqyvvcfAa6iaxPzmutZNI2qQx8h2ZitDm2Yhhb63WCbGu/exec";

  // Festivals with Haftorah (fallback) 2025–2026
  const FESTIVALS_FALLBACK = new Set([
    "2025-12-20",
    "2026-02-14","2026-02-28","2026-03-07","2026-03-14","2026-03-28",
    "2026-04-02","2026-04-03","2026-04-04","2026-04-08","2026-04-09",
    "2026-05-22","2026-05-23",
    "2026-07-18","2026-07-23","2026-07-25",
    "2026-09-12","2026-09-13","2026-09-19","2026-09-21",
    "2026-09-26","2026-09-27","2026-10-03","2026-10-04",
    "2026-12-05","2026-12-12"
  ]);

  const FESTIVAL_HAFTORAH = {
    "2025-12-20": "Roni VeSimchi",
    "2026-02-14": "Yehoash Melech Yehudah",
    "2026-02-28": "Pokedti Es Asher Asah Amalek",
    "2026-03-07": "VeZarakti Aleichem Mayim Tehorim",
    "2026-03-14": "Ko Amar Hashem Elokim BaRishon",
    "2026-03-28": "VeArevah LaHashem",
    "2026-04-02": "VaYehoshua",
    "2026-04-03": "VaYomer Yoshiyahu",
    "2026-04-04": "HaAtzamos HaYevayshos",
    "2026-04-08": "VaYedaber Dovid",
    "2026-04-09": "Od HaYom",
    "2026-05-22": "Ma'aseh Merkavah",
    "2026-05-23": "Hashem BeHeichal Kodsho",
    "2026-07-18": "Chazon Yeshayahu",
    "2026-07-23": "Asof Asifeim",
    "2026-07-25": "Nachamu Nachamu Ami",
    "2026-09-12": "VaYehi HaYom",
    "2026-09-13": "Ko Amar Hashem Motzo Chen",
    "2026-09-19": "Shuvah Yisroel",
    "2026-09-21": "Solu Solu (Shacharis) / Yonah (Mincha)",
    "2026-09-26": "Hineh Yom Bo LaHashem",
    "2026-09-27": "VaYikahalu El HaMelech",
    "2026-10-03": "VaYehi KeChalos Shlomo",
    "2026-10-04": "VaYehi Acharei Mos Moshe",
    "2026-12-05": "Roni VeSimchi",
    "2026-12-12": "VaYa'as Chiram"
  };

  const FESTIVAL_NAME = {
    "2025-12-20": "Shabbos Chanukah",
    "2026-02-14": "Shabbos Shekalim",
    "2026-02-28": "Shabbos Zachor",
    "2026-03-07": "Shabbos Parah",
    "2026-03-14": "Shabbos HaChodesh",
    "2026-03-28": "Shabbos HaGadol",
    "2026-04-02": "Pesach I",
    "2026-04-03": "Pesach II",
    "2026-04-04": "Shabbos Chol HaMoed Pesach",
    "2026-04-08": "Pesach VII",
    "2026-04-09": "Pesach VIII",
    "2026-05-22": "Shavuos I",
    "2026-05-23": "Shavuos II",
    "2026-07-18": "Shabbos Chazon",
    "2026-07-23": "Tishah BeAv",
    "2026-07-25": "Shabbos Nachamu",
    "2026-09-12": "Rosh Hashonoh I",
    "2026-09-13": "Rosh Hashonoh II",
    "2026-09-19": "Shabbos Shuvah",
    "2026-09-21": "Yom Kippour",
    "2026-09-26": "Sukkos I",
    "2026-09-27": "Sukkos II",
    "2026-10-03": "Shemini Atzeres",
    "2026-10-04": "Simchas Torah",
    "2026-12-05": "Shabbos Chanukah",
    "2026-12-12": "Shabbos Chanukah"
  };

  const HEB_START = "2025-01-01";
  const HEB_END = "2035-12-31";

  let bookings = [];
  let selected = null;
  let viewDate = new Date();
  let userPhone = localStorage.getItem("haftorahUserPhone") || "";
  let hefIndex = [];
  let festivalSet = new Set();

  const grid = document.getElementById("hfGrid");
  const monthLabel = document.getElementById("hfMonthLabel");
  const formBox = document.getElementById("hfFormBox");
  const loading = document.getElementById("hfLoading");
  const whoBookedList = document.getElementById("hfWhoBookedList");
  const whoBookedSearch = document.getElementById("hfWhoBookedSearch");

  if (!grid || !monthLabel || !formBox) return;

  function endpoint(path) { const base = USE_PROXY ? (PROXY_URL + SCRIPT_URL) : SCRIPT_URL; return path ? (base + path) : base; }
  function makeDate(y, m, d) { return new Date(Date.UTC(y, m - 1, d, 12)); }
  function formatISO(y, m, d) { return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function normaliseBackendDate(val) {
    if (val === null || val === undefined) return "";
    let s = String(val).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.length > 10 && s.charAt(10) === "T") return s.substring(0, 10);
    let cleaned = s.charAt(0) === "'" ? s.substring(1).trim() : s;
    let uk = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (uk) {
      let day = Number(uk[1]), month = Number(uk[2]), year = Number(uk[3]);
      if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) return formatISO(year, month, day);
    }
    let d = new Date(cleaned);
    if (!isNaN(d)) return formatISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    return "";
  }

  async function fetchHebcalRange() {
    const url = `https://www.hebcal.com/hebcal?v=1&cfg=json&start=${HEB_START}&end=${HEB_END}&maj=on&min=on&mod=on&s=on`;
    const res = await fetch(url);
    const data = await res.json();
    const items = data.items || [];
    hefIndex = items
      .filter(it => it.category === "parashat" || (it.title && it.title.toLowerCase().includes("parashat")))
      .map(it => ({ date: it.date.substring(0, 10), title: it.title.replace("Parashat ", "").trim() }));
    festivalSet = new Set(items
      .filter(it => it.category === "holiday")
      .map(it => it.date.substring(0, 10)));
  }

  function findHaftorahByDate(iso) {
    if (FESTIVAL_HAFTORAH[iso]) return FESTIVAL_HAFTORAH[iso];
    const hit = hefIndex.find(x => x.date === iso);
    return hit ? hit.title : "Haftorah TBD";
  }

  function fuzzyMatch(term) {
    const t = term.trim().toLowerCase();
    if (!t) return [];
    return hefIndex
      .filter(x => x.title.toLowerCase().includes(t) || leven(x.title.toLowerCase(), t) <= 2)
      .slice(0, 8);
  }

  function leven(a, b) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl; if (bl === 0) return al;
    const dp = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[al][bl];
  }

  async function fetchBookings() {
    loading.hidden = false;
    try {
      const res = await fetch(endpoint());
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      bookings = Array.isArray(data) ? data.map(b => ({ date: normaliseBackendDate(b.date), name: String(b.name || "").trim(), dedication: String(b.dedication || "").trim() })).filter(b => b.date) : [];
      localStorage.setItem("haftorahBookings", JSON.stringify(bookings));
    } catch (e) {
      console.error("Fetch failed:", e);
      const saved = localStorage.getItem("haftorahBookings");
      bookings = saved ? JSON.parse(saved) : [];
    }
    loading.hidden = true;
    renderCalendar();
    renderWhoBooked();
    if (selected) renderForm();
  }

  function renderCalendar() {
    monthLabel.textContent = viewDate.toLocaleString("en-GB", { month: "long", year: "numeric" });
    grid.innerHTML = "";
    const y = viewDate.getFullYear();
    const m = viewDate.getMonth() + 1;
    const todayMid = makeDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

    const days = getCalendarDays(y, m);
    for (let d of days) {
      const cy = d.getUTCFullYear(), cm = d.getUTCMonth() + 1, cd = d.getUTCDate();
      const iso = formatISO(cy, cm, cd);
      const thisMonth = cm === m;
      const booking = bookings.find(b => b.date === iso);
      const taken = !!booking;
      const isPast = d < todayMid;
      const isFestival = FESTIVALS_FALLBACK.has(iso);
      const isSat = d.getUTCDay() === 6;
      const selectable = (isSat || isFestival) && thisMonth && !taken && !isPast;
      const clickableReserved = taken && thisMonth;

      const cell = document.createElement("button");
      cell.type = "button";
      cell.disabled = !(selectable || clickableReserved);
      cell.className = "cal__day" +
        (selectable ? " is-available" : clickableReserved ? " is-reserved" : " is-off") +
        (thisMonth ? "" : " is-other");

      let contentHtml = "";
      if (taken) {
        const fullName = booking.name || "Reserved";
        const shortName = fullName.length > 10 ? fullName.substring(0, 10) + "..." : fullName;
        contentHtml =
          '<span class="chip chip--booked">Reserved</span>' +
          '<span class="cal__name" data-tooltip="' + esc(fullName) + '">' + esc(shortName) + '</span>';
      } else if (selectable && isFestival) {
        contentHtml = '<span class="chip chip--festival">Festival</span>';
      } else if (selectable) {
        contentHtml = '<span class="chip chip--free">Available</span>';
      } else if ((isSat || isFestival) && !thisMonth) {
        contentHtml = '<span class="chip chip--other">Other month</span>';
      }

      cell.innerHTML = '<span class="cal__num">' + cd + '</span>' + contentHtml;
      cell.setAttribute("aria-label", d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }) + (taken ? ", reserved by " + (booking.name || "someone") : selectable ? ", available" : ""));

      if (selectable || clickableReserved) {
        cell.onclick = () => {
          selected = d;
          renderForm();
          renderCalendar();
          if (window.matchMedia("(max-width: 860px)").matches) {
            formBox.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        };
      }

      if (selected && formatISO(selected.getUTCFullYear(), selected.getUTCMonth() + 1, selected.getUTCDate()) === iso) {
        cell.classList.add("is-selected");
      }
      grid.appendChild(cell);
    }
  }

  function renderWhoBooked() {
    if (!whoBookedList) return;
    const term = (whoBookedSearch && whoBookedSearch.value || "").trim().toLowerCase();
    const today = new Date();
    const todayStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const filtered = bookings
      .filter(b => b.date >= todayStr)
      .filter(b => {
        const niceDate = new Date(b.date + "T12:00:00Z").toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long", year: "numeric"
        }).toLowerCase();
        const name = (b.name || "").toLowerCase();
        return niceDate.includes(term) || name.includes(term);
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    if (!filtered.length) {
      whoBookedList.innerHTML = '<p class="muted" style="text-align:center;padding:1rem 0">No upcoming bookings found.</p>';
      return;
    }

    whoBookedList.innerHTML =
      '<table class="who-table"><thead><tr><th>Date</th><th>Name</th></tr></thead><tbody>' +
      filtered.map(b => {
        const dateObj = new Date(b.date + "T12:00:00Z");
        const displayDate = dateObj.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
        const fullName = b.name || "Reserved";
        const shortName = fullName.length > 10 ? fullName.substring(0, 10) + "..." : fullName;
        return '<tr><td>' + esc(displayDate) + '</td><td><span class="who-name" data-tooltip="' + esc(fullName) + '">' + esc(shortName) + '</span></td></tr>';
      }).join("") +
      '</tbody></table>';
  }

  function getCalendarDays(year, month) {
    const first = makeDate(year, month, 1);
    const startOffset = (first.getUTCDay() + 6) % 7;
    const startDay = 1 - startOffset;
    const days = [];
    for (let i = 0; i < 42; i++) {
      days.push(new Date(Date.UTC(year, month - 1, startDay + i, 12)));
    }
    return days;
  }

  function renderForm() {
    if (!selected) {
      formBox.innerHTML = '<p class="form-intro">Select an available date on the calendar to reserve the Haftorah at <strong>Hadley Wood Shul</strong>.</p>';
      return;
    }
    const iso = formatISO(selected.getUTCFullYear(), selected.getUTCMonth() + 1, selected.getUTCDate());
    const nice = selected.toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const haftorah = findHaftorahByDate(iso);
    const festivalName = FESTIVAL_NAME[iso] || "";
    const booking = bookings.find(b => b.date === iso);
    const taken = !!booking;

    if (taken) {
      formBox.innerHTML =
        '<div class="form-head"><h3>' + nice + '</h3><button id="hfChangeDate" type="button" class="link-btn">Close</button></div>' +
        '<div class="reserved-card">' +
          '<p class="reserved-card__badge"><span class="chip chip--booked">Already reserved</span></p>' +
          '<dl class="reserved-card__list">' +
            '<div><dt>Reserved by</dt><dd>' + esc(booking.name || "Reserved") + '</dd></div>' +
            '<div><dt>Date</dt><dd>' + nice + '</dd></div>' +
            '<div><dt>Haftorah</dt><dd>' + esc(haftorah) + '</dd></div>' +
            (festivalName ? '<div><dt>Festival</dt><dd>' + esc(festivalName) + '</dd></div>' : '') +
            (booking.dedication ? '<div><dt>Dedication</dt><dd>' + esc(booking.dedication) + '</dd></div>' : '') +
          '</dl>' +
          '<p class="muted" style="font-size:0.9rem;text-align:center;margin:0.75rem 0 0">This date is not available for booking.</p>' +
        '</div>';
      document.getElementById("hfChangeDate").onclick = () => { selected = null; renderForm(); renderCalendar(); };
      return;
    }

    formBox.innerHTML =
      '<div class="form-head"><h3>' + nice + '</h3><button id="hfChangeDate" type="button" class="link-btn">Change date</button></div>' +
      '<form id="hfBookingForm" class="kform">' +
        '<div class="kform__field"><label for="hfName">Full name</label><input required id="hfName" name="name" autocomplete="name"></div>' +
        '<div class="kform__field"><label for="hfPhone">Mobile number</label><input required id="hfPhone" name="phone" type="tel" placeholder="0..." autocomplete="tel"></div>' +
        '<div class="kform__field kform__full"><label for="hfDedication">Notes / Dedication</label><input id="hfDedication" name="dedication" value="Haftorah: ' + esc(haftorah) + '"></div>' +
        '<div class="kform__full kform__actions"><button id="hfReserveBtn" type="submit" class="btn btn--primary">Reserve date</button><span id="hfSavedMsg" class="form-msg" hidden></span></div>' +
      '</form>' +
      '<p class="muted" style="font-size:0.9rem;margin-top:0.75rem">Haftorah for this date: <strong>' + esc(haftorah) + '</strong>' +
      (festivalName ? '<br>Festival: <strong>' + esc(festivalName) + '</strong>' : '') + '</p>';

    const phoneInput = formBox.querySelector('input[name="phone"]');
    if (phoneInput && userPhone) phoneInput.value = userPhone;

    document.getElementById("hfChangeDate").onclick = () => { selected = null; renderForm(); renderCalendar(); };

    document.getElementById("hfBookingForm").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        date: iso,
        name: fd.get("name").trim(),
        phone: fd.get("phone").trim(),
        dedication: fd.get("dedication").trim(),
        haftorah: haftorah
      };
      if (!payload.phone) { alert("Please enter a mobile number."); return; }

      userPhone = payload.phone;
      localStorage.setItem("haftorahUserPhone", userPhone);

      const btn = document.getElementById("hfReserveBtn");
      btn.disabled = true; btn.textContent = "Reserving...";
      const msg = document.getElementById("hfSavedMsg");
      msg.textContent = "Saving..."; msg.hidden = false; msg.className = "form-msg";

      try {
        const res = await fetch(endpoint(), {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload)
        });
        const text = await res.text();
        let json = null; try { json = JSON.parse(text); } catch (_) { }
        if (!res.ok) throw new Error("HTTP " + res.status + (json && json.message ? ": " + json.message : ""));
        if (json && json.status === "error") throw new Error(json.message || "Server error");

        msg.textContent = "Reserved!";
        msg.className = "form-msg form-msg--ok";
        formBox.innerHTML = '<div class="form-success">Reservation for <strong>' + nice + '</strong> saved. Haftorah: <strong>' + esc(haftorah) + '</strong>' + (festivalName ? '<br>Festival: <strong>' + esc(festivalName) + '</strong>' : '') + '</div>';
        selected = null;
        localStorage.removeItem("haftorahBookings");
        setTimeout(fetchBookings, 800);
      } catch (err) {
        console.error("Reservation failed:", err);
        msg.textContent = "Error — please try again or contact via WhatsApp.";
        msg.className = "form-msg form-msg--error";
        msg.hidden = false;
        btn.disabled = false; btn.textContent = "Reserve date";
      }
    };
  }

  document.getElementById("hfPrev").onclick = () => { viewDate.setMonth(viewDate.getMonth() - 1); renderCalendar(); };
  document.getElementById("hfNext").onclick = () => { viewDate.setMonth(viewDate.getMonth() + 1); renderCalendar(); };

  if (whoBookedSearch) {
    whoBookedSearch.addEventListener("input", renderWhoBooked);
  }

  renderForm();

  async function init() {
    await fetchHebcalRange();
    await fetchBookings();
    initFaqChat();
  }
  init();

  document.getElementById("hfLookupBtn").onclick = () => {
    const term = document.getElementById("hfLookupInput").value;
    const results = fuzzyMatch(term);
    const box = document.getElementById("hfLookupResults");
    if (!term.trim()) { box.textContent = "Please enter a name."; return; }
    if (!results.length) { box.textContent = "No matches found. Try a different spelling."; return; }
    box.innerHTML = results.map(r => '<div class="lookup__hit"><strong>' + esc(r.title) + '</strong> &mdash; ' + new Date(r.date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) + '</div>').join("");
  };
  document.getElementById("hfLookupInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); document.getElementById("hfLookupBtn").click(); }
  });

  const FAQ_ITEMS = [
    { q: "How do I reserve a Haftorah?", a: "Scroll to the calendar, pick an available date, and submit the form." },
    { q: "Bar/Bat Mitzvahs?", a: "You can reserve here; formal Bar/Bat Mitzvah bookings still go through the office." },
    { q: "Change my reservation?", a: "Message in the Haftorah WhatsApp group." },
    { q: "Who sees my details?", a: "Only the organisers." },
    { q: "A date says 'Reserved'?", a: "It's taken—please choose another date." }
  ];
  function initFaqChat() {
    const panel = document.getElementById("faqChatPanel");
    const toggleBtn = document.getElementById("faqChatToggle");
    const closeBtn = document.getElementById("faqChatClose");
    const questionsBox = document.getElementById("faqChatQuestions");
    const messagesBox = document.getElementById("faqChatMessages");
    if (!panel || !toggleBtn) return;
    questionsBox.innerHTML = "";
    FAQ_ITEMS.forEach(item => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-q";
      btn.textContent = item.q;
      btn.onclick = () => addFaqMessage(item.q, item.a, messagesBox);
      questionsBox.appendChild(btn);
    });
    toggleBtn.onclick = () => { panel.hidden = !panel.hidden; toggleBtn.setAttribute("aria-expanded", String(!panel.hidden)); };
    closeBtn.onclick = () => { panel.hidden = true; toggleBtn.setAttribute("aria-expanded", "false"); };
  }
  function addFaqMessage(question, answer, messagesBox) {
    const userBubble = document.createElement("div");
    userBubble.className = "chat-row chat-row--user";
    userBubble.innerHTML = '<div class="chat-bubble chat-bubble--user">' + esc(question) + "</div>";
    messagesBox.appendChild(userBubble);
    const typing = document.createElement("div");
    typing.className = "chat-row";
    typing.innerHTML = '<div class="chat-bubble"><span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div>';
    messagesBox.appendChild(typing);
    messagesBox.scrollTop = messagesBox.scrollHeight;
    setTimeout(() => {
      if (typing.parentNode === messagesBox) messagesBox.removeChild(typing);
      const bot = document.createElement("div");
      bot.className = "chat-row";
      bot.innerHTML = '<div class="chat-bubble">' + esc(answer) + "</div>";
      messagesBox.appendChild(bot);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 1200);
  }
})();
