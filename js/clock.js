// static/js/clock.js
(function () {
  const HOME_TZ = "America/Chicago"; // auto-switches CST/CDT
  const TARGET_EL_ID = "contact-clock";

  // Returns offset (in minutes) **east of UTC** for a given time zone at a given date.
  // Based on the MDN recipe using formatToParts (robust across DST).
  function getTimeZoneOffsetMinutes(date, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    });
    const parts = dtf.formatToParts(date);
    const map = {};
    for (const { type, value } of parts) map[type] = value;

    // "Wall clock" time in the target TZ, interpreted as if it were UTC:
    const tzAsUTC = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second)
    );

    // The same instant expressed in real UTC:
    const realUTC = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds()
    );

    // Positive = target TZ is east of UTC (ahead). Negative = west (behind).
    return Math.round((tzAsUTC - realUTC) / 60000);
  }

  function getAbbrev(date, tz) {
    // e.g. "2:35:10 PM CDT" -> "CDT"
    return date
      .toLocaleTimeString("en-US", { timeZone: tz, timeZoneName: "short" })
      .split(" ")
      .pop();
  }

  function render() {
    const el = document.getElementById(TARGET_EL_ID);
    if (!el) return;

    const now = new Date();

    // Offsets east of UTC (minutes)
    const homeOffsetMin  = getTimeZoneOffsetMinutes(now, HOME_TZ);
    const localOffsetMin = -now.getTimezoneOffset(); // local offset east of UTC

    // Difference target(Home) - Local, in hours; + means Home is ahead of viewer
    const diffH = Math.round((homeOffsetMin - localOffsetMin) / 60);
    const diffStr = diffH > 0 ? `+${diffH}` : `${diffH}`;

    const localStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", timeZoneName: "short"
    });

    const homeStr = now.toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit",
      timeZoneName: "short", timeZone: HOME_TZ
    });

    el.innerHTML = `
      <div><strong>Your Time:</strong> ${localStr}</div>
      <div><strong>My Time:</strong> ${homeStr} (${HOME_TZ})</div>
      <div><strong>Difference:</strong> ${diffStr}h</div>
    `;
    el.style.textAlign = "center";
    el.style.fontWeight = "600";
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    if (document.getElementById(TARGET_EL_ID)) {
      render();
      setInterval(render, 1000);
    }
  });
})();
