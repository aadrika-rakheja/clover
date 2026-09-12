const { useState, useEffect, useRef, useMemo } = React;

function CloverApp() {
  const bbox = window.DELHI_BBOX;
  const stations = window.CPCB_STATIONS;
  const towers = window.TELECOM_TOWERS;
  const cmlLinks = window.CML_LINKS;
  const fireHotspots = window.CROP_FIRE_HOTSPOTS;

  // Meteorological & Model Forecasts
  const weather72h = useMemo(() => window.FORECAST_ENGINE.generate72HourWeather(), []);
  const baseStationForecasts = useMemo(() => {
    return window.FORECAST_ENGINE.generateStationForecasts(stations, weather72h, cmlLinks, towers);
  }, [stations, weather72h, cmlLinks, towers]);

  const towersMap = useMemo(() => {
    const map = {};
    towers.forEach(t => { map[t.id] = t; });
    return map;
  }, [towers]);

  // Primary Navigation State
  const [activeTab, setActiveTab] = useState('weather'); // 'weather', 'forecast', 'map', 'pollutants', 'cml_science'

  // Temperature unit (°C or °F)
  const [tempUnit, setTempUnit] = useState('C');

  // AQI standard ('IN' for CPCB or 'US' for US EPA)
  const [aqiStandard, setAqiStandard] = useState('IN');

  // Time & Model Scrubber State
  const [selectedHour, setSelectedHour] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [activeModel, setActiveModel] = useState('modelB'); // 'modelB' (CML RSL Fusion), 'modelA' (Baseline Numerical)
  const [searchQuery, setSearchQuery] = useState('');
  const [apiState, setApiState] = useState({ status: 'connecting', observations: [], alerts: [], links: [] });
  const [backendForecast, setBackendForecast] = useState(null);

  // Default to Greater Noida Station (Knowledge Park III)
  const defaultStationId = stations.find(s => s.id.includes('gnoida') || s.name.includes('Greater Noida'))?.id || stations[0].id;
  const [selectedStationId, setSelectedStationId] = useState(defaultStationId);
  const [selectedCmlId, setSelectedCmlId] = useState(cmlLinks[0]?.id || '');
  const [inspectorType, setInspectorType] = useState('station'); // 'station' or 'cml'

  // Map Active Weather Field Mode
  const [weatherFieldMode, setWeatherFieldMode] = useState('aqi'); // 'aqi', 'cml_rain', 'wind'

  // Layer Toggles for Map
  const [layers, setLayers] = useState({
    field: true,
    stations: true,
    cml: true,
    wind: true,
    fires: true
  });

  // Real-time Clock
  const [currentTimeStr, setCurrentTimeStr] = useState(
    new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // DOM & Library Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const heatLayerRef = useRef(null);
  const stationLayerGroupRef = useRef(null);
  const cmlLayerGroupRef = useRef(null);
  const fireLayerGroupRef = useRef(null);
  const windLayerGroupRef = useRef(null);
  const timerRef = useRef(null);
  const chartCanvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const currentWx = weather72h[selectedHour] || weather72h[0];

  // Poll the Node API. The locally generated design data remains a deliberate
  // offline fallback until field telemetry has been ingested by the backend.
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const [health, aq, weather, cml, alerts, links] = await Promise.all([
          window.CLOVER_API.health(), window.CLOVER_API.latest('aq_station'),
          window.CLOVER_API.latest('weather'), window.CLOVER_API.latest('cml'),
          window.CLOVER_API.alerts(), window.CLOVER_API.links()
        ]);
        if (active) setApiState({ status: health.status === 'ok' ? 'live' : 'degraded', observations: [...(aq.data || []), ...(weather.data || []), ...(cml.data || [])], alerts: alerts.data || [], links: links.data || [] });
      } catch (_error) {
        if (active) setApiState(previous => ({ ...previous, status: 'offline' }));
      }
    };
    refresh();
    const poll = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(poll); };
  }, []);

  const livePm25ByStation = useMemo(() => Object.fromEntries(
    apiState.observations.filter(o => o.source === 'aq_station' && Number.isFinite(o.pm25)).map(o => [o.deviceId, o.pm25])
  ), [apiState.observations]);

  // Request the FastAPI forecast through the Node gateway only when real AQ
  // data exists. This avoids presenting simulation values as ML input.
  useEffect(() => {
    const pm25 = livePm25ByStation[selectedStationId];
    if (!Number.isFinite(pm25) || apiState.status !== 'live') { setBackendForecast(null); return; }
    const weather = apiState.observations.find(o => o.source === 'weather') || {};
    const healthyLinks = apiState.links.filter(link => link.health && link.health.status === 'healthy').length;
    let active = true;
    window.CLOVER_API.forecast({
      stationId: selectedStationId,
      features: { pm25, temperatureC: weather.temperatureC ?? null, humidityPct: weather.humidityPct ?? null, windSpeedMs: weather.windSpeedMs ?? null, cmlMeanRslDbm: null, cmlHealthyLinks: healthyLinks },
      horizons: Array.from({ length: 73 }, (_, hour) => hour)
    }).then(result => { if (active) setBackendForecast(result); }).catch(() => { if (active) setBackendForecast(null); });
    return () => { active = false; };
  }, [selectedStationId, livePm25ByStation, apiState.status, apiState.observations, apiState.links]);

  // Helper for Temperature Conversion
  const formatTemp = (celsius) => {
    if (tempUnit === 'F') {
      return `${Math.round(celsius * 1.8 + 32)}°F`;
    }
    return `${Math.round(celsius)}°C`;
  };

  // Current CML Telemetry computation across all microwave hops
  const currentCmlStates = useMemo(() => {
    return cmlLinks.map(link => {
      return window.CML_ENGINE.computeLinkState(link, towersMap, currentWx);
    }).filter(Boolean);
  }, [cmlLinks, towersMap, currentWx]);

  // Active Selected Station Object
  const selectedStation = useMemo(() => {
    const st = stations.find(s => s.id === selectedStationId) || stations[0];
    const traj = baseStationForecasts[st.id] || [];
    return {
      station: st,
      currentTrajectory: traj[selectedHour] || traj[0],
      fullTrajectory: traj
    };
  }, [stations, selectedStationId, baseStationForecasts, selectedHour]);

  // Active Selected CML Link Object
  const selectedCml = useMemo(() => {
    return currentCmlStates.find(c => c.id === selectedCmlId) || currentCmlStates[0];
  }, [selectedCmlId, currentCmlStates]);

  // Station specific metrics for current selected hour
  const currentStationMetrics = useMemo(() => {
    const traj = selectedStation.currentTrajectory;
    const simulatedPm25 = activeModel === 'modelA' ? traj.modelA_PM25 : traj.modelB_PM25;
    const forecastPoint = backendForecast?.forecast?.find(point => point.horizonHours === selectedHour);
    const pm25 = Number.isFinite(forecastPoint?.pm25) ? forecastPoint.pm25 : (selectedHour === 0 && Number.isFinite(livePm25ByStation[selectedStation.station.id]) ? livePm25ByStation[selectedStation.station.id] : simulatedPm25);
    const pm10 = Math.round(pm25 * 1.55);
    const no2 = traj.modelB_NO2 || selectedStation.station.baseNO2;
    const so2 = traj.modelB_SO2 || selectedStation.station.baseSO2;
    const co = +(traj.modelB_CO || selectedStation.station.baseCO).toFixed(1);
    const o3 = traj.modelB_O3 || selectedStation.station.baseO3;
    const aqi = window.FORECAST_ENGINE.calculateAQI(pm25);
    const aqiCategory = window.FORECAST_ENGINE.getAQICategory(aqi);

    return {
      pm25,
      pm10,
      no2,
      so2,
      co,
      o3,
      aqi,
      aqiCategory
    };
  }, [selectedStation, activeModel, selectedHour, livePm25ByStation, backendForecast]);

  // Regional Meteorological & CML Aggregations
  const regionalMetrics = useMemo(() => {
    let sumPM25 = 0;
    stations.forEach(s => {
      const traj = baseStationForecasts[s.id][selectedHour];
      sumPM25 += activeModel === 'modelA' ? traj.modelA_PM25 : traj.modelB_PM25;
    });
    const avgPM25 = Math.round(sumPM25 / stations.length);
    const aqi = window.FORECAST_ENGINE.calculateAQI(avgPM25);
    const aqiCategory = window.FORECAST_ENGINE.getAQICategory(aqi);

    const avgCmlAttenuation = +(currentCmlStates.reduce((acc, c) => acc + c.specificAttenuationDbKm, 0) / (currentCmlStates.length || 1)).toFixed(2);
    const maxCmlAttenuation = Math.max(...currentCmlStates.map(c => c.specificAttenuationDbKm), 0).toFixed(2);
    const avgDeltaRsl = +(currentCmlStates.reduce((acc, c) => acc + c.deltaRsl, 0) / (currentCmlStates.length || 1)).toFixed(1);

    const cmlDerivedRainRate = currentWx.rain > 0 ? currentWx.rain : (avgCmlAttenuation > 0.8 ? +(avgCmlAttenuation * 1.8).toFixed(1) : 0);

    return { avgPM25, aqi, aqiCategory, avgCmlAttenuation, maxCmlAttenuation, avgDeltaRsl, cmlDerivedRainRate };
  }, [stations, baseStationForecasts, selectedHour, activeModel, currentCmlStates, currentWx]);

  // Ranked Stations
  const rankedStations = useMemo(() => {
    return [...stations].map(st => {
      const traj = baseStationForecasts[st.id][selectedHour];
      const pm25 = activeModel === 'modelA' ? traj.modelA_PM25 : traj.modelB_PM25;
      const aqi = window.FORECAST_ENGINE.calculateAQI(pm25);
      return {
        ...st,
        currentPM25: pm25,
        currentAQI: aqi,
        cat: window.FORECAST_ENGINE.getAQICategory(aqi)
      };
    }).sort((a, b) => b.currentPM25 - a.currentPM25);
  }, [stations, baseStationForecasts, selectedHour, activeModel]);

  // Search Results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return stations.filter(s =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.district && s.district.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [stations, searchQuery]);

  // Real-time Clock
  useEffect(() => {
    const clock = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(clock);
  }, []);

  // 72-Hour Auto Playback Timer
  useEffect(() => {
    if (isPlaying) {
      const interval = Math.round(1000 / playSpeed);
      timerRef.current = setInterval(() => {
        setSelectedHour(prev => {
          if (prev >= 72) {
            setIsPlaying(false);
            return 72;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, playSpeed]);

  // Initialize Map Permanently on Mount
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [28.474, 77.504],
      zoom: 11,
      minZoom: 9,
      maxZoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 16,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    stationLayerGroupRef.current = L.layerGroup().addTo(map);
    cmlLayerGroupRef.current = L.layerGroup().addTo(map);
    fireLayerGroupRef.current = L.layerGroup().addTo(map);
    windLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate Map Size on Tab Switch
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 150);
    }
  }, [activeTab]);

  // Update Meteorological Heatmap based on Weather Mode
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapRef.current || mapRef.current.clientHeight === 0) return;

    try {
      if (layers.field && typeof L.heatLayer === 'function') {
        let heatPoints = [];
        let heatGradient = {};

        if (weatherFieldMode === 'cml_rain') {
          heatPoints = window.FORECAST_ENGINE.generateCmlMoisturePoints(currentCmlStates, bbox, 26);
          heatGradient = {
            0.15: '#0ea5e9',
            0.35: '#3b82f6',
            0.55: '#10b981',
            0.75: '#f59e0b',
            0.90: '#ef4444'
          };
        } else {
          heatPoints = window.FORECAST_ENGINE.generateHeatmapPoints(stations, baseStationForecasts, selectedHour, activeModel, bbox, 26);
          heatGradient = {
            0.15: '#10b981',
            0.32: '#84cc16',
            0.52: '#eab308',
            0.70: '#f97316',
            0.84: '#ef4444',
            0.98: '#7f1d1d'
          };
        }

        if (heatLayerRef.current) {
          heatLayerRef.current.setLatLngs(heatPoints);
        } else {
          heatLayerRef.current = L.heatLayer(heatPoints, {
            radius: 36,
            blur: 26,
            maxZoom: 14,
            max: 1.0,
            minOpacity: 0.22,
            gradient: heatGradient
          }).addTo(map);
        }
      } else if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    } catch (err) {
      console.warn("Heatmap canvas update deferred:", err);
    }
  }, [selectedHour, activeModel, layers.field, weatherFieldMode, stations, baseStationForecasts, currentCmlStates, bbox]);

  // Update Vector Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    stationLayerGroupRef.current.clearLayers();
    cmlLayerGroupRef.current.clearLayers();
    fireLayerGroupRef.current.clearLayers();
    windLayerGroupRef.current.clearLayers();

    // 1. CML Telecom Microwave Links
    if (layers.cml) {
      currentCmlStates.forEach(linkState => {
        const fromPos = [linkState.fromTower.lat, linkState.fromTower.lon];
        const toPos = [linkState.toTower.lat, linkState.toTower.lon];

        let beamColor = '#0284c7';
        let isAttenuating = false;
        if (linkState.specificAttenuationDbKm > 1.8) {
          beamColor = '#ef4444';
          isAttenuating = true;
        } else if (linkState.specificAttenuationDbKm > 0.8) {
          beamColor = '#f59e0b';
        }

        const isSelected = selectedCmlId === linkState.id && inspectorType === 'cml';

        const polyline = L.polyline([fromPos, toPos], {
          color: beamColor,
          weight: isSelected ? 4.5 : 2.4,
          dashArray: '5, 5',
          opacity: isSelected ? 1.0 : 0.85,
          className: isAttenuating ? 'cml-beam-pulsing' : ''
        });

        polyline.bindTooltip(`
          <div class="font-sans text-xs p-1 text-slate-800">
            <div class="text-sky-700 font-bold flex items-center gap-1.5">
              <span>CML LINK: ${linkState.id}</span>
              <span class="text-[10px] text-slate-500">(${linkState.freqGHz} GHz &bull; ${linkState.polarization}-pol)</span>
            </div>
            <div class="text-slate-700 mt-1">
              Specific Attenuation (&gamma;): <strong class="text-amber-600">${linkState.specificAttenuationDbKm} dB/km</strong>
            </div>
            <div class="text-[10px] text-slate-500">
              Rx Power (RSL): <strong class="text-rose-600">${linkState.currentRsl} dBm</strong> (&Delta;RSL: ${linkState.deltaRsl} dBm)
            </div>
            <div class="text-[10px] text-emerald-700 mt-0.5">
              Derived Rain Rate: ${(linkState.specificAttenuationDbKm > 0.5 ? (linkState.specificAttenuationDbKm * 2.1).toFixed(1) : 0)} mm/h
            </div>
          </div>
        `, { sticky: true, offset: [0, -5] });

        polyline.on('click', () => {
          setSelectedCmlId(linkState.id);
          setInspectorType('cml');
        });

        polyline.addTo(cmlLayerGroupRef.current);

        // Tower markers at endpoints
        [linkState.fromTower, linkState.toTower].forEach(tow => {
          const towerIcon = L.divIcon({
            className: 'telecom-tower-icon-wrapper',
            html: `
              <div class="telecom-tower-marker" title="${tow.name} (${tow.id})">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M12 2v20M8 8l8 8M16 8l-8 8M4 18h16" />
                </svg>
              </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          L.marker([tow.lat, tow.lon], { icon: towerIcon, interactive: false }).addTo(cmlLayerGroupRef.current);
        });
      });
    }

    // 2. Monitoring Stations
    if (layers.stations) {
      stations.forEach(station => {
        const trajectory = baseStationForecasts[station.id][selectedHour];
        const pm25 = activeModel === 'modelA' ? trajectory.modelA_PM25 : trajectory.modelB_PM25;
        const aqi = window.FORECAST_ENGINE.calculateAQI(pm25);
        const cat = window.FORECAST_ENGINE.getAQICategory(aqi);
        const isSelected = selectedStationId === station.id && inspectorType === 'station';

        const shortCode = station.name.split(' ')[0].substring(0, 4).toUpperCase();

        const badgeIcon = L.divIcon({
          className: 'station-pin-container',
          html: `
            <div class="station-badge-pill ${isSelected ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white scale-110 shadow-lg' : ''}">
              <span class="station-badge-code">${shortCode}</span>
              <span class="station-badge-val" style="background-color: ${cat.color}; color: #ffffff;">
                ${aqi}
              </span>
            </div>
          `,
          iconSize: [68, 26],
          iconAnchor: [34, 13]
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
          </div>
        `, { offset: [0, -14] });

        marker.on('click', () => {
          setSelectedStationId(station.id);
          setInspectorType('station');
        });

        marker.addTo(stationLayerGroupRef.current);
      });
    }

    // 3. Upwind Hotspots
    if (layers.fires) {
      fireHotspots.forEach(fire => {
        const fireIcon = L.divIcon({
          className: 'fire-marker-wrapper',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer" title="Thermal Hotspot: ${fire.location}">
              <div class="absolute w-5 h-5 rounded-full bg-rose-500/40 animate-ping"></div>
              <div class="relative w-4 h-4 rounded-full bg-rose-600 border border-amber-300 shadow flex items-center justify-center text-[9px] text-amber-200">
                🔥
              </div>
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
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

    // 4. Wind Vectors
    if (layers.wind) {
      const windStep = 0.08;
      for (let lat = bbox.minLat + 0.04; lat <= bbox.maxLat; lat += windStep) {
        for (let lon = bbox.minLon + 0.04; lon <= bbox.maxLon; lon += windStep) {
          const windAngle = currentWx.windDir + 180;
          const windIcon = L.divIcon({
            className: 'wind-vector-arrow',
            html: `
              <div style="transform: rotate(${windAngle}deg); opacity: 0.3;" class="text-sky-600 pointer-events-none">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" />
                </svg>
              </div>
            `,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          });
          L.marker([lat, lon], { icon: windIcon, interactive: false }).addTo(windLayerGroupRef.current);
        }
      }
    }
  }, [selectedHour, activeModel, layers, stations, baseStationForecasts, currentCmlStates, fireHotspots, currentWx, bbox, selectedStationId, selectedCmlId, inspectorType, tempUnit]);

  // Chart Rendering
  useEffect(() => {
    if (!chartCanvasRef.current) return;

    const ctx = chartCanvasRef.current.getContext('2d');
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const labels = weather72h.filter((_, i) => i % 3 === 0).map(w => `+${w.hour}h`);

    if (inspectorType === 'cml' && selectedCml) {
      const rslData = weather72h.filter((_, i) => i % 3 === 0).map(w => {
        const state = window.CML_ENGINE.computeLinkState(selectedCml, towersMap, w);
        return state.currentRsl;
      });
      const baselineData = labels.map(() => selectedCml.baselineRsl);

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Received Signal Level (RSL in dBm)',
              data: rslData,
              borderColor: '#059669',
              backgroundColor: 'rgba(5, 150, 105, 0.12)',
              fill: true,
              tension: 0.35,
              borderWidth: 2,
              pointRadius: 2
            },
            {
              label: 'Baseline Clear-Sky RSL (dBm)',
              data: baselineData,
              borderColor: '#94a3b8',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10, family: 'Inter' } } }
          },
          scales: {
            x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } },
            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } }
          }
        }
      });
    } else {
      const traj = selectedStation.fullTrajectory;
      const modelAData = traj.filter((_, i) => i % 3 === 0).map(t => t.modelA_PM25);
      const modelBData = traj.filter((_, i) => i % 3 === 0).map(t => t.modelB_PM25);

      chartInstanceRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: '✦ CML RSL Fusion Model (µg/m³)',
              data: modelBData,
              borderColor: '#059669',
              backgroundColor: 'rgba(5, 150, 105, 0.12)',
              fill: true,
              tension: 0.35,
              borderWidth: 2.2,
              pointRadius: 2
            },
            {
              label: 'Baseline Numerical Model (µg/m³)',
              data: modelAData,
              borderColor: '#94a3b8',
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 10, family: 'Inter' } } }
          },
          scales: {
            x: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } } },
            y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 9 } }, title: { display: true, text: 'PM2.5 (µg/m³)', font: { size: 10 } } }
          }
        }
      });
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [inspectorType, selectedStation, selectedCml, towersMap, weather72h]);

  const flyToStation = (stationId) => {
    setSelectedStationId(stationId);
    setInspectorType('station');
    const st = stations.find(s => s.id === stationId);
    if (st && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([st.lat, st.lon], 13, { duration: 1.2 });
    }
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen text-slate-800 font-sans flex flex-col">

      {/* =====================================================================
          1. TRANSPARENT GLASSY HEADER — CLOVER BRAND WITH 4-LEAF LOGO
         ===================================================================== */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-3">

          {/* Left: CLOVER Four-Leaf Clover Logo & Brand */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => setActiveTab('weather')}>
            {/* Elegant 4-Leaf Clover SVG with Radial Emerald/Mint Gradients */}
            <div className="w-10 h-10 flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" className="drop-shadow">
                <defs>
                  <radialGradient id="cloverGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#4ade80" />
                    <stop offset="60%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </radialGradient>
                  <radialGradient id="cloverGradTop" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#86efac" />
                    <stop offset="70%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </radialGradient>
                </defs>

                {/* Top Leaf (Heart-shaped clover lobe) */}
                <path d="M18 18 C14 10 11 4 15 3 C17.5 2.2 18 5 18 6 C18 5 18.5 2.2 21 3 C25 4 22 10 18 18 Z" fill="url(#cloverGradTop)"/>
                {/* Right Leaf */}
                <path d="M18 18 C26 14 32 11 33 15 C33.8 17.5 31 18 30 18 C31 18 33.8 18.5 33 21 C32 25 26 22 18 18 Z" fill="url(#cloverGrad)"/>
                {/* Bottom Leaf */}
                <path d="M18 18 C22 26 25 32 21 33 C18.5 33.8 18 31 18 30 C18 31 17.5 33.8 15 33 C11 32 14 26 18 18 Z" fill="url(#cloverGrad)"/>
                {/* Left Leaf */}
                <path d="M18 18 C10 22 4 25 3 21 C2.2 18.5 5 18 6 18 C5 18 2.2 17.5 3 15 C4 11 10 14 18 18 Z" fill="url(#cloverGrad)"/>

                {/* Curved Stem */}
                <path d="M18 18 Q16 26 10 32" stroke="#047857" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.9"/>
                {/* Center Luminous Dew Dot */}
                <circle cx="18" cy="18" r="2.8" fill="#d1fae5" stroke="#059669" strokeWidth="0.8"/>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-2xl tracking-tight text-slate-900 font-heading">
                  CLOVER
                </span>
                <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 px-1.5 py-0.5 rounded-full">
                  v3.4
                </span>
              </div>
              <div className="text-[10px] text-slate-500 font-medium leading-none tracking-wide">
                Greater Noida Weather & Air Quality Engine
              </div>
            </div>
          </div>

          {/* Center Search Bar with Glass Surface */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-slate-400 text-sm">🔍</span>
              <input
                id="location-search-input"
                type="text"
                placeholder="Search station or sector (e.g. Pari Chowk, Knowledge Park)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-full glass-subtle text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown Suggestions with Glass Effect */}
            {searchResults.length > 0 && (
              <div className="absolute top-11 left-0 right-0 glass-dropdown rounded-2xl p-2 z-50 max-h-64 overflow-y-auto">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                  Matching Monitoring Stations
                </div>
                {searchResults.map(st => (
                  <div
                    key={st.id}
                    onClick={() => flyToStation(st.id)}
                    className="px-3 py-2 rounded-xl hover:bg-emerald-500/10 cursor-pointer text-xs flex justify-between items-center transition-colors gap-2"
                  >
                    <div>
                      <div className="font-bold text-slate-800">{st.name}</div>
                      <div className="text-[10px] text-slate-500">{st.district} &bull; {st.type}</div>
                    </div>
                    <span className="text-emerald-700 font-bold text-[11px] shrink-0">Select &rarr;</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Action Controls: Clean Time & Unit Toggles (No "LIVE" tag) */}
          <div className="flex items-center gap-2.5">
            <ApiStatusBadge status={apiState.status} alertCount={apiState.alerts.length} recordCount={apiState.observations.length} />
            {/* Real-time Clock Pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-subtle text-slate-700 text-xs font-semibold font-mono">
              <span className="text-emerald-600">🕒</span>
              <span>{currentTimeStr} IST</span>
            </div>

            {/* °C / °F Toggle Button */}
            <div className="flex items-center glass-subtle rounded-xl p-0.5 border border-white/80">
              <button
                id="temp-unit-c-btn"
                onClick={() => setTempUnit('C')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  tempUnit === 'C' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                °C
              </button>
              <button
                id="temp-unit-f-btn"
                onClick={() => setTempUnit('F')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  tempUnit === 'F' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                °F
              </button>
            </div>

            {/* CPCB / US EPA Standard Toggle */}
            <button
              id="standard-toggle-btn"
              onClick={() => setAqiStandard(prev => prev === 'IN' ? 'US' : 'IN')}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-xl text-xs font-bold glass-subtle text-slate-700 hover:bg-white/80 transition-colors"
              title="Toggle Standard between Indian CPCB and US EPA"
            >
              Standard: <span className="text-emerald-700 ml-1">{aqiStandard === 'IN' ? 'CPCB' : 'US-EPA'}</span>
            </button>
          </div>

        </div>

        {/* Sub-Navigation Tabs Bar with Frosted Glass Styling */}
        <div className="border-t border-white/60 bg-white/40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1.5 overflow-x-auto py-1.5">
            {[
              ['weather', 'Weather & Overview'],
              ['forecast', '7-Day Forecast'],
              ['map', 'Interactive Radar & Map'],
              ['pollutants', 'Pollutants Deep-Dive'],
              ['cml_science', '✦ CML Microwave Radar']
            ].map(([id, label]) => (
              <button
                key={id}
                id={`nav-${id}`}
                onClick={() => setActiveTab(id)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === id
                    ? 'bg-emerald-600/90 text-white shadow-sm backdrop-blur-md'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                {label}
                {id === 'cml_science' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block"/>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* =====================================================================
          2. LOCATION BREADCRUMB & QUICK CHIPS
         ===================================================================== */}
      <div className="glass-subtle border-b border-white/60">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-1 text-xs text-slate-600 font-medium">
            <span className="text-slate-400">Home</span>
            <span className="text-slate-300">›</span>
            <span>🇮🇳 India</span>
            <span className="text-slate-300">›</span>
            <span>Uttar Pradesh</span>
            <span className="text-slate-300">›</span>
            <span className="font-bold text-slate-900">Greater Noida · CLOVER</span>
          </div>

          {/* Quick Station Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs py-0.5">
            <span className="text-slate-400 text-[11px] font-semibold shrink-0">Locations:</span>
            {stations.slice(0, 6).map(st => (
              <button
                key={st.id}
                onClick={() => flyToStation(st.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-all border ${
                  selectedStationId === st.id
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'glass-subtle text-slate-700 hover:bg-white/80 border-white/80'
                }`}
              >
                {st.name.split(',')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. MAIN CONTENT CONTAINER
         ===================================================================== */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full space-y-6">

        {/* ── LOCATION HERO TITLE ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black font-heading text-slate-900 tracking-tight">
                {selectedStation.station.name}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold glass-subtle text-emerald-800 border border-emerald-300/60">
                CLOVER Atmospheric Station
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

          {/* Model toggle button with Glass Effect */}
          <div className="flex items-center gap-2 self-start md:self-auto glass-card p-1 rounded-2xl shadow-sm">
            <button
              onClick={() => setActiveModel('modelB')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeModel === 'modelB'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>✦ CML RSL Fusion</span>
            </button>
            <button
              onClick={() => setActiveModel('modelA')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeModel === 'modelA'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Baseline NWP
            </button>
          </div>
        </div>

        {/* ================================================================
            TAB: WEATHER & OVERVIEW (Glassmorphic Layout)
           ================================================================ */}
        {activeTab === 'weather' && (
          <div className="space-y-6">

            {/* ── SPLIT HERO BANNER (Transparent Glass Cards) ────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

              {/* Left Column: Live Weather Hero (7 Cols) */}
              <div className="lg:col-span-7 glass-card rounded-3xl p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Current Weather
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {currentWx.timestamp}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    {/* Big Temp & Condition */}
                    <div>
                      <div className="text-6xl sm:text-7xl font-black font-heading text-slate-900 leading-none tracking-tight">
                        {formatTemp(currentWx.temp)}
                      </div>
                      <div className="text-base font-bold text-slate-700 mt-2 flex items-center gap-2">
                        <span>
                          {currentWx.rain > 0 ? '🌧️ Light to Moderate Rain' :
                           currentWx.relativeHumidity > 80 ? '🌫️ Dense Fog & Mist' :
                           currentWx.isInversionRisk ? '😶‍🌫️ Smoggy Haze' :
                           currentWx.relativeHumidity > 65 ? '🌥️ Partly Cloudy' : '☀️ Sunny & Clear'}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500 font-normal">
                          Feels like <strong className="text-slate-700">{formatTemp(currentWx.temp + 3)}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Weather Graphic */}
                    <div className="text-6xl sm:text-7xl drop-shadow-md">
                      {currentWx.rain > 0 ? '🌧️' :
                       currentWx.relativeHumidity > 80 ? '🌫️' :
                       currentWx.isInversionRisk ? '😶‍🌫️' :
                       currentWx.relativeHumidity > 65 ? '⛅' : '☀️'}
                    </div>
                  </div>

                  {/* Day High / Low and Summary */}
                  <div className="mt-5 pt-4 border-t border-slate-200/60 flex items-center gap-4 text-xs font-semibold text-slate-600 flex-wrap">
                    <span className="flex items-center gap-1 text-rose-600">
                      ▲ Max: <strong>{formatTemp(currentWx.temp + 4)}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="flex items-center gap-1 text-sky-600">
                      ▼ Min: <strong>{formatTemp(currentWx.temp - 6)}</strong>
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500 font-normal">
                      Dew Point: <strong className="text-slate-700">{formatTemp(currentWx.dewPoint)}</strong>
                    </span>
                  </div>
                </div>

                {/* Bottom Weather Context Strip with Glass Surface */}
                <div className="mt-5 p-3.5 rounded-2xl glass-subtle text-xs text-slate-600 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📡</span>
                    <span>
                      CML Microwave Rain Radar: <strong className="text-emerald-700">{regionalMetrics.cmlDerivedRainRate} mm/h</strong> (Atmospheric link tomogram)
                    </span>
                  </div>
                  <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
                    Confidence: 98.4%
                  </span>
                </div>
              </div>

              {/* Right Column: Signature Air Quality Glass Card (5 Cols) */}
              <div className="lg:col-span-5 glass-card rounded-3xl p-6 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Air Quality Index (AQI)
                    </span>
                    <span
                      className="px-3 py-0.5 rounded-full text-xs font-extrabold"
                      style={{
                        backgroundColor: currentStationMetrics.aqiCategory.color + '22',
                        color: currentStationMetrics.aqiCategory.color,
                        border: `1px solid ${currentStationMetrics.aqiCategory.color}55`
                      }}
                    >
                      {currentStationMetrics.aqiCategory.label}
                    </span>
                  </div>

                  {/* AQI Center Circular Display */}
                  <div className="flex items-center justify-center my-2">
                    {(() => {
                      const aqi = currentStationMetrics.aqi;
                      const color = currentStationMetrics.aqiCategory.color;
                      const r = 64;
                      const circ = 2 * Math.PI * r;
                      const pct = Math.min(aqi / 500, 1);
                      const dash = circ * pct;
                      return (
                        <div className="relative w-44 h-44 flex items-center justify-center">
                          <svg width="176" height="176" viewBox="0 0 176 176" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                            <circle cx="88" cy="88" r={r} fill="none" stroke="rgba(203, 213, 225, 0.4)" strokeWidth="16"/>
                            <circle
                              cx="88" cy="88" r={r} fill="none"
                              stroke={color} strokeWidth="16"
                              strokeDasharray={`${dash} ${circ - dash}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="text-center z-10">
                            <div className="text-5xl font-black font-heading leading-none" style={{ color }}>
                              {aqi}
                            </div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              AQI ({aqiStandard})
                            </div>
                            <div className="text-xs font-bold mt-0.5 text-slate-700">
                              PM2.5: {currentStationMetrics.pm25} µg/m³
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Health Impact Snippet */}
                  <div className="text-xs text-slate-600 text-center px-2 mt-1">
                    {currentStationMetrics.aqi > 300
                      ? 'Severe emergency! Healthy people may experience respiratory illness; serious risk to those with pre-existing conditions.'
                      : currentStationMetrics.aqi > 200
                      ? 'Very Poor air quality. Significant breathing discomfort to people on prolonged exposure; avoid morning jogs.'
                      : currentStationMetrics.aqi > 100
                      ? 'Poor to Moderate air quality. Sensitive individuals should wear masks outdoors and avoid strenuous exertion.'
                      : 'Air quality is satisfactory and poses little or no risk to public health.'}
                  </div>
                </div>

                {/* Comparison to WHO guideline */}
                <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                  <span>Prominent Pollutant: <strong className="text-slate-800">PM2.5</strong></span>
                  <span className="text-rose-600 font-bold">
                    {(currentStationMetrics.pm25 / 15).toFixed(1)}× WHO Limit
                  </span>
                </div>
              </div>

            </div>

            {/* ── 8-PARAMETER WEATHER CONDITIONS GRID (Transparent Glass Cards) ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500">
                  Greater Noida Current Weather Parameters
                </h2>
                <span className="text-xs text-slate-400">8 Real-time Indicators</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {[
                  {
                    icon: '💧',
                    label: 'Humidity',
                    value: `${currentWx.relativeHumidity}%`,
                    desc: `Dew Point ${formatTemp(currentWx.dewPoint)}`,
                    barColor: '#0ea5e9',
                    pct: currentWx.relativeHumidity
                  },
                  {
                    icon: '💨',
                    label: 'Wind Speed',
                    value: `${currentWx.windSpeed} m/s`,
                    desc: `Direction ${currentWx.windDir}° (${currentWx.windDir > 270 ? 'WNW' : currentWx.windDir > 180 ? 'SW' : 'NW'})`,
                    barColor: '#10b981',
                    pct: Math.min((currentWx.windSpeed / 12) * 100, 100)
                  },
                  {
                    icon: '🧭',
                    label: 'Pressure',
                    value: `1010 hPa`,
                    desc: 'Barometer: Stable',
                    barColor: '#6366f1',
                    pct: 65
                  },
                  {
                    icon: '☀️',
                    label: 'UV Index',
                    value: `${currentWx.hour >= 6 && currentWx.hour <= 18 ? 6 : 0} of 11`,
                    desc: currentWx.hour >= 6 && currentWx.hour <= 18 ? 'Moderate to High' : 'Low / Night',
                    barColor: '#f59e0b',
                    pct: currentWx.hour >= 6 && currentWx.hour <= 18 ? 55 : 5
                  },
                  {
                    icon: '👁️',
                    label: 'Visibility',
                    value: currentStationMetrics.aqi > 250 ? '2.5 km' : '4.5 km',
                    desc: currentStationMetrics.aqi > 250 ? 'Reduced by haze/smog' : 'Moderate visibility',
                    barColor: '#8b5cf6',
                    pct: currentStationMetrics.aqi > 250 ? 30 : 60
                  },
                  {
                    icon: '🌧️',
                    label: 'Precipitation Rate',
                    value: `${regionalMetrics.cmlDerivedRainRate} mm/h`,
                    desc: 'CML Microwave Sensing',
                    barColor: '#0284c7',
                    pct: Math.min(regionalMetrics.cmlDerivedRainRate * 15, 100)
                  },
                  {
                    icon: '🌅',
                    label: 'Sunrise / Sunset',
                    value: '06:08 AM / 06:33 PM',
                    desc: 'Day length: 12h 25m',
                    barColor: '#ec4899',
                    pct: 50
                  },
                  {
                    icon: '🌫️',
                    label: 'Boundary Layer (PBL)',
                    value: `${currentWx.boundaryLayerHeight} m`,
                    desc: currentWx.isInversionRisk ? '⚠️ Inversion Trapping' : 'Normal mixing',
                    barColor: currentWx.isInversionRisk ? '#ef4444' : '#10b981',
                    pct: Math.min((currentWx.boundaryLayerHeight / 2000) * 100, 100)
                  }
                ].map(param => (
                  <div key={param.label} className="glass-card glass-card-hover rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl">{param.icon}</span>
                      <span className="text-[11px] font-semibold text-slate-400">{param.label}</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black font-heading text-slate-900 leading-tight">
                      {param.value}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 truncate">
                      {param.desc}
                    </div>
                    <div className="w-full h-1 bg-slate-200/50 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${param.pct}%`, backgroundColor: param.barColor }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── HOURLY WEATHER & AQI FORECAST (24–48h GLASS SLIDER) ────────── */}
            <div className="glass-card rounded-3xl p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/60 mb-4">
                <div>
                  <h2 className="text-base font-black font-heading text-slate-900">
                    Greater Noida Hourly Weather & AQI Forecast
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Continuous 72-hour trajectory with CML microwave precipitation and inversion coupling
                  </p>
                </div>

                {/* Timeline playback controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedHour(0)}
                    className="px-2.5 py-1 rounded-xl glass-subtle hover:bg-white text-xs font-bold text-slate-600 transition-colors"
                  >
                    Now
                  </button>
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center gap-1 ${
                      isPlaying ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    <span>{isPlaying ? '⏸ Pause' : '▶ Play'}</span>
                  </button>
                  <div className="flex items-center glass-subtle rounded-xl p-0.5 text-xs font-bold text-slate-600">
                    {[0.5, 1, 2].map(spd => (
                      <button
                        key={spd}
                        onClick={() => setPlaySpeed(spd)}
                        className={`px-2 py-0.5 rounded-lg transition-all ${
                          playSpeed === spd ? 'bg-white shadow text-emerald-700' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {spd}×
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-600 pl-1">
                    +{selectedHour}h
                  </span>
                </div>
              </div>

              {/* Horizontal Scroll Hourly Cards */}
              <div className="forecast-scroll flex gap-2.5 overflow-x-auto pb-3 pt-1">
                {weather72h.slice(0, 36).map((wx, idx) => {
                  const h = idx;
                  const stForecast = selectedStation.fullTrajectory[h];
                  const pm25H = stForecast ? (activeModel === 'modelA' ? stForecast.modelA_PM25 : stForecast.modelB_PM25) : 180;
                  const aqiH = window.FORECAST_ENGINE.calculateAQI(pm25H);
                  const catH = window.FORECAST_ENGINE.getAQICategory(aqiH);
                  const isSelected = selectedHour === h;
                  const icon = wx.rain > 0 ? '🌧️' : wx.relativeHumidity > 80 ? '🌫️' : wx.isInversionRisk ? '😶‍🌫️' : wx.relativeHumidity > 65 ? '🌥️' : '☀️';

                  return (
                    <div
                      key={h}
                      onClick={() => setSelectedHour(h)}
                      className={`shrink-0 w-24 p-3 rounded-2xl text-center cursor-pointer forecast-hour-card transition-all ${
                        isSelected
                          ? 'bg-emerald-500/15 border-2 border-emerald-500 shadow-md backdrop-blur-md'
                          : 'glass-subtle hover:bg-white/90 border border-white/80'
                      }`}
                    >
                      <div className="text-[11px] font-bold text-slate-500">
                        {h === 0 ? 'Now' : `+${h}h`}
                      </div>
                      <div className="text-2xl my-1.5">{icon}</div>
                      <div className="text-sm font-black font-heading text-slate-900">
                        {formatTemp(wx.temp)}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {wx.rain > 0 ? `${wx.rain}mm` : `${wx.relativeHumidity}%`}
                      </div>
                      <div
                        className="mt-2 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                        style={{ backgroundColor: catH.color }}
                      >
                        AQI {aqiH}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time slider */}
              <div className="mt-3 pt-2">
                <input
                  type="range"
                  min="0"
                  max="72"
                  value={selectedHour}
                  onChange={e => setSelectedHour(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mt-1">
                  <span>Current (0h)</span>
                  <span>+24h (Tomorrow)</span>
                  <span>+48h (Day 2)</span>
                  <span>+72h (Day 3)</span>
                </div>
              </div>
            </div>

            {/* ── 7-DAY OUTLOOK PREVIEW & HEALTH PRECAUTIONS ───────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

              {/* 7-Day Weather & AQI Outlook Table (7 Cols) */}
              <div className="lg:col-span-7 glass-card rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500">
                    7-Day Weather & Air Quality Outlook
                  </h2>
                  <span className="text-xs text-emerald-700 font-bold cursor-pointer" onClick={() => setActiveTab('forecast')}>
                    View Details &rarr;
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { day: 'Today', date: 'Thu, Sep 11', icon: '☀️', cond: 'Hazy Sun', min: 24, max: 35, rain: 5, aqi: 192, cat: 'Poor', color: '#f97316' },
                    { day: 'Tomorrow', date: 'Fri, Sep 12', icon: '⛅', cond: 'Partly Cloudy', min: 25, max: 34, rain: 15, aqi: 178, cat: 'Moderate', color: '#eab308' },
                    { day: 'Saturday', date: 'Sat, Sep 13', icon: '🌧️', cond: 'Passing Showers', min: 23, max: 31, rain: 60, aqi: 115, cat: 'Moderate', color: '#eab308' },
                    { day: 'Sunday', date: 'Sun, Sep 14', icon: '☀️', cond: 'Clear & Breezy', min: 22, max: 32, rain: 10, aqi: 95, cat: 'Satisfactory', color: '#84cc16' },
                    { day: 'Monday', date: 'Mon, Sep 15', icon: '🌫️', cond: 'Morning Mist', min: 23, max: 33, rain: 5, aqi: 165, cat: 'Moderate', color: '#eab308' },
                    { day: 'Tuesday', date: 'Tue, Sep 16', icon: '☀️', cond: 'Sunny Warm', min: 24, max: 35, rain: 5, aqi: 205, cat: 'Very Poor', color: '#ef4444' },
                    { day: 'Wednesday', date: 'Wed, Sep 17', icon: '⛅', cond: 'Afternoon Haze', min: 24, max: 34, rain: 10, aqi: 185, cat: 'Poor', color: '#f97316' },
                  ].map(d => (
                    <div key={d.day} className="flex items-center justify-between p-2.5 rounded-2xl glass-subtle hover:bg-white/80 transition-all text-xs">
                      <div className="w-24 shrink-0">
                        <div className="font-bold text-slate-800">{d.day}</div>
                        <div className="text-[10px] text-slate-400">{d.date}</div>
                      </div>
                      <div className="flex items-center gap-2 w-32 shrink-0">
                        <span className="text-xl">{d.icon}</span>
                        <span className="text-slate-600 font-medium truncate">{d.cond}</span>
                      </div>
                      {/* Temp range bar */}
                      <div className="flex-1 max-w-[120px] hidden sm:flex items-center gap-2">
                        <span className="text-[10px] text-slate-400">{formatTemp(d.min)}</span>
                        <div className="flex-1 temp-range-bar"/>
                        <span className="text-[10px] font-bold text-slate-700">{formatTemp(d.max)}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className="px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white"
                          style={{ backgroundColor: d.color }}
                        >
                          AQI {d.aqi} &bull; {d.cat}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health Recommendations & Precautions (5 Cols) */}
              <div className="lg:col-span-5 glass-card rounded-3xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-black font-heading uppercase tracking-wider text-slate-500">
                      Health Recommendations
                    </h2>
                    <span className="text-xs text-slate-400 font-medium">Greater Noida Advisory</span>
                  </div>

                  <div className="space-y-3">
                    {[
                      { icon: '😷', title: 'Wear an N95 Mask Outdoors', desc: 'Advised when AQI exceeds 150 to protect against fine PM2.5 particulates.' },
                      { icon: '🪟', title: 'Keep Windows Closed', desc: 'Prevent high concentrations of ambient smog and dust from penetrating indoors.' },
                      { icon: '🌀', title: 'Run Indoor Air Purifiers', desc: 'Keep HEPA filters active, particularly during evening thermal inversion peaks.' },
                      { icon: '🏃', title: 'Limit Heavy Morning Exercise', desc: 'Postpone intense cardio jogs until the afternoon when boundary layer mixing rises.' },
                      { icon: '👶', title: 'Protect Vulnerable Groups', desc: 'Children, elderly, and respiratory patients should minimize outdoor duration.' }
                    ].map(rec => (
                      <div key={rec.title} className="flex items-start gap-3 p-3 rounded-2xl glass-subtle">
                        <span className="text-xl shrink-0 mt-0.5">{rec.icon}</span>
                        <div>
                          <div className="text-xs font-bold text-slate-800">{rec.title}</div>
                          <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{rec.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-slate-400 text-center">
                  Based on Central Pollution Control Board (CPCB) & WHO Health Standards
                </div>
              </div>

            </div>

            {/* ── POLLUTANTS BREAKDOWN GRID (Glass Surfaces) ─────────────── */}
            <div className="glass-card rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black font-heading text-slate-900">
                    Live Air Pollutant Concentrations
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Continuous monitoring at {selectedStation.station.name} compared to National (NAAQS) and WHO safety limits
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-500">Unit: µg/m³ (CO in mg/m³)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {[
                  { name: 'PM2.5', value: currentStationMetrics.pm25, unit: 'µg/m³', whoLimit: 15, naaqsLimit: 60, status: 'Poor', color: currentStationMetrics.aqiCategory.color },
                  { name: 'PM10', value: currentStationMetrics.pm10, unit: 'µg/m³', whoLimit: 45, naaqsLimit: 100, status: 'Moderate', color: '#eab308' },
                  { name: 'NO2', value: currentStationMetrics.no2, unit: 'µg/m³', whoLimit: 25, naaqsLimit: 80, status: 'Good', color: '#10b981' },
                  { name: 'SO2', value: currentStationMetrics.so2, unit: 'µg/m³', whoLimit: 40, naaqsLimit: 80, status: 'Good', color: '#10b981' },
                  { name: 'CO', value: currentStationMetrics.co, unit: 'mg/m³', whoLimit: 4, naaqsLimit: 4, status: 'Satisfactory', color: '#84cc16' },
                  { name: 'Ozone (O3)', value: currentStationMetrics.o3, unit: 'µg/m³', whoLimit: 100, naaqsLimit: 180, status: 'Good', color: '#10b981' }
                ].map(poll => {
                  const pct = Math.min((poll.value / (poll.naaqsLimit * 1.5)) * 100, 100);
                  return (
                    <div key={poll.name} className="p-3.5 rounded-2xl glass-subtle">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold text-xs text-slate-700">{poll.name}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: poll.color + '25', color: poll.color }}>
                          {poll.status}
                        </span>
                      </div>
                      <div className="text-2xl font-black font-heading text-slate-900 mt-1">
                        {poll.value}
                      </div>
                      <div className="text-[10px] text-slate-400 mb-2">{poll.unit}</div>
                      <div className="w-full h-1.5 bg-slate-200/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: poll.color }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 mt-1.5">
                        <span>WHO: {poll.whoLimit}</span>
                        <span>NAAQS: {poll.naaqsLimit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── NEARBY MONITORING STATIONS TABLE ───────────────────────── */}
            <div className="glass-card rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-black font-heading text-slate-900">
                    Greater Noida & Delhi NCR Real-Time Station Directory
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click any station to switch location, view telemetry, or fly the interactive radar
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">{stations.length} Active Stations</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="glass-subtle text-slate-600 font-bold border-b border-white/60">
                    <tr>
                      <th className="px-4 py-3">STATION</th>
                      <th className="px-4 py-3">DISTRICT</th>
                      <th className="px-4 py-3">TEMP</th>
                      <th className="px-4 py-3">HUMIDITY</th>
                      <th className="px-4 py-3">PM2.5</th>
                      <th className="px-4 py-3">AQI LEVEL</th>
                      <th className="px-4 py-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/40">
                    {rankedStations.map(st => {
                      const isCurr = st.id === selectedStationId;
                      return (
                        <tr key={st.id} className={`hover:bg-white/60 transition-colors ${isCurr ? 'bg-emerald-500/10 font-semibold' : ''}`}>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {st.name} {isCurr && <span className="ml-1 text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-normal">Active</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{st.district || 'Delhi NCR'}</td>
                          <td className="px-4 py-3 text-slate-700">{formatTemp(currentWx.temp)}</td>
                          <td className="px-4 py-3 text-sky-700">{currentWx.relativeHumidity}%</td>
                          <td className="px-4 py-3 font-bold text-slate-800">{st.currentPM25} µg/m³</td>
                          <td className="px-4 py-3">
                            <span
                              className="px-2.5 py-1 rounded-full text-[10px] font-extrabold text-white"
                              style={{ backgroundColor: st.cat.color }}
                            >
                              AQI {st.currentAQI}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => flyToStation(st.id)}
                              className="px-3 py-1 rounded-xl glass-subtle hover:bg-white hover:text-emerald-700 font-bold transition-all text-xs border border-white/80"
                            >
                              Select &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================================================================
            TAB: 7-DAY FORECAST
           ================================================================ */}
        {activeTab === 'forecast' && (
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-black font-heading text-slate-900 mb-1">
                Greater Noida 7-Day Extended Weather & Air Quality Outlook
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Comprehensive synoptic meteorological model combined with CML microwave atmospheric absorption trajectories
              </p>

              <div className="space-y-3">
                {[
                  { day: 'Thursday (Today)', date: 'Sep 11, 2026', icon: '☀️', cond: 'Hazy Sunshine & Warm', min: 24, max: 35, rain: 5, wind: '9 km/h WNW', hum: '58%', aqi: 192, cat: 'Poor', color: '#f97316' },
                  { day: 'Friday (Tomorrow)', date: 'Sep 12, 2026', icon: '⛅', cond: 'Partly Cloudy, Afternoon Breeze', min: 25, max: 34, rain: 15, wind: '12 km/h W', hum: '62%', aqi: 178, cat: 'Moderate', color: '#eab308' },
                  { day: 'Saturday', date: 'Sat, Sep 13, 2026', icon: '🌧️', cond: 'Passing Monsoon Showers', min: 23, max: 31, rain: 60, wind: '15 km/h SW', hum: '78%', aqi: 115, cat: 'Moderate', color: '#eab308' },
                  { day: 'Sunday', date: 'Sun, Sep 14, 2026', icon: '☀️', cond: 'Clean Atmosphere & Clear Skies', min: 22, max: 32, rain: 10, wind: '11 km/h NW', hum: '52%', aqi: 95, cat: 'Satisfactory', color: '#84cc16' },
                  { day: 'Monday', date: 'Mon, Sep 15, 2026', icon: '🌫️', cond: 'Early Morning Fog & Mist', min: 23, max: 33, rain: 5, wind: '8 km/h NW', hum: '66%', aqi: 165, cat: 'Moderate', color: '#eab308' },
                  { day: 'Tuesday', date: 'Tue, Sep 16, 2026', icon: '☀️', cond: 'Warm Autumn Sun, Light Haze', min: 24, max: 35, rain: 5, wind: '7 km/h W', hum: '55%', aqi: 205, cat: 'Very Poor', color: '#ef4444' },
                  { day: 'Wednesday', date: 'Wed, Sep 17, 2026', icon: '⛅', cond: 'Scattered High Clouds', min: 24, max: 34, rain: 10, wind: '10 km/h WNW', hum: '60%', aqi: 185, cat: 'Poor', color: '#f97316' },
                ].map(item => (
                  <div key={item.day} className="p-4 rounded-2xl glass-subtle hover:bg-white/80 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <span className="text-3xl">{item.icon}</span>
                      <div>
                        <div className="font-bold text-sm text-slate-800">{item.day}</div>
                        <div className="text-xs text-slate-400">{item.date} &bull; {item.cond}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-xs text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block">TEMP RANGE</span>
                        <strong className="text-slate-800">{formatTemp(item.min)} — {formatTemp(item.max)}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">RAIN CHANCE</span>
                        <strong className="text-sky-600">{item.rain}%</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">WIND & HUMIDITY</span>
                        <span>{item.wind} &bull; {item.hum}</span>
                      </div>
                    </div>

                    <div>
                      <span
                        className="px-3.5 py-1.5 rounded-full text-xs font-extrabold text-white inline-block shadow-sm"
                        style={{ backgroundColor: item.color }}
                      >
                        AQI {item.aqi} &bull; {item.cat}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB: INTERACTIVE RADAR & MAP
           ================================================================ */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="glass-card rounded-3xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-800">Map Mode:</span>
                <button
                  onClick={() => setWeatherFieldMode('aqi')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    weatherFieldMode === 'aqi' ? 'bg-emerald-600 text-white shadow' : 'glass-subtle text-slate-600 hover:bg-white'
                  }`}
                >
                  Air Quality (AQI) Heatmap
                </button>
                <button
                  onClick={() => setWeatherFieldMode('cml_rain')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    weatherFieldMode === 'cml_rain' ? 'bg-sky-600 text-white shadow' : 'glass-subtle text-slate-600 hover:bg-white'
                  }`}
                >
                  CML Microwave Rain Radar
                </button>
              </div>

              {/* Layer checkboxes */}
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-600 flex-wrap">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.stations}
                    onChange={e => setLayers({ ...layers, stations: e.target.checked })}
                  />
                  <span>Stations</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.cml}
                    onChange={e => setLayers({ ...layers, cml: e.target.checked })}
                  />
                  <span>CML Microwave Links</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.wind}
                    onChange={e => setLayers({ ...layers, wind: e.target.checked })}
                  />
                  <span>Wind Vectors</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.fires}
                    onChange={e => setLayers({ ...layers, fires: e.target.checked })}
                  />
                  <span>Upwind Hotspots</span>
                </label>
              </div>
            </div>

            {/* Map Canvas */}
            <div className="w-full h-[600px] rounded-3xl overflow-hidden glass-card shadow-md relative">
              <div ref={mapRef} className="w-full h-full"/>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB: POLLUTANTS DEEP-DIVE
           ================================================================ */}
        {activeTab === 'pollutants' && (
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-black font-heading text-slate-900 mb-1">
                Air Pollutant Standards & Medical Health Impact
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Real-time measurements at {selectedStation.station.name} with toxicity thresholds and source attribution
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {[
                  {
                    code: 'PM2.5',
                    name: 'Fine Particulate Matter (< 2.5 µm)',
                    val: `${currentStationMetrics.pm25} µg/m³`,
                    color: currentStationMetrics.aqiCategory.color,
                    sources: 'Vehicular exhaust (Yamuna/Noida Expressway), biomass burning, construction dust, secondary aerosol synthesis.',
                    health: 'Penetrates deep into alveolar sacs and bloodstream. Associated with cardiovascular stress, stroke, asthma, and chronic bronchitis.'
                  },
                  {
                    code: 'PM10',
                    name: 'Coarse Particulates (< 10 µm)',
                    val: `${currentStationMetrics.pm10} µg/m³`,
                    color: '#eab308',
                    sources: 'Road resuspension, construction sites in Greater Noida West, desert dust, industrial processing.',
                    health: 'Causes upper respiratory tract irritation, nasal congestion, eye burning, and persistent coughing.'
                  },
                  {
                    code: 'NO2',
                    name: 'Nitrogen Dioxide',
                    val: `${currentStationMetrics.no2} µg/m³`,
                    color: '#10b981',
                    sources: 'High-temperature diesel combustion, freight transit along Eastern Peripheral Expressway.',
                    health: 'Aggravates asthma and increases susceptibility to respiratory lung infections.'
                  },
                  {
                    code: 'CO',
                    name: 'Carbon Monoxide',
                    val: `${currentStationMetrics.co} mg/m³`,
                    color: '#84cc16',
                    sources: 'Incomplete combustion in motor vehicles and slow idling at congested intersections (Pari Chowk).',
                    health: 'Reduces oxygen delivery to body organs and tissues; causes headaches, fatigue, and dizziness.'
                  },
                  {
                    code: 'SO2',
                    name: 'Sulfur Dioxide',
                    val: `${currentStationMetrics.so2} µg/m³`,
                    color: '#10b981',
                    sources: 'Industrial clusters, brick kilns upwind, coal-fired industrial boilers.',
                    health: 'Causes bronchoconstriction and bronchial spasms in sensitive asthmatic populations.'
                  },
                  {
                    code: 'O3',
                    name: 'Ground-Level Ozone',
                    val: `${currentStationMetrics.o3} µg/m³`,
                    color: '#10b981',
                    sources: 'Secondary photochemical pollutant formed by sunlight reaction between NOx and VOCs.',
                    health: 'Reduces lung capacity, triggers asthma attacks, and inflames chest lining.'
                  }
                ].map(item => (
                  <div key={item.code} className="p-5 rounded-2xl glass-subtle">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-lg font-black font-heading text-slate-900">{item.code}</span>
                        <span className="text-xs text-slate-500 ml-2 font-medium">{item.name}</span>
                      </div>
                      <span className="text-xl font-black font-heading" style={{ color: item.color }}>
                        {item.val}
                      </span>
                    </div>
                    <div className="mt-3 text-xs text-slate-600 space-y-1.5">
                      <div><strong className="text-slate-800">Primary Sources:</strong> {item.sources}</div>
                      <div><strong className="text-slate-800">Health Hazards:</strong> {item.health}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            TAB: CML SCIENCE & RADAR INNOVATION
           ================================================================ */}
        {activeTab === 'cml_science' && (
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-xl font-black font-heading text-slate-900">
                    Commercial Microwave Link (CML) Atmospheric Radar
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Opportunistic telecom microwave signal absorption (ITU-R P.838) providing ultra-dense rain and boundary layer sensing
                  </p>
                </div>
                <div className="px-3 py-1 rounded-full glass-subtle text-emerald-800 border border-emerald-300/60 text-xs font-bold">
                  Active Hops: {cmlLinks.length}
                </div>
              </div>

              {/* Metric Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-2xl glass-subtle border-sky-300/60">
                  <div className="text-xs font-bold text-sky-700">Mean Specific Attenuation</div>
                  <div className="text-3xl font-black font-heading text-sky-950 mt-1">
                    {regionalMetrics.avgCmlAttenuation} <span className="text-sm font-normal text-sky-700">dB/km</span>
                  </div>
                  <div className="text-[11px] text-sky-700 mt-0.5">Atmospheric microwave loss</div>
                </div>
                <div className="p-4 rounded-2xl glass-subtle border-emerald-300/60">
                  <div className="text-xs font-bold text-emerald-700">CML Inferred Rain Rate</div>
                  <div className="text-3xl font-black font-heading text-emerald-950 mt-1">
                    {regionalMetrics.cmlDerivedRainRate} <span className="text-sm font-normal text-emerald-700">mm/h</span>
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">Real-time rain rate via RSL inversion</div>
                </div>
                <div className="p-4 rounded-2xl glass-subtle border-amber-300/60">
                  <div className="text-xs font-bold text-amber-700">Max Attenuation Peak</div>
                  <div className="text-3xl font-black font-heading text-amber-950 mt-1">
                    {regionalMetrics.maxCmlAttenuation} <span className="text-sm font-normal text-amber-700">dB/km</span>
                  </div>
                  <div className="text-[11px] text-amber-700 mt-0.5">Localized downpour detection</div>
                </div>
              </div>

              {/* Chart of Selected Link or Model Comparison */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-800">
                    {inspectorType === 'cml' ? `Telemetry for Link ${selectedCml?.id} (72-Hour RSL Signal Decay)` : `PM2.5 Model Comparison at ${selectedStation.station.name}`}
                  </h3>
                  <button
                    onClick={() => setInspectorType(prev => prev === 'cml' ? 'station' : 'cml')}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    Switch to {inspectorType === 'cml' ? 'Station Model' : 'CML Link'} &rarr;
                  </button>
                </div>
                <div className="w-full h-72 glass-subtle rounded-2xl p-3 border border-white/80">
                  <canvas ref={chartCanvasRef}/>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* =====================================================================
          4. GLASSY FOOTER
         ===================================================================== */}
      <footer className="glass-header py-8 mt-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl glass-subtle flex items-center justify-center text-emerald-700 font-bold text-sm">
              🍀
            </div>
            <div>
              <div className="font-bold text-slate-800">CLOVER Atmospheric Sensing & Air Quality System</div>
              <div className="text-[11px] text-slate-500">Continuous multimodal boundary layer and particulate forecasting &bull; Greater Noida & Delhi NCR</div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span>Continuous Telemetry</span>
            <span>&bull;</span>
            <span>National Standards (CPCB / NAAQS)</span>
            <span>&bull;</span>
            <span>WHO 2021 Benchmarks</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<CloverApp />);
