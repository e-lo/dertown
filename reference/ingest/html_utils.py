import logging
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser

USER_AGENT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
        (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.google.com/",
}

logger = logging.getLogger(__name__)


def extract_skileavenworth_events(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for event_div in soup.select(".eventspecifics"):
        title_a = event_div.select_one("strong a")
        title = title_a.get_text(strip=True) if title_a else None
        link = urljoin(base_url, title_a["href"]) if title_a and title_a.has_attr("href") else None

        # Find the closest previous eventdatemonth div for times
        eventdatemonth_div = event_div.find_previous("div", class_="eventdatemonth")

        time_tags = eventdatemonth_div.find_all("time") if eventdatemonth_div else []
        # <time datetime="2025-05-21T20:00:00Z">May</time>
        start_datetime = time_tags[0]["datetime"] if len(time_tags) > 0 else None
        end_datetime = time_tags[1]["datetime"] if len(time_tags) > 1 else None

        location_a = event_div.select_one(".event-dates a")
        location = location_a.get_text(strip=True) if location_a else None

        desc_div = event_div.select_one(".views-field-view-node")
        description = desc_div.get_text(strip=True) if desc_div else None

        events.append(
            {
                "title": title,
                "start_date": start_datetime[:10] if start_datetime else None,
                "start_time": start_datetime[11:16] if start_datetime else None,
                "end_date": end_datetime[:10] if end_datetime else None,
                "end_time": end_datetime[11:16] if end_datetime else None,
                "location": location,
                "description": description,
                "website": link,
            }
        )
    return events


def extract_llm_events(html, base_url):
    # Placeholder for LLM-based extraction
    return []


def extract_firespring_event(td, base_url: str) -> dict:
    a = td.select_one("a.calendar-grid-event")
    if not a:
        return None

    title = a.get("title") or (
        a.select_one(".calendar-grid-event__title").get_text(strip=True)
        if a.select_one(".calendar-grid-event__title")
        else None
    )
    if not title:
        logger.warning(f"No title found for {base_url}{a['href']}. Skipping event.")
        return None

    event_url = urljoin(base_url, a["href"])
    start_date = event_url.split(".html/event/")[1][:10]
    time = a.select_one(".calendar-grid-event__time")
    time_text = time.get_text(strip=True) if time else ""

    event_detail = requests.get(event_url, headers=USER_AGENT_HEADERS, timeout=20)
    detail_soup = BeautifulSoup(event_detail.text, "html.parser")
    image_url = (
        detail_soup.select_one(".event-image img")["src"]
        if detail_soup.select_one(".event-image img")
        else None
    )
    description = (
        detail_soup.select_one(".event-details__description").get_text(strip=True)
        if detail_soup.select_one(".event-details__description")
        else None
    )

    return {
        "title": title,
        "start_date": start_date,
        "start_time": time_text,
        "website": event_url,
        "image_url": image_url,
        "description": description,
    }


def extract_firespring_month(page_html: str, base_url: str) -> list[dict]:
    events = []
    soup = BeautifulSoup(page_html, "html.parser")
    containers = soup.select("td.calendar-grid-event-container")
    logger.debug(f"Found {len(containers)} events ")

    for td in containers:
        event = extract_firespring_event(td, base_url)
        if not event:
            continue
        events.append(event)

    return events


def extract_firespring_events(html, base_url, months_ahead=3):
    """
    Scrape events from Firespring platform including WRI for the next X months.
    Returns a list of event dicts.
    """
    events = []
    today = datetime.today()
    for i in range(months_ahead):
        year = today.year + ((today.month + i - 1) // 12)
        month = ((today.month + i - 1) % 12) + 1

        if months_ahead == 0:
            page_html = html
            url = base_url
        else:
            url = f"{base_url}/calendar/{year}/{month}"
            resp = requests.get(url, headers=USER_AGENT_HEADERS, timeout=20)
            page_html = resp.text
        logger.debug(f"Extracting events for {month}/{year}")
        events += extract_firespring_month(page_html, base_url)
    return events


def parse_time_string(time_str):
    if not time_str:
        return None
    try:
        dt = dateparser.parse(time_str)
        return dt.strftime("%H:%M")
    except Exception:
        return None


def extract_cascadekodiakathletics_events(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    events = []
    today = datetime.today().date()
    for tr in soup.select("tr.event.event-mobile"):
        # Date and time
        date_td = tr.select_one("td.date.print-hide")
        date_str = (
            date_td["data-event-date"].strip()
            if date_td and date_td.has_attr("data-event-date")
            else None
        )
        time_str = (
            date_td["data-event-start-time"].strip()
            if date_td and date_td.has_attr("data-event-start-time")
            else None
        )
        # Parse date_str to YYYY-MM-DD
        start_date = None
        if date_str:
            try:
                # Remove weekday if present
                if "," in date_str:
                    date_str = date_str.split(",", 1)[1].strip()
                # Add current year if missing
                if not any(char.isdigit() for char in date_str.split()[-1]):
                    date_str += f" {datetime.today().year}"
                start_date = dateparser.parse(date_str).date()
            except Exception:
                start_date = None
        # Only import events today or in the future
        if not start_date or start_date < today:
            continue
        # Parse time to HH:MM
        start_time = parse_time_string(time_str)
        # Team
        team_a = tr.select_one("td.team a")
        team = team_a.get_text(strip=True) if team_a else None
        # Opponents
        opponent_span = tr.select_one(".event-details .opponent")
        opponents = opponent_span.get_text(strip=True) if opponent_span else None
        # Event name
        event_name_span = tr.select_one(".event-details .event-name")
        event_name = event_name_span.get_text(strip=True) if event_name_span else None
        # Location
        home_away_span = tr.select_one(".event-details .home-away")
        location = home_away_span.get_text(strip=True) if home_away_span else None
        # Only import home events, and do not set location
        if not (location and "home" in location.lower()):
            continue
        # Details link
        details_a = tr.select_one("td.info-mobile a")
        details_link = (
            urljoin(base_url, details_a["href"])
            if details_a and details_a.has_attr("href")
            else None
        )
        # Description (optional, could fetch details page if needed)
        description = None
        events.append(
            {
                "title": event_name or team,
                "start_date": start_date.isoformat() if start_date else None,
                "start_time": start_time,
                "location": None,  # Do not set location for Kodiak
                "description": description,
                "website": details_link,
                "opponents": opponents,
            }
        )
    return events


# New function for Icicle Creek Center for the Arts
def extract_salesforce_events(html, base_url):
    """Extaction function for events using Salesforce event ticketing including Icicle.org"""
    from dateutil import parser as dateparser

    soup = BeautifulSoup(html, "html.parser")
    events = []
    for event_div in soup.select("div.event-container"):
        # Title and category
        title_inner = event_div.select_one(".event-title-inner")
        title = None
        category = None
        if title_inner:
            title_parts = list(title_inner.stripped_strings)
            if title_parts:
                title = title_parts[0]
            if len(title_parts) > 1:
                category = title_parts[1]
        # Date and time
        date_container = event_div.select_one(".event-datetime .date-container")
        date_time_str = date_container.get_text(strip=True) if date_container else None
        start_date = None
        start_time = None
        if date_time_str:
            try:
                dt = dateparser.parse(date_time_str)
                start_date = dt.date().isoformat()
                start_time = dt.strftime("%H:%M")
            except Exception as e:
                logger.error(f"Could not parse date/time: {date_time_str} ({e})")
        # Image
        img = event_div.select_one(".event-img img")
        image_url = urljoin(base_url, img["src"]) if img and img.has_attr("src") else None
        # Info and buy/register links
        info_a = event_div.select_one(".event-info a")
        website = urljoin(base_url, info_a["href"]) if info_a and info_a.has_attr("href") else None
        registration_link = None
        purchase_div = event_div.select_one(".event-purchase")
        if purchase_div:
            ticket_a = purchase_div.select_one("a")
            if ticket_a and ticket_a.has_attr("href"):
                registration_link = urljoin(base_url, ticket_a["href"])
            else:
                select = purchase_div.select_one("select")
                if select:
                    for option in select.find_all("option"):
                        if option.get("value") and option["value"] != "Buy Tickets":
                            registration_link = option["value"]
                            break
        # Price
        price_div = event_div.select_one(".event-price")
        price = price_div.get_text(strip=True) if price_div else None
        # Description
        desc_div = event_div.select_one(".event-desc")
        description = desc_div.get_text(" ", strip=True) if desc_div else None
        events.append(
            {
                "title": title,
                "category": category,
                "start_date": start_date,
                "start_time": start_time,
                "image_url": image_url,
                "website": website,
                "registration_link": registration_link,
                "price": price,
                "description": description,
            }
        )
    logger.info(f"Extracted {len(events)} events from Icicle Creek Center for the Arts")
    return events


# For all other extraction functions, filter out past events
def filter_future_events(events):
    today = datetime.today().date()
    filtered = []
    for event in events:
        start_date = event.get("start_date")
        try:
            if start_date and isinstance(start_date, str):
                start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
            elif start_date and isinstance(start_date, datetime):
                start_date_obj = start_date.date()
            else:
                continue
            if start_date_obj >= today:
                filtered.append(event)
        except Exception:
            continue
    return filtered


# Wrap other extraction functions to filter future events
def wrap_future_only(fn):
    def wrapper(*args, **kwargs):
        events = fn(*args, **kwargs)
        return filter_future_events(events)

    return wrapper


def extract_wordpress_events(html, base_url):
    """
    Extract events from wordpress events including leavenworth.org/calendar/events.
    Returns a list of dicts with keys: title, start_date, start_time, end_date,
        end_time, location, description, link, image_url.
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []
    # Each event is wrapped in a div.tribe-events-calendar-list__event-wrapper
    for wrapper in soup.select("div.tribe-events-calendar-list__event-wrapper"):
        article = wrapper.select_one("article.tribe-events-calendar-list__event")
        if not article:
            continue
        # Title and link
        title_a = article.select_one(".tribe-events-calendar-list__event-featured-image-link")
        link = urljoin(base_url, title_a["href"]) if title_a and title_a.has_attr("href") else None
        title = title_a["title"].strip() if title_a and title_a.has_attr("title") else None
        # Image
        img = article.select_one("img.tribe-events-calendar-list__event-featured-image")
        image_url = urljoin(base_url, img["src"]) if img and img.has_attr("src") else None
        # Date and time
        time_tag = article.select_one("time.tribe-events-calendar-list__event-datetime")
        start_date = time_tag["datetime"] if time_tag and time_tag.has_attr("datetime") else None
        # Parse time text: e.g. 'May 13 @ 6:00 pm - 7:30 pm'
        start_time = None
        end_time = None
        if time_tag:
            time_text = time_tag.get_text(" ", strip=True)
            import re

            # Match e.g. 'May 13 @ 6:00 pm - 7:30 pm'
            match = re.search(r"@ ([\d:apm ]+)(?:\s*-\s*([\d:apm ]+))?", time_text)
            if match:
                start_time_raw = match.group(1).strip()
                end_time_raw = match.group(2).strip() if match.group(2) else None
                # Convert to 24-hour HH:MM format
                from dateutil import parser as dateparser

                try:
                    start_time_dt = dateparser.parse(start_time_raw)
                    start_time = start_time_dt.strftime("%H:%M")
                except Exception:
                    start_time = None
                if end_time_raw:
                    try:
                        end_time_dt = dateparser.parse(end_time_raw)
                        end_time = end_time_dt.strftime("%H:%M")
                    except Exception:
                        end_time = None
        # Description (not always present)
        desc_div = article.select_one(".tribe-events-calendar-list__event-details")
        description = desc_div.get_text(" ", strip=True) if desc_div else None
        # Location (try to extract from description or other fields if available)
        location = None
        # Compose event dict
        events.append(
            {
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": start_date,  # Only one date per event
                "end_time": end_time,
                "location": location,
                "description": description,
                "website": link,
                "image_url": image_url,
            }
        )
    return events


def extract_joomla_dpcalendar_events(html, base_url):
    """
    Extract events from Joomla dp calendar event lists.

    e.g. https://www.wnps.org/wv-events/calendar?view=list

    Returns:
        list of dicts with keys: title, start_date, start_time, end_date,
            end_time, location, description, link.
    """
    soup = BeautifulSoup(html, "html.parser")
    events = []
    # WNPS dpCalendar: each event is a <li class="dp-list-unordered__item dp-event ...">
    for event_li in soup.select("li.dp-list-unordered__item.dp-event"):
        # Title and link
        title = None
        link = None
        h2 = event_li.find("h2", class_="dp-event__title")
        if h2:
            a = h2.find("a", class_="dp-event__link")
            if a:
                title = a.get_text(strip=True)
                link = urljoin(base_url, a["href"]) if a.has_attr("href") else None
        # Date and time
        start_date = None
        start_time = None
        end_time = None
        date_details = event_li.find("div", class_="dp-event__date")
        if date_details:
            date_span = date_details.find("span", class_="dp-date__start")
            time_start_span = date_details.find("span", class_="dp-time__start")
            time_end_span = date_details.find("span", class_="dp-time__end")
            if date_span:
                from dateutil import parser as dateparser

                try:
                    start_date = dateparser.parse(date_span.get_text(strip=True)).date().isoformat()
                except Exception:
                    start_date = None
            if time_start_span:
                start_time = time_start_span.get_text(strip=True)
            if time_end_span:
                end_time = time_end_span.get_text(strip=True)
        # Location
        location = None
        loc_div = event_li.find("div", class_="dp-event__locations")
        if loc_div:
            loc_title = loc_div.find("span", class_="dp-location__title")
            if loc_title:
                location = loc_title.get_text(strip=True)
        # Description
        description = None
        desc_div = event_li.find("div", class_="dp-event__description")
        if desc_div:
            description = desc_div.get_text(" ", strip=True)
        # Image (optional)
        image_url = None
        img = event_li.find("img", class_="dp-image")
        if img and img.has_attr("src"):
            image_url = urljoin(base_url, img["src"])
        events.append(
            {
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": start_date,  # Only one date per event
                "end_time": end_time,
                "location": location,
                "description": description,
                "website": link,
                "image_url": image_url,
            }
        )
    return events


EXTRACTION_FUNCTIONS = {
    "skileavenworth": wrap_future_only(extract_skileavenworth_events),
    "llm": extract_llm_events,
    "default": extract_llm_events,
    "Firespring Events": wrap_future_only(extract_firespring_events),
    "cascadekodiakathletics": wrap_future_only(extract_cascadekodiakathletics_events),
    "Salesforce Tickets": wrap_future_only(extract_salesforce_events),
    "Wordpress: TheEventsCalendar": wrap_future_only(extract_wordpress_events),
    "Joomla: dpCalendar": wrap_future_only(extract_joomla_dpcalendar_events),
}
