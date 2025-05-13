// Subscribe Offcanvas Menu Logic

document.addEventListener('DOMContentLoaded', function () {
  // Parse tag data from the JSON script
  const tagData = JSON.parse(document.getElementById('event-tags-data').textContent);

  // Map tag name to tag object for quick lookup
  const tagMap = {};
  tagData.forEach((tag) => {
    tagMap[tag.name] = tag;
  });

  // Elements
  const mainMenu = document.getElementById('subscribeMainMenu');
  const subMenu = document.getElementById('subscribeSubMenu');
  const backBtn = document.querySelector('.subscribe-back-btn');
  const subGoogle = document.getElementById('sub-google');
  const subApple = document.getElementById('sub-apple');
  const subOutlook = document.getElementById('sub-outlook');
  const subRss = document.getElementById('sub-rss');

  // Show submenu for selected event type
  mainMenu.addEventListener('click', function (e) {
    const li = e.target.closest('.subscribe-event-type');
    if (!li) return;
    const tagName = li.getAttribute('data-event-type');
    const tag = tagMap[tagName];
    if (!tag) return;

    // Update submenu links
    subGoogle.href = tag.google_subscribe_url || '#';
    subApple.href = tag.google_calendar_ical_url || '#';
    subOutlook.href = tag.outlook_calendar_url || '#';
    subRss.href = tag.rss_url || '#';

    // Show submenu, hide main menu
    mainMenu.classList.add('d-none');
    subMenu.classList.remove('d-none');
  });

  // Back button returns to main menu
  backBtn.addEventListener('click', function () {
    subMenu.classList.add('d-none');
    mainMenu.classList.remove('d-none');
  });
});
