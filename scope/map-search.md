# Scope: map-search

Goal: a MapSearch component in Storybook (General UI/Components/Map search) where a person can search a place or type coordinates, or click the map, and get back { lat, lon }.

Tier: explore

Features:

F1. Search box: typed decimal or degrees-minutes-seconds coordinates are parsed locally; anything else goes to a consumer-supplied geocoder (`search` prop, e.g. `nominatimSearch()`), run on Enter only.
Source: build

F2. Map: dependency-free Web Mercator (EPSG:3857) z/x/y tile grid, tiles opt-in via `tileUrl`, an offline graticule otherwise; drag to pan, wheel and buttons to zoom, click or Enter to drop the pin.
Source: none, exploratory
Quote: "the exploratory version should be way more lenient"

F3. Latitude and longitude fields (WGS 84 decimal degrees), clear, use-my-location (browser geolocation, accuracy shown), hidden form inputs.
Source: build
