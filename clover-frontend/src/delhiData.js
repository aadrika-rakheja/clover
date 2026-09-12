/**
 * Delhi NCR Comprehensive Spatial Database
 * Real-world geographic coordinates for CPCB/DPCC Stations, Telecom Tower Nodes,
 * Industrial Hotspots, and Major Highway Corridors.
 */

window.DELHI_BBOX = {
  minLat: 28.35,
  maxLat: 28.88,
  minLon: 76.84,
  maxLon: 77.56,
  center: [28.474, 77.504]
};

// Key CPCB / DPCC / UPPCB Continuous Ambient Air Quality Monitoring Stations (CAAQMS)
// Featuring official Greater Noida stations first for direct localization
window.CPCB_STATIONS = [
  { id: "ncr_gnoida_kp3", name: "Knowledge Park III, Greater Noida", district: "Gautam Buddha Nagar", lat: 28.4720, lon: 77.4890, type: "Institutional & Tech Corridor", basePM25: 188, basePM10: 295, baseNO2: 56, baseCO: 1.6, baseO3: 45, baseSO2: 12 },
  { id: "ncr_gnoida_pari_chowk", name: "Pari Chowk, Greater Noida", district: "Gautam Buddha Nagar", lat: 28.4650, lon: 77.5090, type: "Commercial Transit & Junction", basePM25: 215, basePM10: 340, baseNO2: 68, baseCO: 2.1, baseO3: 38, baseSO2: 15 },
  { id: "ncr_gnoida_sec1", name: "Sector 1, Greater Noida West", district: "Gautam Buddha Nagar", lat: 28.5830, lon: 77.4600, type: "Residential High-Rise Hub", basePM25: 198, basePM10: 310, baseNO2: 59, baseCO: 1.8, baseO3: 42, baseSO2: 13 },
  { id: "ncr_gnoida_kp5", name: "Knowledge Park V, Greater Noida", district: "Gautam Buddha Nagar", lat: 28.5980, lon: 77.4720, type: "Industrial & IT Zone", basePM25: 205, basePM10: 325, baseNO2: 62, baseCO: 1.9, baseO3: 40, baseSO2: 14 },
  { id: "ncr_noida_sec62", name: "Noida Sector 62, Gautam Buddha Nagar", district: "Gautam Buddha Nagar", lat: 28.6245, lon: 77.3578, type: "IT Park / Expressway Hub", basePM25: 220, basePM10: 330, baseNO2: 65, baseCO: 1.8, baseO3: 46, baseSO2: 12 },
  { id: "ncr_noida_sec1", name: "Noida Sector 1, Industrial", district: "Gautam Buddha Nagar", lat: 28.5898, lon: 77.3114, type: "Industrial / Commercial", basePM25: 245, basePM10: 365, baseNO2: 78, baseCO: 2.2, baseO3: 43, baseSO2: 15 },
  { id: "del_anand_vihar", name: "Anand Vihar, East Delhi", district: "East Delhi", lat: 28.6508, lon: 77.3152, type: "Industrial / Inter-State Transit", basePM25: 285, basePM10: 420, baseNO2: 95, baseCO: 2.8, baseO3: 42, baseSO2: 18 },
  { id: "del_punjabi_bagh", name: "Punjabi Bagh, West Delhi", district: "West Delhi", lat: 28.6740, lon: 77.1310, type: "Dense Urban / Ring Road", basePM25: 240, basePM10: 360, baseNO2: 82, baseCO: 2.1, baseO3: 38, baseSO2: 14 },
  { id: "del_ito", name: "ITO Junction, Central Delhi", district: "Central Delhi", lat: 28.6310, lon: 77.2410, type: "Heavy Traffic Intercept", basePM25: 260, basePM10: 390, baseNO2: 110, baseCO: 3.2, baseO3: 35, baseSO2: 16 },
  { id: "del_rk_puram", name: "R K Puram, South Delhi", district: "South Delhi", lat: 28.5630, lon: 77.1860, type: "Residential / Institutional", basePM25: 195, basePM10: 290, baseNO2: 68, baseCO: 1.7, baseO3: 50, baseSO2: 12 },
  { id: "del_dwarka_sec8", name: "Dwarka Sector 8, South West", district: "South West Delhi", lat: 28.5710, lon: 77.0690, type: "Suburban / Airport Corridor", basePM25: 185, basePM10: 275, baseNO2: 55, baseCO: 1.5, baseO3: 55, baseSO2: 10 },
  { id: "del_bawana", name: "Bawana Industrial Area, North", district: "North Delhi", lat: 28.7762, lon: 77.0510, type: "Heavy Industrial Zone", basePM25: 310, basePM10: 460, baseNO2: 105, baseCO: 3.4, baseO3: 32, baseSO2: 24 },
  { id: "del_jahangirpuri", name: "Jahangirpuri, North Delhi", district: "North Delhi", lat: 28.7328, lon: 77.1706, type: "Commercial / Res. Mixed", basePM25: 270, basePM10: 410, baseNO2: 88, baseCO: 2.4, baseO3: 36, baseSO2: 15 },
  { id: "del_okhla_ph2", name: "Okhla Phase 2, South East", district: "South East Delhi", lat: 28.5307, lon: 77.2713, type: "Industrial / Waste-to-Energy", basePM25: 275, basePM10: 405, baseNO2: 92, baseCO: 2.6, baseO3: 40, baseSO2: 22 },
  { id: "del_wazirpur", name: "Wazirpur Industrial Area", district: "North West Delhi", lat: 28.6998, lon: 77.1654, type: "Metals / Finishing Cluster", basePM25: 295, basePM10: 440, baseNO2: 98, baseCO: 3.0, baseO3: 34, baseSO2: 21 },
  { id: "del_mandir_marg", name: "Mandir Marg, New Delhi", district: "New Delhi", lat: 28.6364, lon: 77.1973, type: "Diplomatic / Low Density", basePM25: 165, basePM10: 235, baseNO2: 48, baseCO: 1.3, baseO3: 58, baseSO2: 9 },
  { id: "del_rohini", name: "Rohini Sector 16, North West", district: "North West Delhi", lat: 28.7325, lon: 77.1199, type: "Planned Residential", basePM25: 225, basePM10: 340, baseNO2: 72, baseCO: 1.9, baseO3: 45, baseSO2: 13 },
  { id: "del_shadipur", name: "Shadipur, West Central", district: "West Delhi", lat: 28.6515, lon: 77.1581, type: "Urban Industrial Rail", basePM25: 250, basePM10: 375, baseNO2: 85, baseCO: 2.3, baseO3: 39, baseSO2: 17 },
  { id: "ncr_gurugram_vikas", name: "Vikas Sadan, Gurugram", district: "Gurugram", lat: 28.4501, lon: 77.0264, type: "Urban Center / NH48", basePM25: 215, basePM10: 325, baseNO2: 62, baseCO: 1.7, baseO3: 48, baseSO2: 11 },
  { id: "ncr_gurugram_teri", name: "TERI Gram, Gwal Pahari", district: "Gurugram", lat: 28.4312, lon: 77.1511, type: "Aravalli Ridge Background", basePM25: 140, basePM10: 200, baseNO2: 36, baseCO: 1.1, baseO3: 64, baseSO2: 7 },
  { id: "ncr_ghaziabad_vasundhara", name: "Vasundhara, Ghaziabad", district: "Ghaziabad", lat: 28.6603, lon: 77.3573, type: "Dense Urban / Brick Kiln Path", basePM25: 290, basePM10: 435, baseNO2: 90, baseCO: 2.7, baseO3: 36, baseSO2: 19 },
  { id: "ncr_faridabad_sec16a", name: "Sector 16A, Faridabad", district: "Faridabad", lat: 28.4088, lon: 77.3178, type: "Industrial / Auto Corridor", basePM25: 235, basePM10: 350, baseNO2: 74, baseCO: 2.0, baseO3: 44, baseSO2: 16 }
];

// Telecom Tower Nodes across Delhi NCR & Greater Noida for Commercial Microwave Link (CML) network
window.TELECOM_TOWERS = [
  { id: "tow_gnoida_kp3", name: "Knowledge Park III Sharda Tower", lat: 28.4725, lon: 77.4885, height: 50 },
  { id: "tow_gnoida_pari", name: "Pari Chowk Commercial Tower", lat: 28.4660, lon: 77.5080, height: 55 },
  { id: "tow_gnoida_sec1", name: "Gr. Noida West Sec 1 Tower", lat: 28.5820, lon: 77.4620, height: 48 },
  { id: "tow_gnoida_kp5", name: "Knowledge Park V Tech Tower", lat: 28.5970, lon: 77.4710, height: 45 },
  { id: "tow_cp_01", name: "CP Shivaji Stadium Tower", lat: 28.6295, lon: 77.2140, height: 48 },
  { id: "tow_ito_02", name: "ITO Vikas Minar Tower", lat: 28.6305, lon: 77.2470, height: 62 },
  { id: "tow_rkp_03", name: "RK Puram Sector 4 Tower", lat: 28.5665, lon: 77.1812, height: 42 },
  { id: "tow_dla_04", name: "Dhaula Kuan Junction Tower", lat: 28.5910, lon: 77.1610, height: 50 },
  { id: "tow_pb_05", name: "Punjabi Bagh Club Road Tower", lat: 28.6690, lon: 77.1270, height: 45 },
  { id: "tow_karol_06", name: "Karol Bagh Pusa Rd Tower", lat: 28.6432, lon: 77.1895, height: 40 },
  { id: "tow_wazir_07", name: "Wazirpur Ashok Vihar Tower", lat: 28.6940, lon: 77.1720, height: 46 },
  { id: "tow_jahan_08", name: "Jahangirpuri Metro Tower", lat: 28.7260, lon: 77.1680, height: 52 },
  { id: "tow_anand_09", name: "Anand Vihar ISBT Tower", lat: 28.6480, lon: 77.3100, height: 55 },
  { id: "tow_mayur_10", name: "Mayur Vihar Phase 1 Tower", lat: 28.6050, lon: 77.2980, height: 44 },
  { id: "tow_okhla_11", name: "Okhla Ind Estate Tower", lat: 28.5280, lon: 77.2780, height: 50 },
  { id: "tow_lajpat_12", name: "Lajpat Nagar Ring Rd Tower", lat: 28.5700, lon: 77.2390, height: 42 },
  { id: "tow_dwarka_13", name: "Dwarka Sector 10 Tower", lat: 28.5810, lon: 77.0580, height: 45 },
  { id: "tow_igi_14", name: "IGI Airport T3 Cargo Tower", lat: 28.5560, lon: 77.0980, height: 38 },
  { id: "tow_rohini_15", name: "Rohini Sec 7 Metro Tower", lat: 28.7080, lon: 77.1150, height: 48 },
  { id: "tow_bawana_16", name: "Bawana Sector 3 Tower", lat: 28.7840, lon: 77.0420, height: 58 },
  { id: "tow_noida_17", name: "Noida Film City Sec 16A", lat: 28.5670, lon: 77.3210, height: 55 },
  { id: "tow_noida_18", name: "Noida Sec 62 Electronic City", lat: 28.6210, lon: 77.3680, height: 52 },
  { id: "tow_guru_19", name: "Cyber City DLF Ph 2 Gurugram", lat: 28.4950, lon: 77.0890, height: 65 },
  { id: "tow_guru_20", name: "IFFCO Chowk Gurugram", lat: 28.4720, lon: 77.0650, height: 50 },
  { id: "tow_ghazi_21", name: "Vaishali Sector 4 Ghaziabad", lat: 28.6470, lon: 77.3410, height: 48 },
  { id: "tow_ghazi_22", name: "Indirapuram Shipra Tower", lat: 28.6360, lon: 77.3710, height: 50 },
  { id: "tow_fari_23", name: "Neelam Chowk Faridabad", lat: 28.3980, lon: 77.3110, height: 46 },
  { id: "tow_badar_24", name: "Badarpur Border NTPC Tower", lat: 28.4990, lon: 77.3020, height: 60 }
];

// Commercial Microwave Links between towers
window.CML_LINKS = [
  { id: "cml_gn_01", from: "tow_noida_18", to: "tow_gnoida_sec1", freqGHz: 23.0, polarization: "H", baselineRSL: -43.0 },
  { id: "cml_gn_02", from: "tow_gnoida_sec1", to: "tow_gnoida_kp5", freqGHz: 23.0, polarization: "V", baselineRSL: -41.5 },
  { id: "cml_gn_03", from: "tow_noida_17", to: "tow_gnoida_kp3", freqGHz: 18.0, polarization: "H", baselineRSL: -46.2 },
  { id: "cml_gn_04", from: "tow_gnoida_kp3", to: "tow_gnoida_pari", freqGHz: 38.0, polarization: "V", baselineRSL: -39.8 },
  { id: "cml_01", from: "tow_cp_01", to: "tow_ito_02", freqGHz: 23.0, polarization: "H", baselineRSL: -42.5 },
  { id: "cml_02", from: "tow_cp_01", to: "tow_karol_06", freqGHz: 18.0, polarization: "V", baselineRSL: -41.0 },
  { id: "cml_03", from: "tow_karol_06", to: "tow_pb_05", freqGHz: 18.0, polarization: "H", baselineRSL: -44.2 },
  { id: "cml_04", from: "tow_pb_05", to: "tow_wazir_07", freqGHz: 23.0, polarization: "V", baselineRSL: -43.8 },
  { id: "cml_05", from: "tow_wazir_07", to: "tow_jahan_08", freqGHz: 23.0, polarization: "H", baselineRSL: -42.1 },
  { id: "cml_06", from: "tow_wazir_07", to: "tow_rohini_15", freqGHz: 18.0, polarization: "H", baselineRSL: -45.0 },
  { id: "cml_07", from: "tow_rohini_15", to: "tow_bawana_16", freqGHz: 15.0, polarization: "V", baselineRSL: -48.3 },
  { id: "cml_08", from: "tow_ito_02", to: "tow_anand_09", freqGHz: 15.0, polarization: "H", baselineRSL: -49.5 },
  { id: "cml_09", from: "tow_ito_02", to: "tow_lajpat_12", freqGHz: 18.0, polarization: "V", baselineRSL: -45.2 },
  { id: "cml_10", from: "tow_lajpat_12", to: "tow_okhla_11", freqGHz: 23.0, polarization: "H", baselineRSL: -43.0 },
  { id: "cml_11", from: "tow_lajpat_12", to: "tow_rkp_03", freqGHz: 23.0, polarization: "V", baselineRSL: -44.6 },
  { id: "cml_12", from: "tow_rkp_03", to: "tow_dla_04", freqGHz: 23.0, polarization: "H", baselineRSL: -42.0 },
  { id: "cml_13", from: "tow_dla_04", to: "tow_igi_14", freqGHz: 18.0, polarization: "V", baselineRSL: -45.8 },
  { id: "cml_14", from: "tow_igi_14", to: "tow_dwarka_13", freqGHz: 23.0, polarization: "H", baselineRSL: -43.5 },
  { id: "cml_15", from: "tow_dwarka_13", to: "tow_pb_05", freqGHz: 15.0, polarization: "V", baselineRSL: -51.2 },
  { id: "cml_16", from: "tow_anand_09", to: "tow_ghazi_21", freqGHz: 23.0, polarization: "H", baselineRSL: -41.8 },
  { id: "cml_17", from: "tow_ghazi_21", to: "tow_ghazi_22", freqGHz: 23.0, polarization: "V", baselineRSL: -42.4 },
  { id: "cml_18", from: "tow_ghazi_22", to: "tow_noida_18", freqGHz: 23.0, polarization: "H", baselineRSL: -41.2 },
  { id: "cml_19", from: "tow_noida_18", to: "tow_mayur_10", freqGHz: 18.0, polarization: "V", baselineRSL: -46.7 },
  { id: "cml_20", from: "tow_mayur_10", to: "tow_noida_17", freqGHz: 23.0, polarization: "H", baselineRSL: -42.9 },
  { id: "cml_21", from: "tow_noida_17", to: "tow_okhla_11", freqGHz: 18.0, polarization: "V", baselineRSL: -44.0 },
  { id: "cml_22", from: "tow_okhla_11", to: "tow_badar_24", freqGHz: 23.0, polarization: "H", baselineRSL: -42.7 },
  { id: "cml_23", from: "tow_badar_24", to: "tow_fari_23", freqGHz: 15.0, polarization: "V", baselineRSL: -49.8 },
  { id: "cml_24", from: "tow_dla_04", to: "tow_guru_19", freqGHz: 15.0, polarization: "H", baselineRSL: -50.5 },
  { id: "cml_25", from: "tow_guru_19", to: "tow_guru_20", freqGHz: 38.0, polarization: "V", baselineRSL: -40.2 },
];

// Active Stubble Burning / Agricultural Hotspots (NASA FIRMS proxy upwind of Delhi)
window.CROP_FIRE_HOTSPOTS = [
  { id: "fire_01", lat: 28.845, lon: 76.920, location: "Sonipat Border", frp: 48.5, confidence: 92 },
  { id: "fire_02", lat: 28.810, lon: 76.860, location: "Jhajjar Rural", frp: 62.0, confidence: 95 },
  { id: "fire_03", lat: 28.720, lon: 76.840, location: "Bahadurgarh Outskirts", frp: 38.4, confidence: 88 },
  { id: "fire_04", lat: 28.870, lon: 77.290, location: "Khekra / Baghpat Corridor", frp: 55.2, confidence: 94 },
  { id: "fire_05", lat: 28.420, lon: 76.910, location: "Farrukhnagar Fringe", frp: 31.7, confidence: 85 }
];
