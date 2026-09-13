/**
 * app.jsx — Clover application root.
 *
 * Responsibilities:
 *  - All React state declarations
 *  - Computed / memoised derived values
 *  - Side-effect hooks (clock, playback timer, map init, map layers, chart)
 *  - API polling and backend forecast request
 *  - Rendering: composes extracted components, passes props down
 *
 * UI sections live in src/components/ — this file only orchestrates them.
 * Data globals (window.DELHI_BBOX, window.CPCB_STATIONS, etc.) are loaded
 * before this script via plain <script> tags in index.html.
 */

const { useState, useEffect, useRef, useMemo } = React;

function CloverApp() {
  // ── Static reference data from delhiData.js ───────────────────────────────
  const bbox        = window.DELHI_BBOX;
  const stations    = window.CPCB_STATIONS;
  const towers      = window.TELECOM_TOWERS;
  const cmlLinks    = window.CML_LINKS;
  const fireHotspots = window.CROP_FIRE_HOTSPOTS;

  // ── Dynamic live atmospheric engine ───────────────────────────────────────
  const [weather72h, setWeather72h] = useState(() =>
    window.FORECAST_ENGINE ? window.FORECAST_ENGINE.generate72HourWeather() : []
  );
  const [baseStationForecasts, setBaseStationForecasts] = useState(() =>
    window.FORECAST_ENGINE ? window.FORECAST_ENGINE.generateStationForecasts(stations, weather72h, cmlLinks, towers) : {}
  );

  useEffect(() => {
    let active = true;
    const initDynamicData = async () => {
      if (!window.LIVE_WEATHER_SERVICE) return;
      try {
        const liveWx = await window.LIVE_WEATHER_SERVICE.fetchDynamic72HourWeather();
        if (active && liveWx && liveWx.length > 0) {
          setWeather72h(liveWx);
          const liveStForecasts = await window.LIVE_WEATHER_SERVICE.fetchDynamicStationForecasts(stations, liveWx);
          if (active && liveStForecasts && Object.keys(liveStForecasts).length > 0) {
            setBaseStationForecasts(liveStForecasts);
          }
        }
      } catch (err) {
        console.warn('Live dynamic weather initialization notice:', err);
      }
    };
    initDynamicData();
    return () => { active = false; };
  }, [stations]);
  const towersMap = useMemo(() => {
    const map = {};
    towers.forEach(t => { map[t.id] = t; });
    return map;
  }, [towers]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('weather');

  // ── Settings ──────────────────────────────────────────────────────────────
  const [tempUnit, setTempUnit] = useState('C');

  // ── Timeline scrubber ─────────────────────────────────────────────────────
  const [selectedHour, setSelectedHour] = useState(0);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [playSpeed,    setPlaySpeed]    = useState(1);

  // ── Model selection ───────────────────────────────────────────────────────
  const [activeModel, setActiveModel] = useState('modelB'); // 'modelB' = CML RSL Fusion

  // ── Station / CML selection ────────────────────────────────────────────────
  const defaultStationId = stations.find(
    s => s.id.includes('gnoida') || s.name.includes('Greater Noida')
  )?.id || stations[0].id;

  const [selectedStationId, setSelectedStationId] = useState(defaultStationId);
  const [selectedCmlId,     setSelectedCmlId]     = useState(cmlLinks[0]?.id || '');
  const [inspectorType,     setInspectorType]     = useState('station'); // 'station' | 'cml'

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Map layer toggles ─────────────────────────────────────────────────────
  const [weatherFieldMode, setWeatherFieldMode] = useState('aqi');
  const [layers, setLayers] = useState({
    field: true, stations: true, wind: true, fires: true,
  });

  // ── Real-time clock ───────────────────────────────────────────────────────
  const [currentTimeStr, setCurrentTimeStr] = useState(
    new Date().toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  );

  // ── Backend API state ─────────────────────────────────────────────────────
  const [apiState, setApiState] = useState({
    status: 'connecting', observations: [], alerts: [], links: [],
  });
  const [backendForecast, setBackendForecast] = useState(null);

  // ── DOM / library refs ────────────────────────────────────────────────────
  const mapRef              = useRef(null);
  const mapInstanceRef      = useRef(null);
  const heatLayerRef        = useRef(null);
  const stationLayerGroupRef = useRef(null);
  const fireLayerGroupRef   = useRef(null);
  const windLayerGroupRef   = useRef(null);
  const timerRef            = useRef(null);
  const chartCanvasRef      = useRef(null);
  const chartInstanceRef    = useRef(null);

  // ── Current weather snapshot ──────────────────────────────────────────────
  const liveWeatherObs = useMemo(() =>
    apiState.observations.find(o => o.source === 'weather'),
    [apiState.observations]
  );

  const fallbackWx = weather72h[selectedHour] || weather72h[0];
  const currentWx = useMemo(() => {
    if (selectedHour === 0 && liveWeatherObs) {
      return {
        ...fallbackWx,
        temp: liveWeatherObs.temperatureC ?? fallbackWx.temp,
        relativeHumidity: liveWeatherObs.humidityPct ?? fallbackWx.relativeHumidity,
        windSpeed: liveWeatherObs.windSpeedMs ?? fallbackWx.windSpeed,
        windDir: liveWeatherObs.windDirectionDeg ?? fallbackWx.windDir,
      };
    }
    return fallbackWx;
  }, [selectedHour, liveWeatherObs, fallbackWx]);

  // ── Continuous Live Telemetry Polling (every 3 seconds) ──────────────────
  const [telemetryTick, setTelemetryTick] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [health, aq, weather, cml, alerts, links] = await Promise.all([
          window.CLOVER_API.health(),
          window.CLOVER_API.latest('aq_station'),
          window.CLOVER_API.latest('weather'),
          window.CLOVER_API.latest('cml'),
          window.CLOVER_API.alerts(),
          window.CLOVER_API.links(),
        ]);
        if (active) {
          setApiState({
            status: health.status === 'ok' ? 'live' : 'degraded',
            observations: [
              ...(aq.data      || []),
              ...(weather.data || []),
              ...(cml.data     || []),
            ],
            alerts: alerts.data || [],
            links:  links.data  || [],
          });
          setTelemetryTick(t => t + 1);
          setLastSyncTime(new Date());
        }
      } catch {
        if (active) setApiState(prev => ({ ...prev, status: 'offline' }));
      }
    };
    refresh();
    const poll = setInterval(refresh, 3000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  // Live PM2.5 readings indexed by station ID (from backend, if connected)
  const livePm25ByStation = useMemo(() =>
    Object.fromEntries(
      apiState.observations
        .filter(o => o.source === 'aq_station' && Number.isFinite(o.pm25))
        .map(o => [o.deviceId, o.pm25])
    ),
    [apiState.observations]
  );

  // ── Backend ML forecast request ───────────────────────────────────────────
  // Always query trained AI ML engine (CoupledLiveEngine) for selectedStationId.
  useEffect(() => {
    const livePm25 = livePm25ByStation[selectedStationId];
    const trajPm25 = baseStationForecasts[selectedStationId]?.[selectedHour]?.groundTruthPM25;
    const pm25 = Number.isFinite(livePm25) ? livePm25 : (Number.isFinite(trajPm25) ? trajPm25 : 120.0);

    const weather = apiState.observations.find(o => o.source === 'weather') || {};
    const healthyLinks = (apiState.links || []).filter(
      link => link.health && link.health.status === 'healthy'
    ).length;
    let active = true;

    window.CLOVER_API.forecast({
      stationId: selectedStationId,
      features: {
        pm25,
        temperatureC:  weather.temperatureC  ?? currentWx.temp ?? 25.0,
        humidityPct:   weather.humidityPct   ?? currentWx.relativeHumidity ?? 60.0,
        windSpeedMs:   weather.windSpeedMs   ?? currentWx.windSpeed ?? 2.5,
        cmlMeanRslDbm: -42.5,
        cmlHealthyLinks: healthyLinks,
      },
      horizons: Array.from({ length: 73 }, (_, h) => h),
    })
      .then(result => { if (active) setBackendForecast(result); })
      .catch((err) => {
        console.warn('Backend ML forecast query notice:', err.message);
        if (active) setBackendForecast(null);
      });
    return () => { active = false; };
  }, [selectedStationId, livePm25ByStation, baseStationForecasts, selectedHour, currentWx, apiState.observations, apiState.links]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const formatTemp = (celsius) =>
    tempUnit === 'F' ? `${Math.round(celsius * 1.8 + 32)}°F` : `${Math.round(celsius)}°C`;

  // ── Derived / memoised values ─────────────────────────────────────────────
  const currentCmlStates = useMemo(() =>
    cmlLinks.map(link => window.CML_ENGINE.computeLinkState(link, towersMap, currentWx)).filter(Boolean),
    [cmlLinks, towersMap, currentWx]
  );

  const selectedStation = useMemo(() => {
    const st   = stations.find(s => s.id === selectedStationId) || stations[0];
    const traj = baseStationForecasts[st.id] || [];
    return {
      station:           st,
      currentTrajectory: traj[selectedHour] || traj[0],
      fullTrajectory:    traj,
    };
  }, [stations, selectedStationId, baseStationForecasts, selectedHour]);

  const selectedCml = useMemo(() =>
    currentCmlStates.find(c => c.id === selectedCmlId) || currentCmlStates[0],
    [selectedCmlId, currentCmlStates]
  );

  const currentStationMetrics = useMemo(() => {
    const traj = selectedStation.currentTrajectory || selectedStation.fullTrajectory?.[0];
    const simulatedPm25 = traj
      ? (activeModel === 'modelA' ? (traj.modelA_PM25 ?? traj.groundTruthPM25) : (traj.modelB_PM25 ?? traj.groundTruthPM25))
      : null;
    const forecastPoint  = backendForecast?.forecast?.find(p => p.horizonHours === selectedHour);
    const livePm = livePm25ByStation[selectedStation.station?.id]
      ?? Object.entries(livePm25ByStation).find(([k]) => k.includes(selectedStation.station?.id?.split('_')?.pop() || ''))?.[1];

    let rawPm25 = (selectedHour === 0 && Number.isFinite(livePm))
      ? livePm
      : (Number.isFinite(forecastPoint?.pm25)
          ? forecastPoint.pm25
          : (Number.isFinite(simulatedPm25) ? simulatedPm25 : (selectedStation.station?.basePM25 ?? 38.5)));

    const pm25 = Number.isFinite(rawPm25) ? Math.round(rawPm25 * 10) / 10 : (selectedStation.station?.basePM25 || 38.5);

    const liveObsForStation = apiState.observations.find(
      o => o.source === 'aq_station' && (o.deviceId === selectedStation.station?.id || o.deviceId?.includes(selectedStation.station?.id?.split('_').pop()))
    );

    const pm10 = liveObsForStation?.pm10 ?? traj?.pm10 ?? Math.round(pm25 * 1.55);
    const no2  = liveObsForStation?.no2 ?? traj?.no2 ?? 28;
    const so2  = liveObsForStation?.so2 ?? traj?.so2 ?? 11;
    const co   = liveObsForStation?.co ?? traj?.co ?? 0.5;
    const o3   = liveObsForStation?.o3 ?? traj?.o3 ?? 44;
    const aqi  = window.FORECAST_ENGINE ? window.FORECAST_ENGINE.calculateAQI(pm25) : 108;
    const aqiCategory = window.FORECAST_ENGINE ? window.FORECAST_ENGINE.getAQICategory(aqi) : { label: 'Moderate', color: '#eab308' };

    return { pm25: Math.round(pm25), pm10: Math.round(pm10), no2, so2, co, o3, aqi, aqiCategory };
  }, [selectedStation, activeModel, selectedHour, livePm25ByStation, backendForecast, apiState.observations]);

  const regionalMetrics = useMemo(() => {
    let sumPM25 = 0;
    let validCount = 0;
    stations.forEach(s => {
      const liveObs = apiState.observations.find(o => o.deviceId === s.id || o.deviceId?.includes(s.id.split('_').pop()));
      const livePm = liveObs && Number.isFinite(liveObs.pm25) ? liveObs.pm25 : null;
      const traj = baseStationForecasts[s.id]?.[selectedHour];
      const pm25 = (selectedHour === 0 && livePm !== null)
        ? livePm
        : (traj ? (activeModel === 'modelA' ? (traj.modelA_PM25 ?? 0) : (traj.modelB_PM25 ?? 0)) : (s.basePM25 || 38.5));
      sumPM25 += pm25;
      validCount++;
    });
    const avgPM25 = validCount > 0 ? Math.round((sumPM25 / validCount) * 10) / 10 : null;
    const aqi = avgPM25 !== null ? window.FORECAST_ENGINE.calculateAQI(avgPM25) : null;
    const aqiCategory = aqi !== null ? window.FORECAST_ENGINE.getAQICategory(aqi) : { label: 'N/A', color: '#64748b' };

    const avgCmlAttenuation = +(currentCmlStates.reduce(
      (acc, c) => acc + c.specificAttenuationDbKm, 0
    ) / (currentCmlStates.length || 1)).toFixed(2);

    const maxCmlAttenuation = Math.max(
      ...currentCmlStates.map(c => c.specificAttenuationDbKm), 0
    ).toFixed(2);

    const avgDeltaRsl = +(currentCmlStates.reduce(
      (acc, c) => acc + c.deltaRsl, 0
    ) / (currentCmlStates.length || 1)).toFixed(1);

    const cmlDerivedRainRate = currentWx.rain > 0
      ? currentWx.rain
      : avgCmlAttenuation > 0.8 ? +(avgCmlAttenuation * 1.8).toFixed(1) : 0;

    return { avgPM25, aqi, aqiCategory, avgCmlAttenuation, maxCmlAttenuation, avgDeltaRsl, cmlDerivedRainRate };
  }, [stations, baseStationForecasts, selectedHour, activeModel, currentCmlStates, currentWx, apiState.observations]);

  const rankedStations = useMemo(() =>
    [...stations].map(st => {
      const traj = baseStationForecasts[st.id]?.[selectedHour];
      const livePm = livePm25ByStation[st.id];
      const pm25 = Number.isFinite(livePm)
        ? livePm
        : (traj ? (activeModel === 'modelA' ? traj.modelA_PM25 : traj.modelB_PM25) : null);
      const isAvailable = Number.isFinite(pm25);
      const aqi  = isAvailable ? window.FORECAST_ENGINE.calculateAQI(pm25) : null;
      const cat  = isAvailable ? window.FORECAST_ENGINE.getAQICategory(aqi) : { label: 'N/A', color: '#64748b' };
      return { ...st, currentPM25: pm25, currentAQI: aqi, cat };
    }).sort((a, b) => ((b.currentPM25 ?? -1) - (a.currentPM25 ?? -1))),
    [stations, baseStationForecasts, selectedHour, activeModel, livePm25ByStation]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stations.filter(
      s => s.name.toLowerCase().includes(q) || (s.district && s.district.toLowerCase().includes(q))
    );
  }, [stations, searchQuery]);

  // ── Side effects ──────────────────────────────────────────────────────────

  // Real-time clock
  useEffect(() => {
    const clock = setInterval(() => {
      setCurrentTimeStr(
        new Date().toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  // 72-hour auto-playback timer
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setSelectedHour(prev => {
          if (prev >= 72) { setIsPlaying(false); return 72; }
          return prev + 1;
        });
      }, Math.round(1000 / playSpeed));
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, playSpeed]);

  // ── Leaflet map lifecycle & initialization ────────────────────────────────
  const initMap = () => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch (e) {}
      mapInstanceRef.current = null;
    }
    if (mapRef.current._leaflet_id) {
      delete mapRef.current._leaflet_id;
    }

    const map = L.map(mapRef.current, {
      center: [28.474, 77.504], zoom: 11, minZoom: 9, maxZoom: 16,
      zoomControl: false, attributionControl: false,
    });

    const CARTO_API_KEY = 'cb1_3ixp_1_6495ecfd6038be59b57639dc';
    L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; CARTO &copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    stationLayerGroupRef.current = L.layerGroup().addTo(map);
    fireLayerGroupRef.current    = L.layerGroup().addTo(map);
    windLayerGroupRef.current    = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);
  };

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (e) {}
        mapInstanceRef.current = null;
      }
    };
  }, [activeTab]);

  // Invalidate map size on tab switch so Leaflet re-draws tiles
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => mapInstanceRef.current.invalidateSize(), 150);
    }
  }, [activeTab]);

  // Center map helper
  const centerMap = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([28.474, 77.504], 11, { duration: 1.2 });
    }
  };

  // Update AQI / Rain radar heatmap
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapRef.current || mapRef.current.clientHeight === 0) return;

    try {
      if (layers.field && typeof L.heatLayer === 'function') {
        let heatPoints, heatGradient;

        if (weatherFieldMode === 'rain') {
          heatPoints   = window.FORECAST_ENGINE.generateCmlMoisturePoints(currentCmlStates, bbox, 26);
          heatGradient = { 0.15: '#0ea5e9', 0.35: '#3b82f6', 0.55: '#10b981', 0.75: '#f59e0b', 0.90: '#ef4444' };
        } else {
          heatPoints   = window.FORECAST_ENGINE.generateHeatmapPoints(stations, baseStationForecasts, selectedHour, activeModel, bbox, 26);
          heatGradient = { 0.15: '#10b981', 0.32: '#84cc16', 0.52: '#eab308', 0.70: '#f97316', 0.84: '#ef4444', 0.98: '#7f1d1d' };
        }

        if (heatLayerRef.current) {
          heatLayerRef.current.setLatLngs(heatPoints);
        } else {
          heatLayerRef.current = L.heatLayer(heatPoints, {
            radius: 36, blur: 26, maxZoom: 14, max: 1.0, minOpacity: 0.22, gradient: heatGradient,
          }).addTo(map);
        }
      } else if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    } catch (err) {
      console.warn('Heatmap canvas update deferred:', err);
    }
  }, [selectedHour, activeModel, layers.field, weatherFieldMode, stations, baseStationForecasts, currentCmlStates, bbox, activeTab, apiState.observations, telemetryTick]);

  // Update vector layers (stations, fire hotspots, wind)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (stationLayerGroupRef.current) stationLayerGroupRef.current.clearLayers();
    if (fireLayerGroupRef.current)    fireLayerGroupRef.current.clearLayers();
    if (windLayerGroupRef.current)    windLayerGroupRef.current.clearLayers();

    // 1. Monitoring station pins (live telemetry synchronized)
    if (layers.stations && stationLayerGroupRef.current) {
      stations.forEach(station => {
        const liveObs = apiState.observations.find(o => o.deviceId === station.id || o.deviceId?.includes(station.id.split('_').pop()));
        const livePm = liveObs && Number.isFinite(liveObs.pm25) ? liveObs.pm25 : null;
        const trajectory = baseStationForecasts[station.id]?.[selectedHour];

        let pm25;
        if (selectedHour === 0 && livePm !== null) {
          pm25 = livePm;
        } else if (trajectory) {
          pm25 = activeModel === 'modelA' ? trajectory.modelA_PM25 : trajectory.modelB_PM25;
        } else {
          pm25 = station.basePM25 || 38.5;
        }
        pm25 = Math.round(pm25 * 10) / 10;
        const aqi  = window.FORECAST_ENGINE.calculateAQI(pm25);
        const cat  = window.FORECAST_ENGINE.getAQICategory(aqi);
        const isSelected = selectedStationId === station.id && inspectorType === 'station';
        const shortCode = station.name.split(' ')[0].substring(0, 4).toUpperCase();

        const badgeIcon = L.divIcon({
          className: 'station-pin-container',
          html: `<div class="station-badge-pill ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white scale-110 shadow-lg' : ''}">
            <span class="station-badge-code">${shortCode}</span>
            <span class="station-badge-val" style="background-color: ${cat.color}; color: #ffffff;">${aqi}</span>
          </div>`,
          iconSize: [68, 26], iconAnchor: [34, 13],
        });

        const marker = L.marker([station.lat, station.lon], { icon: badgeIcon });
        marker.bindTooltip(`
          <div class="font-sans p-1.5 text-slate-800">
            <div class="font-bold text-slate-900 text-xs">${station.name}</div>
            <div class="text-slate-500 text-[10px]">${station.district} &bull; ${station.type}</div>
            <div class="flex items-center gap-2 mt-1.5 pt-1 border-t border-slate-100 text-xs font-semibold">
              <span class="text-emerald-700">${pm25} µg/m³ PM2.5</span>
              <span style="color: ${cat.color};">AQI ${aqi} (${cat.label})</span>
            </div>
            <div class="text-[10px] text-slate-500 mt-0.5">
              Temp: ${formatTemp(currentWx.temp)} &bull; RH: ${currentWx.relativeHumidity}% &bull; Wind: ${currentWx.windSpeed} m/s
            </div>
            <div class="text-[9px] text-emerald-700 font-mono mt-1 font-bold">
              ● Live CAAQMS Telemetry Synced
            </div>
          </div>
        `, { offset: [0, -14] });

        marker.on('click', () => { setSelectedStationId(station.id); setInspectorType('station'); });
        marker.addTo(stationLayerGroupRef.current);
      });
    }

    // 2. Fire hotspot markers
    if (layers.fires && fireLayerGroupRef.current) {
      fireHotspots.forEach(fire => {
        const fireIcon = L.divIcon({
          className: 'fire-marker-wrapper',
          html: `<div class="relative flex items-center justify-center cursor-pointer" title="Thermal Hotspot: ${fire.location}">
            <div class="absolute w-5 h-5 rounded-full bg-rose-500/40 animate-ping"></div>
            <div class="relative w-4 h-4 rounded-full bg-rose-600 border border-amber-300 shadow flex items-center justify-center text-[9px] text-amber-200">🔥</div>
          </div>`,
          iconSize: [16, 16], iconAnchor: [8, 8],
        });
        const marker = L.marker([fire.lat, fire.lon], { icon: fireIcon });
        marker.bindTooltip(`
          <div class="font-sans text-xs text-slate-800">
            <span class="text-rose-600 font-bold">NASA VIIRS Thermal Anomaly</span><br/>
            Location: <strong>${fire.location}</strong><br/>
            FRP: <strong class="text-amber-600">${fire.frp} MW</strong> (Confidence: ${fire.confidence}%)
          </div>
        `);
        marker.addTo(fireLayerGroupRef.current);
      });
    }

    // 3. Wind vectors
    if (layers.wind && windLayerGroupRef.current) {
      const windStep = 0.08;
      for (let lat = bbox.minLat + 0.04; lat <= bbox.maxLat; lat += windStep) {
        for (let lon = bbox.minLon + 0.04; lon <= bbox.maxLon; lon += windStep) {
          const windAngle = currentWx.windDir + 180;
          const windIcon = L.divIcon({
            className: 'wind-vector-arrow',
            html: `<div style="transform: rotate(${windAngle}deg); opacity: 0.3;" class="text-sky-600 pointer-events-none">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
              </svg></div>`,
            iconSize: [12, 12], iconAnchor: [6, 6],
          });
          L.marker([lat, lon], { icon: windIcon, interactive: false }).addTo(windLayerGroupRef.current);
        }
      }
    }
  }, [selectedHour, activeModel, layers, stations, baseStationForecasts, fireHotspots, currentWx, bbox, selectedStationId, inspectorType, tempUnit, activeTab, apiState.observations, livePm25ByStation, telemetryTick]);

  // Chart.js rendering
  useEffect(() => {
    if (!chartCanvasRef.current) return;
    const ctx = chartCanvasRef.current.getContext('2d');
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const labels = weather72h.filter((_, i) => i % 3 === 0).map(w => `+${w.hour}h`);

    if (inspectorType === 'cml' && selectedCml) {
      const rslData      = weather72h.filter((_, i) => i % 3 === 0).map(w => window.CML_ENGINE.computeLinkState(selectedCml, towersMap, w).currentRsl);
      const baselineData = labels.map(() => selectedCml.baselineRsl);

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Received Signal Level (RSL in dBm)', data: rslData, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.12)', fill: true, tension: 0.35, borderWidth: 2, pointRadius: 2 },
            { label: 'Baseline Clear-Sky RSL (dBm)', data: baselineData, borderColor: '#94a3b8', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 0 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10, family: 'Inter' } } } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } } } },
      });
    } else {
      const traj      = selectedStation.fullTrajectory;
      const modelAData = traj.filter((_, i) => i % 3 === 0).map(t => t.modelA_PM25);
      const modelBData = traj.filter((_, i) => i % 3 === 0).map(t => t.modelB_PM25);

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: '✦ Atmospheric Radar AI Model (µg/m³)', data: modelBData, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.12)', fill: true, tension: 0.35, borderWidth: 2.2, pointRadius: 2 },
            { label: 'Baseline Numerical Model (µg/m³)', data: modelAData, borderColor: '#94a3b8', borderDash: [4, 4], borderWidth: 1.5, pointRadius: 1 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10, family: 'Inter' } } } }, scales: { x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } }, y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } }, title: { display: true, text: 'PM2.5 (µg/m³)', font: { size: 10 } } } } },
      });
    }

    return () => { if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; } };
  }, [inspectorType, selectedStation, selectedCml, towersMap, weather72h]);

  // ── Navigation helper ─────────────────────────────────────────────────────
  const flyToStation = (stationId) => {
    setSelectedStationId(stationId);
    setInspectorType('station');
    const st = stations.find(s => s.id === stationId);
    if (st && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([st.lat, st.lon], 13, { duration: 1.2 });
    }
    setSearchQuery('');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen text-slate-800 font-sans flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <Header
        activeTab={activeTab}          setActiveTab={setActiveTab}
        searchQuery={searchQuery}      setSearchQuery={setSearchQuery}
        searchResults={searchResults}  flyToStation={flyToStation}
        currentTimeStr={currentTimeStr}
        tempUnit={tempUnit}            setTempUnit={setTempUnit}
      />

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">

        {/* Location hero title + model toggle */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black font-heading text-slate-900 tracking-tight">
                {selectedStation.station.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold glass-subtle text-emerald-800 border border-emerald-300/60 flex items-center gap-1.5 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"/>
                </span>
                <span>LIVE CAAQMS TELEMETRY &bull; SYNC #{telemetryTick}</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
              <span>📍 Lat: <strong>{selectedStation.station.lat}° N</strong>, Lon: <strong>{selectedStation.station.lon}° E</strong></span>
              <span>•</span>
              <span>Elevation: <strong>201 m</strong></span>
              <span>•</span>
              <span>Station Type: <strong>{selectedStation.station.type}</strong></span>
              <span>•</span>
              <span>Horizon: <strong>+{selectedHour} Hours</strong></span>
            </p>
          </div>

          {/* Model toggle */}
          <div className="flex items-center gap-2 self-start md:self-auto glass-card p-1 rounded-2xl shadow-sm">
            <button
              onClick={() => setActiveModel('modelB')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeModel === 'modelB' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>✦ Radar AI Fusion</span>
            </button>
            <button
              onClick={() => setActiveModel('modelA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeModel === 'modelA' ? 'bg-slate-800 text-white shadow' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baseline NWP
            </button>
          </div>
        </div>

        {/* ── Weather & Overview tab ─────────────────────────────────────── */}
        {activeTab === 'weather' && (
          <div className="space-y-6">

            {/* Hero split: weather + AQI */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <WeatherHeroCard
                currentWx={currentWx}
                formatTemp={formatTemp}
                cmlDerivedRainRate={regionalMetrics.cmlDerivedRainRate}
              />
              <AQICard
                currentStationMetrics={currentStationMetrics}
              />
            </div>

            {/* ── Interactive Radar MAP Prototype Centerpiece ──────────── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <span>📡 Interactive Radar Map &amp; Atmospheric Field</span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                      PROTOTYPE RADAR
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live 360° radar sweep scanning Delhi-NCR and Greater Noida monitoring stations
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('map')}
                  className="text-xs text-emerald-700 font-bold hover:underline cursor-pointer"
                >
                  Full Radar Screen &rarr;
                </button>
              </div>

              <MapView
                weatherFieldMode={weatherFieldMode}
                setWeatherFieldMode={setWeatherFieldMode}
                layers={layers}
                setLayers={setLayers}
                mapRef={mapRef}
                activeModel={activeModel}
                selectedHour={selectedHour}
                selectedStation={selectedStation}
                currentWx={currentWx}
                formatTemp={formatTemp}
                centerMap={centerMap}
                telemetryTick={telemetryTick}
                lastSyncTime={lastSyncTime}
              />
            </div>

            {/* 8-parameter grid */}
            <WeatherParamGrid
              currentWx={currentWx}
              currentStationMetrics={currentStationMetrics}
              regionalMetrics={regionalMetrics}
              formatTemp={formatTemp}
            />

            {/* Hourly forecast scroll */}
            <HourlyForecast
              weather72h={weather72h}
              selectedStation={selectedStation}
              selectedHour={selectedHour}    setSelectedHour={setSelectedHour}
              isPlaying={isPlaying}          setIsPlaying={setIsPlaying}
              playSpeed={playSpeed}          setPlaySpeed={setPlaySpeed}
              activeModel={activeModel}
              formatTemp={formatTemp}
              backendForecast={backendForecast}
            />

            {/* 7-day outlook + health recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <SevenDayForecast
                weather72h={weather72h}
                selectedStation={selectedStation}
                activeModel={activeModel}
                formatTemp={formatTemp}
                setActiveTab={setActiveTab}
                backendForecast={backendForecast}
              />
              <HealthRecommendations aqi={currentStationMetrics.aqi} />
            </div>

            {/* Pollutants grid */}
            <PollutantsGrid
              currentStationMetrics={currentStationMetrics}
              selectedStation={selectedStation}
            />

            {/* Stations table */}
            <StationsTable
              rankedStations={rankedStations}
              selectedStationId={selectedStationId}
              currentWx={currentWx}
              formatTemp={formatTemp}
              flyToStation={flyToStation}
              stations={stations}
            />
          </div>
        )}

        {/* ── Forecast tab ───────────────────────────────────────────────── */}
        {activeTab === 'forecast' && (
          <ForecastTab
            weather72h={weather72h}
            selectedStation={selectedStation}
            activeModel={activeModel}
            formatTemp={formatTemp}
            backendForecast={backendForecast}
          />
        )}

        {/* ── Map tab (Full dedicated view) ──────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black font-heading text-slate-900">
                  Greater Noida &amp; Delhi-NCR Interactive Atmospheric Radar
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  High-resolution continuous 360° radar telemetry with dispersion modelling &amp; station telemetry
                </p>
              </div>
              <button
                onClick={() => setActiveTab('weather')}
                className="text-xs font-bold text-slate-600 glass-subtle px-3 py-1.5 rounded-xl hover:bg-white cursor-pointer"
              >
                &larr; Back to Overview
              </button>
            </div>

            <MapView
              weatherFieldMode={weatherFieldMode}
              setWeatherFieldMode={setWeatherFieldMode}
              layers={layers}
              setLayers={setLayers}
              mapRef={mapRef}
              activeModel={activeModel}
              selectedHour={selectedHour}
              selectedStation={selectedStation}
              currentWx={currentWx}
              formatTemp={formatTemp}
              centerMap={centerMap}
              telemetryTick={telemetryTick}
              lastSyncTime={lastSyncTime}
            />

            <StationsTable
              rankedStations={rankedStations}
              selectedStationId={selectedStationId}
              currentWx={currentWx}
              formatTemp={formatTemp}
              flyToStation={flyToStation}
              stations={stations}
            />
          </div>
        )}

        {/* ── Pollutants deep-dive tab ───────────────────────────────────── */}
        {activeTab === 'pollutants' && (
          <PollutantsDeepDive
            currentStationMetrics={currentStationMetrics}
            selectedStation={selectedStation}
          />
        )}

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <Footer />

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<CloverApp />);
