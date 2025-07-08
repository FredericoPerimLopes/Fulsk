import { WeatherService } from '@services/WeatherService';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WeatherService', () => {
  let weatherService: WeatherService;
  
  beforeEach(() => {
    weatherService = WeatherService.getInstance();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should create a singleton instance', () => {
      const instance1 = WeatherService.getInstance();
      const instance2 = WeatherService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(WeatherService);
    });
  });

  describe('getCurrentWeather', () => {
    it('should return current weather data for a device', async () => {
      const mockWeatherResponse = {
        data: {
          main: {
            temp: 25.5,
            humidity: 65,
            pressure: 1013.25
          },
          wind: {
            speed: 3.6,
            deg: 180
          },
          clouds: {
            all: 40
          },
          visibility: 10000,
          uvi: 5.2
        }
      };

      mockedAxios.get.mockResolvedValue(mockWeatherResponse);

      const result = await weatherService.getCurrentWeather('test-device-1');
      
      expect(result).toBeDefined();
      expect(result.temperature).toBe(25.5);
      expect(result.humidity).toBe(65);
      expect(result.pressure).toBe(1013.25);
      expect(result.windSpeed).toBe(3.6);
      expect(result.windDirection).toBe(180);
      expect(result.cloudCover).toBe(40);
      expect(result.visibility).toBe(10); // Converted from meters to km
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return mock data when API key is not configured', async () => {
      const result = await weatherService.getCurrentWeather('test-device-1');
      
      expect(result).toBeDefined();
      expect(typeof result.temperature).toBe('number');
      expect(typeof result.humidity).toBe('number');
      expect(typeof result.windSpeed).toBe('number');
      expect(typeof result.cloudCover).toBe('number');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getSolarData', () => {
    it('should return solar irradiance data', async () => {
      const result = await weatherService.getSolarData('test-device-1');
      
      expect(result).toBeDefined();
      expect(typeof result.irradiance).toBe('number');
      expect(typeof result.ghi).toBe('number');
      expect(typeof result.dni).toBe('number');
      expect(typeof result.dhi).toBe('number');
      expect(typeof result.sunAngle).toBe('number');
      expect(typeof result.sunAzimuth).toBe('number');
      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('getWeatherForecast', () => {
    it('should return weather forecast for next 7 days', async () => {
      const mockForecastResponse = {
        data: {
          list: [
            {
              dt: Math.floor(Date.now() / 1000) + 86400, // Tomorrow
              main: {
                temp: 24.5,
                humidity: 70
              },
              wind: {
                speed: 2.8
              },
              clouds: {
                all: 30
              },
              weather: [
                {
                  main: 'Clear'
                }
              ]
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValue(mockForecastResponse);

      const result = await weatherService.getWeatherForecast('test-device-1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(7);
      
      result.forEach(forecast => {
        expect(forecast.date).toBeInstanceOf(Date);
        expect(typeof forecast.temperature.min).toBe('number');
        expect(typeof forecast.temperature.max).toBe('number');
        expect(typeof forecast.temperature.average).toBe('number');
        expect(typeof forecast.humidity).toBe('number');
        expect(typeof forecast.windSpeed).toBe('number');
        expect(typeof forecast.cloudCover).toBe('number');
        expect(typeof forecast.precipitationChance).toBe('number');
        expect(typeof forecast.solarIrradiance).toBe('number');
        expect(typeof forecast.expectedProduction).toBe('number');
      });
    });
  });

  describe('analyzeWeatherImpact', () => {
    it('should analyze weather impact on solar performance', async () => {
      const result = await weatherService.analyzeWeatherImpact('test-device-1');
      
      expect(result).toBeDefined();
      expect(result.deviceId).toBe('test-device-1');
      expect(result.currentConditions).toBeDefined();
      expect(result.solarConditions).toBeDefined();
      expect(result.performanceImpact).toBeDefined();
      expect(result.recommendations).toBeDefined();
      expect(result.forecast).toBeDefined();
      
      // Check performance impact structure
      expect(typeof result.performanceImpact.temperature).toBe('number');
      expect(typeof result.performanceImpact.cloudCover).toBe('number');
      expect(typeof result.performanceImpact.humidity).toBe('number');
      expect(typeof result.performanceImpact.overall).toBe('number');
      
      // Check recommendations
      expect(Array.isArray(result.recommendations)).toBe(true);
      result.recommendations.forEach(rec => {
        expect(['maintenance', 'optimization', 'alert', 'planning']).toContain(rec.type);
        expect(['low', 'medium', 'high']).toContain(rec.priority);
        expect(typeof rec.description).toBe('string');
        expect(typeof rec.timeFrame).toBe('string');
        expect(typeof rec.expectedBenefit).toBe('string');
      });
    });
  });

  describe('predictSolarProduction', () => {
    it('should predict solar production for next 7 days', async () => {
      const result = await weatherService.predictSolarProduction('test-device-1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      result.forEach(prediction => {
        expect(prediction.date).toBeInstanceOf(Date);
        expect(typeof prediction.expectedProduction).toBe('number');
        expect(prediction.expectedProduction).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('getOptimalMaintenanceWindows', () => {
    it('should return optimal maintenance windows', async () => {
      const result = await weatherService.getOptimalMaintenanceWindows('test-device-1');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(3);
      
      result.forEach(window => {
        expect(window).toBeInstanceOf(Date);
      });
    });
  });

  describe('getHistoricalWeatherData', () => {
    it('should return historical weather data', async () => {
      const result = await weatherService.getHistoricalWeatherData('test-device-1');
      
      expect(result).toBeDefined();
      expect(result.deviceId).toBe('test-device-1');
      expect(typeof result.averageTemperature).toBe('number');
      expect(typeof result.averageHumidity).toBe('number');
      expect(typeof result.averageWindSpeed).toBe('number');
      expect(typeof result.averageCloudCover).toBe('number');
      expect(typeof result.averageIrradiance).toBe('number');
      expect(typeof result.temperatureRange).toBe('number');
      expect(typeof result.cloudCoverVariability).toBe('number');
      expect(typeof result.precipitationDays).toBe('number');
      expect(typeof result.extremeWeatherEvents).toBe('number');
    });
  });

  afterEach(() => {
    weatherService.cleanup();
  });
});