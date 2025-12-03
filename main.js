// De service worker vertaalt dit naar de echte CMGT API.
const API_BASE = "/api";

/**
 * Update de zichtbare online/offline status in de UI.
 */
function updateOnlineStatus() {
  const indicator = document.getElementById("status-indicator");
  const text = document.getElementById("status-text");

  if (!indicator || !text) return;

  const online = navigator.onLine;

  indicator.classList.toggle("online", online);
  indicator.classList.toggle("offline", !online);

  if (online) {
    text.textContent = "Status: online – data kan worden opgehaald.";
  } else {
    text.textContent = "Status: offline – nieuwe data kan nu niet worden opgehaald.";
  }
}

/**
 * Haalt de lijst met projecten op uit de API.
 */
function fetchProjects() {
  const loadingEl = document.getElementById("projects-loading");
  const errorSection = document.getElementById("error-section");
  const errorMessage = document.getElementById("error-message");

  if (errorSection) {
    errorSection.classList.add("hidden");
  }
  if (loadingEl) {
    loadingEl.textContent = "Projecten worden geladen...";
  }

  fetch(`${API_BASE}/projects`)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Netwerkantwoord was niet ok: " + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      if (loadingEl) {
        loadingEl.remove();
      }
      renderProjects(data);
    })
    .catch(function (error) {
      console.error("Fout bij ophalen projecten:", error);

      if (loadingEl) {
        loadingEl.textContent = "";
      }
      if (errorSection && errorMessage) {
        errorSection.classList.remove("hidden");
        errorMessage.textContent =
          "Er ging iets mis bij het ophalen van de projecten. Controleer je verbinding " +
          "en probeer het later opnieuw.";
      }
    });
}

/* stopt de projecten in de HTML */
function renderProjects(apiData) {
  const container = document.getElementById("projects");
  if (!container) return;

  container.innerHTML = "";

  if (!apiData || !Array.isArray(apiData.data) || apiData.data.length === 0) {
    const p = document.createElement("p");
    p.textContent = "Geen projecten gevonden.";
    container.appendChild(p);
    return;
  }

  apiData.data.forEach(function (item) {
    const project = item.project;
    if (!project) return;

    const card = document.createElement("article");
    card.className = "project-card";

    const title = document.createElement("h3");
    title.textContent = project.title || "Naamloos project";
    card.appendChild(title);

    if (project.tagline) {
      const tagline = document.createElement("p");
      tagline.className = "project-tagline";
      tagline.textContent = project.tagline;
      card.appendChild(tagline);
    }

    if (project.author) {
      const author = document.createElement("p");
      author.className = "project-author";
      author.textContent = "Door: " + project.author;
      card.appendChild(author);
    }

    if (project.slug) {
      const link = document.createElement("a");
      link.href = `https://cmgt.hr.nl/api/projects/${project.slug}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "project-link";
      link.textContent = "Bekijk projectdetails (API)";
      card.appendChild(link);
    }

    container.appendChild(card);
  });
}

/**
 * Haalt de lijst met tags op uit de API.
 * De service worker zorgt voor:
 * Network Only bij online
 * Een offline JSON als het netwerk faalt
 */
function fetchTags() {
  const loadingEl = document.getElementById("tags-loading");
  const container = document.getElementById("tags-container");

  if (!container) return;

  if (loadingEl) {
    loadingEl.textContent = "Tags worden geladen...";
  }

  fetch(`${API_BASE}/tags`)
    .then(function (response) {
      if (!response.ok) {
        throw new Error("Netwerkantwoord was niet ok: " + response.status);
      }
      return response.json();
    })
    .then(function (data) {
      if (loadingEl) {
        loadingEl.remove();
      }
      renderTags(data);
    })
    .catch(function (error) {
      console.error("Fout bij ophalen tags:", error);
      if (loadingEl) {
        loadingEl.textContent =
          "Er ging iets mis bij het ophalen van de tags.";
      }
    });
}

/**
 * Rendeert de tags of een offline-bericht in de HTML.
 * Als de service worker een speciale offline payload terugstuurt, tonen we een melding.
 */
function renderTags(data) {
  const container = document.getElementById("tags-container");
  if (!container) return;

  container.innerHTML = "";

  // Service worker kan een offline payload sturen, bijv. { offline: true, message: "..." }
  if (data && data.offline) {
    const msg = document.createElement("p");
    msg.className = "tags-message";
    msg.textContent = data.message || "Tags zijn niet beschikbaar (offline).";
    container.appendChild(msg);
    return;
  }

  let items = [];

  if (Array.isArray(data?.data)) {  
    items = data.data;
  } else if (Array.isArray(data?.tags)) {
    items = data.tags;
  } else if (Array.isArray(data)) {
    items = data;
  }

  if (!items.length) {
    const p = document.createElement("p");
    p.className = "tags-message";
    p.textContent = "Geen tags gevonden.";
    container.appendChild(p);
    return;
  }

  items.forEach(function (item) {
    const tagObj = item.tag || item;
    const label =
      tagObj.title ||
      tagObj.name ||
      tagObj.label ||
      tagObj.slug ||
      String(tagObj);

    const span = document.createElement("span");
    span.className = "tag-pill";
    span.textContent = label;
    container.appendChild(span);
  });
}

// Init zodra de DOM klaar is
document.addEventListener("DOMContentLoaded", function () {
  updateOnlineStatus();
  fetchProjects();
  fetchTags();

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
});

// Service worker registratie
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/serviceworker.js")
      .then(function (registration) {
        console.log("ServiceWorker geregistreerd met scope:", registration.scope);
      })
      .catch(function (error) {
        console.error("ServiceWorker registratie mislukt:", error);
      });
  });
}
