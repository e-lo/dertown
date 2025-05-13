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
        start_time = time_tags[0]["datetime"] if len(time_tags) > 0 else None
        end_time = time_tags[1]["datetime"] if len(time_tags) > 1 else None

        location_a = event_div.select_one(".event-dates a")
        location = location_a.get_text(strip=True) if location_a else None

        desc_div = event_div.select_one(".views-field-view-node")
        description = desc_div.get_text(strip=True) if desc_div else None

        events.append(
            {
                "title": title,
                "start_date": start_time[:10] if start_time else None,
                "start_time": start_time[11:16] if start_time else None,
                "end_date": end_time[:10] if end_time else None,
                "end_time": end_time[11:16] if end_time else None,
                "location": location,
                "description": description,
                "link": link,
            }
        )
    return events


def extract_iciclebrewing_events(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for event_article in soup.select(".mec-event-list-classic article.mec-past-event"):
        # Title and link
        title_a = event_article.select_one("h4.mec-event-title a")
        title = title_a.get_text(strip=True) if title_a else None
        link = title_a["href"] if title_a and title_a.has_attr("href") else None
        if link:
            link = urljoin(base_url, link)
        # Date
        date_span = event_article.select_one(".mec-event-date .mec-start-date-label")
        date_str = date_span.get_text(strip=True) if date_span else None
        # Time (may be empty)
        time_div = event_article.select_one(".mec-event-time")
        time_str = time_div.get_text(strip=True) if time_div else None
        # Location
        loc_div = event_article.select_one(".mec-event-loc-place")
        location = loc_div.get_text(strip=True) if loc_div else None
        # Description (not always present)
        desc_div = event_article.select_one(".mec-event-detail")
        description = desc_div.get_text(strip=True) if desc_div else None
        # Parse date and time
        from dateutil import parser as dateparser

        start_date = None
        start_time = None
        end_date = None
        end_time = None
        if date_str:
            try:
                start_date = dateparser.parse(date_str).date().isoformat()
            except Exception:
                start_date = None
        if time_str:
            import re

            match = re.match(
                r"(\d{1,2}:\d{2}\s*[ap]m)(?:\s*-\s*(\d{1,2}:\d{2}\s*[ap]m))?", time_str, re.I
            )
            if match:
                start_time = match.group(1)
                end_time = match.group(2)
        events.append(
            {
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "location": location,
                "description": description,
                "link": link,
            }
        )
    return events


def extract_cityofleavenworth_events(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    events = []
    for event_article in soup.select(".mec-event-list-classic article.mec-past-event"):
        # Title and link
        title_a = event_article.select_one("h4.mec-event-title a")
        title = title_a.get_text(strip=True) if title_a else None
        link = title_a["href"] if title_a and title_a.has_attr("href") else None
        if link:
            link = urljoin(base_url, link)
        # Date
        date_span = event_article.select_one(".mec-event-date .mec-start-date-label")
        date_str = date_span.get_text(strip=True) if date_span else None
        # Time (may be empty)
        time_div = event_article.select_one(".mec-event-time")
        time_str = time_div.get_text(strip=True) if time_div else None
        # Location
        loc_div = event_article.select_one(".mec-event-loc-place")
        location = loc_div.get_text(strip=True) if loc_div else None
        # Description (not always present)
        desc_div = event_article.select_one(".mec-event-detail")
        description = desc_div.get_text(strip=True) if desc_div else None
        # Parse date and time
        from dateutil import parser as dateparser

        start_date = None
        start_time = None
        end_date = None
        end_time = None
        if date_str:
            try:
                start_date = dateparser.parse(date_str).date().isoformat()
            except Exception:
                start_date = None
        if time_str:
            import re

            match = re.match(
                r"(\d{1,2}:\d{2}\s*[ap]m)(?:\s*-\s*(\d{1,2}:\d{2}\s*[ap]m))?", time_str, re.I
            )
            if match:
                start_time = match.group(1)
                end_time = match.group(2)
        events.append(
            {
                "title": title,
                "start_date": start_date,
                "start_time": start_time,
                "end_date": end_date,
                "end_time": end_time,
                "location": location,
                "description": description,
                "link": link,
            }
        )
    return events


def extract_llm_events(html, base_url):
    # Placeholder for LLM-based extraction
    return []


def extract_wenatcheeriverinstitute_events(html, base_url, months_ahead=3, stdout=None):
    """
    Scrape events from Wenatchee River Institute's calendar for the next X months.
    Returns a list of event dicts.
    """
    events = []
    today = datetime.today()
    for i in range(months_ahead):
        year = today.year + ((today.month + i - 1) // 12)
        month = ((today.month + i - 1) % 12) + 1
        if i == 0:
            page_html = html  # Use the provided HTML for the first month
            if stdout:
                stdout(f"processing {base_url}")
        else:
            url = f"{base_url}/calendar/{year}/{month}"
            if stdout:
                stdout(f"Requesting calendar page: {url}")
            resp = requests.get(url, headers=USER_AGENT_HEADERS, timeout=20)
            if stdout:
                stdout(f"Received response for: {url}")
            page_html = resp.text
        soup = BeautifulSoup(page_html, "html.parser")
        for td in soup.select("td.calendar-grid-event-container"):
            a = td.select_one("a.calendar-grid-event")
            if not a:
                continue
            event_url = urljoin(base_url, a["href"])
            title = a.get("title") or (
                a.select_one(".calendar-grid-event__title").get_text(strip=True)
                if a.select_one(".calendar-grid-event__title")
                else None
            )
            time = a.select_one(".calendar-grid-event__time")
            time_text = time.get_text(strip=True) if time else ""
            # Optionally, fetch event detail page for more info
            if stdout:
                stdout(f"Requesting event detail page: {event_url}")
            # event_detail = requests.get(event_url, headers=USER_AGENT_HEADERS, timeout=20)
            if stdout:
                stdout(f"Received response for event detail: {event_url}")
            # detail_soup = BeautifulSoup(event_detail.text, "html.parser")
            # You can extract more fields from detail_soup as needed
            events.append(
                {
                    "title": title,
                    "time": time_text,
                    "url": event_url,
                    # Add more fields as needed from detail_soup
                }
            )
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
                "link": details_link,
                "opponents": opponents,
            }
        )
    return events


# New function for Icicle Creek Center for the Arts
def extract_iciclecreek_events(html, base_url, stdout=None):
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
                if stdout:
                    stdout(f"Could not parse date/time: {date_time_str} ({e})")
        # Image
        img = event_div.select_one(".event-img img")
        image_url = urljoin(base_url, img["src"]) if img and img.has_attr("src") else None
        # Info and buy/register links
        info_a = event_div.select_one(".event-info a")
        info_link = (
            urljoin(base_url, info_a["href"]) if info_a and info_a.has_attr("href") else None
        )
        ticket_link = None
        purchase_div = event_div.select_one(".event-purchase")
        if purchase_div:
            ticket_a = purchase_div.select_one("a")
            if ticket_a and ticket_a.has_attr("href"):
                ticket_link = urljoin(base_url, ticket_a["href"])
            else:
                select = purchase_div.select_one("select")
                if select:
                    for option in select.find_all("option"):
                        if option.get("value") and option["value"] != "Buy Tickets":
                            ticket_link = option["value"]
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
                "info_link": info_link,
                "ticket_link": ticket_link,
                "price": price,
                "description": description,
            }
        )
    if stdout:
        stdout(f"Extracted {len(events)} events from Icicle Creek Center for the Arts")
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


def extract_leavenworthorg_events(html, base_url):
    """
    Extract events from leavenworth.org/calendar/events.
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
                "link": link,
                "image_url": image_url,
            }
        )
    return events


EXTRACTION_FUNCTIONS = {
    "skileavenworth": wrap_future_only(extract_skileavenworth_events),
    "iciclebrewing": wrap_future_only(extract_iciclebrewing_events),
    "cityofleavenworth": wrap_future_only(extract_cityofleavenworth_events),
    "llm": extract_llm_events,
    "default": extract_llm_events,
    "wenatcheeriverinstitute": wrap_future_only(extract_wenatcheeriverinstitute_events),
    "cascadekodiakathletics": wrap_future_only(extract_cascadekodiakathletics_events),
    "iciclecreek": wrap_future_only(extract_iciclecreek_events),
    "WordpressTheEventsCalendar": wrap_future_only(extract_leavenworthorg_events),
}
