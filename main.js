// Basis URL van de CMGT API
const API_BASE = "https://cmgt.hr.nl/api";

/**
 * Update de zichtbare online/offline status in de UI.
 * Dit is puur visueel; de echte offline strategieën komen later in de service worker.
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
 * Haalt de lijst met projecten op uit de API en geeft die door om te renderen.
 * Nog GEEN caching, GEEN IndexedDB, alleen netwerk.
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

/**
 * Rendeert de projecten in de HTML.
 * Verwacht een object met een `data` array,
 * waarbij elk item een `project` property heeft.
 */
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

    // Link naar de projectdetails in de API (of later je eigen detailpagina)
    if (project.slug) {
      const link = document.createElement("a");
      link.href = `${API_BASE}/projects/${project.slug}`;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.className = "project-link";
      link.textContent = "Bekijk projectdetails (API)";
      card.appendChild(link);
    }

    container.appendChild(card);
  });
}

// Init zodra de DOM klaar is
document.addEventListener("DOMContentLoaded", function () {
  updateOnlineStatus();
  fetchProjects();

  // Alleen UI-status bijwerken; offline logica zelf komt later in de service worker.
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
});

// Service worker registratie - alleen als de browser het ondersteunt
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

