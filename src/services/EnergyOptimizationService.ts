import { DeviceData, Device } from '@models/Device';
import { WeatherService } from './WeatherService';
import { DatabaseDeviceService } from './DatabaseDeviceService';
import { AIService } from './AIService';
import logger from '@utils/logger';
import axios from 'axios';

export interface EnergyPrice {
  timestamp: Date;
  price: number; // cents per kWh
  currency: string;
  source: 'grid' | 'spot_market' | 'demand_response';
}

export interface EnergyTradingStrategy {
  deviceId: string;
  strategy: 'buy_low_sell_high' | 'demand_response' | 'peak_shaving' | 'arbitrage';
  parameters: {
    buyThreshold: number; // price threshold for buying
    sellThreshold: number; // price threshold for selling
    batteryReserve: number; // minimum battery level to maintain
    maxTradeAmount: number; // maximum energy to trade per transaction
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnergyOptimizationResult {
  deviceId: string;
  timestamp: Date;
  currentProduction: number; // kWh
  currentConsumption: number; // kWh
  batteryLevel: number; // percentage
  gridExport: number; // kWh
  gridImport: number; // kWh
  recommendations: EnergyRecommendation[];
  potentialSavings: number; // dollars per month
  optimizationScore: number; // 0-100
}

export interface EnergyRecommendation {
  type: 'storage' | 'export' | 'consumption' | 'trading' | 'demand_response';
  priority: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  expectedSavings: number; // dollars
  timeFrame: string;
  actionRequired: boolean;
}

export interface BatteryOptimization {
  deviceId: string;
  currentLevel: number; // percentage
  optimalLevel: number; // percentage
  chargingStrategy: 'solar_priority' | 'grid_cheap' | 'mixed';
  dischargingStrategy: 'peak_shaving' | 'export_priority' | 'backup_reserve';
  predictedActions: {
    action: 'charge' | 'discharge' | 'hold';
    time: Date;
    amount: number; // kWh
    reason: string;
  }[];
}

export interface DemandResponseProgram {
  id: string;
  name: string;
  provider: string;
  type: 'peak_shaving' | 'load_shifting' | 'curtailment' | 'frequency_regulation';
  incentive: number; // dollars per kWh
  requirements: {
    minimumCapacity: number; // kW
    responseTime: number; // minutes
    duration: number; // minutes
  };
  active: boolean;
  participationHistory: {
    date: Date;
    amount: number; // kWh
    earnings: number; // dollars
  }[];
}

export interface EnergyMarketData {
  timestamp: Date;
  spotPrice: number; // cents per kWh
  forecasts: {
    time: Date;
    price: number;
    confidence: number;
  }[];
  demandResponse: {
    active: boolean;
    rate: number;
    duration: number;
  };
}

export class EnergyOptimizationService {
  private static instance: EnergyOptimizationService;
  private readonly energyApiKey: string;
  private readonly tradingStrategies: Map<string, EnergyTradingStrategy> = new Map();
  private readonly demandResponsePrograms: Map<string, DemandResponseProgram> = new Map();
  private priceCache: Map<string, { data: EnergyPrice[]; timestamp: Date }> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.energyApiKey = process.env.ENERGY_API_KEY || '';
    this.initializeDemandResponsePrograms();
  }

  public static getInstance(): EnergyOptimizationService {
    if (!EnergyOptimizationService.instance) {
      EnergyOptimizationService.instance = new EnergyOptimizationService();
    }
    return EnergyOptimizationService.instance;
  }

  /**
   * Get current energy prices from market
   */
  public async getCurrentEnergyPrices(location: string): Promise<EnergyPrice[]> {
    try {
      const cacheKey = `prices_${location}`;
      
      // Check cache first
      const cached = this.priceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
        return cached.data;
      }

      if (!this.energyApiKey) {
        return this.generateMockEnergyPrices();
      }

      // In a real implementation, this would call actual energy market APIs
      // For now, we'll generate realistic price data
      const prices = this.generateMockEnergyPrices();
      
      // Cache the result
      this.priceCache.set(cacheKey, { data: prices, timestamp: new Date() });
      
      logger.info(`💰 Retrieved energy prices for ${location}: ${prices[0].price} cents/kWh`);
      return prices;
    } catch (error) {
      logger.error(`❌ Error fetching energy prices for ${location}:`, error);
      return this.generateMockEnergyPrices();
    }
  }

  /**
   * Optimize energy usage for a device
   */
  public async optimizeEnergyUsage(deviceId: string): Promise<EnergyOptimizationResult> {
    try {
      logger.info(`⚡ Optimizing energy usage for device ${deviceId}`);

      // Gather current data
      const [deviceData, weatherData, energyPrices] = await Promise.all([
        this.getCurrentDeviceData(deviceId),
        WeatherService.getInstance().getCurrentWeather(deviceId),
        this.getCurrentEnergyPrices('default')
      ]);

      // Get battery status if available
      const batteryLevel = await this.getBatteryLevel(deviceId);
      
      // Calculate current energy flows
      const energyFlows = this.calculateEnergyFlows(deviceData, batteryLevel);
      
      // Generate optimization recommendations
      const recommendations = await this.generateEnergyRecommendations(
        deviceId, 
        deviceData, 
        energyPrices, 
        weatherData,
        batteryLevel
      );

      // Calculate potential savings
      const potentialSavings = this.calculatePotentialSavings(recommendations);
      
      // Calculate optimization score
      const optimizationScore = this.calculateOptimizationScore(energyFlows, recommendations);

      const result: EnergyOptimizationResult = {
        deviceId,
        timestamp: new Date(),
        currentProduction: energyFlows.production,
        currentConsumption: energyFlows.consumption,
        batteryLevel,
        gridExport: energyFlows.gridExport,
        gridImport: energyFlows.gridImport,
        recommendations,
        potentialSavings,
        optimizationScore
      };

      logger.info(`📊 Energy optimization complete for ${deviceId}: ${optimizationScore}% score, $${potentialSavings}/month savings`);
      return result;
    } catch (error) {
      logger.error(`❌ Error optimizing energy usage for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Optimize battery charging/discharging strategy
   */
  public async optimizeBatteryStrategy(deviceId: string): Promise<BatteryOptimization> {
    try {
      logger.info(`🔋 Optimizing battery strategy for device ${deviceId}`);

      const [currentLevel, energyPrices, weatherForecast] = await Promise.all([
        this.getBatteryLevel(deviceId),
        this.getCurrentEnergyPrices('default'),
        WeatherService.getInstance().getWeatherForecast(deviceId)
      ]);

      // Determine optimal charging strategy
      const chargingStrategy = this.determineChargingStrategy(energyPrices, weatherForecast);
      
      // Determine optimal discharging strategy
      const dischargingStrategy = this.determineDischargingStrategy(energyPrices);
      
      // Calculate optimal battery level
      const optimalLevel = this.calculateOptimalBatteryLevel(energyPrices, weatherForecast);
      
      // Generate predicted actions for the next 24 hours
      const predictedActions = await this.generateBatteryActions(
        deviceId, 
        currentLevel, 
        energyPrices, 
        weatherForecast
      );

      const optimization: BatteryOptimization = {
        deviceId,
        currentLevel,
        optimalLevel,
        chargingStrategy,
        dischargingStrategy,
        predictedActions
      };

      logger.info(`🔋 Battery optimization complete for ${deviceId}: ${optimalLevel}% target level`);
      return optimization;
    } catch (error) {
      logger.error(`❌ Error optimizing battery strategy for device ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Execute energy trading strategy
   */
  public async executeEnergyTrade(deviceId: string, amount: number, type: 'buy' | 'sell'): Promise<boolean> {
    try {
      logger.info(`💱 Executing energy trade for device ${deviceId}: ${type} ${amount} kWh`);

      const strategy = this.tradingStrategies.get(deviceId);
      if (!strategy || !strategy.active) {
        logger.warn(`⚠️ No active trading strategy for device ${deviceId}`);
        return false;
      }

      const currentPrices = await this.getCurrentEnergyPrices('default');
      const currentPrice = currentPrices[0].price;

      // Validate trade against strategy parameters
      if (type === 'buy' && currentPrice > strategy.parameters.buyThreshold) {
        logger.warn(`⚠️ Current price ${currentPrice} exceeds buy threshold ${strategy.parameters.buyThreshold}`);
        return false;
      }

      if (type === 'sell' && currentPrice < strategy.parameters.sellThreshold) {
        logger.warn(`⚠️ Current price ${currentPrice} below sell threshold ${strategy.parameters.sellThreshold}`);
        return false;
      }

      if (amount > strategy.parameters.maxTradeAmount) {
        logger.warn(`⚠️ Trade amount ${amount} exceeds maximum ${strategy.parameters.maxTradeAmount}`);
        return false;
      }

      // Execute the trade (in a real implementation, this would call trading APIs)
      const success = await this.executeTradeTransaction(deviceId, amount, type, currentPrice);
      
      if (success) {
        logger.info(`✅ Energy trade executed successfully: ${type} ${amount} kWh at ${currentPrice} cents/kWh`);
        await this.recordTradeTransaction(deviceId, amount, type, currentPrice);
      }

      return success;
    } catch (error) {
      logger.error(`❌ Error executing energy trade for device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Participate in demand response program
   */
  public async participateInDemandResponse(deviceId: string, programId: string): Promise<boolean> {
    try {
      logger.info(`📋 Participating in demand response program ${programId} for device ${deviceId}`);

      const program = this.demandResponsePrograms.get(programId);
      if (!program || !program.active) {
        logger.warn(`⚠️ Demand response program ${programId} not available`);
        return false;
      }

      const deviceCapacity = await this.getDeviceCapacity(deviceId);
      if (deviceCapacity < program.requirements.minimumCapacity) {
        logger.warn(`⚠️ Device capacity ${deviceCapacity} below minimum ${program.requirements.minimumCapacity}`);
        return false;
      }

      // Calculate participation amount
      const participationAmount = Math.min(deviceCapacity, deviceCapacity * 0.5); // Limit to 50% of capacity

      // Execute demand response action
      const success = await this.executeDemandResponseAction(deviceId, participationAmount, program);
      
      if (success) {
        const earnings = participationAmount * program.incentive;
        logger.info(`✅ Demand response participation successful: ${participationAmount} kWh, earned $${earnings}`);
        
        // Record participation
        program.participationHistory.push({
          date: new Date(),
          amount: participationAmount,
          earnings
        });
      }

      return success;
    } catch (error) {
      logger.error(`❌ Error participating in demand response for device ${deviceId}:`, error);
      return false;
    }
  }

  /**
   * Set energy trading strategy for a device
   */
  public setTradingStrategy(deviceId: string, strategy: Partial<EnergyTradingStrategy>): void {
    const existingStrategy = this.tradingStrategies.get(deviceId);
    
    const newStrategy: EnergyTradingStrategy = {
      deviceId,
      strategy: strategy.strategy || 'buy_low_sell_high',
      parameters: {
        buyThreshold: strategy.parameters?.buyThreshold || 10, // cents/kWh
        sellThreshold: strategy.parameters?.sellThreshold || 20, // cents/kWh
        batteryReserve: strategy.parameters?.batteryReserve || 20, // percentage
        maxTradeAmount: strategy.parameters?.maxTradeAmount || 50 // kWh
      },
      active: strategy.active !== undefined ? strategy.active : true,
      createdAt: existingStrategy?.createdAt || new Date(),
      updatedAt: new Date()
    };

    this.tradingStrategies.set(deviceId, newStrategy);
    logger.info(`📝 Trading strategy updated for device ${deviceId}: ${newStrategy.strategy}`);
  }

  /**
   * Get energy market forecast
   */
  public async getEnergyMarketForecast(): Promise<EnergyMarketData> {
    try {
      const currentPrices = await this.getCurrentEnergyPrices('default');
      const currentPrice = currentPrices[0].price;

      // Generate 24-hour price forecast
      const forecasts = [];
      for (let i = 1; i <= 24; i++) {
        const time = new Date();
        time.setHours(time.getHours() + i);
        
        // Simple price forecast model (in production, use ML model)
        const basePrice = currentPrice;
        const timeVariation = Math.sin(i * Math.PI / 12) * 5; // Peak during day
        const randomVariation = (Math.random() - 0.5) * 3;
        const price = Math.max(5, basePrice + timeVariation + randomVariation);
        
        forecasts.push({
          time,
          price,
          confidence: 0.7 + Math.random() * 0.3
        });
      }

      const marketData: EnergyMarketData = {
        timestamp: new Date(),
        spotPrice: currentPrice,
        forecasts,
        demandResponse: {
          active: Math.random() > 0.7,
          rate: 25 + Math.random() * 10,
          duration: 60 + Math.random() * 120
        }
      };

      logger.info(`📈 Energy market forecast generated: ${forecasts.length} hours`);
      return marketData;
    } catch (error) {
      logger.error('❌ Error generating energy market forecast:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async getCurrentDeviceData(deviceId: string): Promise<DeviceData> {
    const devices = await DatabaseDeviceService.getAllDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    const deviceData = await DatabaseDeviceService.getDeviceData(deviceId, device.owner, 1);
    return deviceData[0] || this.generateMockDeviceData(deviceId);
  }

  private async getBatteryLevel(deviceId: string): Promise<number> {
    // In a real implementation, this would query battery management system
    return 45 + Math.random() * 50; // Mock battery level 45-95%
  }

  private calculateEnergyFlows(deviceData: DeviceData, batteryLevel: number): any {
    const production = deviceData.power / 1000; // Convert W to kW
    const consumption = production * 0.3; // Assume 30% self-consumption
    const batteryCharge = batteryLevel > 80 ? 0 : production * 0.2; // Charge if below 80%
    const gridExport = Math.max(0, production - consumption - batteryCharge);
    const gridImport = Math.max(0, consumption - production);

    return {
      production,
      consumption,
      batteryCharge,
      gridExport,
      gridImport
    };
  }

  private async generateEnergyRecommendations(
    deviceId: string,
    deviceData: DeviceData,
    energyPrices: EnergyPrice[],
    weatherData: any,
    batteryLevel: number
  ): Promise<EnergyRecommendation[]> {
    const recommendations: EnergyRecommendation[] = [];
    const currentPrice = energyPrices[0].price;

    // Battery optimization recommendations
    if (batteryLevel < 30 && currentPrice < 15) {
      recommendations.push({
        type: 'storage',
        priority: 'high',
        description: 'Charge battery from grid during low price period',
        expectedSavings: 8.50,
        timeFrame: 'Next 2 hours',
        actionRequired: true
      });
    }

    // Export optimization recommendations
    if (deviceData.power > 3000 && currentPrice > 20) {
      recommendations.push({
        type: 'export',
        priority: 'medium',
        description: 'Maximize grid export during high price period',
        expectedSavings: 12.30,
        timeFrame: 'Next 4 hours',
        actionRequired: false
      });
    }

    // Demand response recommendations
    if (currentPrice > 25) {
      recommendations.push({
        type: 'demand_response',
        priority: 'high',
        description: 'Participate in demand response program to earn incentives',
        expectedSavings: 15.75,
        timeFrame: 'Next 1 hour',
        actionRequired: true
      });
    }

    // Weather-based recommendations
    if (weatherData.cloudCover > 70) {
      recommendations.push({
        type: 'consumption',
        priority: 'medium',
        description: 'Defer non-essential loads due to low solar production',
        expectedSavings: 5.20,
        timeFrame: 'Today',
        actionRequired: false
      });
    }

    return recommendations;
  }

  private calculatePotentialSavings(recommendations: EnergyRecommendation[]): number {
    return recommendations.reduce((total, rec) => total + rec.expectedSavings, 0);
  }

  private calculateOptimizationScore(energyFlows: any, recommendations: EnergyRecommendation[]): number {
    const selfConsumptionRatio = energyFlows.consumption / energyFlows.production;
    const exportEfficiency = energyFlows.gridExport / energyFlows.production;
    const actionableRecommendations = recommendations.filter(r => r.actionRequired).length;
    
    let score = 50; // Base score
    
    // Reward high self-consumption
    score += selfConsumptionRatio * 30;
    
    // Reward efficient export
    score += exportEfficiency * 20;
    
    // Penalize actionable recommendations (indicating suboptimal performance)
    score -= actionableRecommendations * 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private determineChargingStrategy(energyPrices: EnergyPrice[], weatherForecast: any[]): BatteryOptimization['chargingStrategy'] {
    const avgPrice = energyPrices.reduce((sum, p) => sum + p.price, 0) / energyPrices.length;
    const lowPriceHours = energyPrices.filter(p => p.price < avgPrice * 0.8).length;
    const cloudyDays = weatherForecast.filter(day => day.cloudCover > 60).length;
    
    if (lowPriceHours > 6 && cloudyDays > 2) {
      return 'grid_cheap';
    } else if (cloudyDays <= 1) {
      return 'solar_priority';
    } else {
      return 'mixed';
    }
  }

  private determineDischargingStrategy(energyPrices: EnergyPrice[]): BatteryOptimization['dischargingStrategy'] {
    const avgPrice = energyPrices.reduce((sum, p) => sum + p.price, 0) / energyPrices.length;
    const highPriceHours = energyPrices.filter(p => p.price > avgPrice * 1.2).length;
    
    if (highPriceHours > 4) {
      return 'export_priority';
    } else if (highPriceHours > 2) {
      return 'peak_shaving';
    } else {
      return 'backup_reserve';
    }
  }

  private calculateOptimalBatteryLevel(energyPrices: EnergyPrice[], weatherForecast: any[]): number {
    const avgPrice = energyPrices.reduce((sum, p) => sum + p.price, 0) / energyPrices.length;
    const highPriceHours = energyPrices.filter(p => p.price > avgPrice * 1.2).length;
    const sunnyDays = weatherForecast.filter(day => day.cloudCover < 40).length;
    
    let optimalLevel = 50; // Base level
    
    // Increase for high price periods
    optimalLevel += highPriceHours * 2;
    
    // Decrease for sunny weather (more solar production)
    optimalLevel -= sunnyDays * 3;
    
    // Increase for cloudy weather (less solar production)
    optimalLevel += (7 - sunnyDays) * 2;
    
    return Math.max(20, Math.min(95, optimalLevel));
  }

  private async generateBatteryActions(
    deviceId: string,
    currentLevel: number,
    energyPrices: EnergyPrice[],
    weatherForecast: any[]
  ): Promise<BatteryOptimization['predictedActions']> {
    const actions: BatteryOptimization['predictedActions'] = [];
    let batteryLevel = currentLevel;
    
    for (let hour = 1; hour <= 24; hour++) {
      const time = new Date();
      time.setHours(time.getHours() + hour);
      
      const currentPrice = energyPrices[Math.min(hour - 1, energyPrices.length - 1)].price;
      const avgPrice = energyPrices.reduce((sum, p) => sum + p.price, 0) / energyPrices.length;
      
      // Determine action based on price and battery level
      if (currentPrice < avgPrice * 0.8 && batteryLevel < 80) {
        // Charge during low prices
        const chargeAmount = Math.min(10, 80 - batteryLevel);
        actions.push({
          action: 'charge',
          time,
          amount: chargeAmount,
          reason: `Low energy price: ${currentPrice} cents/kWh`
        });
        batteryLevel += chargeAmount;
      } else if (currentPrice > avgPrice * 1.2 && batteryLevel > 30) {
        // Discharge during high prices
        const dischargeAmount = Math.min(15, batteryLevel - 30);
        actions.push({
          action: 'discharge',
          time,
          amount: dischargeAmount,
          reason: `High energy price: ${currentPrice} cents/kWh`
        });
        batteryLevel -= dischargeAmount;
      } else {
        // Hold current level
        actions.push({
          action: 'hold',
          time,
          amount: 0,
          reason: 'Optimal battery level for current conditions'
        });
      }
    }
    
    return actions;
  }

  private async executeTradeTransaction(deviceId: string, amount: number, type: 'buy' | 'sell', price: number): Promise<boolean> {
    // In a real implementation, this would call energy trading APIs
    // For simulation purposes, we'll assume 95% success rate
    const success = Math.random() > 0.05;
    
    if (success) {
      await this.recordTradeTransaction(deviceId, amount, type, price);
    }
    
    return success;
  }

  private async recordTradeTransaction(deviceId: string, amount: number, type: 'buy' | 'sell', price: number): Promise<void> {
    // Record trade transaction in database
    logger.info(`📊 Recording trade transaction: ${deviceId} ${type} ${amount} kWh at ${price} cents/kWh`);
  }

  private async executeDemandResponseAction(deviceId: string, amount: number, program: DemandResponseProgram): Promise<boolean> {
    // In a real implementation, this would send commands to the device
    // For simulation purposes, we'll assume 90% success rate
    return Math.random() > 0.1;
  }

  private async getDeviceCapacity(deviceId: string): Promise<number> {
    // In a real implementation, this would query device specifications
    return 5000; // Mock 5kW capacity
  }

  private generateMockEnergyPrices(): EnergyPrice[] {
    const prices: EnergyPrice[] = [];
    const basePrice = 15; // cents per kWh
    
    for (let i = 0; i < 24; i++) {
      const time = new Date();
      time.setHours(time.getHours() + i);
      
      // Simulate time-of-use pricing
      let price = basePrice;
      if (i >= 17 && i <= 21) {
        price += 10; // Peak hours
      } else if (i >= 0 && i <= 6) {
        price -= 5; // Off-peak hours
      }
      
      // Add some randomness
      price += (Math.random() - 0.5) * 4;
      
      prices.push({
        timestamp: time,
        price: Math.max(5, price),
        currency: 'USD',
        source: 'spot_market'
      });
    }
    
    return prices;
  }

  private generateMockDeviceData(deviceId: string): DeviceData {
    return {
      deviceId,
      timestamp: new Date(),
      power: 3000 + Math.random() * 2000,
      voltage: 240 + Math.random() * 20,
      current: 12 + Math.random() * 8,
      temperature: 30 + Math.random() * 15,
      efficiency: 85 + Math.random() * 10,
      energyToday: 25 + Math.random() * 15,
      energyTotal: 15000 + Math.random() * 5000,
      status: 'ONLINE' as any
    };
  }

  private initializeDemandResponsePrograms(): void {
    // Initialize some sample demand response programs
    this.demandResponsePrograms.set('peak_shaving_1', {
      id: 'peak_shaving_1',
      name: 'Peak Shaving Program',
      provider: 'Utility Company',
      type: 'peak_shaving',
      incentive: 0.25, // dollars per kWh
      requirements: {
        minimumCapacity: 5, // kW
        responseTime: 10, // minutes
        duration: 120 // minutes
      },
      active: true,
      participationHistory: []
    });

    this.demandResponsePrograms.set('load_shifting_1', {
      id: 'load_shifting_1',
      name: 'Load Shifting Program',
      provider: 'Energy Aggregator',
      type: 'load_shifting',
      incentive: 0.15, // dollars per kWh
      requirements: {
        minimumCapacity: 3, // kW
        responseTime: 30, // minutes
        duration: 240 // minutes
      },
      active: true,
      participationHistory: []
    });
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.tradingStrategies.clear();
    this.demandResponsePrograms.clear();
    this.priceCache.clear();
    logger.info('🧹 Energy Optimization Service cleaned up');
  }
}

export const energyOptimizationService = EnergyOptimizationService.getInstance();