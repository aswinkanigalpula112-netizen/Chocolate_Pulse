// Chocolate Pulse image search powered by Wikimedia Commons.
const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const clearButton = document.getElementById("clear-button");
const results = document.getElementById("results-container");
const emptyState = document.getElementById("empty-state");

let activeSearch = null;
let searchSequence = 0;

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = input.value.trim();

  if (!query) {
    emptyState.textContent = "Enter a topic to search for images.";
    emptyState.hidden = false;
    input.focus();
    return;
  }

  searchImages(query);
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const query = chip.textContent.trim();
    input.value = query;
    searchImages(query);
  });
});

clearButton.addEventListener("click", () => {
  searchSequence += 1;
  activeSearch?.abort();
  activeSearch = null;
  form.reset();
  results.replaceChildren();
  results.setAttribute("aria-busy", "false");
  emptyState.textContent = "Your next discovery starts here. Search for something you love to see your results.";
  emptyState.hidden = false;
  searchButton.disabled = false;
  input.focus();
});

async function searchImages(query) {
  activeSearch?.abort();
  const controller = new AbortController();
  activeSearch = controller;
  const currentSearch = ++searchSequence;

  results.replaceChildren();
  results.setAttribute("aria-busy", "true");
  emptyState.textContent = "Searching Wikimedia Commons…";
  emptyState.hidden = false;
  searchButton.disabled = true;

  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "24",
    prop: "info|imageinfo",
    inprop: "url",
    iiprop: "url|extmetadata",
    iiurlwidth: "900",
    format: "json",
    origin: "*",
    gsrsearch: query,
  });

  try {
    const response = await fetch("https://commons.wikimedia.org/w/api.php?" + params, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error("Image search failed with HTTP " + response.status);
    }

    const data = await response.json();
    if (currentSearch !== searchSequence) return;

    const pages = Object.values(data.query?.pages ?? {}).sort(
      (first, second) => (first.index ?? 0) - (second.index ?? 0)
    );
    const imagePages = pages.filter((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url);

    if (imagePages.length === 0) {
      emptyState.textContent = "No images found for “" + query + "”. Try another topic.";
      return;
    }

    const cards = imagePages.map(createImageCard);
    results.append(...cards);
    emptyState.hidden = true;
  } catch (error) {
    if (error.name === "AbortError" || currentSearch !== searchSequence) return;
    emptyState.textContent = "Images could not be loaded. Check your connection and try again.";
  } finally {
    if (currentSearch === searchSequence) {
      results.setAttribute("aria-busy", "false");
      searchButton.disabled = false;
      activeSearch = null;
    }
  }
}

function createImageCard(page) {
  const imageInfo = page.imageinfo[0];
  const metadata = imageInfo.extmetadata ?? {};
  const title = page.title.replace(/^File:/, "");
  const sourceUrl =
    page.fullurl ||
    "https://commons.wikimedia.org/wiki/" + encodeURIComponent(page.title.replaceAll(" ", "_"));

  const card = document.createElement("article");
  card.className = "image-card";

  const link = document.createElement("a");
  link.className = "image-card-link";
  link.href = sourceUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.setAttribute("aria-label", "View source and license for " + title + " on Wikimedia Commons");

  const image = document.createElement("img");
  image.src = imageInfo.thumburl || imageInfo.url;
  image.alt = title;
  image.loading = "lazy";
  image.decoding = "async";

  const copy = document.createElement("div");
  copy.className = "image-card-copy";

  const heading = document.createElement("h3");
  heading.className = "image-card-title";
  heading.textContent = title;

  const detail = document.createElement("p");
  detail.className = "image-card-license";
  detail.textContent = metadata.LicenseShortName?.value
    ? "License: " + metadata.LicenseShortName.value
    : "View license details";

  copy.append(heading, detail);
  link.append(image, copy);
  card.append(link);
  return card;
}
