import axios from 'axios';
import logger from '@utils/logger';
import { DatabaseDeviceService } from './DatabaseDeviceService';
import { Device } from '@models/Device';

export interface WeatherData {
  temperature: number; // Celsius
  humidity: number; // Percentage
  windSpeed: number; // m/s
  windDirection: number; // degrees
  pressure: number; // hPa
  cloudCover: number; // Percentage
  visibility: number; // km
  uvIndex: number;
  timestamp: Date;
}

export interface SolarData {
  irradiance: number; // W/m²
  ghi: number; // Global Horizontal Irradiance
  dni: number; // Direct Normal Irradiance
  dhi: number; // Diffuse Horizontal Irradiance
  sunAngle: number; // degrees
  sunAzimuth: number; // degrees
  timestamp: Date;
}

export interface WeatherForecast {
  date: Date;
  temperature: {
    min: number;
    max: number;
    average: number;
  };
  humidity: number;
  windSpeed: number;
  cloudCover: number;
  precipitationChance: number;
  precipitationAmount: number; // mm
  solarIrradiance: number; // W/m²
  expectedProduction: number; // kWh
}

export interface WeatherImpactAnalysis {
  deviceId: string;
  currentConditions: WeatherData;
  solarConditions: SolarData;
  performanceImpact: {
    temperature: number; // -1 to 1 (negative = reduced performance)
    cloudCover: number;
    humidity: number;
    overall: number;
  };
  recommendations: WeatherRecommendation[];
  forecast: WeatherForecast[];
}

export interface WeatherRecommendation {
  type: 'maintenance' | 'optimization' | 'alert' | 'planning';
  priority: 'low' | 'medium' | 'high';
  description: string;
  timeFrame: string;
  expectedBenefit: string;
}

export interface HistoricalWeatherData {
  deviceId: string;
  averageTemperature: number;
  averageHumidity: number;
  averageWindSpeed: number;
  averageCloudCover: number;
  averageIrradiance: number;
  temperatureRange: number;
  cloudCoverVariability: number;
  precipitationDays: number;
  extremeWeatherEvents: number;
}

export class WeatherService {
  private static instance: WeatherService;
  private readonly openWeatherApiKey: string;
  private readonly solarApiKey: string;
  private readonly baseUrl = 'https://api.openweathermap.org/data/2.5';
  private readonly solarBaseUrl = 'https://api.solcast.com.au';
  private weatherCache: Map<string, { data: WeatherData; timestamp: Date }> = new Map();
  private forecastCache: Map<string, { data: WeatherForecast[]; timestamp: Date }> = new Map();
  private readonly cacheTimeout = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    this.openWeatherApiKey = process.env.OPENWEATHER_API_KEY || '';
    this.solarApiKey = process.env.SOLCAST_API_KEY || '';
    
    if (!this.openWeatherApiKey) {
      logger.warn('⚠️ OpenWeather API key not configured - weather features will be limited');
    }
  }

  public static getInstance(): WeatherService {
    if (!WeatherService.instance) {
      WeatherService.instance = new WeatherService();
    }
    return WeatherService.instance;
  }

  /**
   * Get current weather data for a device location
   */
  public async getCurrentWeather(deviceId: string): Promise<WeatherData> {
    try {
      const device = await this.getDeviceLocation(deviceId);
      const cacheKey = `${device.latitude},${device.longitude}`;
      
      // Check cache first
      const cached = this.weatherCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
        return cached.data;
      }

      if (!this.openWeatherApiKey) {
        return this.generateMockWeatherData();
      }

      const response = await axios.get(`${this.baseUrl}/weather`, {
        params: {
          lat: device.latitude,
          lon: device.longitude,
          appid: this.openWeatherApiKey,
          units: 'metric'
        }
      });

      const data = response.data;
      const weatherData: WeatherData = {
        temperature: data.main.temp,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        windDirection: data.wind.deg || 0,
        pressure: data.main.pressure,
        cloudCover: data.clouds.all,
        visibility: data.visibility / 1000, // Convert to km
        uvIndex: data.uvi || 0,
        timestamp: new Date()
      };

      // Cache the result
      this.weatherCache.set(cacheKey, { data: weatherData, timestamp: new Date() });
      
      logger.info(`🌤️ Retrieved weather data for device ${deviceId}: ${weatherData.temperature}°C, ${weatherData.cloudCover}% clouds`);
      return weatherData;
    } catch (error) {
      logger.error(`❌ Error fetching weather data for device ${deviceId}:`, error);
      return this.generateMockWeatherData();
    }
  }

  /**
   * Get solar irradiance data for a device location
   */
  public async getSolarData(deviceId: string): Promise<SolarData> {
    try {
      const device = await this.getDeviceLocation(deviceId);
      
      if (!this.solarApiKey) {
        return this.generateMockSolarData();
      }

      const response = await axios.get(`${this.solarBaseUrl}/radiation/estimated_actuals`, {
        params: {
          latitude: device.latitude,
          longitude: device.longitude,
          hours: 1,
          format: 'json'
        },
        headers: {
          'Authorization': `Bearer ${this.solarApiKey}`
        }
      });

      const data = response.data.estimated_actuals[0];
      const solarData: SolarData = {
        irradiance: data.ghi,
        ghi: data.ghi,
        dni: data.dni,
        dhi: data.dhi,
        sunAngle: this.calculateSunAngle(device.latitude, device.longitude),
        sunAzimuth: this.calculateSunAzimuth(device.latitude, device.longitude),
        timestamp: new Date()
      };

      logger.info(`☀️ Retrieved solar data for device ${deviceId}: ${solarData.irradiance} W/m²`);
      return solarData;
    } catch (error) {
      logger.error(`❌ Error fetching solar data for device ${deviceId}:`, error);
      return this.generateMockSolarData();
    }
  }

  /**
   * Get weather forecast for the next 7 days
   */
  public async getWeatherForecast(deviceId: string): Promise<WeatherForecast[]> {
    try {
      const device = await this.getDeviceLocation(deviceId);
      const cacheKey = `forecast_${device.latitude},${device.longitude}`;
      
      // Check cache first
      const cached = this.forecastCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
        return cached.data;
      }

      if (!this.openWeatherApiKey) {
        return this.generateMockForecast();
      }

      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          lat: device.latitude,
          lon: device.longitude,
          appid: this.openWeatherApiKey,
          units: 'metric'
        }
      });

      const forecast = this.processWeatherForecast(response.data.list, device);
      
      // Cache the result
      this.forecastCache.set(cacheKey, { data: forecast, timestamp: new Date() });
      
      logger.info(`📅 Retrieved weather forecast for device ${deviceId}: ${forecast.length} days`);
      return forecast;
    } catch (error) {
      logger.error(`❌ Error fetching weather forecast for device ${deviceId}:`, error);
      return this.generateMockForecast();
    }
  }

  /**
   * Analyze weather impact on solar panel performance
   */
  public async analyzeWeatherImpact(deviceId: string): Promise<WeatherImpactAnalysis> {
    try {
      const [currentWeather, solarData, forecast] = await Promise.all([
        this.getCurrentWeather(deviceId),
        this.getSolarData(deviceId),
        this.getWeatherForecast(deviceId)
      ]);

      const performanceImpact = this.calculatePerformanceImpact(currentWeather, solarData);
      const recommendations = this.generateWeatherRecommendations(currentWeather, solarData, forecast);

      const analysis: WeatherImpactAnalysis = {
        deviceId,
        currentConditions: currentWeather,
        solarConditions: solarData,
        performanceImpact,
        recommendations,
        forecast
      };

      logger.info(`🔍 Weather impact analysis for device ${deviceId}: ${(performanceImpact.overall * 100).toFixed(1)}% impact`);
      return analysis;
    } catch (error) {
      logger.error(`❌ Error analyzing weather impact for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get historical weather data for ML model training
   */
  public async getHistoricalWeatherData(deviceId: string): Promise<HistoricalWeatherData> {
    try {
      const device = await this.getDeviceLocation(deviceId);
      
      // In a real implementation, this would fetch historical data from weather API
      // For now, we'll generate realistic historical data
      const historicalData: HistoricalWeatherData = {
        deviceId,
        averageTemperature: 22.5,
        averageHumidity: 65,
        averageWindSpeed: 3.2,
        averageCloudCover: 35,
        averageIrradiance: 450,
        temperatureRange: 15,
        cloudCoverVariability: 25,
        precipitationDays: 45,
        extremeWeatherEvents: 3
      };

      logger.info(`📊 Retrieved historical weather data for device ${deviceId}`);
      return historicalData;
    } catch (error) {
      logger.error(`❌ Error fetching historical weather data for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Predict solar production based on weather forecast
   */
  public async predictSolarProduction(deviceId: string): Promise<{ date: Date; expectedProduction: number }[]> {
    try {
      const device = await this.getDeviceByIdFromDatabase(deviceId);
      const forecast = await this.getWeatherForecast(deviceId);
      
      const predictions = forecast.map(day => ({
        date: day.date,
        expectedProduction: this.calculateExpectedProduction(day, device)
      }));

      logger.info(`🔮 Generated solar production predictions for device ${deviceId}: ${predictions.length} days`);
      return predictions;
    } catch (error) {
      logger.error(`❌ Error predicting solar production for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get optimal maintenance windows based on weather
   */
  public async getOptimalMaintenanceWindows(deviceId: string): Promise<Date[]> {
    try {
      const forecast = await this.getWeatherForecast(deviceId);
      
      const optimalWindows = forecast
        .filter(day => 
          day.precipitationChance < 20 && 
          day.windSpeed < 10 && 
          day.temperature.max < 30
        )
        .map(day => day.date)
        .slice(0, 3); // Get next 3 optimal days

      logger.info(`🛠️ Found ${optimalWindows.length} optimal maintenance windows for device ${deviceId}`);
      return optimalWindows;
    } catch (error) {
      logger.error(`❌ Error finding optimal maintenance windows for device ${deviceId}:`, error);
      return [];
    }
  }

  /**
   * Private helper methods
   */
  private async getDeviceLocation(deviceId: string): Promise<{ latitude: number; longitude: number }> {
    const device = await this.getDeviceByIdFromDatabase(deviceId);
    return {
      latitude: device.latitude,
      longitude: device.longitude
    };
  }

  private async getDeviceByIdFromDatabase(deviceId: string): Promise<any> {
    // TODO: Implement proper database query
    return {
      id: deviceId,
      latitude: 37.7749,
      longitude: -122.4194,
      capacity: 5000 // watts
    };
  }

  private processWeatherForecast(forecastData: any[], device: any): WeatherForecast[] {
    const dailyForecasts = new Map<string, any[]>();
    
    // Group forecasts by date
    forecastData.forEach(item => {
      const date = new Date(item.dt * 1000).toDateString();
      if (!dailyForecasts.has(date)) {
        dailyForecasts.set(date, []);
      }
      dailyForecasts.get(date)!.push(item);
    });

    // Process each day
    const forecasts: WeatherForecast[] = [];
    for (const [dateStr, dayData] of dailyForecasts) {
      const date = new Date(dateStr);
      const temperatures = dayData.map(item => item.main.temp);
      const avgCloudCover = dayData.reduce((sum, item) => sum + item.clouds.all, 0) / dayData.length;
      const avgWindSpeed = dayData.reduce((sum, item) => sum + item.wind.speed, 0) / dayData.length;
      const avgHumidity = dayData.reduce((sum, item) => sum + item.main.humidity, 0) / dayData.length;
      
      const precipitationChance = dayData.some(item => item.weather[0].main === 'Rain') ? 60 : 20;
      const precipitationAmount = precipitationChance > 50 ? 5 : 0;
      const solarIrradiance = this.calculateSolarIrradiance(avgCloudCover, date);
      
      forecasts.push({
        date,
        temperature: {
          min: Math.min(...temperatures),
          max: Math.max(...temperatures),
          average: temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length
        },
        humidity: avgHumidity,
        windSpeed: avgWindSpeed,
        cloudCover: avgCloudCover,
        precipitationChance,
        precipitationAmount,
        solarIrradiance,
        expectedProduction: this.calculateExpectedProduction({
          solarIrradiance,
          temperature: { average: temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length },
          cloudCover: avgCloudCover
        } as any, device)
      });
    }

    return forecasts.slice(0, 7); // Return next 7 days
  }

  private calculatePerformanceImpact(weather: WeatherData, solar: SolarData): any {
    // Temperature impact (optimal around 25°C)
    const tempImpact = weather.temperature > 25 ? 
      -0.004 * (weather.temperature - 25) : 
      0.002 * (25 - weather.temperature);
    
    // Cloud cover impact
    const cloudImpact = -0.01 * weather.cloudCover;
    
    // Humidity impact (affects dust accumulation)
    const humidityImpact = weather.humidity > 70 ? -0.001 * (weather.humidity - 70) : 0;
    
    // Overall impact
    const overall = Math.max(-0.5, Math.min(0.2, tempImpact + cloudImpact + humidityImpact));

    return {
      temperature: Math.round(tempImpact * 100) / 100,
      cloudCover: Math.round(cloudImpact * 100) / 100,
      humidity: Math.round(humidityImpact * 100) / 100,
      overall: Math.round(overall * 100) / 100
    };
  }

  private generateWeatherRecommendations(weather: WeatherData, solar: SolarData, forecast: WeatherForecast[]): WeatherRecommendation[] {
    const recommendations: WeatherRecommendation[] = [];

    // High temperature recommendation
    if (weather.temperature > 35) {
      recommendations.push({
        type: 'alert',
        priority: 'high',
        description: 'High temperature detected - monitor system performance for thermal stress',
        timeFrame: 'Immediate',
        expectedBenefit: 'Prevent thermal damage and performance degradation'
      });
    }

    // Low solar irradiance recommendation
    if (solar.irradiance < 200) {
      recommendations.push({
        type: 'planning',
        priority: 'medium',
        description: 'Low solar irradiance - consider scheduling maintenance during this period',
        timeFrame: 'Today',
        expectedBenefit: 'Minimize production loss during maintenance'
      });
    }

    // High cloud cover recommendation
    if (weather.cloudCover > 80) {
      recommendations.push({
        type: 'optimization',
        priority: 'low',
        description: 'High cloud cover - system performance will be reduced',
        timeFrame: 'Today',
        expectedBenefit: 'Awareness of expected performance reduction'
      });
    }

    // Upcoming maintenance window
    const clearDays = forecast.filter(day => 
      day.precipitationChance < 30 && 
      day.cloudCover < 50 && 
      day.windSpeed < 15
    );

    if (clearDays.length > 0) {
      recommendations.push({
        type: 'maintenance',
        priority: 'medium',
        description: `Optimal maintenance window available on ${clearDays[0].date.toDateString()}`,
        timeFrame: 'Next 3 days',
        expectedBenefit: 'Ideal conditions for safe and effective maintenance'
      });
    }

    return recommendations;
  }

  private calculateSolarIrradiance(cloudCover: number, date: Date): number {
    // Simplified solar irradiance calculation based on cloud cover and season
    const baseIrradiance = 1000; // W/m² on clear day
    const seasonalFactor = 0.8 + 0.2 * Math.sin((date.getMonth() + 1) * Math.PI / 6); // Peak in summer
    const cloudFactor = 1 - (cloudCover / 100) * 0.8;
    
    return baseIrradiance * seasonalFactor * cloudFactor;
  }

  private calculateExpectedProduction(forecast: WeatherForecast, device: any): number {
    const peakSunHours = 6; // Average peak sun hours
    const systemEfficiency = 0.85; // System efficiency factor
    const temperatureDerating = forecast.temperature.average > 25 ? 
      1 - (forecast.temperature.average - 25) * 0.004 : 1;
    
    const dailyProduction = (device.capacity / 1000) * // Convert to kW
      (forecast.solarIrradiance / 1000) * // Convert to kW/m²
      peakSunHours * 
      systemEfficiency * 
      temperatureDerating;
    
    return Math.round(dailyProduction * 100) / 100;
  }

  private calculateSunAngle(latitude: number, longitude: number): number {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const solarDeclination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    const hourAngle = 15 * (now.getHours() - 12);
    
    const sunAngle = Math.asin(
      Math.sin(solarDeclination * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) +
      Math.cos(solarDeclination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) * Math.cos(hourAngle * Math.PI / 180)
    ) * 180 / Math.PI;
    
    return Math.max(0, sunAngle);
  }

  private calculateSunAzimuth(latitude: number, longitude: number): number {
    const now = new Date();
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const solarDeclination = 23.45 * Math.sin(2 * Math.PI * (284 + dayOfYear) / 365);
    const hourAngle = 15 * (now.getHours() - 12);
    
    const azimuth = Math.atan2(
      Math.sin(hourAngle * Math.PI / 180),
      Math.cos(hourAngle * Math.PI / 180) * Math.sin(latitude * Math.PI / 180) -
      Math.tan(solarDeclination * Math.PI / 180) * Math.cos(latitude * Math.PI / 180)
    ) * 180 / Math.PI;
    
    return (azimuth + 360) % 360;
  }

  private generateMockWeatherData(): WeatherData {
    return {
      temperature: 22 + Math.random() * 15,
      humidity: 40 + Math.random() * 40,
      windSpeed: Math.random() * 10,
      windDirection: Math.random() * 360,
      pressure: 1013 + Math.random() * 20 - 10,
      cloudCover: Math.random() * 100,
      visibility: 10 + Math.random() * 20,
      uvIndex: Math.random() * 10,
      timestamp: new Date()
    };
  }

  private generateMockSolarData(): SolarData {
    const baseIrradiance = 200 + Math.random() * 800;
    return {
      irradiance: baseIrradiance,
      ghi: baseIrradiance,
      dni: baseIrradiance * 0.8,
      dhi: baseIrradiance * 0.2,
      sunAngle: 30 + Math.random() * 60,
      sunAzimuth: Math.random() * 360,
      timestamp: new Date()
    };
  }

  private generateMockForecast(): WeatherForecast[] {
    const forecasts: WeatherForecast[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      const avgTemp = 20 + Math.random() * 10;
      const cloudCover = Math.random() * 100;
      const solarIrradiance = 1000 * (1 - cloudCover / 100);
      
      forecasts.push({
        date,
        temperature: {
          min: avgTemp - 5,
          max: avgTemp + 5,
          average: avgTemp
        },
        humidity: 50 + Math.random() * 30,
        windSpeed: Math.random() * 8,
        cloudCover,
        precipitationChance: Math.random() * 60,
        precipitationAmount: Math.random() * 10,
        solarIrradiance,
        expectedProduction: 15 + Math.random() * 20
      });
    }
    return forecasts;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.weatherCache.clear();
    this.forecastCache.clear();
    logger.info('🧹 Weather Service cleaned up');
  }
}

export const weatherService = WeatherService.getInstance();