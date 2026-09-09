/* Book My Kiddush — booking calendar and form
   Ported from wame11/bookmykiddushhw. The booking logic, the Google Apps
   Script endpoint and the data sent to it are unchanged; only the markup
   and class names differ so the page matches the rest of the site. */
(function () {
  "use strict";

  const USE_PROXY = false;
  const PROXY_URL = "https://corsproxy.io/?";
  const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywFQwN2xaU71S6_VKYVqIvdR_IquIVCNTRD1XS5ri_3Fs9LeL0_Ql-TT7FxMZ4DxAo/exec";

  const FESTIVALS = new Set([
    "2025-04-13","2025-04-14","2025-04-19","2025-04-20",
    "2025-06-02","2025-06-03",
    "2025-09-23","2025-09-24",
    "2025-10-07","2025-10-08",
    "2025-10-14","2025-10-15"
  ]);

  // ── Package content data ──────────────────────────────────────────────
  const STANDARD_ITEMS = [
    "Fish balls",
    "Smoked salmon",
    "Herring platter",
    "3 dips with crackers",
    "Fruit",
    "Biscuits",
    "Wine",
    "Whisky",
    "Fruit juice"
  ];

  const PREMIUM_EXTRAS = [
    "Filled mini challah rolls",
    "Danish platter",
    "Petit fours",
    "Sushi",
    "Fish goujons",
    "Kugel"
  ];
  // ─────────────────────────────────────────────────────────────────────

  var bookings = [];
  var selected = null;
  var viewDate = new Date();
  var userEmail = localStorage.getItem("kiddushUserEmail") || null;

  var grid = document.getElementById("grid");
  var monthLabel = document.getElementById("monthLabel");
  var formBox = document.getElementById("formBox");
  var loading = document.getElementById("loading");

  if (!grid || !monthLabel || !formBox) return;

  function endpoint(path) {
    var base = USE_PROXY ? (PROXY_URL + SCRIPT_URL) : SCRIPT_URL;
    return path ? (base + path) : base;
  }

  function makeDate(y, m, d) {
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function formatISO(y, m, d) {
    return y + "-" + String(m).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function normaliseBackendDate(val) {
    if (val === null || val === undefined) return "";
    var s = String(val).trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.length > 10 && s.charAt(10) === 'T') return s.substring(0, 10);
    var cleaned = s.charAt(0) === "'" ? s.substring(1).trim() : s;
    var uk = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (uk) {
      var day = Number(uk[1]), month = Number(uk[2]), year = Number(uk[3]);
      if (year && month >= 1 && month <= 12 && day >= 1 && day <= 31) return formatISO(year, month, day);
    }
    var d = new Date(cleaned);
    if (!isNaN(d)) return formatISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    return "";
  }

  async function fetchBookings() {
    loading.hidden = false;
    try {
      var res = await fetch(endpoint());
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      bookings = Array.isArray(data)
        ? data.map(function (b) { return { date: normaliseBackendDate(b.date) }; }).filter(function (b) { return b.date; })
        : [];
      localStorage.setItem("kiddushBookings", JSON.stringify(bookings));
    } catch (e) {
      console.error("Fetch failed:", e);
      var saved = localStorage.getItem("kiddushBookings");
      bookings = saved ? JSON.parse(saved) : [];
    }

    loading.hidden = true;
    renderCalendar();
    if (selected) renderForm();
  }

  function renderCalendar() {
    monthLabel.textContent = viewDate.toLocaleString("en-GB", { month: "long", year: "numeric" });
    grid.innerHTML = "";

    var y = viewDate.getFullYear();
    var m = viewDate.getMonth() + 1;
    var todayMid = makeDate(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

    var days = getCalendarDays(y, m);
    for (var i = 0; i < days.length; i++) {
      var d = days[i];
      var cy = d.getUTCFullYear(), cm = d.getUTCMonth() + 1, cd = d.getUTCDate();
      var iso = formatISO(cy, cm, cd);
      var thisMonth = cm === m;
      var taken = false;
      for (var j = 0; j < bookings.length; j++) {
        if (bookings[j].date === iso) { taken = true; break; }
      }
      var isPast = d < todayMid;
      var selectable = isSaturdayOrFestival(d) && thisMonth && !taken && !isPast;

      var cell = document.createElement("button");
      cell.type = "button";
      cell.disabled = !selectable;
      cell.className = "cal__day" + (selectable ? " is-available" : " is-off") + (thisMonth ? "" : " is-other");

      var chipHtml = "";
      if (taken) {
        chipHtml = '<span class="chip chip--booked">Booked</span>';
      } else if (selectable) {
        chipHtml = '<span class="chip chip--free">Available</span>';
      } else if (isSaturdayOrFestival(d) && !thisMonth) {
        chipHtml = '<span class="chip chip--other">Other month</span>';
      }

      cell.innerHTML = '<span class="cal__num">' + cd + '</span>' + chipHtml;
      cell.setAttribute("aria-label", d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }) + (taken ? ", booked" : selectable ? ", available" : ""));

      if (selectable) {
        (function (dateObj) {
          cell.onclick = function () {
            selected = dateObj;
            renderForm();
            renderCalendar();
            var box = document.getElementById("formBox");
            if (box && window.matchMedia("(max-width: 860px)").matches) {
              box.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          };
        })(d);
      }

      if (selected && formatISO(selected.getUTCFullYear(), selected.getUTCMonth() + 1, selected.getUTCDate()) === iso) {
        cell.classList.add("is-selected");
      }

      grid.appendChild(cell);
    }
  }

  function getCalendarDays(year, month) {
    var first = makeDate(year, month, 1);
    var startOffset = (first.getUTCDay() + 6) % 7;
    var startDay = 1 - startOffset;
    var days = [];
    for (var i = 0; i < 42; i++) {
      days.push(new Date(Date.UTC(year, month - 1, startDay + i, 12)));
    }
    return days;
  }

  function isSaturdayOrFestival(d) {
    return d.getUTCDay() === 6 || FESTIVALS.has(formatISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()));
  }

  // ── Build the package details HTML ────────────────────────────────────
  function buildPackageDetails(packageValue) {
    if (!packageValue) return "";

    var standardListHtml = STANDARD_ITEMS.map(function (item) {
      return '<li>' + item + '</li>';
    }).join("");

    if (packageValue === "225.00") {
      return (
        '<div class="pkg">' +
          '<h4>Standard Kiddush &mdash; what&rsquo;s included</h4>' +
          '<ul class="pkg__list">' + standardListHtml + '</ul>' +
        '</div>'
      );
    }

    if (packageValue === "350.00") {
      var extrasHtml = PREMIUM_EXTRAS.map(function (extra, idx) {
        var id = "premiumExtra_" + idx;
        return (
          '<div class="extra-option">' +
            '<input type="radio" name="premiumExtra" id="' + id + '" value="' + extra + '">' +
            '<label for="' + id + '">' + extra + '</label>' +
          '</div>'
        );
      }).join("");

      return (
        '<div class="pkg">' +
          '<h4>Premium Kiddush &mdash; what&rsquo;s included</h4>' +
          '<ul class="pkg__list">' + standardListHtml + '</ul>' +
          '<div class="pkg__extras">' +
            '<p class="pkg__extras-title">Plus, choose one extra:</p>' +
            '<div class="extra-grid">' + extrasHtml + '</div>' +
            '<p id="extraError" class="form-error" hidden>Please select one extra option.</p>' +
          '</div>' +
        '</div>'
      );
    }

    if (packageValue === "To be discussed with Chantelle") {
      return (
        '<div class="pkg pkg--special">' +
          '<h4>Special package</h4>' +
          '<p>Our team will be in touch to discuss a bespoke package tailored to your occasion. Simply complete and submit the form and the office will contact you to arrange the details.</p>' +
        '</div>'
      );
    }

    return "";
  }
  // ─────────────────────────────────────────────────────────────────────

  function renderForm() {
    if (!selected) {
      formBox.innerHTML = '<p class="form-intro">Select an available date on the calendar to sponsor the Kiddush at <strong>Hadley Wood Shul</strong>.</p>';
      return;
    }

    var iso = formatISO(selected.getUTCFullYear(), selected.getUTCMonth() + 1, selected.getUTCDate());

    var nice = selected.toLocaleDateString("en-GB", {
      timeZone: "Europe/London",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    formBox.innerHTML =
      '<div class="form-head">' +
        '<h3>' + nice + '</h3>' +
        '<button id="changeDate" type="button" class="link-btn">Change date</button>' +
      '</div>' +
      '<form id="bookingForm" class="kform">' +
        '<div class="kform__field">' +
          '<label for="kName">Full name</label>' +
          '<input required id="kName" name="name" autocomplete="name">' +
        '</div>' +
        '<div class="kform__field">' +
          '<label for="kEmail">Email</label>' +
          '<input required type="email" id="kEmail" name="email" autocomplete="email">' +
        '</div>' +
        '<div class="kform__field">' +
          '<label for="sponsorshipAmount">Sponsorship package</label>' +
          '<select required id="sponsorshipAmount">' +
            '<option value="">Select a package</option>' +
            '<option value="225.00">Standard (£225)</option>' +
            '<option value="350.00">Premium (£350)</option>' +
            '<option value="To be discussed with Chantelle">Special (contact office)</option>' +
          '</select>' +
        '</div>' +
        '<div class="kform__field">' +
          '<label for="kShul">Synagogue</label>' +
          '<input disabled id="kShul" value="Hadley Wood Shul">' +
        '</div>' +
        '<div id="packageDetailsSlot" class="kform__full"></div>' +
        '<div class="kform__field kform__full">' +
          '<label for="kDedication">Dedication (optional)</label>' +
          '<input id="kDedication" name="dedication">' +
        '</div>' +
        '<div class="kform__full kform__actions">' +
          '<button id="reserveBtn" type="submit" class="btn btn--primary">Reserve date</button>' +
          '<span id="savedMsg" class="form-msg" hidden></span>' +
        '</div>' +
      '</form>';

    var emailInput = formBox.querySelector('input[name="email"]');
    if (emailInput && userEmail) emailInput.value = userEmail;

    var selectEl = document.getElementById("sponsorshipAmount");
    var detailsSlot = document.getElementById("packageDetailsSlot");

    selectEl.addEventListener("change", function () {
      detailsSlot.innerHTML = buildPackageDetails(this.value);
    });

    document.getElementById("changeDate").onclick = function () {
      selected = null;
      renderForm();
      renderCalendar();
    };

    document.getElementById("bookingForm").onsubmit = async function (e) {
      e.preventDefault();

      var fd = new FormData(e.target);
      var amount = document.getElementById("sponsorshipAmount").value;
      if (!amount) {
        alert("Please select a sponsorship package.");
        return;
      }

      var premiumExtraValue = "";
      if (amount === "350.00") {
        var checkedExtra = document.querySelector('input[name="premiumExtra"]:checked');
        var extraError = document.getElementById("extraError");
        if (!checkedExtra) {
          if (extraError) extraError.hidden = false;
          return;
        }
        if (extraError) extraError.hidden = true;
        premiumExtraValue = checkedExtra.value;
      }

      var btn = document.getElementById("reserveBtn");
      btn.disabled = true;
      btn.textContent = "Reserving...";

      var amountForSheet;
      if (amount === "To be discussed with Chantelle") {
        amountForSheet = amount;
      } else if (amount === "350.00" && premiumExtraValue) {
        amountForSheet = parseFloat(amount).toFixed(2) + " (Premium + " + premiumExtraValue + ")";
      } else {
        amountForSheet = parseFloat(amount).toFixed(2);
      }

      var payload = {
        date: iso,
        name: fd.get("name").trim(),
        email: fd.get("email").toLowerCase().trim(),
        amount: amountForSheet,
        dedication: fd.get("dedication").trim(),
        synagogue: "Hadley Wood Shul"
      };

      userEmail = payload.email;
      localStorage.setItem("kiddushUserEmail", userEmail);

      var msg = document.getElementById("savedMsg");
      msg.textContent = "Saving...";
      msg.hidden = false;
      msg.className = "form-msg";

      try {
        var res = await fetch(endpoint(), {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify(payload)
        });

        var text = await res.text();
        console.log("=== RAW SERVER RESPONSE ===", text);

        var json = null;
        try { json = JSON.parse(text); } catch (parseErr) {
          console.error("Parse failed:", parseErr, "Raw:", text);
          throw new Error("Server returned invalid response. Please try again or contact the office.");
        }

        if (!res.ok) throw new Error("Server error: " + (json && json.message ? json.message : "HTTP " + res.status));
        if (json && json.status === "error") throw new Error(json.message || "Unable to complete booking");

        msg.textContent = "Booking confirmed!";
        msg.className = "form-msg form-msg--ok";

        formBox.innerHTML = '<div class="form-success">Booking for <strong>' + nice + '</strong> reserved successfully! A confirmation email is on its way.</div>';

        selected = null;
        localStorage.removeItem("kiddushBookings");
        setTimeout(fetchBookings, 800);

      } catch (err) {
        console.error("Reservation failed:", err);

        btn.disabled = false;
        btn.textContent = "Reserve date";

        msg.textContent = "⚠️ " + err.message;
        msg.className = "form-msg form-msg--error";
        msg.hidden = false;

        alert("Booking failed: " + err.message + "\n\nPlease try again or contact the office at office@hwjc.org.uk");
      }
    };
  }

  document.getElementById("prevBtn").onclick = function () {
    viewDate.setMonth(viewDate.getMonth() - 1);
    renderCalendar();
  };

  document.getElementById("nextBtn").onclick = function () {
    viewDate.setMonth(viewDate.getMonth() + 1);
    renderCalendar();
  };

  renderForm();
  fetchBookings();

  // ===== Simple FAQ "chat" widget with pre-written Q&A and typing dots =====
  const FAQ_ITEMS = [
    {
      q: "How do I book a Kiddush?",
      a: "Scroll to the calendar, choose an available date, select your preferred sponsorship package, and complete the booking form."
    },
    {
      q: "What about Bar/Bat Mitzvahs?",
      a: "By all means book your Kiddush, but please be aware there is a separate process for booking Bar/Bat Mitzvah celebrations through the office."
    },
    {
      q: "Can I cancel or change my booking?",
      a: "Yes. Please contact the office for help with cancellations or changes."
    },
    {
      q: "Who can see the amount I've sponsored?",
      a: "Only the Shul office can see the amount you have sponsored."
    },
    {
      q: "What if a date says 'Booked'?",
      a: "That means it's already taken. Please select another available Shabbat or Festival date."
    }
  ];

  function initFaqChat() {
    var root = document.getElementById("faqChatRoot");
    if (!root) return;

    var panel = document.getElementById("faqChatPanel");
    var toggleBtn = document.getElementById("faqChatToggle");
    var closeBtn = document.getElementById("faqChatClose");
    var questionsBox = document.getElementById("faqChatQuestions");
    var messagesBox = document.getElementById("faqChatMessages");

    questionsBox.innerHTML = "";
    FAQ_ITEMS.forEach(function (item) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-q";
      btn.textContent = item.q;
      btn.onclick = function () {
        addFaqMessage(item.q, item.a, messagesBox);
      };
      questionsBox.appendChild(btn);
    });

    toggleBtn.onclick = function () {
      panel.hidden = !panel.hidden;
      toggleBtn.setAttribute("aria-expanded", String(!panel.hidden));
    };
    closeBtn.onclick = function () {
      panel.hidden = true;
      toggleBtn.setAttribute("aria-expanded", "false");
    };
  }

  function addFaqMessage(question, answer, messagesBox) {
    var userBubble = document.createElement("div");
    userBubble.className = "chat-row chat-row--user";
    userBubble.innerHTML = '<div class="chat-bubble chat-bubble--user">' + escapeHtml(question) + "</div>";
    messagesBox.appendChild(userBubble);

    var typingBubble = document.createElement("div");
    typingBubble.className = "chat-row";
    typingBubble.innerHTML =
      '<div class="chat-bubble">' +
        '<span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span>' +
      "</div>";
    messagesBox.appendChild(typingBubble);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    setTimeout(function () {
      if (typingBubble.parentNode === messagesBox) messagesBox.removeChild(typingBubble);
      var botBubble = document.createElement("div");
      botBubble.className = "chat-row";
      botBubble.innerHTML = '<div class="chat-bubble">' + escapeHtml(answer) + "</div>";
      messagesBox.appendChild(botBubble);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }, 2000);
  }

  initFaqChat();
})();
