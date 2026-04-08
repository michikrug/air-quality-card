/**
 * Air Quality Card v3.0.0
 * A custom Home Assistant card for air quality visualization
 * Thresholds based on WHO 2021 guidelines and ASHRAE standards
 * Now with WAQI (World Air Quality Index) integration support
 *
 * https://github.com/KadenThomp36/air-quality-card
 */

const CARD_VERSION = '3.0.0';

// WAQI entity key suffix -> card config mapping
const WAQI_ENTITY_MAP = {
  'air_quality': { config: 'air_quality_entity', outdoor: false },
  'humidity': { config: 'outdoor_humidity_entity', outdoor: true },
  'temperature': { config: 'outdoor_temperature_entity', outdoor: true },
  'carbon_monoxide': { config: 'outdoor_co_entity', outdoor: true },
  'nitrogen_dioxide': { config: 'outdoor_no2_entity', outdoor: true },
  'ozone': { config: 'outdoor_o3_entity', outdoor: true },
  'sulphur_dioxide': { config: 'outdoor_so2_entity', outdoor: true },
  'pm10': { config: 'outdoor_pm10_entity', outdoor: true },
  'pm25': { config: 'outdoor_pm25_entity', outdoor: true },
  'pressure': { config: null, outdoor: false }, // not supported in card
  'neph': { config: null, outdoor: false }, // not supported in card
  'dominant_pollutant': { config: null, outdoor: false } // enum, not graphable
};

// EPA AQI breakpoint tables for converting AQI sub-index back to raw concentration.
// Each entry: [AQI_lo, AQI_hi, C_lo, C_hi]
// Source: US EPA Technical Assistance Document for the Reporting of Daily Air Quality (2024)
const WAQI_BREAKPOINTS = {
  pm25: [ // μg/m³ (24-hr)
    [0, 50, 0.0, 9.0],
    [51, 100, 9.1, 35.4],
    [101, 150, 35.5, 55.4],
    [151, 200, 55.5, 125.4],
    [201, 300, 125.5, 225.4],
    [301, 500, 225.5, 500.4],
  ],
  pm10: [ // μg/m³ (24-hr)
    [0, 50, 0, 54],
    [51, 100, 55, 154],
    [101, 150, 155, 254],
    [151, 200, 255, 354],
    [201, 300, 355, 424],
    [301, 500, 425, 604],
  ],
  co: [ // ppm (8-hr)
    [0, 50, 0.0, 4.4],
    [51, 100, 4.5, 9.4],
    [101, 150, 9.5, 12.4],
    [151, 200, 12.5, 15.4],
    [201, 300, 15.5, 30.4],
    [301, 500, 30.5, 50.4],
  ],
  no2: [ // ppb (1-hr)
    [0, 50, 0, 53],
    [51, 100, 54, 100],
    [101, 150, 101, 360],
    [151, 200, 361, 649],
    [201, 300, 650, 1249],
    [301, 500, 1250, 2049],
  ],
  o3: [ // ppb (8-hr for 0-200, then 1-hr)
    [0, 50, 0, 54],
    [51, 100, 55, 70],
    [101, 150, 71, 85],
    [151, 200, 86, 105],
    [201, 300, 106, 200],
    [301, 500, 201, 504],
  ],
  so2: [ // ppb (1-hr)
    [0, 50, 0, 35],
    [51, 100, 36, 75],
    [101, 150, 76, 185],
    [151, 200, 186, 304],
    [201, 300, 305, 604],
    [301, 500, 605, 1004],
  ],
};

class AirQualityCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('air-quality-card-editor');
  }

  static getStubConfig() {
    return {
      name: 'Air Quality',
      hours_to_show: 24
    };
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._rendered = false;
    this._history = {
      aqi: [], co2: [], pm25: [], pm1: [], pm10: [], pm03: [], pm4: [],
      hcho: [], tvoc: [], nox: [], no2: [], o3: [], so2: [],
      co: [], radon: [], radon_longterm: [], humidity: [], temperature: [],
      outdoor_co2: [], outdoor_pm25: [], outdoor_pm1: [], outdoor_pm10: [],
      outdoor_pm03: [], outdoor_hcho: [], outdoor_tvoc: [], outdoor_co: [],
      outdoor_no2: [], outdoor_o3: [], outdoor_so2: [],
      outdoor_humidity: [], outdoor_temperature: []
    };
    this._historyLoaded = false;
    this._graphData = {};
    this._isDragging = false;
    this._waqiResolved = false;
    this._waqiEntityIds = new Set();
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');

    // Validate that at least one sensor entity or waqi_device is configured
    const hasEntity = config.co2_entity || config.pm25_entity || config.pm1_entity ||
      config.pm10_entity || config.pm03_entity || config.pm4_entity ||
      config.hcho_entity || config.tvoc_entity || config.nox_entity ||
      config.no2_entity || config.o3_entity || config.so2_entity ||
      config.co_entity || config.radon_entity ||
      config.radon_longterm_entity || config.humidity_entity || config.temperature_entity ||
      config.air_quality_entity;
    const hasOutdoorEntity = config.outdoor_co2_entity || config.outdoor_pm25_entity ||
      config.outdoor_pm1_entity || config.outdoor_pm10_entity || config.outdoor_pm03_entity ||
      config.outdoor_hcho_entity || config.outdoor_tvoc_entity || config.outdoor_co_entity ||
      config.outdoor_no2_entity || config.outdoor_o3_entity || config.outdoor_so2_entity ||
      config.outdoor_humidity_entity || config.outdoor_temperature_entity;
    const hasWaqi = !!config.waqi_device;
    if (!hasEntity && !hasOutdoorEntity && !hasWaqi) {
      throw new Error('Please configure at least one sensor entity or a WAQI device');
    }

    this._config = {
      name: 'Air Quality',
      hours_to_show: 24,
      temperature_unit: 'auto',
      radon_unit: 'auto',
      ...config
    };
    this._rendered = false;
    this._historyLoaded = false;
    this._waqiResolved = false;
  }

  set hass(hass) {
    this._hass = hass;

    // Resolve WAQI entities on first hass update
    if (this._config.waqi_device && !this._waqiResolved) {
      this._resolveWaqiEntities();
      this._waqiResolved = true;
    }

    if (!this._rendered) {
      this._initialRender();
      this._rendered = true;
      this._loadHistory();
    }
    this._updateStates();
  }

  _resolveWaqiEntities() {
    if (!this._hass || !this._config.waqi_device) return;

    const deviceId = this._config.waqi_device;
    this._waqiEntityIds = new Set();

    // hass.entities is the entity registry (available since HA 2023.4+)
    // It maps entity_id -> { device_id, platform, ... }
    const entityRegistry = this._hass.entities;
    if (!entityRegistry) {
      console.warn('Air Quality Card: hass.entities not available, cannot resolve WAQI device entities');
      return;
    }

    // Find all entities belonging to this device
    for (const [entityId, regEntry] of Object.entries(entityRegistry)) {
      if (regEntry.device_id !== deviceId) continue;
      if (!entityId.startsWith('sensor.')) continue;

      this._waqiEntityIds.add(entityId);

      // Match entity to WAQI sensor key using entity registry translation_key
      // (reliable) rather than entity_id suffix matching (fragile).
      // Pollutant sensors have translation_key set (pm25, nitrogen_dioxide, etc.)
      // AQI/humidity/temperature lack translation_key but have device_class.
      const tk = regEntry.translation_key;
      if (tk && WAQI_ENTITY_MAP[tk]?.config) {
        if (!this._config[WAQI_ENTITY_MAP[tk].config]) {
          this._config[WAQI_ENTITY_MAP[tk].config] = entityId;
        }
        continue;
      }

      // Fallback: match by device_class for sensors without translation_key
      const stateObj = this._hass.states?.[entityId];
      const dc = stateObj?.attributes?.device_class;
      const dcToWaqiKey = { aqi: 'air_quality', humidity: 'humidity', temperature: 'temperature' };
      const waqiKey = dcToWaqiKey[dc];
      if (waqiKey && WAQI_ENTITY_MAP[waqiKey]?.config) {
        if (!this._config[WAQI_ENTITY_MAP[waqiKey].config]) {
          this._config[WAQI_ENTITY_MAP[waqiKey].config] = entityId;
        }
      }
    }
  }

  /**
   * Check if a given entity ID came from the WAQI integration.
   * WAQI reports pollutant values as AQI sub-indices (0-500 scale),
   * not raw concentration values.
   */
  _isWaqiEntity(entityId) {
    if (!entityId) return false;
    // If we resolved from waqi_device, check our known set
    if (this._waqiEntityIds.has(entityId)) return true;
    // Also check entity registry platform
    const regEntry = this._hass?.entities?.[entityId];
    return regEntry?.platform === 'waqi';
  }

  /**
   * Convert an AQI sub-index value back to raw concentration using EPA breakpoints.
   * Uses reverse linear interpolation: C = (C_hi - C_lo) / (I_hi - I_lo) * (I - I_lo) + C_lo
   * Returns the value unchanged if no breakpoints are found for the sensor type.
   */
  _aqiSubIndexToConcentration(subIndex, sensorType) {
    const breakpoints = WAQI_BREAKPOINTS[sensorType];
    if (!breakpoints) return subIndex;
    // Clamp to valid range
    const clamped = Math.max(0, Math.min(500, subIndex));
    for (const [ilo, ihi, clo, chi] of breakpoints) {
      if (clamped >= ilo && clamped <= ihi) {
        return (chi - clo) / (ihi - ilo) * (clamped - ilo) + clo;
      }
    }
    // Above 500 — extrapolate from the last bracket
    const last = breakpoints[breakpoints.length - 1];
    return (last[3] - last[2]) / (last[1] - last[0]) * (clamped - last[0]) + last[2];
  }

  /**
   * Convert a WAQI outdoor value to raw concentration if the entity is WAQI.
   * Non-WAQI values are returned unchanged. AQI type is never converted.
   */
  _convertWaqiValue(sensorType, value) {
    if (sensorType === 'aqi') return value; // AQI is already the correct scale
    const entity = this._config[`outdoor_${sensorType}_entity`];
    if (!entity || !this._isWaqiEntity(entity)) return value;
    return this._aqiSubIndexToConcentration(value, sensorType);
  }

  getCardSize() {
    let size = 3; // Base size for header and recommendation
    const c = this._config;
    if (c.air_quality_entity || this._hasOutdoorOnly('aqi')) size += 1;
    if (c.co_entity || c.outdoor_co_entity) size += 1;
    if (c.radon_entity || c.radon_longterm_entity) size += 1;
    if (c.co2_entity || c.outdoor_co2_entity) size += 1;
    if (c.pm25_entity || c.outdoor_pm25_entity) size += 1;
    if (c.pm10_entity || c.outdoor_pm10_entity) size += 1;
    if (c.pm1_entity || c.outdoor_pm1_entity) size += 1;
    if (c.pm03_entity || c.outdoor_pm03_entity) size += 1;
    if (c.hcho_entity || c.outdoor_hcho_entity) size += 1;
    if (c.tvoc_entity || c.outdoor_tvoc_entity) size += 1;
    if (c.pm4_entity) size += 1;
    if (c.nox_entity) size += 1;
    if (c.no2_entity || c.outdoor_no2_entity) size += 1;
    if (c.o3_entity || c.outdoor_o3_entity) size += 1;
    if (c.so2_entity || c.outdoor_so2_entity) size += 1;
    if (c.humidity_entity || c.outdoor_humidity_entity) size += 1;
    if (c.temperature_entity || c.outdoor_temperature_entity) size += 1;
    return size;
  }

  /**
   * Returns true if a sensor type has only an outdoor entity and no indoor.
   * Special case: 'aqi' maps to air_quality_entity.
   */
  _hasOutdoorOnly(sensorType) {
    if (sensorType === 'aqi') return false; // AQI has no indoor/outdoor split
    return !this._config[`${sensorType}_entity`] && !!this._config[`outdoor_${sensorType}_entity`];
  }

  /**
   * Get the effective entity for a sensor type (indoor preferred, outdoor fallback).
   */
  _getEffectiveEntity(sensorType) {
    return this._config[`${sensorType}_entity`] || this._config[`outdoor_${sensorType}_entity`] || null;
  }

  /**
   * Get the effective numeric state for a sensor type (indoor preferred, outdoor fallback).
   */
  _getEffectiveState(sensorType) {
    const entity = this._getEffectiveEntity(sensorType);
    return entity ? this._getNumericState(entity) : null;
  }

  async _loadHistory() {
    if (!this._hass || this._historyLoaded) return;

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (this._config.hours_to_show * 60 * 60 * 1000));

    try {
      const promises = [];
      const keys = [];

      // AQI
      if (this._config.air_quality_entity) {
        promises.push(this._fetchHistory(this._config.air_quality_entity, startTime, endTime));
        keys.push('aqi');
      }

      if (this._config.co_entity) {
        promises.push(this._fetchHistory(this._config.co_entity, startTime, endTime));
        keys.push('co');
      }
      if (this._config.radon_entity) {
        promises.push(this._fetchHistory(this._config.radon_entity, startTime, endTime));
        keys.push('radon');
      }
      if (this._config.radon_longterm_entity) {
        promises.push(this._fetchHistory(this._config.radon_longterm_entity, startTime, endTime));
        keys.push('radon_longterm');
      }
      if (this._config.co2_entity) {
        promises.push(this._fetchHistory(this._config.co2_entity, startTime, endTime));
        keys.push('co2');
      }
      if (this._config.pm25_entity) {
        promises.push(this._fetchHistory(this._config.pm25_entity, startTime, endTime));
        keys.push('pm25');
      }
      if (this._config.pm10_entity) {
        promises.push(this._fetchHistory(this._config.pm10_entity, startTime, endTime));
        keys.push('pm10');
      }
      if (this._config.pm1_entity) {
        promises.push(this._fetchHistory(this._config.pm1_entity, startTime, endTime));
        keys.push('pm1');
      }
      if (this._config.pm03_entity) {
        promises.push(this._fetchHistory(this._config.pm03_entity, startTime, endTime));
        keys.push('pm03');
      }
      if (this._config.hcho_entity) {
        promises.push(this._fetchHistory(this._config.hcho_entity, startTime, endTime));
        keys.push('hcho');
      }
      if (this._config.tvoc_entity) {
        promises.push(this._fetchHistory(this._config.tvoc_entity, startTime, endTime));
        keys.push('tvoc');
      }
      if (this._config.pm4_entity) {
        promises.push(this._fetchHistory(this._config.pm4_entity, startTime, endTime));
        keys.push('pm4');
      }
      if (this._config.nox_entity) {
        promises.push(this._fetchHistory(this._config.nox_entity, startTime, endTime));
        keys.push('nox');
      }
      if (this._config.no2_entity) {
        promises.push(this._fetchHistory(this._config.no2_entity, startTime, endTime));
        keys.push('no2');
      }
      if (this._config.o3_entity) {
        promises.push(this._fetchHistory(this._config.o3_entity, startTime, endTime));
        keys.push('o3');
      }
      if (this._config.so2_entity) {
        promises.push(this._fetchHistory(this._config.so2_entity, startTime, endTime));
        keys.push('so2');
      }
      if (this._config.humidity_entity) {
        promises.push(this._fetchHistory(this._config.humidity_entity, startTime, endTime));
        keys.push('humidity');
      }
      if (this._config.temperature_entity) {
        promises.push(this._fetchHistory(this._config.temperature_entity, startTime, endTime));
        keys.push('temperature');
      }

      // Outdoor sensors
      const outdoorSensors = ['co2', 'pm25', 'pm1', 'pm10', 'pm03', 'hcho', 'tvoc', 'co', 'no2', 'o3', 'so2', 'humidity', 'temperature'];
      for (const sensor of outdoorSensors) {
        const key = `outdoor_${sensor}_entity`;
        if (this._config[key]) {
          promises.push(this._fetchHistory(this._config[key], startTime, endTime));
          keys.push(`outdoor_${sensor}`);
        }
      }

      const results = await Promise.all(promises);

      keys.forEach((key, i) => {
        this._history[key] = this._processHistory(results[i]);
      });

      this._historyLoaded = true;
      this._renderGraphs();
    } catch (e) {
      console.warn('Air Quality Card: Failed to load history:', e);
    }
  }

  async _fetchHistory(entityId, startTime, endTime) {
    if (!entityId) return [];
    const uri = `history/period/${startTime.toISOString()}?filter_entity_id=${entityId}&end_time=${endTime.toISOString()}&minimal_response&no_attributes`;
    const response = await this._hass.callApi('GET', uri);
    return response?.[0] || [];
  }

  _processHistory(history) {
    return history
      .filter(item => item.state && !isNaN(parseFloat(item.state)))
      .map(item => ({
        time: new Date(item.last_changed).getTime(),
        value: parseFloat(item.state)
      }));
  }

  _getState(entityId) {
    if (!entityId) return 'unknown';
    return this._hass?.states[entityId]?.state ?? 'unknown';
  }

  _getNumericState(entityId) {
    const state = this._getState(entityId);
    return parseFloat(state) || 0;
  }

  // ============================================
  // COLOR FUNCTIONS
  // ============================================

  // Standard AQI color (US EPA scale, 0-500)
  _getAQIColor(value) {
    if (value <= 50) return '#4caf50';
    if (value <= 100) return '#8bc34a';
    if (value <= 150) return '#ffc107';
    if (value <= 200) return '#ff9800';
    if (value <= 300) return '#f44336';
    return '#b71c1c';
  }

  _getAQIStatus(value) {
    if (value <= 50) return 'Good';
    if (value <= 100) return 'Moderate';
    if (value <= 150) return 'USG';
    if (value <= 200) return 'Unhealthy';
    if (value <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  _getCO2Color(value) {
    if (value < 600) return '#4caf50';
    if (value < 800) return '#8bc34a';
    if (value < 1000) return '#ffc107';
    if (value < 1500) return '#ff9800';
    return '#f44336';
  }

  _getPM25Color(value) {
    if (value < 5) return '#4caf50';
    if (value < 15) return '#8bc34a';
    if (value < 25) return '#ffc107';
    if (value < 35) return '#ff9800';
    return '#f44336';
  }

  _getHCHOColor(value) {
    if (value < 20) return '#4caf50';
    if (value < 50) return '#8bc34a';
    if (value < 100) return '#ffc107';
    if (value < 200) return '#ff9800';
    return '#f44336';
  }

  _isVOCIndex() {
    if (this._config.tvoc_unit && this._config.tvoc_unit !== 'auto') {
      return this._config.tvoc_unit === 'index';
    }
    // Auto-detect from entity unit_of_measurement
    if (this._hass && this._config.tvoc_entity) {
      const uom = this._hass.states[this._config.tvoc_entity]?.attributes?.unit_of_measurement;
      if (uom === undefined || uom === null || uom === '' || uom?.toLowerCase() === 'voc index') return true;
      if (uom === 'ppb' || uom === 'mg/m³') return false;
    }
    return false;
  }

  _getTVOCUnit() {
    return this._isVOCIndex() ? '' : 'ppb';
  }

  _getTVOCColor(value) {
    if (this._isVOCIndex()) {
      if (value < 100) return '#4caf50';
      if (value < 150) return '#8bc34a';
      if (value < 250) return '#ffc107';
      if (value < 400) return '#ff9800';
      return '#f44336';
    }
    if (value < 100) return '#4caf50';
    if (value < 300) return '#8bc34a';
    if (value < 500) return '#ffc107';
    if (value < 1000) return '#ff9800';
    return '#f44336';
  }

  _getPM4Color(value) {
    if (value < 10) return '#4caf50';
    if (value < 25) return '#8bc34a';
    if (value < 37.5) return '#ffc107';
    if (value < 50) return '#ff9800';
    return '#f44336';
  }

  _getNOxColor(value) {
    if (value < 20) return '#4caf50';
    if (value < 50) return '#8bc34a';
    if (value < 150) return '#ffc107';
    if (value < 250) return '#ff9800';
    return '#f44336';
  }

  _getHumidityColor(value) {
    if (value < 30) return '#ff9800';
    if (value < 40) return '#8bc34a';
    if (value < 50) return '#4caf50';
    if (value < 60) return '#8bc34a';
    return '#ff9800';
  }

  _getPM1Color(value) {
    if (value < 5) return '#4caf50';
    if (value < 15) return '#8bc34a';
    if (value < 25) return '#ffc107';
    if (value < 35) return '#ff9800';
    return '#f44336';
  }

  _getPM10Color(value) {
    if (value < 15) return '#4caf50';
    if (value < 45) return '#8bc34a';
    if (value < 75) return '#ffc107';
    if (value < 150) return '#ff9800';
    return '#f44336';
  }

  _getPM03Color(value) {
    if (value < 500) return '#4caf50';
    if (value < 1000) return '#8bc34a';
    if (value < 3000) return '#ffc107';
    if (value < 5000) return '#ff9800';
    return '#f44336';
  }

  _getCOColor(value) {
    if (value < 4) return '#4caf50';
    if (value < 9) return '#8bc34a';
    if (value < 35) return '#ffc107';
    if (value < 100) return '#ff9800';
    return '#f44336';
  }

  _getRadonColor(bq) {
    if (bq < 48) return '#4caf50';
    if (bq < 100) return '#8bc34a';
    if (bq < 148) return '#ffc107';
    if (bq < 300) return '#ff9800';
    return '#f44336';
  }

  // NEW: NO2 color (raw ppb thresholds — WHO/EPA guidelines)
  _getNO2Color(value) {
    if (value < 25) return '#4caf50';
    if (value < 50) return '#8bc34a';
    if (value < 100) return '#ffc107';
    if (value < 200) return '#ff9800';
    return '#f44336';
  }

  // NEW: O3 (Ozone) color (raw ppb thresholds — WHO guidelines)
  _getO3Color(value) {
    if (value < 50) return '#4caf50';
    if (value < 100) return '#8bc34a';
    if (value < 130) return '#ffc107';
    if (value < 200) return '#ff9800';
    return '#f44336';
  }

  // NEW: SO2 (Sulphur Dioxide) color (raw ppb thresholds — WHO/EPA)
  _getSO2Color(value) {
    if (value < 20) return '#4caf50';
    if (value < 75) return '#8bc34a';
    if (value < 185) return '#ffc107';
    if (value < 300) return '#ff9800';
    return '#f44336';
  }

  // AQI Sub-Index color function (for WAQI pollutant values, 0-500 scale)
  // Used when a pollutant entity is from WAQI and reports AQI sub-index values
  _getAQISubIndexColor(value) {
    if (value <= 50) return '#4caf50';
    if (value <= 100) return '#8bc34a';
    if (value <= 150) return '#ffc107';
    if (value <= 200) return '#ff9800';
    if (value <= 300) return '#f44336';
    return '#b71c1c';
  }

  _getAQISubIndexStatus(value) {
    if (value <= 50) return 'Good';
    if (value <= 100) return 'Moderate';
    if (value <= 150) return 'USG';
    if (value <= 200) return 'Unhealthy';
    if (value <= 300) return 'Very Unhealthy';
    return 'Hazardous';
  }

  /**
   * Returns the appropriate color function for a sensor type.
   * WAQI pollutant values are converted to raw concentration before display,
   * so standard color functions apply to all sensors.
   */
  _getColorFn(sensorType) {
    const colorFns = {
      aqi: this._getAQIColor.bind(this),
      co2: this._getCO2Color.bind(this),
      pm25: this._getPM25Color.bind(this),
      pm10: this._getPM10Color.bind(this),
      pm1: this._getPM1Color.bind(this),
      pm03: this._getPM03Color.bind(this),
      pm4: this._getPM4Color.bind(this),
      hcho: this._getHCHOColor.bind(this),
      tvoc: this._getTVOCColor.bind(this),
      nox: this._getNOxColor.bind(this),
      no2: this._getNO2Color.bind(this),
      o3: this._getO3Color.bind(this),
      so2: this._getSO2Color.bind(this),
      co: this._getCOColor.bind(this),
      humidity: this._getHumidityColor.bind(this),
      temperature: this._getTempColor.bind(this)
    };
    return colorFns[sensorType] || this._getAQISubIndexColor.bind(this);
  }

  /**
   * Returns the status text for a sensor value.
   * WAQI pollutant values are converted to raw concentration before display,
   * so standard status functions apply to all sensors.
   */
  _getSensorStatus(sensorType, value) {
    const statusFns = {
      aqi: (v) => this._getAQIStatus(v),
      co: (v) => v < 4 ? 'Safe' : v < 9 ? 'Low' : v < 35 ? 'Moderate' : v < 100 ? 'High' : 'Dangerous',
      co2: (v) => v < 800 ? 'Excellent' : v < 1000 ? 'Good' : v < 1500 ? 'Elevated' : 'Poor',
      pm25: (v) => v < 5 ? 'Excellent' : v < 15 ? 'Good' : v < 25 ? 'Moderate' : v < 35 ? 'Elevated' : 'Poor',
      pm10: (v) => v < 15 ? 'Excellent' : v < 45 ? 'Good' : v < 75 ? 'Moderate' : v < 150 ? 'Elevated' : 'Poor',
      pm1: (v) => v < 5 ? 'Excellent' : v < 15 ? 'Good' : v < 25 ? 'Moderate' : v < 35 ? 'Elevated' : 'Poor',
      pm03: (v) => v < 500 ? 'Clean' : v < 1000 ? 'Good' : v < 3000 ? 'Moderate' : v < 5000 ? 'Elevated' : 'Poor',
      pm4: (v) => v < 10 ? 'Excellent' : v < 25 ? 'Good' : v < 37.5 ? 'Moderate' : v < 50 ? 'Elevated' : 'Poor',
      hcho: (v) => v < 20 ? 'Excellent' : v < 50 ? 'Good' : v < 100 ? 'Moderate' : v < 200 ? 'Elevated' : 'Poor',
      tvoc: (v) => {
        if (this._isVOCIndex()) return v < 100 ? 'Excellent' : v < 150 ? 'Good' : v < 250 ? 'Moderate' : v < 400 ? 'Elevated' : 'Poor';
        return v < 100 ? 'Excellent' : v < 300 ? 'Good' : v < 500 ? 'Moderate' : v < 1000 ? 'Elevated' : 'Poor';
      },
      nox: (v) => v < 20 ? 'Excellent' : v < 50 ? 'Good' : v < 150 ? 'Moderate' : v < 250 ? 'Elevated' : 'Poor',
      no2: (v) => v < 25 ? 'Excellent' : v < 50 ? 'Good' : v < 100 ? 'Moderate' : v < 200 ? 'Elevated' : 'Poor',
      o3: (v) => v < 50 ? 'Excellent' : v < 100 ? 'Good' : v < 130 ? 'Moderate' : v < 200 ? 'Elevated' : 'Poor',
      so2: (v) => v < 20 ? 'Excellent' : v < 75 ? 'Good' : v < 185 ? 'Moderate' : v < 300 ? 'Elevated' : 'Poor',
      humidity: (v) => {
        if (v < 30) return 'Too Dry';
        if (v < 40) return 'Dry';
        if (v > 60) return 'Too Humid';
        if (v > 50) return 'Humid';
        return 'Comfortable';
      },
      temperature: (v) => {
        if (this._isCelsius()) {
          if (v < 18) return 'Cold';
          if (v < 20) return 'Cool';
          if (v > 24) return 'Hot';
          if (v > 22) return 'Warm';
        } else {
          if (v < 65) return 'Cold';
          if (v < 68) return 'Cool';
          if (v > 76) return 'Hot';
          if (v > 72) return 'Warm';
        }
        return 'Comfortable';
      }
    };
    const fn = statusFns[sensorType];
    return fn ? fn(value) : '';
  }

  // ============================================
  // RADON HELPERS
  // ============================================

  _getRadonUnit() {
    const unit = this._config.radon_unit;
    if (unit === 'pCi/L') return 'pCi/L';
    if (unit === 'Bq/m³') return 'Bq/m³';
    // Auto-detect from entity's unit_of_measurement
    if (this._config.radon_entity) {
      const entityUnit = this._hass?.states[this._config.radon_entity]?.attributes?.unit_of_measurement;
      if (entityUnit && entityUnit.toLowerCase().includes('pci')) return 'pCi/L';
    }
    return 'Bq/m³';
  }

  _isRadonPciL() {
    return this._getRadonUnit() === 'pCi/L';
  }

  _getRadonBqm3(value) {
    if (this._isRadonPciL()) return value * 37;
    return value;
  }

  _formatRadon(value) {
    const unit = this._getRadonUnit();
    if (unit === 'pCi/L') return `${value.toFixed(1)} pCi/L`;
    return `${Math.round(value)} Bq/m³`;
  }

  _getRadonAdvisory() {
    if (!this._config.radon_entity && !this._config.radon_longterm_entity) return null;
    const shortRaw = this._config.radon_entity ? this._getNumericState(this._config.radon_entity) : 0;
    const longRaw = this._config.radon_longterm_entity ? this._getNumericState(this._config.radon_longterm_entity) : 0;
    const shortBq = this._getRadonBqm3(shortRaw);
    const longBq = this._getRadonBqm3(longRaw);
    const bq = Math.max(shortBq, longBq);
    const raw = shortBq >= longBq ? shortRaw : longRaw;
    const display = this._formatRadon(raw);
    const threshold = this._isRadonPciL() ? '4.0 pCi/L' : '148 Bq/m³';

    // Build subtitle with both values when both are configured
    const bothConfigured = this._config.radon_entity && this._config.radon_longterm_entity;
    const valuesStr = bothConfigured
      ? `Short-term: ${this._formatRadon(shortRaw)}, Long-term: ${this._formatRadon(longRaw)}`
      : `Radon at ${display}`;

    if (bq >= 300) return {
      level: 'danger',
      text: 'Radon High - Mitigation Needed',
      subtitle: `${valuesStr} - contact a certified radon mitigator`
    };
    if (bq >= 148) return {
      level: 'warning',
      text: 'Radon Above EPA Action Level',
      subtitle: `${valuesStr} - EPA recommends mitigation above ${threshold}`
    };
    if (bq >= 100) return {
      level: 'info',
      text: 'Radon - Monitor Closely',
      subtitle: `${valuesStr} - approaching action level`
    };
    return null;
  }

  // ============================================
  // TEMPERATURE HELPERS
  // ============================================

  _isCelsius() {
    const unit = this._config.temperature_unit;
    if (unit === 'C') return true;
    if (unit === 'F') return false;
    // Auto-detect from Home Assistant unit system
    try {
      return this._hass.config.unit_system.temperature === '°C';
    } catch (e) {
      return false;
    }
  }

  _getTempUnit() {
    return this._isCelsius() ? '°C' : '°F';
  }

  _getTempColor(value) {
    if (this._isCelsius()) {
      if (value < 18) return '#2196f3';
      if (value < 20) return '#03a9f4';
      if (value < 22) return '#4caf50';
      if (value < 24) return '#ff9800';
      return '#f44336';
    }
    if (value < 65) return '#2196f3';
    if (value < 68) return '#03a9f4';
    if (value < 72) return '#4caf50';
    if (value < 76) return '#ff9800';
    return '#f44336';
  }

  // ============================================
  // STATUS & RECOMMENDATION LOGIC
  // ============================================

  _getOverallStatus() {
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : 0;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;
    const radonShort = this._config.radon_entity ? this._getRadonBqm3(this._getNumericState(this._config.radon_entity)) : 0;
    const radonLong = this._config.radon_longterm_entity ? this._getRadonBqm3(this._getNumericState(this._config.radon_longterm_entity)) : 0;
    const radon = Math.max(radonShort, radonLong);

    // If air_quality_entity is configured (AQI), use it as primary status source
    if (this._config.air_quality_entity) {
      const aqiState = this._getState(this._config.air_quality_entity);
      const aqiNum = parseFloat(aqiState);
      if (!isNaN(aqiNum)) {
        // Numeric AQI value — use standard AQI status
        return { status: this._getAQIStatus(aqiNum), color: this._getAQIColor(aqiNum) };
      }
      // Text-based quality (legacy behavior)
      return { status: aqiState.replace('_', ' '), color: this._getQualityColor(aqiState) };
    }

    // CO is a life-safety metric — always takes priority
    if (co > 35) return { status: 'Dangerous', color: '#d32f2f' };
    if (co > 9) return { status: 'Poor', color: '#f44336' };

    // Radon — only degrades status at EPA action level and above
    if (radon >= 300) return { status: 'Poor', color: '#f44336' };
    if (radon >= 148) return { status: 'Fair', color: '#ff9800' };

    // Calculate from CO2 and PM2.5
    if (co2 > 1500 || pm25 > 35) return { status: 'Poor', color: '#f44336' };
    if (co2 > 1000 || pm25 > 25) return { status: 'Fair', color: '#ff9800' };
    if (co2 > 800 || pm25 > 15) return { status: 'Moderate', color: '#ffc107' };
    if (co2 > 600 || pm25 > 5) return { status: 'Good', color: '#8bc34a' };
    return { status: 'Excellent', color: '#4caf50' };
  }

  _getQualityColor(quality) {
    const colors = {
      'good': '#4caf50',
      'excellent': '#4caf50',
      'moderate': '#8bc34a',
      'fair': '#ffc107',
      'poor': '#ff9800',
      'very_poor': '#f44336',
      'very poor': '#f44336',
      'extremely_poor': '#b71c1c'
    };
    return colors[quality?.toLowerCase()] || '#9e9e9e';
  }

  _getRecommendation() {
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : 0;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : 0;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : 0;
    const pm10 = this._config.pm10_entity ? this._getNumericState(this._config.pm10_entity) : 0;
    const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : 0;
    const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : 0;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : 45;

    // AQI-based outdoor recommendation
    const aqi = this._config.air_quality_entity ? this._getNumericState(this._config.air_quality_entity) : null;

    // Read outdoor values for smart recommendations
    const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
    let outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
    if (outdoorPm25 !== null) outdoorPm25 = this._convertWaqiValue('pm25', outdoorPm25);
    const outdoorIsWorse = (outdoorPm25 !== null && outdoorPm25 > pm25) || (outdoorCo2 !== null && outdoorCo2 > co2);

    // Priority waterfall — CO safety first (never suppressed by outdoor override)
    if (co > 100) return 'CO Danger — Leave Area';
    if (co > 35) return 'CO Warning — Ventilate Now';

    // AQI-based outdoor advisory (only when no indoor issues are severe)
    if (aqi !== null && aqi > 150) return 'Limit Outdoor Exposure';

    let rec = 'All Good';
    if (co2 > 1500) rec = 'Ventilate Now';
    else if (pm25 > 35) rec = 'Run Air Purifier';
    else if (pm10 > 150) rec = 'Run Air Purifier';
    else if (hcho > 100) rec = 'Ventilate — Formaldehyde';
    else if (tvoc > 500) rec = 'Ventilate — VOCs Elevated';
    else if (pm25 > 25 && co2 > 1000) rec = 'Air Purifier + Ventilate';
    else if (pm25 > 25) rec = 'Run Air Purifier';
    else if (pm10 > 75) rec = 'Consider Air Purifier';
    else if (co2 > 1000) rec = 'Open Window';
    else if (co > 9) rec = 'CO Elevated — Ventilate';
    else if (humidity < 30) rec = 'Too Dry';
    else if (humidity > 60) rec = 'Too Humid';
    else if (co2 > 800 || pm25 > 15) rec = 'Consider Ventilating';

    // Override ventilation recommendations if outdoor air is worse
    // CO recommendations are NOT in this list — CO is always a life-safety concern
    const ventilationRecs = ['Ventilate Now', 'Open Window', 'Consider Ventilating', 'Air Purifier + Ventilate', 'Ventilate — Formaldehyde', 'Ventilate — VOCs Elevated', 'CO Elevated — Ventilate'];
    if (outdoorIsWorse && ventilationRecs.includes(rec)) {
      if (pm25 > 25) return 'Run Air Purifier';
      return 'Keep Windows Closed';
    }

    return rec;
  }

  _getRecommendationIcon(rec) {
    const icons = {
      'All Good': 'mdi:check-circle',
      'Consider Ventilating': 'mdi:information',
      'Open Window': 'mdi:window-open-variant',
      'Run Air Purifier': 'mdi:air-purifier',
      'Consider Air Purifier': 'mdi:air-purifier',
      'Air Purifier + Ventilate': 'mdi:alert',
      'Ventilate Now': 'mdi:alert-circle',
      'Ventilate — Formaldehyde': 'mdi:alert-circle',
      'Ventilate — VOCs Elevated': 'mdi:alert-circle',
      'CO Danger — Leave Area': 'mdi:alert-octagon',
      'CO Warning — Ventilate Now': 'mdi:alert-octagon',
      'CO Elevated — Ventilate': 'mdi:alert',
      'Keep Windows Closed': 'mdi:window-closed-variant',
      'Limit Outdoor Exposure': 'mdi:shield-alert',
      'Too Dry': 'mdi:water-percent',
      'Too Humid': 'mdi:water'
    };
    return icons[rec] || 'mdi:air-filter';
  }

  // ============================================
  // SENSOR UNIT HELPERS
  // ============================================

  /**
   * Get the display unit for a sensor type, accounting for WAQI sub-index.
   */
  _getSensorUnit(sensorType) {
    const units = {
      aqi: '',
      co: 'ppm',
      co2: 'ppm',
      pm25: 'μg/m³',
      pm10: 'μg/m³',
      pm1: 'μg/m³',
      pm03: 'p/0.1L',
      pm4: 'μg/m³',
      hcho: 'ppb',
      nox: 'ppb',
      no2: 'ppb',
      o3: 'ppb',
      so2: 'ppb',
      humidity: '%',
    };
    if (sensorType === 'tvoc') return this._getTVOCUnit();
    if (sensorType === 'temperature') return this._getTempUnit();
    if (sensorType === 'radon') return this._getRadonUnit();
    return units[sensorType] || '';
  }

  // ============================================
  // INITIAL RENDER
  // ============================================

  _initialRender() {
    const c = this._config;

    // Show flags: indoor OR outdoor (for outdoor-only display)
    const showAQI = !!c.air_quality_entity;
    const showCO = !!(c.co_entity || c.outdoor_co_entity);
    const showRadon = !!(c.radon_entity || c.radon_longterm_entity);
    const showCO2 = !!(c.co2_entity || c.outdoor_co2_entity);
    const showPM25 = !!(c.pm25_entity || c.outdoor_pm25_entity);
    const showPM10 = !!(c.pm10_entity || c.outdoor_pm10_entity);
    const showPM1 = !!(c.pm1_entity || c.outdoor_pm1_entity);
    const showPM03 = !!(c.pm03_entity || c.outdoor_pm03_entity);
    const showHCHO = !!(c.hcho_entity || c.outdoor_hcho_entity);
    const showTVOC = !!(c.tvoc_entity || c.outdoor_tvoc_entity);
    const showPM4 = !!c.pm4_entity;
    const showNOx = !!c.nox_entity;
    const showNO2 = !!(c.no2_entity || c.outdoor_no2_entity);
    const showO3 = !!(c.o3_entity || c.outdoor_o3_entity);
    const showSO2 = !!(c.so2_entity || c.outdoor_so2_entity);
    const showHumidity = !!(c.humidity_entity || c.outdoor_humidity_entity);
    const showTemp = !!(c.temperature_entity || c.outdoor_temperature_entity);

    // Helper to get the data-entity attribute (indoor preferred, outdoor fallback)
    const dataEntity = (indoor, outdoor) => indoor || outdoor || '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --aq-excellent: #4caf50;
          --aq-good: #8bc34a;
          --aq-moderate: #ffc107;
          --aq-poor: #ff9800;
          --aq-very-poor: #f44336;
          --aq-critical: #d32f2f;
        }

        .card {
          background: var(--ha-card-background, var(--card-background-color, #fff));
          border-radius: var(--ha-card-border-radius, 12px);
          padding: 16px;
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .title {
          font-size: 1.1em;
          font-weight: 600;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 0.8em;
          font-weight: 500;
          text-transform: capitalize;
        }

        .recommendation {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 10px;
          margin-bottom: 14px;
          background: var(--secondary-background-color);
        }

        .recommendation ha-icon {
          --mdc-icon-size: 24px;
        }

        .recommendation-text {
          flex: 1;
        }

        .recommendation-title {
          font-weight: 600;
          font-size: 1em;
        }

        .recommendation-subtitle {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          margin-top: 1px;
        }

        .radon-advisory {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          border-radius: 8px;
          margin-bottom: 14px;
          border-left: 3px solid var(--aq-moderate);
          background: var(--secondary-background-color);
          font-size: 0.9em;
        }

        .radon-advisory ha-icon {
          --mdc-icon-size: 20px;
          flex-shrink: 0;
        }

        .radon-advisory-text {
          flex: 1;
        }

        .radon-advisory-title {
          font-weight: 600;
          font-size: 0.9em;
        }

        .radon-advisory-subtitle {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          margin-top: 1px;
        }

        .graphs {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .graph-container {
          background: var(--secondary-background-color);
          border-radius: 10px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .graph-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }

        .graph-label {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .outdoor-only-badge {
          font-size: 0.6em;
          color: var(--secondary-text-color);
          opacity: 0.7;
          margin-left: 4px;
          text-transform: none;
          letter-spacing: 0;
        }

        .graph-value {
          font-size: 1em;
          font-weight: 700;
        }

        .graph-value .unit {
          font-size: 0.7em;
          font-weight: 400;
          opacity: 0.8;
        }

        .graph-value .status {
          font-size: 0.7em;
          font-weight: 500;
          margin-left: 6px;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .graph-value-secondary {
          font-size: 0.8em;
          font-weight: 500;
          opacity: 0.7;
          margin-top: -2px;
          margin-bottom: 4px;
          text-align: right;
        }

        .graph-value-secondary .unit {
          font-size: 0.75em;
          font-weight: 400;
          opacity: 0.8;
        }

        .graph-value-secondary .status {
          font-size: 0.75em;
          font-weight: 500;
          margin-left: 4px;
          padding: 1px 4px;
          border-radius: 3px;
        }

        .graph-wrapper {
          position: relative;
        }

        .graph {
          height: 50px;
          position: relative;
        }

        .graph svg {
          width: 100%;
          height: 100%;
        }

        .graph-line {
          fill: none;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .graph-cursor {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: var(--primary-text-color);
          opacity: 0.7;
          pointer-events: none;
          display: none;
        }

        .graph-cursor::before {
          content: '';
          position: absolute;
          top: 50%;
          left: -4px;
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: var(--primary-text-color);
          transform: translateY(-50%);
        }

        .graph-tooltip {
          position: absolute;
          top: -6px;
          transform: translateX(-50%);
          background: var(--primary-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 6px;
          padding: 3px 7px;
          font-size: 0.7em;
          font-weight: 600;
          white-space: nowrap;
          pointer-events: none;
          display: none;
          z-index: 10;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }

        .graph-tooltip-time {
          font-size: 0.85em;
          font-weight: 400;
          color: var(--secondary-text-color);
          margin-top: 1px;
        }

        .graph-tooltip-outdoor {
          font-size: 0.8em;
          font-weight: 400;
          color: var(--secondary-text-color);
          opacity: 0.7;
          margin-top: 1px;
          display: none;
        }

        .outdoor-value {
          font-size: 0.75em;
          color: var(--secondary-text-color);
          opacity: 0.7;
        }

        .graph-time-axis {
          display: flex;
          justify-content: space-between;
          font-size: 0.6em;
          color: var(--secondary-text-color);
          margin-top: 4px;
          opacity: 0.8;
        }

        .no-data {
          text-align: center;
          padding: 20px;
          color: var(--secondary-text-color);
        }
      </style>

      <ha-card>
        <div class="card">
          <div class="header">
            <span class="title">${this._config.name}</span>
            <div class="status-badge" id="status-badge">
              <ha-icon id="status-icon" icon="mdi:leaf"></ha-icon>
              <span id="status-text">Good</span>
            </div>
          </div>

          <div class="recommendation" id="recommendation">
            <ha-icon id="rec-icon" icon="mdi:check-circle"></ha-icon>
            <div class="recommendation-text">
              <div class="recommendation-title" id="rec-title">All Good</div>
              <div class="recommendation-subtitle" id="rec-subtitle">Air quality is within healthy limits</div>
            </div>
          </div>

          <div class="radon-advisory" id="radon-advisory" style="display:none">
            <ha-icon id="radon-advisory-icon" icon="mdi:radioactive"></ha-icon>
            <div class="radon-advisory-text">
              <div class="radon-advisory-title" id="radon-advisory-title"></div>
              <div class="radon-advisory-subtitle" id="radon-advisory-subtitle"></div>
            </div>
          </div>

          <div class="graphs">
            ${showAQI ? this._renderGraphSection('aqi', 'AQI', '', dataEntity(c.air_quality_entity, null)) : ''}
            ${showCO ? this._renderGraphSection('co', 'CO', 'ppm', dataEntity(c.co_entity, c.outdoor_co_entity)) : ''}
            ${showRadon ? `
            <div class="graph-container" id="radon-graph-container" data-entity="${c.radon_entity || c.radon_longterm_entity}">
              <div class="graph-header">
                <span class="graph-label">Radon</span>
                <span class="graph-value" id="radon-value">-- <span class="unit">${this._getRadonUnit()}</span><span class="status" id="radon-status"></span></span>
              </div>
              ${c.radon_longterm_entity ? `<div class="graph-value-secondary" id="radon-lt-value">LT: -- <span class="unit">${this._getRadonUnit()}</span></div>` : ''}
              <div class="graph-wrapper">
                <div class="graph" id="radon-graph">
                  <svg id="radon-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
                </div>
                <div class="graph-cursor" id="radon-cursor"></div>
                <div class="graph-tooltip" id="radon-tooltip">
                  <div class="graph-tooltip-value"></div>
                  ${c.radon_longterm_entity ? `<div class="graph-tooltip-outdoor"></div>` : ''}
                  <div class="graph-tooltip-time"></div>
                </div>
              </div>
              <div class="graph-time-axis" id="radon-time-axis"></div>
            </div>
            ` : ''}
            ${showCO2 ? this._renderGraphSection('co2', 'CO\u2082', this._getSensorUnit('co2'), dataEntity(c.co2_entity, c.outdoor_co2_entity)) : ''}
            ${showPM25 ? this._renderGraphSection('pm25', 'PM2.5', this._getSensorUnit('pm25'), dataEntity(c.pm25_entity, c.outdoor_pm25_entity)) : ''}
            ${showPM10 ? this._renderGraphSection('pm10', 'PM10', this._getSensorUnit('pm10'), dataEntity(c.pm10_entity, c.outdoor_pm10_entity)) : ''}
            ${showPM1 ? this._renderGraphSection('pm1', 'PM1', this._getSensorUnit('pm1'), dataEntity(c.pm1_entity, c.outdoor_pm1_entity)) : ''}
            ${showPM03 ? this._renderGraphSection('pm03', 'PM0.3', this._getSensorUnit('pm03'), dataEntity(c.pm03_entity, c.outdoor_pm03_entity)) : ''}
            ${showHCHO ? this._renderGraphSection('hcho', 'HCHO / CH\u2082O', this._getSensorUnit('hcho'), dataEntity(c.hcho_entity, c.outdoor_hcho_entity)) : ''}
            ${showTVOC ? this._renderGraphSection('tvoc', 'tVOC', this._getSensorUnit('tvoc'), dataEntity(c.tvoc_entity, c.outdoor_tvoc_entity)) : ''}
            ${showPM4 ? this._renderGraphSection('pm4', 'PM4', 'μg/m³', c.pm4_entity) : ''}
            ${showNOx ? this._renderGraphSection('nox', 'NOx', 'ppb', c.nox_entity) : ''}
            ${showNO2 ? this._renderGraphSection('no2', 'NO\u2082', this._getSensorUnit('no2'), dataEntity(c.no2_entity, c.outdoor_no2_entity)) : ''}
            ${showO3 ? this._renderGraphSection('o3', 'O\u2083', this._getSensorUnit('o3'), dataEntity(c.o3_entity, c.outdoor_o3_entity)) : ''}
            ${showSO2 ? this._renderGraphSection('so2', 'SO\u2082', this._getSensorUnit('so2'), dataEntity(c.so2_entity, c.outdoor_so2_entity)) : ''}
            ${showHumidity ? this._renderGraphSection('humidity', 'Humidity', '%', dataEntity(c.humidity_entity, c.outdoor_humidity_entity)) : ''}
            ${showTemp ? this._renderGraphSection('temperature', 'Temperature', this._getTempUnit(), dataEntity(c.temperature_entity, c.outdoor_temperature_entity)) : ''}
          </div>
        </div>
      </ha-card>
    `;
  }

  /**
   * Generate HTML for a standard graph section.
   * Marks outdoor-only sections with a subtle badge.
   */
  _renderGraphSection(id, label, unit, entityId) {
    const isOutdoorOnly = this._hasOutdoorOnly(id);
    const outdoorBadge = isOutdoorOnly ? '<span class="outdoor-only-badge">(outdoor)</span>' : '';
    const unitSpan = unit ? `<span class="unit">${unit}</span>` : '';
    return `
    <div class="graph-container" id="${id}-graph-container" data-entity="${entityId}">
      <div class="graph-header">
        <span class="graph-label">${label}${outdoorBadge}</span>
        <span class="graph-value" id="${id}-value">-- ${unitSpan}<span class="status" id="${id}-status"></span></span>
      </div>
      <div class="graph-wrapper">
        <div class="graph" id="${id}-graph">
          <svg id="${id}-svg" viewBox="0 0 300 50" preserveAspectRatio="none"></svg>
        </div>
        <div class="graph-cursor" id="${id}-cursor"></div>
        <div class="graph-tooltip" id="${id}-tooltip">
          <div class="graph-tooltip-value"></div>
          <div class="graph-tooltip-outdoor"></div>
          <div class="graph-tooltip-time"></div>
        </div>
      </div>
      <div class="graph-time-axis" id="${id}-time-axis"></div>
    </div>
    `;
  }

  // ============================================
  // STATE UPDATES
  // ============================================

  _updateStates() {
    if (!this._hass || !this._rendered) return;

    const recommendation = this._getRecommendation();
    const overall = this._getOverallStatus();

    // Update status badge
    const statusBadge = this.shadowRoot.getElementById('status-badge');
    const statusText = this.shadowRoot.getElementById('status-text');
    const statusIcon = this.shadowRoot.getElementById('status-icon');

    if (statusBadge) {
      statusBadge.style.background = overall.color + '22';
      statusBadge.style.color = overall.color;
      statusText.textContent = overall.status;
      statusIcon.style.color = overall.color;
    }

    // Update recommendation
    this._updateRecommendation(recommendation);

    // Update radon advisory banner
    this._updateRadonAdvisory();

    // Helper to render outdoor value suffix (only when indoor entity exists)
    // Converts WAQI sub-index values to raw concentration for comparable display.
    const outdoorSuffix = (sensorType, unit) => {
      const entityKey = `outdoor_${sensorType}_entity`;
      if (!this._config[entityKey]) return '';
      const rawVal = this._getNumericState(this._config[entityKey]);
      const val = this._convertWaqiValue(sensorType, rawVal);
      return ` <span class="outdoor-value">(out: ${unit === 'μg/m³' || unit === 'ppb' ? val.toFixed(1) : Math.round(val)} ${unit})</span>`;
    };

    // Standard sensor updates using the unified approach
    const standardSensors = ['aqi', 'co', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'no2', 'o3', 'so2', 'humidity', 'temperature'];

    for (const sensorType of standardSensors) {
      // Skip radon (handled separately) and sensors without entities
      if (sensorType === 'radon') continue;

      const indoorEntity = this._config[`${sensorType}_entity`];
      const outdoorEntity = sensorType !== 'aqi' ? this._config[`outdoor_${sensorType}_entity`] : null;

      // Determine the effective entity (indoor preferred, outdoor fallback)
      const effectiveEntity = sensorType === 'aqi' ? this._config.air_quality_entity : (indoorEntity || outdoorEntity);
      if (!effectiveEntity) continue;

      let value = this._getNumericState(effectiveEntity);
      // Convert WAQI sub-index to raw concentration when outdoor-only (no indoor entity)
      if (!indoorEntity && outdoorEntity) {
        value = this._convertWaqiValue(sensorType, value);
      }
      const unit = this._getSensorUnit(sensorType);
      const colorFn = this._getColorFn(sensorType);
      const color = colorFn(value);
      const status = this._getSensorStatus(sensorType, value);

      const valueEl = this.shadowRoot.getElementById(`${sensorType}-value`);
      if (!valueEl) continue;

      // Format value
      let displayVal;
      if (unit === '%' || unit === '°F' || unit === '°C' || unit === 'ppm' || unit === '') {
        displayVal = (unit === 'ppm' && sensorType === 'co') ? value.toFixed(1) : Math.round(value);
      } else if (unit === 'pCi/L') {
        displayVal = value.toFixed(1);
      } else {
        displayVal = value.toFixed(1);
      }

      const unitSpan = unit ? ` <span class="unit">${unit}</span>` : '';
      // Only show outdoor suffix when we have both indoor and outdoor
      const suffix = (indoorEntity && outdoorEntity) ? outdoorSuffix(sensorType, unit) : '';

      valueEl.innerHTML = `${displayVal}${unitSpan}<span class="status" id="${sensorType}-status"></span>${suffix}`;
      const statusEl = valueEl.querySelector('.status');
      if (statusEl) {
        statusEl.textContent = status;
        statusEl.style.background = color + '22';
        statusEl.style.color = color;
      }
      valueEl.style.color = color;
    }

    // Radon (special handling due to short-term + long-term)
    this._updateRadon();
  }

  _updateRecommendation(recommendation) {
    const co = this._config.co_entity ? this._getNumericState(this._config.co_entity) : null;
    const co2 = this._config.co2_entity ? this._getNumericState(this._config.co2_entity) : null;
    const pm25 = this._config.pm25_entity ? this._getNumericState(this._config.pm25_entity) : null;
    const pm10 = this._config.pm10_entity ? this._getNumericState(this._config.pm10_entity) : null;
    const humidity = this._config.humidity_entity ? this._getNumericState(this._config.humidity_entity) : null;
    const aqi = this._config.air_quality_entity ? this._getNumericState(this._config.air_quality_entity) : null;

    const recIcon = this.shadowRoot.getElementById('rec-icon');
    const recTitle = this.shadowRoot.getElementById('rec-title');
    const recSubtitle = this.shadowRoot.getElementById('rec-subtitle');
    const recContainer = this.shadowRoot.getElementById('recommendation');

    if (recIcon && recommendation) {
      recIcon.setAttribute('icon', this._getRecommendationIcon(recommendation));
      recTitle.textContent = recommendation;

      let subtitle = '';
      if (recommendation === 'CO Danger — Leave Area') {
        subtitle = co !== null ? `CO at ${co.toFixed(0)} ppm — dangerous levels detected` : 'Dangerous CO levels';
      } else if (recommendation === 'CO Warning — Ventilate Now') {
        subtitle = co !== null ? `CO at ${co.toFixed(0)} ppm — open all windows immediately` : 'High CO levels';
      } else if (recommendation === 'CO Elevated — Ventilate') {
        subtitle = co !== null ? `CO at ${co.toFixed(0)} ppm — improve ventilation` : 'CO levels elevated';
      } else if (recommendation === 'Limit Outdoor Exposure') {
        subtitle = aqi !== null ? `AQI at ${Math.round(aqi)} — reduce outdoor activity` : 'Poor outdoor air quality';
      } else if (recommendation === 'All Good') {
        subtitle = 'Air quality is within healthy limits';
      } else if (recommendation === 'Run Air Purifier') {
        if (pm25 !== null && pm25 > 35) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³ - filter the air`;
        else if (pm10 !== null && pm10 > 150) subtitle = `PM10 at ${pm10.toFixed(0)} μg/m³ - filter the air`;
        else if (pm25 !== null) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³ - filter the air`;
        else subtitle = 'Particulate levels elevated';
      } else if (recommendation === 'Consider Air Purifier' && pm10 !== null) {
        subtitle = `PM10 at ${pm10.toFixed(0)} μg/m³`;
      } else if (recommendation === 'Open Window' && co2 !== null) {
        subtitle = `CO₂ at ${Math.round(co2)} ppm - fresh air needed`;
      } else if (recommendation === 'Air Purifier + Ventilate' && co2 !== null && pm25 !== null) {
        subtitle = `CO₂: ${Math.round(co2)} ppm, PM2.5: ${pm25.toFixed(0)} μg/m³`;
      } else if (recommendation === 'Ventilate Now' && co2 !== null) {
        subtitle = `CO₂ at ${Math.round(co2)} ppm - may affect focus`;
      } else if (recommendation === 'Ventilate — Formaldehyde') {
        const hcho = this._config.hcho_entity ? this._getNumericState(this._config.hcho_entity) : null;
        subtitle = hcho !== null ? `HCHO at ${hcho.toFixed(0)} ppb - ventilation needed` : 'Formaldehyde levels elevated';
      } else if (recommendation === 'Ventilate — VOCs Elevated') {
        const tvoc = this._config.tvoc_entity ? this._getNumericState(this._config.tvoc_entity) : null;
        subtitle = tvoc !== null ? `tVOC at ${tvoc.toFixed(0)} ppb - ventilation needed` : 'VOC levels elevated';
      } else if (recommendation === 'Too Dry' && humidity !== null) {
        subtitle = `Humidity at ${Math.round(humidity)}% - consider humidifier`;
      } else if (recommendation === 'Too Humid' && humidity !== null) {
        subtitle = `Humidity at ${Math.round(humidity)}% - ventilate`;
      } else if (recommendation === 'Consider Ventilating') {
        if (co2 !== null && co2 > 800) subtitle = `CO₂ at ${Math.round(co2)} ppm`;
        else if (pm25 !== null && pm25 > 15) subtitle = `PM2.5 at ${pm25.toFixed(0)} μg/m³`;
        else subtitle = 'Slightly elevated levels';
      } else if (recommendation === 'Keep Windows Closed') {
        const outdoorPm25 = this._config.outdoor_pm25_entity ? this._getNumericState(this._config.outdoor_pm25_entity) : null;
        const outdoorCo2 = this._config.outdoor_co2_entity ? this._getNumericState(this._config.outdoor_co2_entity) : null;
        if (outdoorPm25 !== null && outdoorPm25 > 35) subtitle = `Outdoor PM2.5 at ${outdoorPm25.toFixed(0)} μg/m³ - poor outdoor air`;
        else if (outdoorPm25 !== null) subtitle = `Outdoor PM2.5 at ${outdoorPm25.toFixed(0)} μg/m³ - worse than indoor`;
        else if (outdoorCo2 !== null) subtitle = `Outdoor CO₂ at ${Math.round(outdoorCo2)} ppm - worse than indoor`;
        else subtitle = 'Outdoor air quality is worse than indoor';
      }
      recSubtitle.textContent = subtitle;

      const isGood = recommendation === 'All Good';
      const isCritical = ['CO Danger — Leave Area', 'CO Warning — Ventilate Now'].includes(recommendation);
      const isPoor = ['Run Air Purifier', 'Open Window', 'Ventilate Now', 'Air Purifier + Ventilate', 'Keep Windows Closed', 'Ventilate — Formaldehyde', 'Ventilate — VOCs Elevated', 'CO Elevated — Ventilate', 'Consider Air Purifier', 'Limit Outdoor Exposure'].includes(recommendation);
      recIcon.style.color = isGood ? 'var(--aq-excellent)' : (isCritical ? 'var(--aq-very-poor)' : (isPoor ? 'var(--aq-poor)' : 'var(--aq-moderate)'));
      recContainer.style.background = isGood ?
        'rgba(76, 175, 80, 0.1)' : (isCritical ? 'rgba(244, 67, 54, 0.15)' : (isPoor ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 193, 7, 0.1)'));
    }
  }

  _updateRadonAdvisory() {
    const radonAdvisory = this._getRadonAdvisory();
    const advisoryEl = this.shadowRoot.getElementById('radon-advisory');
    if (advisoryEl) {
      if (radonAdvisory) {
        advisoryEl.style.display = '';
        const advisoryColors = { danger: 'var(--aq-very-poor)', warning: 'var(--aq-poor)', info: 'var(--aq-moderate)' };
        advisoryEl.style.borderLeftColor = advisoryColors[radonAdvisory.level] || 'var(--aq-moderate)';
        const titleEl = this.shadowRoot.getElementById('radon-advisory-title');
        const subtitleEl = this.shadowRoot.getElementById('radon-advisory-subtitle');
        const iconEl = this.shadowRoot.getElementById('radon-advisory-icon');
        if (titleEl) titleEl.textContent = radonAdvisory.text;
        if (subtitleEl) subtitleEl.textContent = radonAdvisory.subtitle;
        if (iconEl) iconEl.style.color = advisoryColors[radonAdvisory.level] || 'var(--aq-moderate)';
      } else {
        advisoryEl.style.display = 'none';
      }
    }
  }

  _updateRadon() {
    // Update short-term radon
    if (this._config.radon_entity) {
      const radonRaw = this._getNumericState(this._config.radon_entity);
      const radonBq = this._getRadonBqm3(radonRaw);
      const radonColor = this._getRadonColor(radonBq);
      const radonUnit = this._getRadonUnit();
      const radonValueEl = this.shadowRoot.getElementById('radon-value');
      if (radonValueEl) {
        const displayVal = radonUnit === 'pCi/L' ? radonRaw.toFixed(1) : Math.round(radonRaw);
        radonValueEl.innerHTML = `${displayVal} <span class="unit">${radonUnit}</span><span class="status" id="radon-status"></span>`;
        const statusEl = radonValueEl.querySelector('.status');
        statusEl.textContent = radonBq < 48 ? 'Excellent' : radonBq < 100 ? 'Good' : radonBq < 148 ? 'Elevated' : radonBq < 300 ? 'High' : 'Dangerous';
        statusEl.style.background = radonColor + '22';
        statusEl.style.color = radonColor;
        radonValueEl.style.color = radonColor;
      }
    }

    // Update long-term radon
    if (this._config.radon_longterm_entity) {
      const ltRaw = this._getNumericState(this._config.radon_longterm_entity);
      const ltBq = this._getRadonBqm3(ltRaw);
      const ltColor = this._getRadonColor(ltBq);
      const radonUnit = this._getRadonUnit();
      const ltValueEl = this.shadowRoot.getElementById('radon-lt-value');
      if (ltValueEl) {
        const displayVal = radonUnit === 'pCi/L' ? ltRaw.toFixed(1) : Math.round(ltRaw);
        const statusText = ltBq < 48 ? 'Excellent' : ltBq < 100 ? 'Good' : ltBq < 148 ? 'Elevated' : ltBq < 300 ? 'High' : 'Dangerous';
        ltValueEl.innerHTML = `LT: ${displayVal} <span class="unit">${radonUnit}</span><span class="status">${statusText}</span>`;
        const statusEl = ltValueEl.querySelector('.status');
        statusEl.style.background = ltColor + '22';
        statusEl.style.color = ltColor;
        ltValueEl.style.color = ltColor;
      }
      // If no short-term radon entity, show long-term as the main value
      if (!this._config.radon_entity) {
        const radonValueEl = this.shadowRoot.getElementById('radon-value');
        if (radonValueEl) {
          const displayVal = radonUnit === 'pCi/L' ? ltRaw.toFixed(1) : Math.round(ltRaw);
          radonValueEl.innerHTML = `${displayVal} <span class="unit">${radonUnit}</span><span class="status" id="radon-status"></span>`;
          const statusEl = radonValueEl.querySelector('.status');
          const statusText = ltBq < 48 ? 'Excellent' : ltBq < 100 ? 'Good' : ltBq < 148 ? 'Elevated' : ltBq < 300 ? 'High' : 'Dangerous';
          statusEl.textContent = statusText;
          statusEl.style.background = ltColor + '22';
          statusEl.style.color = ltColor;
          radonValueEl.style.color = ltColor;
        }
      }
    }
  }

  // ============================================
  // GRAPH RENDERING
  // ============================================

  _renderGraphs() {
    this._graphData = {};

    // Helper: convert WAQI outdoor history data to raw concentration
    const convertHistory = (sensorType, data) => {
      const outdoorEntity = this._config[`outdoor_${sensorType}_entity`];
      if (!outdoorEntity || !this._isWaqiEntity(outdoorEntity) || sensorType === 'aqi') return data;
      return data.map(d => ({ time: d.time, value: this._aqiSubIndexToConcentration(d.value, sensorType) }));
    };

    // Helper: render a standard sensor graph with optional outdoor overlay
    const renderSensor = (sensorType, minVal, maxVal) => {
      const indoorKey = sensorType;
      const outdoorKey = `outdoor_${sensorType}`;
      const indoorEntity = sensorType === 'aqi' ? this._config.air_quality_entity : this._config[`${sensorType}_entity`];
      const outdoorEntity = this._config[`outdoor_${sensorType}_entity`];
      const colorFn = this._getColorFn(sensorType);
      const unit = this._getSensorUnit(sensorType);

      const hasIndoor = indoorEntity && this._history[indoorKey] && this._history[indoorKey].length;
      const hasOutdoor = outdoorEntity && this._history[outdoorKey] && this._history[outdoorKey].length;

      if (hasIndoor) {
        // Indoor as primary, outdoor as overlay (converted to raw concentration)
        const outdoorData = hasOutdoor ? convertHistory(sensorType, this._history[outdoorKey]) : [];
        this._renderGraph(sensorType, this._history[indoorKey], colorFn, minVal, maxVal, unit, outdoorData);
      } else if (hasOutdoor) {
        // Outdoor only: convert and render as primary (solid line)
        const convertedData = convertHistory(sensorType, this._history[outdoorKey]);
        this._renderGraph(sensorType, convertedData, colorFn, minVal, maxVal, unit, []);
      }
    };

    // AQI — stays on 0-500 scale (no conversion needed)
    if (this._config.air_quality_entity) {
      renderSensor('aqi', 0, 500);
    }

    // CO — always raw concentration scale (ppm)
    if (this._config.co_entity || this._config.outdoor_co_entity) {
      renderSensor('co', 0, 100);
    }

    // Radon (special)
    if ((this._config.radon_entity || this._config.radon_longterm_entity) && (this._history.radon.length || this._history.radon_longterm.length)) {
      const radonUnit = this._getRadonUnit();
      const radonMax = this._isRadonPciL() ? 10 : 370;
      const primaryData = this._history.radon.length ? this._history.radon : this._history.radon_longterm;
      const overlayData = this._config.radon_entity && this._config.radon_longterm_entity ? this._history.radon_longterm : [];
      this._renderGraph('radon', primaryData, (v) => this._getRadonColor(this._getRadonBqm3(v)), 0, radonMax, radonUnit, overlayData, 'Long-term');
    }

    // CO2
    if (this._config.co2_entity || this._config.outdoor_co2_entity) {
      renderSensor('co2', 400, 2000);
    }

    // PM2.5 — always raw concentration scale (μg/m³)
    if (this._config.pm25_entity || this._config.outdoor_pm25_entity) {
      renderSensor('pm25', 0, 60);
    }

    // PM10 — always raw concentration scale (μg/m³)
    if (this._config.pm10_entity || this._config.outdoor_pm10_entity) {
      renderSensor('pm10', 0, 200);
    }

    // PM1
    if (this._config.pm1_entity || this._config.outdoor_pm1_entity) {
      renderSensor('pm1', 0, 60);
    }

    // PM0.3
    if (this._config.pm03_entity || this._config.outdoor_pm03_entity) {
      renderSensor('pm03', 0, 5000);
    }

    // HCHO
    if (this._config.hcho_entity || this._config.outdoor_hcho_entity) {
      renderSensor('hcho', 0, 300);
    }

    // tVOC
    if (this._config.tvoc_entity || this._config.outdoor_tvoc_entity) {
      const tvocMax = this._isVOCIndex() ? 500 : 1500;
      renderSensor('tvoc', 0, tvocMax);
    }

    // PM4
    if (this._config.pm4_entity && this._history.pm4.length) {
      this._renderGraph('pm4', this._history.pm4, this._getPM4Color.bind(this), 0, 75, 'μg/m³');
    }

    // NOx
    if (this._config.nox_entity && this._history.nox.length) {
      this._renderGraph('nox', this._history.nox, this._getNOxColor.bind(this), 0, 300, 'ppb');
    }

    // NO2 — always raw concentration scale (ppb)
    if (this._config.no2_entity || this._config.outdoor_no2_entity) {
      renderSensor('no2', 0, 300);
    }

    // O3 — always raw concentration scale (ppb)
    if (this._config.o3_entity || this._config.outdoor_o3_entity) {
      renderSensor('o3', 0, 300);
    }

    // SO2 — always raw concentration scale (ppb)
    if (this._config.so2_entity || this._config.outdoor_so2_entity) {
      renderSensor('so2', 0, 500);
    }

    // Humidity
    if (this._config.humidity_entity || this._config.outdoor_humidity_entity) {
      renderSensor('humidity', 0, 100);
    }

    // Temperature
    if (this._config.temperature_entity || this._config.outdoor_temperature_entity) {
      const tempMin = this._isCelsius() ? 10 : 50;
      const tempMax = this._isCelsius() ? 32 : 90;
      renderSensor('temperature', tempMin, tempMax);
    }

    this._setupGraphInteractions();
  }

  _renderGraph(graphId, data, colorFn, minVal, maxVal, unit, outdoorData, outdoorLabel) {
    const svg = this.shadowRoot.getElementById(`${graphId}-svg`);
    const timeAxis = this.shadowRoot.getElementById(`${graphId}-time-axis`);
    if (!svg || !data.length) return;

    const width = 300;
    const height = 50;
    const padding = 2;

    // Include outdoor values in min/max calculation so both lines share the same scale
    const allValues = data.map(d => d.value);
    if (outdoorData && outdoorData.length) {
      allValues.push(...outdoorData.map(d => d.value));
    }
    const dataMin = Math.min(...allValues, minVal);
    const dataMax = Math.max(...allValues, maxVal);
    const range = dataMax - dataMin || 1;

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
      return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
    });

    // Map outdoor data to points using same coordinate system
    let outdoorPoints = [];
    if (outdoorData && outdoorData.length >= 2) {
      outdoorPoints = outdoorData.map((d, i) => {
        const x = padding + (i / (outdoorData.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((d.value - dataMin) / range) * (height - 2 * padding);
        return { x, y, value: d.value, time: d.time, color: colorFn(d.value) };
      });
    }

    this._graphData[graphId] = { points, outdoorPoints, unit, colorFn, outdoorLabel: outdoorLabel || 'Outdoor' };

    if (points.length < 2) return;

    const ts = Date.now();
    const gradientId = `gradient-${graphId}-${ts}`;
    let gradientStops = '';
    for (let i = 0; i < points.length; i++) {
      const pct = (i / (points.length - 1)) * 100;
      gradientStops += `<stop offset="${pct}%" style="stop-color:${points[i].color}" />`;
    }

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }

    const areaPath = linePath + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
    const fillGradientId = `fill-${graphId}-${ts}`;

    // Build outdoor dashed line SVG if data exists
    let outdoorSvg = '';
    if (outdoorPoints.length >= 2) {
      const outdoorGradientId = `outdoor-gradient-${graphId}-${ts}`;
      let outdoorGradientStops = '';
      for (let i = 0; i < outdoorPoints.length; i++) {
        const pct = (i / (outdoorPoints.length - 1)) * 100;
        outdoorGradientStops += `<stop offset="${pct}%" style="stop-color:${outdoorPoints[i].color}" />`;
      }
      let outdoorLinePath = `M ${outdoorPoints[0].x} ${outdoorPoints[0].y}`;
      for (let i = 1; i < outdoorPoints.length; i++) {
        outdoorLinePath += ` L ${outdoorPoints[i].x} ${outdoorPoints[i].y}`;
      }
      outdoorSvg = `
        <linearGradient id="${outdoorGradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
          ${outdoorGradientStops}
        </linearGradient>
      `;
      // The outdoor path is appended after the main line
      outdoorSvg += `</defs>
      <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${fillGradientId})" mask="url(#mask-${graphId})" style="color: url(#${gradientId})" />
      <path d="${linePath}" stroke="url(#${gradientId})" class="graph-line" fill="none" />
      <path d="${outdoorLinePath}" stroke="url(#${outdoorGradientId})" class="graph-line" fill="none" stroke-dasharray="4 3" opacity="0.5" />`;
    }

    if (outdoorPoints.length >= 2) {
      svg.innerHTML = `
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops}
          </linearGradient>
          <linearGradient id="${fillGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:currentColor;stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:currentColor;stop-opacity:0.02" />
          </linearGradient>
          <mask id="mask-${graphId}">
            <path d="${areaPath}" fill="white" />
          </mask>
          ${outdoorSvg}
      `;
    } else {
      svg.innerHTML = `
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="0%">
            ${gradientStops}
          </linearGradient>
          <linearGradient id="${fillGradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:currentColor;stop-opacity:0.2" />
            <stop offset="100%" style="stop-color:currentColor;stop-opacity:0.02" />
          </linearGradient>
          <mask id="mask-${graphId}">
            <path d="${areaPath}" fill="white" />
          </mask>
        </defs>
        <rect x="0" y="0" width="${width}" height="${height}" fill="url(#${fillGradientId})" mask="url(#mask-${graphId})" style="color: url(#${gradientId})" />
        <path d="${linePath}" stroke="url(#${gradientId})" class="graph-line" fill="none" />
      `;
    }

    if (timeAxis && points.length > 0) {
      const startTime = new Date(points[0].time);
      const endTime = new Date(points[points.length - 1].time);
      const midTime = new Date((startTime.getTime() + endTime.getTime()) / 2);

      const formatTime = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      timeAxis.innerHTML = `
        <span>${formatTime(startTime)}</span>
        <span>${formatTime(midTime)}</span>
        <span>${formatTime(endTime)}</span>
      `;
    }
  }

  // ============================================
  // GRAPH INTERACTIONS
  // ============================================

  _setupGraphInteractions() {
    // All graph IDs that could be present
    const allGraphIds = ['aqi', 'co', 'radon', 'co2', 'pm25', 'pm10', 'pm1', 'pm03', 'pm4', 'hcho', 'tvoc', 'nox', 'no2', 'o3', 'so2', 'humidity', 'temperature'];

    const graphIds = allGraphIds.filter(id => {
      if (id === 'radon') return this._config.radon_entity || this._config.radon_longterm_entity;
      if (id === 'aqi') return !!this._config.air_quality_entity;
      // Check both indoor and outdoor
      return this._config[`${id}_entity`] || this._config[`outdoor_${id}_entity`];
    });

    graphIds.forEach(graphId => {
      const container = this.shadowRoot.getElementById(`${graphId}-graph-container`);
      const graphEl = this.shadowRoot.getElementById(`${graphId}-graph`);
      const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
      const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);

      if (!container || !graphEl || !cursor || !tooltip) return;

      const entityId = container.dataset.entity;

      container.addEventListener('click', (e) => {
        if (this._isDragging) {
          this._isDragging = false;
          return;
        }
        const event = new CustomEvent('hass-more-info', {
          bubbles: true,
          composed: true,
          detail: { entityId }
        });
        this.dispatchEvent(event);
      });

      graphEl.addEventListener('mouseenter', () => this._showCursor(graphId));
      graphEl.addEventListener('mouseleave', () => this._hideCursor(graphId));
      graphEl.addEventListener('mousemove', (e) => this._updateCursor(graphId, e));

      let touchTimeout;
      graphEl.addEventListener('touchstart', (e) => {
        touchTimeout = setTimeout(() => {
          this._isDragging = true;
          this._showCursor(graphId);
          this._updateCursor(graphId, e.touches[0]);
        }, 200);
      }, { passive: true });

      graphEl.addEventListener('touchmove', (e) => {
        if (this._isDragging) {
          e.preventDefault();
          this._updateCursor(graphId, e.touches[0]);
        }
      }, { passive: false });

      graphEl.addEventListener('touchend', () => {
        clearTimeout(touchTimeout);
        if (this._isDragging) {
          setTimeout(() => this._hideCursor(graphId), 1000);
        }
      });
    });
  }

  _showCursor(graphId) {
    const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
    const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);
    if (cursor) cursor.style.display = 'block';
    if (tooltip) tooltip.style.display = 'block';
  }

  _hideCursor(graphId) {
    const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
    const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);
    if (cursor) cursor.style.display = 'none';
    if (tooltip) tooltip.style.display = 'none';
  }

  _updateCursor(graphId, event) {
    const graphEl = this.shadowRoot.getElementById(`${graphId}-graph`);
    const cursor = this.shadowRoot.getElementById(`${graphId}-cursor`);
    const tooltip = this.shadowRoot.getElementById(`${graphId}-tooltip`);
    const data = this._graphData[graphId];

    if (!graphEl || !cursor || !tooltip || !data || !data.points.length) return;

    const rect = graphEl.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));

    const targetX = pct * 300;
    let closest = data.points[0];
    let minDist = Math.abs(closest.x - targetX);

    for (const point of data.points) {
      const dist = Math.abs(point.x - targetX);
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    }

    cursor.style.left = `${pct * 100}%`;
    cursor.style.background = closest.color;
    cursor.style.setProperty('--cursor-color', closest.color);

    const valueEl = tooltip.querySelector('.graph-tooltip-value');
    const outdoorEl = tooltip.querySelector('.graph-tooltip-outdoor');
    const timeEl = tooltip.querySelector('.graph-tooltip-time');

    const formatVal = (val) => {
      if (data.unit === 'ppm' || data.unit === 'ppb' || data.unit === 'p/0.1L' || data.unit === 'Bq/m³' || data.unit === 'AQI' || data.unit === '') return Math.round(val);
      if (data.unit === '%' || data.unit === '°F' || data.unit === '°C') return Math.round(val);
      if (data.unit === 'pCi/L') return val.toFixed(1);
      return val.toFixed(1);
    };

    if (valueEl) {
      valueEl.textContent = `${formatVal(closest.value)} ${data.unit}`;
      valueEl.style.color = closest.color;
    }

    // Show outdoor value in tooltip if available
    if (outdoorEl) {
      if (data.outdoorPoints && data.outdoorPoints.length) {
        let closestOutdoor = data.outdoorPoints[0];
        let minOutdoorDist = Math.abs(closestOutdoor.x - targetX);
        for (const point of data.outdoorPoints) {
          const dist = Math.abs(point.x - targetX);
          if (dist < minOutdoorDist) {
            minOutdoorDist = dist;
            closestOutdoor = point;
          }
        }
        outdoorEl.textContent = `${data.outdoorLabel}: ${formatVal(closestOutdoor.value)} ${data.unit}`;
        outdoorEl.style.color = closestOutdoor.color;
        outdoorEl.style.display = 'block';
      } else {
        outdoorEl.style.display = 'none';
      }
    }

    if (timeEl && closest.time) {
      const time = new Date(closest.time);
      timeEl.textContent = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    let tooltipX = pct * 100;
    if (tooltipX < 12) tooltipX = 12;
    if (tooltipX > 88) tooltipX = 88;
    tooltip.style.left = `${tooltipX}%`;
  }
}

// Register the card
customElements.define('air-quality-card', AirQualityCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'air-quality-card',
  name: 'Air Quality Card',
  description: 'A custom card for air quality monitoring with WHO-based thresholds, gradient graphs, and WAQI integration',
  preview: true,
  documentationURL: 'https://github.com/KadenThomp36/air-quality-card'
});

console.info(
  `%c AIR-QUALITY-CARD %c v${CARD_VERSION} `,
  'color: white; background: #4caf50; font-weight: bold;',
  'color: #4caf50; background: white; font-weight: bold;'
);

// ============================================
// VISUAL CONFIGURATION EDITOR
// Uses ha-form with expandable sections via getConfigElement
// ============================================

const LitElement = Object.getPrototypeOf(
  customElements.get("hui-masonry-view") || customElements.get("hui-view")
);
const html = LitElement?.prototype?.html;
const css = LitElement?.prototype?.css;

if (LitElement && !customElements.get('air-quality-card-editor')) {
  class AirQualityCardEditor extends LitElement {
    static get properties() {
      return {
        hass: { type: Object },
        _config: { type: Object }
      };
    }

    setConfig(config) {
      this._config = {
        name: 'Air Quality',
        hours_to_show: 24,
        temperature_unit: 'auto',
        radon_unit: 'auto',
        ...config
      };
    }

    _computeLabel(schema) {
      const labels = {
        name: 'Card Name',
        waqi_device: 'WAQI Device (auto-discovers outdoor sensors)',
        co2_entity: 'CO₂ Sensor',
        pm25_entity: 'PM2.5 Sensor',
        humidity_entity: 'Humidity Sensor',
        temperature_entity: 'Temperature Sensor',
        radon_entity: 'Radon Sensor',
        radon_longterm_entity: 'Radon Long-Term Sensor',
        co_entity: 'CO (Carbon Monoxide) Sensor',
        hcho_entity: 'Formaldehyde (HCHO) Sensor',
        tvoc_entity: 'tVOC Sensor',
        pm4_entity: 'PM4 Sensor',
        nox_entity: 'NOx Sensor',
        no2_entity: 'NO₂ (Nitrogen Dioxide) Sensor',
        o3_entity: 'O₃ (Ozone) Sensor',
        so2_entity: 'SO₂ (Sulphur Dioxide) Sensor',
        pm1_entity: 'PM1 Sensor',
        pm10_entity: 'PM10 Sensor',
        pm03_entity: 'PM0.3 Sensor',
        outdoor_co2_entity: 'Outdoor CO₂',
        outdoor_pm25_entity: 'Outdoor PM2.5',
        outdoor_humidity_entity: 'Outdoor Humidity',
        outdoor_temperature_entity: 'Outdoor Temperature',
        outdoor_co_entity: 'Outdoor CO',
        outdoor_hcho_entity: 'Outdoor HCHO',
        outdoor_tvoc_entity: 'Outdoor tVOC',
        outdoor_no2_entity: 'Outdoor NO₂',
        outdoor_o3_entity: 'Outdoor O₃',
        outdoor_so2_entity: 'Outdoor SO₂',
        outdoor_pm1_entity: 'Outdoor PM1',
        outdoor_pm10_entity: 'Outdoor PM10',
        outdoor_pm03_entity: 'Outdoor PM0.3',
        air_quality_entity: 'Air Quality Index (optional)',
        hours_to_show: 'Graph History',
        temperature_unit: 'Temperature Unit',
        radon_unit: 'Radon Unit',
        tvoc_unit: 'tVOC Measurement Type'
      };
      return labels[schema.name] || schema.name;
    }

    _schema() {
      return [
        { name: 'name', selector: { text: {} } },
        {
          type: 'expandable',
          title: 'WAQI Integration',
          flatten: true,
          schema: [
            { name: 'waqi_device', selector: { device: { integration: 'waqi' } } },
          ]
        },
        {
          type: 'grid',
          schema: [
            { name: 'co2_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_dioxide' }] } } },
            { name: 'pm25_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm25' }] } } },
          ]
        },
        {
          type: 'grid',
          schema: [
            { name: 'humidity_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'humidity' }] } } },
            { name: 'temperature_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'temperature' }] } } },
          ]
        },
        {
          type: 'expandable',
          title: 'Additional Sensors',
          flatten: true,
          schema: [
            {
              type: 'grid',
              schema: [
                { name: 'radon_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'radon_longterm_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'co_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_monoxide' }] } } },
                { name: 'hcho_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'tvoc_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'pm4_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'nox_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'pm1_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm1' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'pm10_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm10' }] } } },
                { name: 'pm03_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'no2_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'o3_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'so2_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
          ]
        },
        {
          type: 'expandable',
          title: 'Outdoor Sensors',
          flatten: true,
          schema: [
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_co2_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_dioxide' }] } } },
                { name: 'outdoor_pm25_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm25' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_humidity_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'humidity' }] } } },
                { name: 'outdoor_temperature_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'temperature' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_co_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'carbon_monoxide' }] } } },
                { name: 'outdoor_hcho_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_tvoc_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'outdoor_pm1_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm1' }] } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_pm10_entity', selector: { entity: { filter: [{ domain: 'sensor', device_class: 'pm10' }] } } },
                { name: 'outdoor_pm03_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_no2_entity', selector: { entity: { domain: 'sensor' } } },
                { name: 'outdoor_o3_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
            {
              type: 'grid',
              schema: [
                { name: 'outdoor_so2_entity', selector: { entity: { domain: 'sensor' } } },
              ]
            },
          ]
        },
        {
          type: 'expandable',
          title: 'Advanced',
          flatten: true,
          schema: [
            { name: 'air_quality_entity', selector: { entity: { domain: 'sensor' } } },
            { name: 'hours_to_show', selector: { number: { min: 1, max: 168, mode: 'box', unit_of_measurement: 'hours' } } },
            { name: 'temperature_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from HA)' }, { value: 'F', label: 'Fahrenheit (°F)' }, { value: 'C', label: 'Celsius (°C)' }], mode: 'dropdown' } } },
            { name: 'radon_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto (from sensor)' }, { value: 'pCi/L', label: 'pCi/L (US)' }, { value: 'Bq/m³', label: 'Bq/m³ (International)' }], mode: 'dropdown' } } },
            { name: 'tvoc_unit', selector: { select: { options: [{ value: 'auto', label: 'Auto-detect' }, { value: 'ppb', label: 'Absolute (ppb)' }, { value: 'index', label: 'VOC Index (Sensirion)' }], mode: 'dropdown' } } },
          ]
        }
      ];
    }

    render() {
      if (!this._config) return html``;

      return html`
        <div class="card-config">
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${this._schema()}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>
      `;
    }

    _valueChanged(ev) {
      const newConfig = { type: 'custom:air-quality-card', ...ev.detail.value };
      this.dispatchEvent(new CustomEvent('config-changed', {
        detail: { config: newConfig },
        bubbles: true,
        composed: true
      }));
    }

    static get styles() {
      return css`
        .card-config {
          padding: 16px;
        }
      `;
    }
  }

  customElements.define('air-quality-card-editor', AirQualityCardEditor);
}

