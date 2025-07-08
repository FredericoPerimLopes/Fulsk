import { EnergyOptimizationService } from '@services/EnergyOptimizationService';
import { WeatherService } from '@services/WeatherService';
import { DatabaseDeviceService } from '@services/DatabaseDeviceService';
import axios from 'axios';

// Mock dependencies
jest.mock('@services/WeatherService');
jest.mock('@services/DatabaseDeviceService');
jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('EnergyOptimizationService', () => {
  let energyService: EnergyOptimizationService;
  
  beforeEach(() => {
    energyService = EnergyOptimizationService.getInstance();
    jest.clearAllMocks();
  });

  describe('Service Initialization', () => {
    it('should create a singleton instance', () => {
      const instance1 = EnergyOptimizationService.getInstance();
      const instance2 = EnergyOptimizationService.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBeInstanceOf(EnergyOptimizationService);
    });
  });

  describe('getCurrentEnergyPrices', () => {
    it('should return current energy prices', async () => {
      const result = await energyService.getCurrentEnergyPrices('test-location');
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      result.forEach(price => {
        expect(price.timestamp).toBeInstanceOf(Date);
        expect(typeof price.price).toBe('number');
        expect(price.price).toBeGreaterThan(0);
        expect(typeof price.currency).toBe('string');
        expect(['grid', 'spot_market', 'demand_response']).toContain(price.source);
      });
    });
  });

  describe('optimizeEnergyUsage', () => {
    it('should optimize energy usage for a device', async () => {
      // Mock device data
      const mockDeviceData = {
        deviceId: 'test-device-1',
        timestamp: new Date(),
        power: 3000,
        voltage: 240,
        current: 12.5,
        temperature: 35,
        efficiency: 92,
        energyToday: 25,
        energyTotal: 15000,
        status: 'ONLINE'
      };

      // Mock weather data
      const mockWeatherData = {
        temperature: 25,
        humidity: 60,
        windSpeed: 3.5,
        cloudCover: 30,
        timestamp: new Date()
      };

      // Mock services
      (DatabaseDeviceService.getAllDevices as jest.Mock).mockResolvedValue([{
        id: 'test-device-1',
        owner: 'test-owner'
      }]);
      
      (DatabaseDeviceService.getDeviceData as jest.Mock).mockResolvedValue([mockDeviceData]);
      
      const mockWeatherService = {
        getCurrentWeather: jest.fn().mockResolvedValue(mockWeatherData)
      };
      (WeatherService.getInstance as jest.Mock).mockReturnValue(mockWeatherService);

      const result = await energyService.optimizeEnergyUsage('test-device-1');
      
      expect(result).toBeDefined();
      expect(result.deviceId).toBe('test-device-1');
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.currentProduction).toBe('number');
      expect(typeof result.currentConsumption).toBe('number');
      expect(typeof result.batteryLevel).toBe('number');
      expect(typeof result.gridExport).toBe('number');
      expect(typeof result.gridImport).toBe('number');
      expect(Array.isArray(result.recommendations)).toBe(true);
      expect(typeof result.potentialSavings).toBe('number');
      expect(typeof result.optimizationScore).toBe('number');
      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
      expect(result.optimizationScore).toBeLessThanOrEqual(100);
    });
  });

  describe('optimizeBatteryStrategy', () => {
    it('should optimize battery charging/discharging strategy', async () => {
      // Mock weather forecast
      const mockForecast = [
        {
          date: new Date(),
          temperature: { min: 20, max: 30, average: 25 },
          cloudCover: 40,
          solarIrradiance: 600,
          expectedProduction: 20
        }
      ];

      const mockWeatherService = {
        getWeatherForecast: jest.fn().mockResolvedValue(mockForecast)
      };
      (WeatherService.getInstance as jest.Mock).mockReturnValue(mockWeatherService);

      const result = await energyService.optimizeBatteryStrategy('test-device-1');
      
      expect(result).toBeDefined();
      expect(result.deviceId).toBe('test-device-1');
      expect(typeof result.currentLevel).toBe('number');
      expect(typeof result.optimalLevel).toBe('number');
      expect(['solar_priority', 'grid_cheap', 'mixed']).toContain(result.chargingStrategy);
      expect(['peak_shaving', 'export_priority', 'backup_reserve']).toContain(result.dischargingStrategy);
      expect(Array.isArray(result.predictedActions)).toBe(true);
      
      result.predictedActions.forEach(action => {
        expect(['charge', 'discharge', 'hold']).toContain(action.action);
        expect(action.time).toBeInstanceOf(Date);
        expect(typeof action.amount).toBe('number');
        expect(typeof action.reason).toBe('string');
      });
    });
  });

  describe('setTradingStrategy', () => {
    it('should set trading strategy for a device', () => {
      const strategy = {
        strategy: 'buy_low_sell_high' as const,
        parameters: {
          buyThreshold: 10,
          sellThreshold: 20,
          batteryReserve: 25,
          maxTradeAmount: 50
        },
        active: true
      };

      // This should not throw an error
      expect(() => {
        energyService.setTradingStrategy('test-device-1', strategy);
      }).not.toThrow();
    });
  });

  describe('executeEnergyTrade', () => {
    it('should execute energy trade when conditions are met', async () => {
      // Set up a trading strategy first
      const strategy = {
        strategy: 'buy_low_sell_high' as const,
        parameters: {
          buyThreshold: 20, // Will allow buy at current mock price
          sellThreshold: 10, // Will allow sell at current mock price
          batteryReserve: 25,
          maxTradeAmount: 50
        },
        active: true
      };

      energyService.setTradingStrategy('test-device-1', strategy);

      // Test buy trade
      const buyResult = await energyService.executeEnergyTrade('test-device-1', 10, 'buy');
      expect(typeof buyResult).toBe('boolean');

      // Test sell trade
      const sellResult = await energyService.executeEnergyTrade('test-device-1', 10, 'sell');
      expect(typeof sellResult).toBe('boolean');
    });
  });

  describe('participateInDemandResponse', () => {
    it('should participate in demand response program', async () => {
      const result = await energyService.participateInDemandResponse('test-device-1', 'peak_shaving_1');
      
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getEnergyMarketForecast', () => {
    it('should return energy market forecast', async () => {
      const result = await energyService.getEnergyMarketForecast();
      
      expect(result).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(typeof result.spotPrice).toBe('number');
      expect(Array.isArray(result.forecasts)).toBe(true);
      expect(result.forecasts.length).toBe(24); // 24-hour forecast
      
      result.forecasts.forEach(forecast => {
        expect(forecast.time).toBeInstanceOf(Date);
        expect(typeof forecast.price).toBe('number');
        expect(typeof forecast.confidence).toBe('number');
        expect(forecast.confidence).toBeGreaterThanOrEqual(0);
        expect(forecast.confidence).toBeLessThanOrEqual(1);
      });
      
      expect(result.demandResponse).toBeDefined();
      expect(typeof result.demandResponse.active).toBe('boolean');
      expect(typeof result.demandResponse.rate).toBe('number');
      expect(typeof result.demandResponse.duration).toBe('number');
    });
  });

  afterEach(() => {
    energyService.cleanup();
  });
});