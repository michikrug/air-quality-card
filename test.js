/**
 * Air Quality Card v3.0.0 — Unit Tests
 * Run with: node test.js
 *
 * Tests color functions, recommendation waterfall, config validation,
 * overall status logic, WAQI integration, outdoor-only display,
 * and new sensor types (NO2, O3, SO2, AQI).
 */

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

function section(name) {
  console.log(`\n--- ${name} ---`);
}

// ============================================================
// Extract the class methods by evaluating in a mock DOM context
// ============================================================

// Minimal mock for HTMLElement and customElements
class MockHTMLElement {
  constructor() { this._shadowRoot = {}; }
  attachShadow() { return {}; }
  dispatchEvent() {}
}

// Mock LitElement base for the editor
class MockLitElementBase {
  static get properties() { return {}; }
  static get styles() { return ''; }
  render() { return ''; }
}
MockLitElementBase.prototype.html = (strings, ...values) => strings.join('');
MockLitElementBase.prototype.css = (strings, ...values) => strings.join('');
class MockHuiView extends MockLitElementBase {}

const registeredElements = {};
const mockCustomElements = {
  define(name, cls) { registeredElements[name] = cls; },
  get(name) {
    if (name === 'hui-masonry-view' || name === 'hui-view') return MockHuiView;
    return registeredElements[name];
  }
};

// Patch globals
global.HTMLElement = MockHTMLElement;
global.customElements = mockCustomElements;
global.window = { customCards: [] };
global.document = { createElement: () => ({}) };
global.CustomEvent = class CustomEvent {};
global.console = { ...console, info: () => {} }; // suppress banner

// Load the card
require('./air-quality-card.js');

const CardClass = registeredElements['air-quality-card'];
if (!CardClass) {
  console.error('FATAL: AirQualityCard class not registered');
  process.exit(1);
}

// Create instance with mock hass for method testing
const card = new CardClass();
card._hass = {
  config: { unit_system: { temperature: '°F' } },
  states: {},
  entities: {},
  callApi: async () => []
};
card._config = {
  name: 'Test',
  hours_to_show: 24,
  temperature_unit: 'auto'
};

// ============================================================
// COLOR FUNCTION TESTS
// ============================================================

section('CO2 Color');
assert(card._getCO2Color(400) === '#4caf50', 'CO2 400 = green');
assert(card._getCO2Color(700) === '#8bc34a', 'CO2 700 = light green');
assert(card._getCO2Color(900) === '#ffc107', 'CO2 900 = yellow');
assert(card._getCO2Color(1200) === '#ff9800', 'CO2 1200 = orange');
assert(card._getCO2Color(2000) === '#f44336', 'CO2 2000 = red');

section('PM2.5 Color');
assert(card._getPM25Color(3) === '#4caf50', 'PM25 3 = green');
assert(card._getPM25Color(10) === '#8bc34a', 'PM25 10 = light green');
assert(card._getPM25Color(20) === '#ffc107', 'PM25 20 = yellow');
assert(card._getPM25Color(30) === '#ff9800', 'PM25 30 = orange');
assert(card._getPM25Color(50) === '#f44336', 'PM25 50 = red');

section('PM1 Color');
assert(card._getPM1Color(3) === '#4caf50', 'PM1 3 = green');
assert(card._getPM1Color(10) === '#8bc34a', 'PM1 10 = light green');
assert(card._getPM1Color(20) === '#ffc107', 'PM1 20 = yellow');
assert(card._getPM1Color(30) === '#ff9800', 'PM1 30 = orange');
assert(card._getPM1Color(40) === '#f44336', 'PM1 40 = red');

section('PM10 Color');
assert(card._getPM10Color(10) === '#4caf50', 'PM10 10 = green');
assert(card._getPM10Color(30) === '#8bc34a', 'PM10 30 = light green');
assert(card._getPM10Color(60) === '#ffc107', 'PM10 60 = yellow');
assert(card._getPM10Color(100) === '#ff9800', 'PM10 100 = orange');
assert(card._getPM10Color(200) === '#f44336', 'PM10 200 = red');

section('PM0.3 Color');
assert(card._getPM03Color(200) === '#4caf50', 'PM03 200 = green');
assert(card._getPM03Color(800) === '#8bc34a', 'PM03 800 = light green');
assert(card._getPM03Color(2000) === '#ffc107', 'PM03 2000 = yellow');
assert(card._getPM03Color(4000) === '#ff9800', 'PM03 4000 = orange');
assert(card._getPM03Color(6000) === '#f44336', 'PM03 6000 = red');

section('CO Color');
assert(card._getCOColor(2) === '#4caf50', 'CO 2 = green');
assert(card._getCOColor(6) === '#8bc34a', 'CO 6 = light green');
assert(card._getCOColor(20) === '#ffc107', 'CO 20 = yellow');
assert(card._getCOColor(50) === '#ff9800', 'CO 50 = orange');
assert(card._getCOColor(150) === '#f44336', 'CO 150 = red');

section('Radon Color (Bq/m³)');
assert(card._getRadonColor(30) === '#4caf50', 'Radon 30 Bq = green');
assert(card._getRadonColor(80) === '#8bc34a', 'Radon 80 Bq = light green');
assert(card._getRadonColor(120) === '#ffc107', 'Radon 120 Bq = yellow');
assert(card._getRadonColor(200) === '#ff9800', 'Radon 200 Bq = orange');
assert(card._getRadonColor(400) === '#f44336', 'Radon 400 Bq = red');

section('HCHO Color');
assert(card._getHCHOColor(10) === '#4caf50', 'HCHO 10 = green');
assert(card._getHCHOColor(30) === '#8bc34a', 'HCHO 30 = light green');
assert(card._getHCHOColor(80) === '#ffc107', 'HCHO 80 = yellow');
assert(card._getHCHOColor(150) === '#ff9800', 'HCHO 150 = orange');
assert(card._getHCHOColor(300) === '#f44336', 'HCHO 300 = red');

section('tVOC Color');
assert(card._getTVOCColor(50) === '#4caf50', 'tVOC 50 = green');
assert(card._getTVOCColor(200) === '#8bc34a', 'tVOC 200 = light green');
assert(card._getTVOCColor(400) === '#ffc107', 'tVOC 400 = yellow');
assert(card._getTVOCColor(800) === '#ff9800', 'tVOC 800 = orange');
assert(card._getTVOCColor(1500) === '#f44336', 'tVOC 1500 = red');

section('Humidity Color');
assert(card._getHumidityColor(20) === '#ff9800', 'Humidity 20 = orange (too dry)');
assert(card._getHumidityColor(35) === '#8bc34a', 'Humidity 35 = light green');
assert(card._getHumidityColor(45) === '#4caf50', 'Humidity 45 = green (ideal)');
assert(card._getHumidityColor(55) === '#8bc34a', 'Humidity 55 = light green');
assert(card._getHumidityColor(70) === '#ff9800', 'Humidity 70 = orange (too humid)');

section('Temperature Color (Fahrenheit)');
card._config.temperature_unit = 'F';
assert(card._getTempColor(60) === '#2196f3', 'Temp 60F = blue');
assert(card._getTempColor(66) === '#03a9f4', 'Temp 66F = light blue');
assert(card._getTempColor(70) === '#4caf50', 'Temp 70F = green');
assert(card._getTempColor(74) === '#ff9800', 'Temp 74F = orange');
assert(card._getTempColor(80) === '#f44336', 'Temp 80F = red');

section('Temperature Color (Celsius)');
card._config.temperature_unit = 'C';
assert(card._getTempColor(15) === '#2196f3', 'Temp 15C = blue');
assert(card._getTempColor(19) === '#03a9f4', 'Temp 19C = light blue');
assert(card._getTempColor(21) === '#4caf50', 'Temp 21C = green');
assert(card._getTempColor(23) === '#ff9800', 'Temp 23C = orange');
assert(card._getTempColor(28) === '#f44336', 'Temp 28C = red');

// ============================================================
// NEW COLOR FUNCTION TESTS: AQI, NO2, O3, SO2
// ============================================================

section('AQI Color');
assert(card._getAQIColor(30) === '#4caf50', 'AQI 30 = green (good)');
assert(card._getAQIColor(50) === '#4caf50', 'AQI 50 = green (good boundary)');
assert(card._getAQIColor(75) === '#8bc34a', 'AQI 75 = light green (moderate)');
assert(card._getAQIColor(120) === '#ffc107', 'AQI 120 = yellow (USG)');
assert(card._getAQIColor(180) === '#ff9800', 'AQI 180 = orange (unhealthy)');
assert(card._getAQIColor(250) === '#f44336', 'AQI 250 = red (very unhealthy)');
assert(card._getAQIColor(400) === '#b71c1c', 'AQI 400 = dark red (hazardous)');

section('AQI Status');
assert(card._getAQIStatus(30) === 'Good', 'AQI 30 status = Good');
assert(card._getAQIStatus(75) === 'Moderate', 'AQI 75 status = Moderate');
assert(card._getAQIStatus(120) === 'USG', 'AQI 120 status = USG');
assert(card._getAQIStatus(180) === 'Unhealthy', 'AQI 180 status = Unhealthy');
assert(card._getAQIStatus(250) === 'Very Unhealthy', 'AQI 250 status = Very Unhealthy');
assert(card._getAQIStatus(400) === 'Hazardous', 'AQI 400 status = Hazardous');

section('NO2 Color');
assert(card._getNO2Color(10) === '#4caf50', 'NO2 10 = green');
assert(card._getNO2Color(30) === '#8bc34a', 'NO2 30 = light green');
assert(card._getNO2Color(80) === '#ffc107', 'NO2 80 = yellow');
assert(card._getNO2Color(150) === '#ff9800', 'NO2 150 = orange');
assert(card._getNO2Color(300) === '#f44336', 'NO2 300 = red');

section('O3 Color');
assert(card._getO3Color(30) === '#4caf50', 'O3 30 = green');
assert(card._getO3Color(70) === '#8bc34a', 'O3 70 = light green');
assert(card._getO3Color(115) === '#ffc107', 'O3 115 = yellow');
assert(card._getO3Color(160) === '#ff9800', 'O3 160 = orange');
assert(card._getO3Color(250) === '#f44336', 'O3 250 = red');

section('SO2 Color');
assert(card._getSO2Color(10) === '#4caf50', 'SO2 10 = green');
assert(card._getSO2Color(40) === '#8bc34a', 'SO2 40 = light green');
assert(card._getSO2Color(100) === '#ffc107', 'SO2 100 = yellow');
assert(card._getSO2Color(250) === '#ff9800', 'SO2 250 = orange');
assert(card._getSO2Color(400) === '#f44336', 'SO2 400 = red');

section('AQI Sub-Index Color');
assert(card._getAQISubIndexColor(30) === '#4caf50', 'Sub-index 30 = green');
assert(card._getAQISubIndexColor(75) === '#8bc34a', 'Sub-index 75 = light green');
assert(card._getAQISubIndexColor(120) === '#ffc107', 'Sub-index 120 = yellow');
assert(card._getAQISubIndexColor(180) === '#ff9800', 'Sub-index 180 = orange');
assert(card._getAQISubIndexColor(250) === '#f44336', 'Sub-index 250 = red');
assert(card._getAQISubIndexColor(400) === '#b71c1c', 'Sub-index 400 = dark red');

section('AQI Sub-Index Status');
assert(card._getAQISubIndexStatus(30) === 'Good', 'Sub-index 30 = Good');
assert(card._getAQISubIndexStatus(75) === 'Moderate', 'Sub-index 75 = Moderate');
assert(card._getAQISubIndexStatus(120) === 'USG', 'Sub-index 120 = USG');
assert(card._getAQISubIndexStatus(180) === 'Unhealthy', 'Sub-index 180 = Unhealthy');
assert(card._getAQISubIndexStatus(250) === 'Very Unhealthy', 'Sub-index 250 = Very Unhealthy');
assert(card._getAQISubIndexStatus(400) === 'Hazardous', 'Sub-index 400 = Hazardous');

// ============================================================
// RECOMMENDATION WATERFALL TESTS
// ============================================================

// Helper to set up hass states for recommendation testing
function setStates(states) {
  card._hass.states = {};
  card._hass.entities = {};
  card._config = {
    name: 'Test',
    hours_to_show: 24,
    temperature_unit: 'auto'
  };
  for (const [key, value] of Object.entries(states)) {
    const entityId = `sensor.${key}`;
    card._config[`${key}_entity`] = entityId;
    card._hass.states[entityId] = { state: String(value) };
  }
}

section('Recommendation — CO Safety (highest priority)');
setStates({ co: 150, co2: 2000, pm25: 50 });
assert(card._getRecommendation() === 'CO Danger — Leave Area', 'CO > 100 = CO Danger even with high CO2/PM25');

setStates({ co: 50, co2: 2000 });
assert(card._getRecommendation() === 'CO Warning — Ventilate Now', 'CO > 35 = CO Warning');

setStates({ co: 15 });
assert(card._getRecommendation() === 'CO Elevated — Ventilate', 'CO > 9 = CO Elevated');

setStates({ co: 3 });
assert(card._getRecommendation() === 'All Good', 'CO 3 = All Good');

section('Recommendation — CO not suppressed by outdoor override');
setStates({ co: 150 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_co2'] = { state: '5000' };
card._hass.states['sensor.outdoor_pm25'] = { state: '100' };
assert(card._getRecommendation() === 'CO Danger — Leave Area', 'CO Danger not suppressed by outdoor override');

section('Recommendation — Standard waterfall');
setStates({ co2: 1800 });
assert(card._getRecommendation() === 'Ventilate Now', 'CO2 1800 = Ventilate Now');

setStates({ pm25: 40 });
assert(card._getRecommendation() === 'Run Air Purifier', 'PM25 40 = Run Air Purifier');

setStates({ pm10: 160 });
assert(card._getRecommendation() === 'Run Air Purifier', 'PM10 160 = Run Air Purifier');

setStates({ hcho: 150 });
assert(card._getRecommendation() === 'Ventilate — Formaldehyde', 'HCHO 150 = Ventilate Formaldehyde');

setStates({ tvoc: 600 });
assert(card._getRecommendation() === 'Ventilate — VOCs Elevated', 'tVOC 600 = Ventilate VOCs');

setStates({ pm25: 30, co2: 1100 });
assert(card._getRecommendation() === 'Air Purifier + Ventilate', 'PM25 30 + CO2 1100 = combo');

setStates({ pm25: 30 });
assert(card._getRecommendation() === 'Run Air Purifier', 'PM25 30 alone = Run Air Purifier');

setStates({ pm10: 100 });
assert(card._getRecommendation() === 'Consider Air Purifier', 'PM10 100 = Consider Air Purifier');

setStates({ co2: 1100 });
assert(card._getRecommendation() === 'Open Window', 'CO2 1100 = Open Window');

setStates({ humidity: 25 });
assert(card._getRecommendation() === 'Too Dry', 'Humidity 25 = Too Dry');

setStates({ humidity: 70 });
assert(card._getRecommendation() === 'Too Humid', 'Humidity 70 = Too Humid');

setStates({ co2: 850 });
assert(card._getRecommendation() === 'Consider Ventilating', 'CO2 850 = Consider Ventilating');

setStates({ pm25: 20 });
assert(card._getRecommendation() === 'Consider Ventilating', 'PM25 20 = Consider Ventilating');

setStates({ co2: 400, pm25: 3 });
assert(card._getRecommendation() === 'All Good', 'Low CO2 + PM25 = All Good');

section('Recommendation — Outdoor override');
setStates({ co2: 1100 });
card._config.outdoor_co2_entity = 'sensor.outdoor_co2';
card._hass.states['sensor.outdoor_co2'] = { state: '1500' };
assert(card._getRecommendation() === 'Keep Windows Closed', 'Open Window suppressed when outdoor CO2 worse');

setStates({ pm25: 30, co2: 1100 });
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
card._hass.states['sensor.outdoor_pm25'] = { state: '50' };
assert(card._getRecommendation() === 'Run Air Purifier', 'Combo rec falls back to purifier when outdoor worse');

section('Recommendation — AQI-based outdoor advisory');
setStates({ co2: 400, pm25: 3 });
card._config.air_quality_entity = 'sensor.aqi';
card._hass.states['sensor.aqi'] = { state: '175' };
assert(card._getRecommendation() === 'Limit Outdoor Exposure', 'AQI > 150 = Limit Outdoor Exposure');

setStates({ co2: 400, pm25: 3 });
card._config.air_quality_entity = 'sensor.aqi';
card._hass.states['sensor.aqi'] = { state: '50' };
assert(card._getRecommendation() === 'All Good', 'AQI 50 = All Good (no outdoor limit)');

// AQI does not override CO safety
setStates({ co: 150 });
card._config.air_quality_entity = 'sensor.aqi';
card._hass.states['sensor.aqi'] = { state: '300' };
assert(card._getRecommendation() === 'CO Danger — Leave Area', 'CO Danger takes priority over AQI');

// ============================================================
// RECOMMENDATION ICON TESTS
// ============================================================

section('Recommendation Icons');
assert(card._getRecommendationIcon('All Good') === 'mdi:check-circle', 'All Good icon');
assert(card._getRecommendationIcon('CO Danger — Leave Area') === 'mdi:alert-octagon', 'CO Danger icon');
assert(card._getRecommendationIcon('CO Warning — Ventilate Now') === 'mdi:alert-octagon', 'CO Warning icon');
assert(card._getRecommendationIcon('CO Elevated — Ventilate') === 'mdi:alert', 'CO Elevated icon');
assert(card._getRecommendationIcon('Consider Air Purifier') === 'mdi:air-purifier', 'Consider Air Purifier icon');
assert(card._getRecommendationIcon('Run Air Purifier') === 'mdi:air-purifier', 'Run Air Purifier icon');
assert(card._getRecommendationIcon('Open Window') === 'mdi:window-open-variant', 'Open Window icon');
assert(card._getRecommendationIcon('Keep Windows Closed') === 'mdi:window-closed-variant', 'Keep Windows Closed icon');
assert(card._getRecommendationIcon('Limit Outdoor Exposure') === 'mdi:shield-alert', 'Limit Outdoor Exposure icon');

// ============================================================
// CONFIG VALIDATION TESTS
// ============================================================

section('Config Validation');

// Should throw with no entities
let threw = false;
try { card.setConfig({}); } catch (e) { threw = true; }
assert(threw, 'Empty config throws');

// Should accept any single sensor
const singleSensorConfigs = [
  'co2_entity', 'pm25_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
  'hcho_entity', 'tvoc_entity', 'co_entity', 'radon_entity', 'humidity_entity', 'temperature_entity',
  'no2_entity', 'o3_entity', 'so2_entity', 'air_quality_entity'
];
for (const key of singleSensorConfigs) {
  let ok = true;
  try { card.setConfig({ [key]: 'sensor.test' }); } catch (e) { ok = false; }
  assert(ok, `Single ${key} accepted`);
}

section('Config Validation — Outdoor-only');

// Should accept outdoor-only entities
const outdoorOnlyConfigs = [
  'outdoor_co2_entity', 'outdoor_pm25_entity', 'outdoor_pm1_entity', 'outdoor_pm10_entity',
  'outdoor_co_entity', 'outdoor_no2_entity', 'outdoor_o3_entity', 'outdoor_so2_entity',
  'outdoor_humidity_entity', 'outdoor_temperature_entity'
];
for (const key of outdoorOnlyConfigs) {
  let ok = true;
  try { card.setConfig({ [key]: 'sensor.test' }); } catch (e) { ok = false; }
  assert(ok, `Outdoor-only ${key} accepted`);
}

section('Config Validation — WAQI device');
let waqiOk = true;
try { card.setConfig({ waqi_device: 'abc123' }); } catch (e) { waqiOk = false; }
assert(waqiOk, 'waqi_device alone is valid config');

// Defaults
card.setConfig({ co2_entity: 'sensor.co2' });
assert(card._config.name === 'Air Quality', 'Default name');
assert(card._config.hours_to_show === 24, 'Default hours_to_show');
assert(card._config.temperature_unit === 'auto', 'Default temperature_unit is auto');
assert(card._config.radon_unit === 'auto', 'Default radon_unit is auto');

// ============================================================
// OVERALL STATUS TESTS
// ============================================================

section('Overall Status');

setStates({ co: 50 });
assert(card._getOverallStatus().status === 'Dangerous', 'CO 50 = Dangerous');
assert(card._getOverallStatus().color === '#d32f2f', 'CO 50 = dark red');

setStates({ co: 15 });
assert(card._getOverallStatus().status === 'Poor', 'CO 15 = Poor');

setStates({ co2: 2000 });
assert(card._getOverallStatus().status === 'Poor', 'CO2 2000 = Poor');

setStates({ co2: 1200 });
assert(card._getOverallStatus().status === 'Fair', 'CO2 1200 = Fair');

setStates({ co2: 900 });
assert(card._getOverallStatus().status === 'Moderate', 'CO2 900 = Moderate');

setStates({ co2: 700 });
assert(card._getOverallStatus().status === 'Good', 'CO2 700 = Good');

setStates({ co2: 400 });
assert(card._getOverallStatus().status === 'Excellent', 'CO2 400 = Excellent');

section('Overall Status — AQI entity (numeric)');
setStates({});
card._config.air_quality_entity = 'sensor.aqi';
card._hass.states['sensor.aqi'] = { state: '42' };
const aqiStatus = card._getOverallStatus();
assert(aqiStatus.status === 'Good', 'AQI 42 = Good status');
assert(aqiStatus.color === '#4caf50', 'AQI 42 = green');

card._hass.states['sensor.aqi'] = { state: '155' };
assert(card._getOverallStatus().status === 'Unhealthy', 'AQI 155 = Unhealthy status');

card._hass.states['sensor.aqi'] = { state: '275' };
assert(card._getOverallStatus().status === 'Very Unhealthy', 'AQI 275 = Very Unhealthy');

card._hass.states['sensor.aqi'] = { state: '350' };
assert(card._getOverallStatus().status === 'Hazardous', 'AQI 350 = Hazardous');

// ============================================================
// TEMPERATURE UNIT DETECTION
// ============================================================

section('Temperature Unit Detection');

card._config.temperature_unit = 'auto';
card._hass.config.unit_system.temperature = '°C';
assert(card._isCelsius() === true, 'Auto detects Celsius');
assert(card._getTempUnit() === '°C', 'Auto returns °C');

card._hass.config.unit_system.temperature = '°F';
assert(card._isCelsius() === false, 'Auto detects Fahrenheit');
assert(card._getTempUnit() === '°F', 'Auto returns °F');

card._config.temperature_unit = 'C';
assert(card._isCelsius() === true, 'Explicit C override');

card._config.temperature_unit = 'F';
assert(card._isCelsius() === false, 'Explicit F override');

// ============================================================
// RADON UNIT DETECTION
// ============================================================

section('Radon Unit Detection');

card._config.radon_unit = 'auto';
card._config.radon_entity = 'sensor.radon';
card._hass.states['sensor.radon'] = { state: '2.0', attributes: { unit_of_measurement: 'pCi/L' } };
assert(card._getRadonUnit() === 'pCi/L', 'Auto detects pCi/L from entity');
assert(card._isRadonPciL() === true, 'isRadonPciL true for pCi');
assert(card._getRadonBqm3(2.0) === 74, 'pCi/L to Bq/m³ conversion (2.0 * 37 = 74)');

card._hass.states['sensor.radon'] = { state: '100', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonUnit() === 'Bq/m³', 'Auto detects Bq/m³ from entity');

card._config.radon_unit = 'Bq/m³';
assert(card._getRadonUnit() === 'Bq/m³', 'Explicit Bq/m³ override');
assert(card._getRadonBqm3(100) === 100, 'Bq/m³ passthrough');

card._config.radon_unit = 'pCi/L';
assert(card._getRadonUnit() === 'pCi/L', 'Explicit pCi/L override');

// ============================================================
// RADON ADVISORY TESTS
// ============================================================

section('Radon Advisory');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_entity: 'sensor.radon' };
card._hass.states['sensor.radon'] = { state: '350', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'danger', 'Radon 350 Bq = danger advisory');

card._hass.states['sensor.radon'] = { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'warning', 'Radon 200 Bq = warning advisory');

card._hass.states['sensor.radon'] = { state: '110', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'info', 'Radon 110 Bq = info advisory');

card._hass.states['sensor.radon'] = { state: '40', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory() === null, 'Radon 40 Bq = no advisory');

// ============================================================
// RADON DOES NOT AFFECT RECOMMENDATIONS
// ============================================================

section('Radon does NOT affect recommendations');

setStates({ co2: 400 });
card._config.radon_entity = 'sensor.radon';
card._config.radon_unit = 'Bq/m³';
card._hass.states['sensor.radon'] = { state: '400', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRecommendation() === 'All Good', 'High radon does not change recommendation');

// ============================================================
// RADON OVERALL STATUS
// ============================================================

section('Radon Overall Status');

setStates({});
card._config.radon_entity = 'sensor.radon';
card._config.radon_unit = 'Bq/m³';
card._hass.states['sensor.radon'] = { state: '300', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Poor', 'Radon 300 Bq = Poor status');

card._hass.states['sensor.radon'] = { state: '150', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Fair', 'Radon 150 Bq = Fair status');

card._hass.states['sensor.radon'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Excellent', 'Radon 50 Bq does not degrade status');

// ============================================================
// RADON LONGTERM TESTS
// ============================================================

section('Radon Long-Term Advisory');

// Advisory uses higher of short-term and long-term
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_entity: 'sensor.radon', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'warning', 'Advisory uses longterm when higher (200 Bq LT = warning)');

card._hass.states['sensor.radon'] = { state: '350', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'danger', 'Advisory uses short-term when higher (350 Bq ST = danger)');

// Advisory works with only longterm configured
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon_lt'] = { state: '200', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory().level === 'warning', 'Advisory works with only longterm entity (200 Bq = warning)');

card._hass.states['sensor.radon_lt'] = { state: '40', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getRadonAdvisory() === null, 'No advisory when longterm is low');

// Advisory subtitle shows both values when both configured
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_entity: 'sensor.radon', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon'] = { state: '120', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '110', attributes: { unit_of_measurement: 'Bq/m³' } };
const advisory = card._getRadonAdvisory();
assert(advisory && advisory.subtitle.includes('Short-term') && advisory.subtitle.includes('Long-term'), 'Advisory subtitle shows both values when both configured');

section('Radon Long-Term Overall Status');

// Overall status uses higher of short-term and long-term
setStates({});
card._config.radon_entity = 'sensor.radon';
card._config.radon_longterm_entity = 'sensor.radon_lt';
card._config.radon_unit = 'Bq/m³';
card._hass.states['sensor.radon'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '300', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Poor', 'Overall status uses longterm when higher (300 Bq LT = Poor)');

card._hass.states['sensor.radon'] = { state: '150', attributes: { unit_of_measurement: 'Bq/m³' } };
card._hass.states['sensor.radon_lt'] = { state: '50', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Fair', 'Overall status uses short-term when higher (150 Bq ST = Fair)');

// Works with only longterm
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', radon_unit: 'Bq/m³', radon_longterm_entity: 'sensor.radon_lt' };
card._hass.states['sensor.radon_lt'] = { state: '300', attributes: { unit_of_measurement: 'Bq/m³' } };
assert(card._getOverallStatus().status === 'Poor', 'Overall status works with only longterm (300 Bq = Poor)');

section('Radon Long-Term Config Validation');

// radon_longterm_entity alone should be valid config
let configValid = true;
try {
  card.setConfig({ radon_longterm_entity: 'sensor.radon_lt' });
} catch (e) {
  configValid = false;
}
assert(configValid, 'radon_longterm_entity alone is valid config');

// ============================================================
// CARD SIZE TESTS
// ============================================================

section('Card Size');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
assert(card.getCardSize() === 3, 'Base size = 3');

card._config.co2_entity = 'sensor.co2';
assert(card.getCardSize() === 4, 'One sensor = 4');

card._config.pm25_entity = 'sensor.pm25';
card._config.humidity_entity = 'sensor.hum';
card._config.temperature_entity = 'sensor.temp';
assert(card.getCardSize() === 7, 'Four sensors = 7');

card._config.co_entity = 'sensor.co';
card._config.radon_entity = 'sensor.radon';
card._config.pm10_entity = 'sensor.pm10';
card._config.pm1_entity = 'sensor.pm1';
card._config.pm03_entity = 'sensor.pm03';
card._config.hcho_entity = 'sensor.hcho';
card._config.tvoc_entity = 'sensor.tvoc';
assert(card.getCardSize() === 14, 'All 11 original sensors = 14');

section('Card Size — New sensors');
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.no2_entity = 'sensor.no2';
assert(card.getCardSize() === 4, 'NO2 adds 1');

card._config.o3_entity = 'sensor.o3';
card._config.so2_entity = 'sensor.so2';
assert(card.getCardSize() === 6, 'NO2 + O3 + SO2 = base + 3');

card._config.air_quality_entity = 'sensor.aqi';
assert(card.getCardSize() === 7, 'AQI entity adds 1');

section('Card Size — Outdoor-only');
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
assert(card.getCardSize() === 4, 'Outdoor PM2.5 only = base + 1');

card._config.outdoor_temperature_entity = 'sensor.outdoor_temp';
card._config.outdoor_no2_entity = 'sensor.outdoor_no2';
assert(card.getCardSize() === 6, 'Three outdoor-only sensors = base + 3');

// ============================================================
// OUTDOOR-ONLY DISPLAY TESTS
// ============================================================

section('Outdoor-Only Display Flags');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
assert(card._hasOutdoorOnly('pm25') === true, 'PM2.5 is outdoor-only when no indoor entity');

card._config.pm25_entity = 'sensor.indoor_pm25';
assert(card._hasOutdoorOnly('pm25') === false, 'PM2.5 not outdoor-only when indoor entity exists');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_no2_entity = 'sensor.outdoor_no2';
assert(card._hasOutdoorOnly('no2') === true, 'NO2 is outdoor-only');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
assert(card._hasOutdoorOnly('pm25') === false, 'No outdoor-only when no entities at all');

section('Effective Entity Resolution');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.pm25_entity = 'sensor.indoor_pm25';
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
assert(card._getEffectiveEntity('pm25') === 'sensor.indoor_pm25', 'Indoor entity preferred');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.outdoor_pm25';
assert(card._getEffectiveEntity('pm25') === 'sensor.outdoor_pm25', 'Outdoor entity used when no indoor');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
assert(card._getEffectiveEntity('pm25') === null, 'null when no entity');

// ============================================================
// WAQI ENTITY DETECTION TESTS
// ============================================================

section('WAQI Entity Detection');

card._hass.entities = {
  'sensor.beijing_pm25': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'pm25' },
  'sensor.beijing_air_quality_index': { device_id: 'waqi_device_1', platform: 'waqi' },
  'sensor.indoor_pm25': { device_id: 'indoor_device', platform: 'airthings' },
};
card._waqiEntityIds = new Set();

assert(card._isWaqiEntity('sensor.beijing_pm25') === true, 'WAQI entity detected by platform');
assert(card._isWaqiEntity('sensor.indoor_pm25') === false, 'Non-WAQI entity not detected');
assert(card._isWaqiEntity('sensor.unknown') === false, 'Unknown entity not detected');
assert(card._isWaqiEntity(null) === false, 'null entity not detected');

section('WAQI Entity Resolution');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto', waqi_device: 'waqi_device_1' };
card._hass.entities = {
  'sensor.beijing_pm2_5': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'pm25' },
  'sensor.beijing_pm10': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'pm10' },
  'sensor.beijing_air_quality_index': { device_id: 'waqi_device_1', platform: 'waqi' },
  'sensor.beijing_humidity': { device_id: 'waqi_device_1', platform: 'waqi' },
  'sensor.beijing_temperature': { device_id: 'waqi_device_1', platform: 'waqi' },
  'sensor.beijing_carbon_monoxide': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'carbon_monoxide' },
  'sensor.beijing_nitrogen_dioxide': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'nitrogen_dioxide' },
  'sensor.beijing_ozone': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'ozone' },
  'sensor.beijing_sulphur_dioxide': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'sulphur_dioxide' },
  'sensor.beijing_dominant_pollutant': { device_id: 'waqi_device_1', platform: 'waqi', translation_key: 'dominant_pollutant' },
};
card._hass.states = {
  'sensor.beijing_pm2_5': { state: '75', attributes: {} },
  'sensor.beijing_pm10': { state: '85', attributes: {} },
  'sensor.beijing_air_quality_index': { state: '120', attributes: { device_class: 'aqi' } },
  'sensor.beijing_humidity': { state: '65', attributes: { device_class: 'humidity' } },
  'sensor.beijing_temperature': { state: '28', attributes: { device_class: 'temperature' } },
  'sensor.beijing_carbon_monoxide': { state: '3', attributes: {} },
  'sensor.beijing_nitrogen_dioxide': { state: '45', attributes: {} },
  'sensor.beijing_ozone': { state: '68', attributes: {} },
  'sensor.beijing_sulphur_dioxide': { state: '12', attributes: {} },
  'sensor.beijing_dominant_pollutant': { state: 'pm25', attributes: {} },
};
card._waqiResolved = false;
card._waqiEntityIds = new Set();
card._resolveWaqiEntities();

assert(card._config.air_quality_entity === 'sensor.beijing_air_quality_index', 'WAQI resolves air_quality_entity via device_class');
assert(card._config.outdoor_pm25_entity === 'sensor.beijing_pm2_5', 'WAQI resolves outdoor_pm25_entity via translation_key');
assert(card._config.outdoor_pm10_entity === 'sensor.beijing_pm10', 'WAQI resolves outdoor_pm10_entity via translation_key');
assert(card._config.outdoor_humidity_entity === 'sensor.beijing_humidity', 'WAQI resolves outdoor_humidity_entity via device_class');
assert(card._config.outdoor_temperature_entity === 'sensor.beijing_temperature', 'WAQI resolves outdoor_temperature_entity via device_class');
assert(card._config.outdoor_co_entity === 'sensor.beijing_carbon_monoxide', 'WAQI resolves outdoor_co_entity via translation_key');
assert(card._config.outdoor_no2_entity === 'sensor.beijing_nitrogen_dioxide', 'WAQI resolves outdoor_no2_entity via translation_key');
assert(card._config.outdoor_o3_entity === 'sensor.beijing_ozone', 'WAQI resolves outdoor_o3_entity via translation_key');
assert(card._config.outdoor_so2_entity === 'sensor.beijing_sulphur_dioxide', 'WAQI resolves outdoor_so2_entity via translation_key');

section('WAQI Resolution — Manual overrides preserved');

card._config = {
  name: 'Test', hours_to_show: 24, temperature_unit: 'auto',
  waqi_device: 'waqi_device_1',
  outdoor_pm25_entity: 'sensor.my_custom_pm25' // manual override
};
card._waqiResolved = false;
card._waqiEntityIds = new Set();
card._resolveWaqiEntities();

assert(card._config.outdoor_pm25_entity === 'sensor.my_custom_pm25', 'Manual override preserved over WAQI auto-resolve');
assert(card._config.outdoor_pm10_entity === 'sensor.beijing_pm10', 'Non-overridden WAQI entity still resolved');

section('WAQI AQI Sub-Index Color Selection');

// With conversion, WAQI entities now use standard raw-concentration color functions.
// _getColorFn should return the normal PM2.5 color function (not AQI sub-index).
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.beijing_pm25';
card._hass.entities = {
  'sensor.beijing_pm25': { device_id: 'waqi_device_1', platform: 'waqi' },
};
card._waqiEntityIds = new Set(['sensor.beijing_pm25']);

const pm25ColorFn = card._getColorFn('pm25');
// Now uses raw concentration thresholds (values are converted before being passed to color fn)
assert(pm25ColorFn(3) === '#4caf50', 'PM2.5 color fn uses raw concentration scale: 3 = green');
assert(pm25ColorFn(30) === '#ff9800', 'PM2.5 color fn uses raw concentration scale: 30 = orange');

// Non-WAQI PM2.5 uses the same raw concentration thresholds
card._config.pm25_entity = 'sensor.indoor_pm25';
card._config.outdoor_pm25_entity = null;
card._hass.entities = {
  'sensor.indoor_pm25': { device_id: 'indoor_device', platform: 'airthings' },
};
card._waqiEntityIds = new Set();

const rawPm25ColorFn = card._getColorFn('pm25');
assert(rawPm25ColorFn(3) === '#4caf50', 'Raw PM2.5 3 μg/m³ = green');
assert(rawPm25ColorFn(30) === '#ff9800', 'Raw PM2.5 30 μg/m³ = orange');

section('WAQI Sensor Unit');

// With conversion, WAQI pollutant sensors now report in standard units (not 'AQI').
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.beijing_pm25';
card._hass.entities = {
  'sensor.beijing_pm25': { device_id: 'waqi_device_1', platform: 'waqi' },
};
card._waqiEntityIds = new Set(['sensor.beijing_pm25']);

assert(card._getSensorUnit('pm25') === 'μg/m³', 'WAQI PM2.5 unit = μg/m³ (converted from sub-index)');
assert(card._getSensorUnit('pm10') === 'μg/m³', 'WAQI PM10 unit = μg/m³');
assert(card._getSensorUnit('co') === 'ppm', 'WAQI CO unit = ppm');
assert(card._getSensorUnit('no2') === 'ppb', 'WAQI NO2 unit = ppb');
assert(card._getSensorUnit('o3') === 'ppb', 'WAQI O3 unit = ppb');
assert(card._getSensorUnit('so2') === 'ppb', 'WAQI SO2 unit = ppb');

card._config.pm25_entity = 'sensor.indoor_pm25';
card._config.outdoor_pm25_entity = null;
card._hass.entities = {
  'sensor.indoor_pm25': { device_id: 'indoor_device', platform: 'airthings' },
};
card._waqiEntityIds = new Set();

assert(card._getSensorUnit('pm25') === 'μg/m³', 'Raw PM2.5 unit = μg/m³');

// ============================================================
// GETCONFIG FORM TESTS
// ============================================================

section('Editor Structure');

// Card should have getConfigElement
assert(typeof CardClass.getConfigElement === 'function', 'getConfigElement exists');

// Editor class should be registered
const EditorClass = registeredElements['air-quality-card-editor'];
assert(EditorClass !== undefined, 'Editor custom element registered');

// Test editor schema and labels
const editor = new EditorClass();
editor.setConfig({ co2_entity: 'sensor.co2' });
const schema = editor._schema();
assert(schema && schema.length > 0, 'Editor schema exists');
assert(typeof editor._computeLabel === 'function', 'computeLabel is a function');

// Check all expected labels exist
const allLabels = [
  'name', 'waqi_device',
  'co2_entity', 'pm25_entity', 'humidity_entity', 'temperature_entity',
  'radon_entity', 'radon_longterm_entity', 'co_entity', 'hcho_entity', 'tvoc_entity', 'pm1_entity', 'pm10_entity', 'pm03_entity',
  'no2_entity', 'o3_entity', 'so2_entity',
  'outdoor_co2_entity', 'outdoor_pm25_entity', 'outdoor_humidity_entity', 'outdoor_temperature_entity',
  'outdoor_co_entity', 'outdoor_hcho_entity', 'outdoor_tvoc_entity',
  'outdoor_no2_entity', 'outdoor_o3_entity', 'outdoor_so2_entity',
  'outdoor_pm1_entity', 'outdoor_pm10_entity', 'outdoor_pm03_entity',
  'air_quality_entity', 'hours_to_show', 'temperature_unit', 'radon_unit'
];
for (const name of allLabels) {
  const label = editor._computeLabel({ name });
  assert(label !== name, `Label for ${name} is defined (got: "${label}")`);
}

// Check expandable sections exist
function findExpandable(schemaArr, title) {
  for (const item of schemaArr) {
    if (item.type === 'expandable' && item.title === title) return item;
  }
  return null;
}

const waqiSection = findExpandable(schema, 'WAQI Integration');
assert(waqiSection !== null, 'WAQI Integration expandable exists');
assert(waqiSection.flatten === true, 'WAQI Integration has flatten: true');

const additionalSection = findExpandable(schema, 'Additional Sensors');
assert(additionalSection !== null, 'Additional Sensors expandable exists');
assert(additionalSection.flatten === true, 'Additional Sensors has flatten: true');

const outdoorSection = findExpandable(schema, 'Outdoor Sensors');
assert(outdoorSection !== null, 'Outdoor Sensors expandable exists');
assert(outdoorSection.flatten === true, 'Outdoor Sensors has flatten: true');

const advancedSection = findExpandable(schema, 'Advanced');
assert(advancedSection !== null, 'Advanced expandable exists');
assert(advancedSection.flatten === true, 'Advanced has flatten: true');

// Check that NO2, O3, SO2 are in the Additional Sensors section
function findFieldInSchema(schemaArr, fieldName) {
  for (const item of schemaArr) {
    if (item.name === fieldName) return true;
    if (item.schema) {
      if (findFieldInSchema(item.schema, fieldName)) return true;
    }
  }
  return false;
}

assert(findFieldInSchema(additionalSection.schema, 'no2_entity'), 'NO2 entity in Additional Sensors');
assert(findFieldInSchema(additionalSection.schema, 'o3_entity'), 'O3 entity in Additional Sensors');
assert(findFieldInSchema(additionalSection.schema, 'so2_entity'), 'SO2 entity in Additional Sensors');

assert(findFieldInSchema(outdoorSection.schema, 'outdoor_no2_entity'), 'Outdoor NO2 in Outdoor Sensors');
assert(findFieldInSchema(outdoorSection.schema, 'outdoor_o3_entity'), 'Outdoor O3 in Outdoor Sensors');
assert(findFieldInSchema(outdoorSection.schema, 'outdoor_so2_entity'), 'Outdoor SO2 in Outdoor Sensors');

// ============================================================
// HISTORY KEYS TEST
// ============================================================

section('History Keys');

const freshCard = new CardClass();
const expectedKeys = [
  'aqi',
  'co2', 'pm25', 'pm1', 'pm10', 'pm03', 'hcho', 'tvoc', 'co', 'radon', 'radon_longterm',
  'nox', 'no2', 'o3', 'so2',
  'humidity', 'temperature',
  'outdoor_co2', 'outdoor_pm25', 'outdoor_pm1', 'outdoor_pm10', 'outdoor_pm03',
  'outdoor_hcho', 'outdoor_tvoc', 'outdoor_co',
  'outdoor_no2', 'outdoor_o3', 'outdoor_so2',
  'outdoor_humidity', 'outdoor_temperature'
];
for (const key of expectedKeys) {
  assert(Array.isArray(freshCard._history[key]), `History key '${key}' exists and is array`);
}

// ============================================================
// PM4 COLOR TESTS (existing but was missing from original tests)
// ============================================================

section('PM4 Color');
assert(card._getPM4Color(5) === '#4caf50', 'PM4 5 = green');
assert(card._getPM4Color(15) === '#8bc34a', 'PM4 15 = light green');
assert(card._getPM4Color(30) === '#ffc107', 'PM4 30 = yellow');
assert(card._getPM4Color(45) === '#ff9800', 'PM4 45 = orange');
assert(card._getPM4Color(60) === '#f44336', 'PM4 60 = red');

section('NOx Color');
assert(card._getNOxColor(10) === '#4caf50', 'NOx 10 = green');
assert(card._getNOxColor(30) === '#8bc34a', 'NOx 30 = light green');
assert(card._getNOxColor(100) === '#ffc107', 'NOx 100 = yellow');
assert(card._getNOxColor(200) === '#ff9800', 'NOx 200 = orange');
assert(card._getNOxColor(300) === '#f44336', 'NOx 300 = red');

// ============================================================
// SENSOR STATUS TESTS
// ============================================================

section('Sensor Status — Standard sensors');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'C' };
card._config.co2_entity = 'sensor.co2';
card._hass.states = { 'sensor.co2': { state: '400' } };
card._hass.entities = { 'sensor.co2': { device_id: 'd1', platform: 'esphome' } };
card._waqiEntityIds = new Set();

assert(card._getSensorStatus('co2', 400) === 'Excellent', 'CO2 400 status = Excellent');
assert(card._getSensorStatus('co2', 900) === 'Good', 'CO2 900 status = Good');
assert(card._getSensorStatus('co2', 1200) === 'Elevated', 'CO2 1200 status = Elevated');
assert(card._getSensorStatus('co2', 2000) === 'Poor', 'CO2 2000 status = Poor');

assert(card._getSensorStatus('humidity', 25) === 'Too Dry', 'Humidity 25 status = Too Dry');
assert(card._getSensorStatus('humidity', 45) === 'Comfortable', 'Humidity 45 status = Comfortable');
assert(card._getSensorStatus('humidity', 70) === 'Too Humid', 'Humidity 70 status = Too Humid');

section('Sensor Status — WAQI sub-index sensors');

// With conversion, WAQI values are in raw concentration — use standard status functions.
card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.waqi_pm25';
card._hass.entities = { 'sensor.waqi_pm25': { device_id: 'w1', platform: 'waqi' } };
card._waqiEntityIds = new Set(['sensor.waqi_pm25']);

// Values passed to _getSensorStatus are already converted to raw concentration
assert(card._getSensorStatus('pm25', 3) === 'Excellent', 'PM2.5 3 μg/m³ status = Excellent');
assert(card._getSensorStatus('pm25', 10) === 'Good', 'PM2.5 10 μg/m³ status = Good');
assert(card._getSensorStatus('pm25', 30) === 'Elevated', 'PM2.5 30 μg/m³ status = Elevated');

// ============================================================
// AQI SUB-INDEX TO CONCENTRATION CONVERSION
// ============================================================

section('AQI Sub-Index to Concentration — PM2.5');

// PM2.5 breakpoints: [0-50] → [0-9], [51-100] → [9.1-35.4], etc.
let c;
c = card._aqiSubIndexToConcentration(0, 'pm25');
assert(Math.abs(c - 0) < 0.1, `PM2.5 AQI 0 → 0 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(50, 'pm25');
assert(Math.abs(c - 9.0) < 0.1, `PM2.5 AQI 50 → 9.0 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(51, 'pm25');
assert(Math.abs(c - 9.1) < 0.2, `PM2.5 AQI 51 → ~9.1 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(100, 'pm25');
assert(Math.abs(c - 35.4) < 0.1, `PM2.5 AQI 100 → 35.4 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(150, 'pm25');
assert(Math.abs(c - 55.4) < 0.1, `PM2.5 AQI 150 → 55.4 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(75, 'pm25');
assert(c > 9 && c < 35.4, `PM2.5 AQI 75 → between 9 and 35.4 (got ${c.toFixed(2)})`);

section('AQI Sub-Index to Concentration — PM10');

c = card._aqiSubIndexToConcentration(0, 'pm10');
assert(Math.abs(c - 0) < 0.1, `PM10 AQI 0 → 0 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(50, 'pm10');
assert(Math.abs(c - 54) < 0.5, `PM10 AQI 50 → 54 μg/m³ (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(100, 'pm10');
assert(Math.abs(c - 154) < 0.5, `PM10 AQI 100 → 154 μg/m³ (got ${c.toFixed(2)})`);

section('AQI Sub-Index to Concentration — CO');

c = card._aqiSubIndexToConcentration(50, 'co');
assert(Math.abs(c - 4.4) < 0.1, `CO AQI 50 → 4.4 ppm (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(100, 'co');
assert(Math.abs(c - 9.4) < 0.1, `CO AQI 100 → 9.4 ppm (got ${c.toFixed(2)})`);

section('AQI Sub-Index to Concentration — NO2');

c = card._aqiSubIndexToConcentration(50, 'no2');
assert(Math.abs(c - 53) < 0.5, `NO2 AQI 50 → 53 ppb (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(100, 'no2');
assert(Math.abs(c - 100) < 0.5, `NO2 AQI 100 → 100 ppb (got ${c.toFixed(2)})`);

section('AQI Sub-Index to Concentration — O3');

c = card._aqiSubIndexToConcentration(50, 'o3');
assert(Math.abs(c - 54) < 0.5, `O3 AQI 50 → 54 ppb (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(100, 'o3');
assert(Math.abs(c - 70) < 0.5, `O3 AQI 100 → 70 ppb (got ${c.toFixed(2)})`);

section('AQI Sub-Index to Concentration — SO2');

c = card._aqiSubIndexToConcentration(50, 'so2');
assert(Math.abs(c - 35) < 0.5, `SO2 AQI 50 → 35 ppb (got ${c.toFixed(2)})`);

c = card._aqiSubIndexToConcentration(100, 'so2');
assert(Math.abs(c - 75) < 0.5, `SO2 AQI 100 → 75 ppb (got ${c.toFixed(2)})`);

section('AQI Sub-Index to Concentration — Edge cases');

// Unknown sensor type — returns value unchanged
c = card._aqiSubIndexToConcentration(75, 'unknown');
assert(c === 75, 'Unknown sensor type returns value unchanged');

// Clamped to 0
c = card._aqiSubIndexToConcentration(-10, 'pm25');
assert(Math.abs(c - 0) < 0.1, 'Negative AQI clamped to 0');

// Clamped to 500
c = card._aqiSubIndexToConcentration(600, 'pm25');
assert(Math.abs(c - 500.4) < 0.5, 'AQI > 500 clamped to 500');

section('_convertWaqiValue — WAQI entity conversion');

card._config = { name: 'Test', hours_to_show: 24, temperature_unit: 'auto' };
card._config.outdoor_pm25_entity = 'sensor.waqi_pm25';
card._hass.entities = { 'sensor.waqi_pm25': { device_id: 'w1', platform: 'waqi' } };
card._waqiEntityIds = new Set(['sensor.waqi_pm25']);

// WAQI outdoor PM2.5 sub-index 75 should be converted to μg/m³
const converted = card._convertWaqiValue('pm25', 75);
assert(converted > 9 && converted < 35.4, `WAQI PM2.5 75 converted to ${converted.toFixed(1)} μg/m³`);

// AQI type is never converted
card._config.outdoor_pm25_entity = null;
const aqiVal = card._convertWaqiValue('aqi', 75);
assert(aqiVal === 75, 'AQI type is never converted');

// Non-WAQI entity — value returned unchanged
card._config.outdoor_pm25_entity = 'sensor.regular_pm25';
card._hass.entities = { 'sensor.regular_pm25': { device_id: 'r1', platform: 'other' } };
card._waqiEntityIds = new Set();
const nonWaqi = card._convertWaqiValue('pm25', 75);
assert(nonWaqi === 75, 'Non-WAQI value returned unchanged');

// ============================================================
// SUMMARY
// ============================================================

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);

process.exit(failed > 0 ? 1 : 0);
