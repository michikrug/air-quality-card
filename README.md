# Air Quality Card

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?style=flat&logo=buy-me-a-coffee)](https://buymeacoffee.com/kadenthomp36)

A custom Home Assistant Lovelace card for monitoring indoor air quality with beautiful gradient graphs, WHO-based health thresholds, and native WAQI (World Air Quality Index) integration for outdoor comparison.

![Air Quality Card Preview](https://raw.githubusercontent.com/KadenThomp36/air-quality-card/main/images/preview.png)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Configuration](#configuration)
- [WAQI Integration](#waqi-integration)
- [Built-in Recommendations](#built-in-recommendations)
- [Health Thresholds](#health-thresholds)
- [Supported Devices](#supported-devices)
- [Development](#development)
- [Other Cards](#other-cards)
- [Star History](#star-history)
- [Support](#support)

## Features

- **Real-time monitoring** of CO, Radon, CO₂, PM2.5, PM10, PM1, PM0.3, PM4, HCHO, tVOC, NOx, NO₂, O₃, SO₂, humidity, and temperature
- **AQI graph** -- dedicated Air Quality Index graph section when using WAQI or any AQI entity
- **WAQI integration** -- auto-discover outdoor sensors from a WAQI device with a single config key
- **AQI sub-index conversion** -- WAQI pollutant values (AQI sub-indices) are automatically converted to raw concentrations (µg/m³, ppb, ppm) using EPA breakpoint tables for meaningful indoor/outdoor comparison
- **CO safety alerts** -- critical red warnings for dangerous carbon monoxide levels
- **Radon advisory banner** -- separate long-term health advisory with EPA/WHO thresholds (supports pCi/L and Bq/m³)
- **Gradient-colored graphs** that change color based on air quality levels
- **Interactive hover/touch** to see historical values at any point
- **Health-based thresholds** following WHO 2021 guidelines and ASHRAE standards
- **Actionable recommendations** like "Open Window", "Run Air Purifier", or "Limit Outdoor Exposure"
- **Outdoor sensor comparison** -- optional dashed line overlay with smart ventilation recommendations
- **Outdoor-only display** -- WAQI sensors display as primary graphs even without corresponding indoor sensors
- **Tap to expand** -- click any graph to open the full Home Assistant history view
- **Visual configuration editor** -- no YAML required, with collapsible sections for clean organization

## Installation

### HACS (Recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=KadenThomp36&repository=air-quality-card&category=plugin)

Or manually: open HACS, search for "Air Quality Card", click Install, and refresh your browser.

### Manual Installation

1. Download `air-quality-card.js` from the latest release
2. Copy it to `/config/www/air-quality-card/air-quality-card.js`
3. Add the resource in Home Assistant:
   - Go to Settings -> Dashboards -> Resources
   - Add `/local/air-quality-card/air-quality-card.js` as a JavaScript Module

## Configuration

### Using the Visual Editor

1. Add a new card to your dashboard
2. Search for "Air Quality Card"
3. Configure the entities using the visual editor
4. Primary sensors (CO₂, PM2.5, Humidity, Temperature) are always visible
5. Expand "Additional Sensors" for Radon, CO, HCHO, tVOC, PM1, PM10, PM0.3, PM4, NOx, NO₂, O₃, SO₂
6. Expand "Outdoor Sensors" for comparison data
7. Expand "WAQI Integration" to auto-discover outdoor sensors from a WAQI device

### YAML Configuration

```yaml
type: custom:air-quality-card
name: Office Air Quality
co2_entity: sensor.air_quality_co2
pm25_entity: sensor.air_quality_pm25
pm10_entity: sensor.air_quality_pm10
co_entity: sensor.air_quality_co
radon_entity: sensor.wave_1_day_average
radon_longterm_entity: sensor.wave_longterm_average
humidity_entity: sensor.air_quality_humidity
temperature_entity: sensor.air_quality_temperature
hours_to_show: 24
temperature_unit: C
waqi_device: your_waqi_device_id_here
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `name` | string | No | "Air Quality" | Card title |
| `hours_to_show` | number | No | 24 | Hours of history to display (1-168) |
| `temperature_unit` | string | No | "auto" | Temperature unit: "auto" (detect from HA), "F" (Fahrenheit), or "C" (Celsius) |
| `radon_unit` | string | No | "auto" | Radon unit: "auto" (detect from sensor), "pCi/L" (US), or "Bq/m³" (International) |

#### Indoor Sensors

| Option | Type | Description |
|--------|------|-------------|
| `co2_entity` | string | CO₂ sensor entity ID |
| `pm25_entity` | string | PM2.5 sensor entity ID |
| `pm1_entity` | string | PM1 sensor entity ID |
| `pm10_entity` | string | PM10 sensor entity ID |
| `pm03_entity` | string | PM0.3 particle count sensor entity ID |
| `pm4_entity` | string | PM4 sensor entity ID |
| `co_entity` | string | Carbon monoxide (CO) sensor entity ID |
| `radon_entity` | string | Radon sensor entity ID (supports pCi/L and Bq/m³) |
| `radon_longterm_entity` | string | Radon long-term average sensor (shown as dashed overlay on radon graph) |
| `hcho_entity` | string | Formaldehyde (HCHO) sensor entity ID |
| `tvoc_entity` | string | Volatile organic compounds (tVOC) sensor entity ID |
| `nox_entity` | string | NOx sensor entity ID |
| `no2_entity` | string | Nitrogen dioxide (NO₂) sensor entity ID |
| `o3_entity` | string | Ozone (O₃) sensor entity ID |
| `so2_entity` | string | Sulphur dioxide (SO₂) sensor entity ID |
| `humidity_entity` | string | Humidity sensor entity ID |
| `temperature_entity` | string | Temperature sensor entity ID |
| `air_quality_entity` | string | Overall air quality index entity |

At least one sensor entity (indoor or outdoor) or `waqi_device` is required.

#### Outdoor Sensors

| Option | Type | Description |
|--------|------|-------------|
| `outdoor_co2_entity` | string | Outdoor CO₂ sensor for comparison |
| `outdoor_pm25_entity` | string | Outdoor PM2.5 sensor for comparison |
| `outdoor_pm1_entity` | string | Outdoor PM1 sensor for comparison |
| `outdoor_pm10_entity` | string | Outdoor PM10 sensor for comparison |
| `outdoor_pm03_entity` | string | Outdoor PM0.3 sensor for comparison |
| `outdoor_co_entity` | string | Outdoor CO sensor for comparison |
| `outdoor_hcho_entity` | string | Outdoor HCHO sensor for comparison |
| `outdoor_tvoc_entity` | string | Outdoor tVOC sensor for comparison |
| `outdoor_no2_entity` | string | Outdoor NO₂ sensor for comparison |
| `outdoor_o3_entity` | string | Outdoor O₃ sensor for comparison |
| `outdoor_so2_entity` | string | Outdoor SO₂ sensor for comparison |
| `outdoor_humidity_entity` | string | Outdoor humidity sensor for comparison |
| `outdoor_temperature_entity` | string | Outdoor temperature sensor for comparison |

#### WAQI Integration

| Option | Type | Description |
|--------|------|-------------|
| `waqi_device` | string | WAQI device ID -- auto-discovers all outdoor entities from the device |

### Outdoor Sensors

Configure outdoor sensor entities to see a **dashed comparison line** on each graph showing outdoor conditions alongside indoor readings. When outdoor sensors are configured:

- A subtle dashed line appears on the corresponding graph
- Hovering shows both indoor and outdoor values
- Current outdoor values appear next to indoor readings
- **Smart recommendations** avoid suggesting ventilation when outdoor air is worse (e.g., "Keep Windows Closed" instead of "Open Window")

When only an outdoor sensor exists (no corresponding indoor sensor), the graph displays the outdoor value as the primary solid line with an **(outdoor)** badge.

## WAQI Integration

The card natively supports the [WAQI (World Air Quality Index)](https://www.home-assistant.io/integrations/waqi/) integration. Instead of manually configuring each outdoor entity, provide a single `waqi_device` ID to auto-discover all available sensors from your WAQI station.

### Setup

1. Install the WAQI integration in Home Assistant
2. Find your WAQI device ID:
   - Go to Settings -> Devices & Services -> WAQI
   - Click on your station device
   - Copy the device ID from the URL (the hex string, e.g., `4166f17e22bcbb0662ddd74ab57e0821`)
3. Add it to your card config:

```yaml
type: custom:air-quality-card
name: Air Quality
co2_entity: sensor.indoor_co2
humidity_entity: sensor.indoor_humidity
temperature_entity: sensor.indoor_temperature
pm25_entity: sensor.indoor_pm25
waqi_device: 4166f17e22bcbb0662ddd74ab57e0821
```

### How It Works

- The card reads the Home Assistant entity registry to find all sensor entities belonging to the WAQI device
- Entities are matched to card config slots using the entity registry `translation_key` (for pollutants like PM2.5, PM10, NO₂, O₃, SO₂, CO) and `device_class` (for AQI, humidity, temperature)
- WAQI entities are mapped to outdoor sensor slots (e.g., `outdoor_pm25_entity`, `outdoor_pm10_entity`)
- The AQI entity is mapped to `air_quality_entity` for the dedicated AQI graph
- **Manual overrides always win** -- if you explicitly set an outdoor entity in your config, the WAQI auto-discovery won't overwrite it

### AQI Sub-Index Conversion

WAQI pollutant sensors report values as **AQI sub-indices** on a 0-500 scale, not raw concentrations. For example, a WAQI PM2.5 value of 75 doesn't mean 75 µg/m³ -- it means "moderate air quality for PM2.5".

The card automatically converts these sub-indices back to raw concentrations using the EPA AQI breakpoint tables so that indoor and outdoor values are displayed on the same physical scale:

| Pollutant | WAQI Scale | Converted Unit |
|-----------|-----------|----------------|
| PM2.5 | AQI sub-index (0-500) | µg/m³ |
| PM10 | AQI sub-index (0-500) | µg/m³ |
| CO | AQI sub-index (0-500) | ppm |
| NO₂ | AQI sub-index (0-500) | ppb |
| O₃ | AQI sub-index (0-500) | ppb |
| SO₂ | AQI sub-index (0-500) | ppb |

This conversion uses the [US EPA Technical Assistance Document](https://www.airnow.gov/sites/default/files/2020-05/aqi-technical-assistance-document-sept2018.pdf) breakpoint tables. Humidity and temperature from WAQI already report in standard units (%, °C) and are used as-is.

The overall AQI value (`air_quality_entity`) is **not** converted -- it remains on the 0-500 AQI scale with its own dedicated color coding and graph.

### Available WAQI Sensors

Not all WAQI stations report all pollutants. The card will only show graphs for sensors your station provides. Common sensors include:

| WAQI Sensor | Card Mapping | Notes |
|------------|-------------|-------|
| Air Quality Index | `air_quality_entity` | Overall AQI (0-500), shown as dedicated graph |
| PM2.5 | `outdoor_pm25_entity` | Converted to µg/m³ |
| PM10 | `outdoor_pm10_entity` | Converted to µg/m³ |
| Humidity | `outdoor_humidity_entity` | Already in % |
| Temperature | `outdoor_temperature_entity` | Already in °C |
| Carbon Monoxide | `outdoor_co_entity` | Converted to ppm |
| Nitrogen Dioxide | `outdoor_no2_entity` | Converted to ppb |
| Ozone | `outdoor_o3_entity` | Converted to ppb |
| Sulphur Dioxide | `outdoor_so2_entity` | Converted to ppb |

## Built-in Recommendations

The card automatically generates actionable recommendations based on your sensor readings -- no template sensors needed. It evaluates CO, CO₂, PM2.5, PM10, HCHO, tVOC, humidity, and AQI levels, and when outdoor sensors are configured, it avoids suggesting ventilation when outdoor air is worse.

**CO safety alerts** are always shown regardless of outdoor conditions -- carbon monoxide is a life-safety concern. If CO exceeds dangerous levels, the card shows a critical red warning with instructions to leave the area.

**Outdoor exposure advisory** appears when the AQI exceeds 150 (Unhealthy for Sensitive Groups), recommending reduced outdoor activity.

**Radon advisory banner** appears as a separate element below the main recommendation when radon levels are elevated. Unlike other pollutants, radon changes over days/weeks and requires professional mitigation (not "open a window"), so it uses its own advisory system instead of the main recommendation waterfall. The advisory shows at three levels: informational (approaching action level), warning (above EPA action level of 4.0 pCi/L / 148 Bq/m³), and danger (significantly elevated, mitigation needed).

## Health Thresholds

### AQI (Air Quality Index)
US EPA standard scale:
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Good | 0-50 | Green | Air quality is satisfactory |
| Moderate | 51-100 | Light Green | Acceptable for most people |
| USG | 101-150 | Yellow | Unhealthy for sensitive groups |
| Unhealthy | 151-200 | Orange | Everyone may experience effects |
| Very Unhealthy | 201-300 | Red | Health alert |
| Hazardous | 301-500 | Dark Red | Emergency conditions |

### CO (Carbon Monoxide)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Safe | < 4 ppm | Green | Normal background levels |
| Low | 4-9 ppm | Light Green | Acceptable for short exposure |
| Moderate | 9-35 ppm | Yellow | Improve ventilation |
| High | 35-100 ppm | Orange | Ventilate immediately |
| Dangerous | > 100 ppm | Red | Leave area immediately |

### Radon
Based on EPA and WHO guidelines:
| Level | Range (pCi/L) | Range (Bq/m³) | Color | Meaning |
|-------|---------------|----------------|-------|---------|
| Excellent | < 1.3 | < 48 | Green | Low risk |
| Good | 1.3-2.7 | 48-100 | Light Green | Below WHO reference level |
| Elevated | 2.7-4.0 | 100-148 | Yellow | Approaching EPA action level |
| High | 4.0-8.0 | 148-300 | Orange | Above EPA action level, consider mitigation |
| Dangerous | > 8.0 | > 300 | Red | Professional mitigation needed |

### CO₂ (Carbon Dioxide)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 600 ppm | Green | Fresh outdoor air levels |
| Good | 600-800 ppm | Light Green | Well-ventilated space |
| Moderate | 800-1000 ppm | Yellow | Acceptable, consider ventilation |
| Elevated | 1000-1500 ppm | Orange | May affect concentration |
| Poor | > 1500 ppm | Red | Ventilation needed |

### PM2.5 (Fine Particulate Matter)
Based on WHO 2021 Air Quality Guidelines:
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 5 µg/m³ | Green | WHO annual guideline |
| Good | 5-15 µg/m³ | Light Green | WHO 24-hour guideline |
| Moderate | 15-25 µg/m³ | Yellow | Slightly elevated |
| Elevated | 25-35 µg/m³ | Orange | Consider air purifier |
| Poor | > 35 µg/m³ | Red | Air purifier recommended |

### PM10 (Coarse Particulate Matter)
Based on WHO 2021 Air Quality Guidelines:
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 15 µg/m³ | Green | WHO annual guideline |
| Good | 15-45 µg/m³ | Light Green | Acceptable |
| Moderate | 45-75 µg/m³ | Yellow | Slightly elevated |
| Elevated | 75-150 µg/m³ | Orange | Consider air purifier |
| Poor | > 150 µg/m³ | Red | Air purifier recommended |

### PM1 (Ultrafine Particulate Matter)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 5 µg/m³ | Green | Clean air |
| Good | 5-15 µg/m³ | Light Green | Acceptable |
| Moderate | 15-25 µg/m³ | Yellow | Slightly elevated |
| Elevated | 25-35 µg/m³ | Orange | Consider air purifier |
| Poor | > 35 µg/m³ | Red | Air purifier recommended |

### PM0.3 (Particle Count)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Clean | < 500 p/0.1L | Green | Very clean air |
| Good | 500-1000 p/0.1L | Light Green | Normal levels |
| Moderate | 1000-3000 p/0.1L | Yellow | Slightly elevated |
| Elevated | 3000-5000 p/0.1L | Orange | Consider air purifier |
| Poor | > 5000 p/0.1L | Red | Air purifier recommended |

### NO₂ (Nitrogen Dioxide)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 25 ppb | Green | Clean air |
| Good | 25-50 ppb | Light Green | Acceptable |
| Moderate | 50-100 ppb | Yellow | Slightly elevated |
| Elevated | 100-200 ppb | Orange | Limit exposure |
| Poor | > 200 ppb | Red | Take action |

### O₃ (Ozone)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 50 ppb | Green | Clean air |
| Good | 50-100 ppb | Light Green | Acceptable |
| Moderate | 100-130 ppb | Yellow | Slightly elevated |
| Elevated | 130-200 ppb | Orange | Limit outdoor exposure |
| Poor | > 200 ppb | Red | Avoid outdoor activity |

### SO₂ (Sulphur Dioxide)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 20 ppb | Green | Clean air |
| Good | 20-75 ppb | Light Green | Acceptable |
| Moderate | 75-185 ppb | Yellow | Slightly elevated |
| Elevated | 185-300 ppb | Orange | Limit exposure |
| Poor | > 300 ppb | Red | Take action |

### HCHO (Formaldehyde)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 20 ppb | Green | Safe levels |
| Good | 20-50 ppb | Light Green | Acceptable |
| Moderate | 50-100 ppb | Yellow | Consider ventilation |
| Elevated | 100-200 ppb | Orange | Ventilation needed |
| Poor | > 200 ppb | Red | Take action |

### tVOC (Volatile Organic Compounds)
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Excellent | < 100 ppb | Green | Clean air |
| Good | 100-300 ppb | Light Green | Acceptable |
| Moderate | 300-500 ppb | Yellow | Consider ventilation |
| Elevated | 500-1000 ppb | Orange | Ventilation needed |
| Poor | > 1000 ppb | Red | Take action |

### Humidity
| Level | Range | Color | Meaning |
|-------|-------|-------|---------|
| Too Dry | < 30% | Orange | Use humidifier |
| Dry | 30-40% | Light Green | Acceptable |
| Comfortable | 40-50% | Green | Ideal range |
| Humid | 50-60% | Light Green | Acceptable |
| Too Humid | > 60% | Orange | Improve ventilation |

## Supported Devices

This card works with any sensor that provides entities for the supported pollutants, humidity, or temperature. Use any combination -- even a single sensor works. Tested with:

- **WAQI (World Air Quality Index)** -- outdoor AQI, PM2.5, PM10, NO₂, O₃, SO₂, CO, humidity, temperature
- IKEA VINDSTYRKA / ALPSTUGA (via Matter)
- Aqara TVOC Air Quality Monitor
- Xiaomi Air Quality Monitor
- SenseAir S8
- AirGradient ONE / Open Air
- PurpleAir sensors
- Airthings Wave / Wave Plus (radon, CO₂, tVOC, humidity, temperature)
- Any ESPHome-based air quality sensor

## Development

```bash
# Clone the repository
git clone https://github.com/KadenThomp36/air-quality-card.git

# The card is vanilla JavaScript with no build step required
# Simply edit air-quality-card.js and test in Home Assistant

# Run tests
node test.js
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Other Cards

If you like this card, check out my other Home Assistant cards:

- [Garage Card](https://github.com/KadenThomp36/garage-card) -- A top-down visual garage card with door state, car presence, and light control

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=KadenThomp36/air-quality-card&type=Date)](https://star-history.com/#KadenThomp36/air-quality-card&Date)

## Support

If you find this card useful, consider buying me a coffee!

[![Buy Me a Coffee](https://raw.githubusercontent.com/KadenThomp36/air-quality-card/main/images/bmc-button.png)](https://buymeacoffee.com/kadenthomp36)

## Credits

- Thresholds based on [WHO 2021 Air Quality Guidelines](https://www.who.int/publications/i/item/9789240034228)
- CO₂ recommendations based on [ASHRAE Standard 62.1](https://www.ashrae.org/technical-resources/bookstore/standards-62-1-62-2)
- CO thresholds based on [EPA/WHO carbon monoxide guidelines](https://www.epa.gov/co-pollution)
- AQI breakpoint conversion based on [US EPA Technical Assistance Document for AQI](https://www.airnow.gov/sites/default/files/2020-05/aqi-technical-assistance-document-sept2018.pdf)
- Radon thresholds based on [EPA radon guidelines](https://www.epa.gov/radon) (4.0 pCi/L action level)
