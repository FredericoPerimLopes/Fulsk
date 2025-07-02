-- SunSpec Model Definitions Seeding Script
-- This script populates the sunspec_models table with standard SunSpec model definitions

-- Insert SunSpec Model 101 - Single Phase Inverter
INSERT INTO sunspec_models (
    id, modelNumber, name, description, version, modelType, blockLength,
    dataPoints, mandatoryPoints, optionalPoints
) VALUES (
    'sunspec_model_101',
    101,
    'Single Phase Inverter',
    'Single phase inverter model with basic AC measurements',
    '1.0',
    'INVERTER',
    50,
    '{
        "A": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Total Current"},
        "AphA": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase A Current", "mandatory": true},
        "PhVphA": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase A Voltage", "mandatory": true},
        "W": {"type": "int16", "units": "W", "scaleFactor": "W_SF", "description": "AC Power", "mandatory": true},
        "Hz": {"type": "uint16", "units": "Hz", "scaleFactor": "Hz_SF", "description": "Line Frequency", "mandatory": true},
        "VA": {"type": "int16", "units": "VA", "scaleFactor": "VA_SF", "description": "AC Apparent Power"},
        "VAr": {"type": "int16", "units": "var", "scaleFactor": "VAr_SF", "description": "AC Reactive Power"},
        "PF": {"type": "int16", "units": "Pct", "scaleFactor": "PF_SF", "description": "Power Factor"},
        "WH": {"type": "acc32", "units": "Wh", "scaleFactor": "WH_SF", "description": "AC Energy"},
        "DCA": {"type": "uint16", "units": "A", "scaleFactor": "DCA_SF", "description": "DC Current"},
        "DCV": {"type": "uint16", "units": "V", "scaleFactor": "DCV_SF", "description": "DC Voltage"},
        "DCW": {"type": "int16", "units": "W", "scaleFactor": "DCW_SF", "description": "DC Power"},
        "TmpCab": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Cabinet Temperature"},
        "TmpSnk": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Heat Sink Temperature"},
        "TmpTrns": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Transformer Temperature"},
        "TmpOt": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Other Temperature"},
        "St": {"type": "enum16", "description": "Operating State"},
        "StVnd": {"type": "enum16", "description": "Vendor Operating State"},
        "Evt1": {"type": "bitfield32", "description": "Event Flags 1"},
        "Evt2": {"type": "bitfield32", "description": "Event Flags 2"},
        "EvtVnd1": {"type": "bitfield32", "description": "Vendor Event Flags 1"},
        "EvtVnd2": {"type": "bitfield32", "description": "Vendor Event Flags 2"}
    }',
    ARRAY['A', 'AphA', 'PhVphA', 'W', 'Hz'],
    ARRAY['AphB', 'AphC', 'PPVphAB', 'PPVphBC', 'PPVphCA', 'PhVphB', 'PhVphC', 'VA', 'VAr', 'PF', 'WH', 'DCA', 'DCV', 'DCW', 'DCWH', 'TmpCab', 'TmpSnk', 'TmpTrns', 'TmpOt', 'St', 'StVnd', 'Evt1', 'Evt2', 'EvtVnd1', 'EvtVnd2']
) ON CONFLICT (modelNumber) DO NOTHING;

-- Insert SunSpec Model 102 - Split Phase Inverter
INSERT INTO sunspec_models (
    id, modelNumber, name, description, version, modelType, blockLength,
    dataPoints, mandatoryPoints, optionalPoints
) VALUES (
    'sunspec_model_102',
    102,
    'Split Phase Inverter',
    'Split phase inverter model with dual phase measurements',
    '1.0',
    'INVERTER',
    50,
    '{
        "A": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "AC Total Current"},
        "AphA": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase A Current", "mandatory": true},
        "AphB": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase B Current", "mandatory": true},
        "AphC": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase C Current"},
        "PhVphA": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase A Voltage", "mandatory": true},
        "PhVphB": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase B Voltage", "mandatory": true},
        "PhVphC": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase C Voltage"},
        "PPVphAB": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase Voltage AB"},
        "PPVphBC": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase Voltage BC"},
        "PPVphCA": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase Voltage CA"},
        "W": {"type": "int16", "units": "W", "scaleFactor": "W_SF", "description": "AC Power", "mandatory": true},
        "Hz": {"type": "uint16", "units": "Hz", "scaleFactor": "Hz_SF", "description": "Line Frequency", "mandatory": true}
    }',
    ARRAY['A', 'AphA', 'AphB', 'PhVphA', 'PhVphB', 'W', 'Hz'],
    ARRAY['AphC', 'PhVphC', 'PPVphAB', 'PPVphBC', 'PPVphCA', 'VA', 'VAr', 'PF', 'WH', 'DCA', 'DCV', 'DCW', 'DCWH']
) ON CONFLICT (modelNumber) DO NOTHING;

-- Insert SunSpec Model 103 - Three Phase Inverter
INSERT INTO sunspec_models (
    id, modelNumber, name, description, version, modelType, blockLength,
    dataPoints, mandatoryPoints, optionalPoints
) VALUES (
    'sunspec_model_103',
    103,
    'Three Phase Inverter',
    'Three phase inverter model with complete three-phase measurements',
    '1.0',
    'INVERTER',
    50,
    '{
        "A": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "AC Total Current"},
        "AphA": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase A Current"},
        "AphB": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase B Current"},
        "AphC": {"type": "uint16", "units": "A", "scaleFactor": "A_SF", "description": "Phase C Current"},
        "PPVphAB": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase Voltage AB"},
        "PPVphBC": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase Voltage BC"},
        "PPVphCA": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase Voltage CA"},
        "PhVphA": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase A Voltage"},
        "PhVphB": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase B Voltage"},
        "PhVphC": {"type": "uint16", "units": "V", "scaleFactor": "V_SF", "description": "Phase C Voltage"},
        "W": {"type": "int16", "units": "W", "scaleFactor": "W_SF", "description": "AC Power"},
        "WH": {"type": "acc32", "units": "Wh", "scaleFactor": "WH_SF", "description": "AC Energy"},
        "DCA": {"type": "uint16", "units": "A", "scaleFactor": "DCA_SF", "description": "DC Current"},
        "DCV": {"type": "uint16", "units": "V", "scaleFactor": "DCV_SF", "description": "DC Voltage"},
        "DCW": {"type": "int16", "units": "W", "scaleFactor": "DCW_SF", "description": "DC Power"},
        "DCWH": {"type": "acc32", "units": "Wh", "scaleFactor": "DCWH_SF", "description": "DC Energy"},
        "Hz": {"type": "uint16", "units": "Hz", "scaleFactor": "Hz_SF", "description": "Line Frequency"},
        "VA": {"type": "int16", "units": "VA", "scaleFactor": "VA_SF", "description": "AC Apparent Power"},
        "VAr": {"type": "int16", "units": "var", "scaleFactor": "VAr_SF", "description": "AC Reactive Power"},
        "PF": {"type": "int16", "units": "Pct", "scaleFactor": "PF_SF", "description": "Power Factor"},
        "TmpCab": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Cabinet Temperature"},
        "TmpSnk": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Heat Sink Temperature"},
        "TmpTrns": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Transformer Temperature"},
        "TmpOt": {"type": "int16", "units": "C", "scaleFactor": "Tmp_SF", "description": "Other Temperature"},
        "St": {"type": "enum16", "description": "Operating State"},
        "StVnd": {"type": "enum16", "description": "Vendor Operating State"},
        "Evt1": {"type": "bitfield32", "description": "Event Flags 1"},
        "Evt2": {"type": "bitfield32", "description": "Event Flags 2"}
    }',
    ARRAY['A', 'W', 'Hz', 'St'],
    ARRAY['AphA', 'AphB', 'AphC', 'PPVphAB', 'PPVphBC', 'PPVphCA', 'PhVphA', 'PhVphB', 'PhVphC', 'WH', 'DCA', 'DCV', 'DCW', 'DCWH', 'VA', 'VAr', 'PF', 'TmpCab', 'TmpSnk', 'TmpTrns', 'TmpOt', 'StVnd', 'Evt1', 'Evt2']
) ON CONFLICT (modelNumber) DO NOTHING;

-- Insert SunSpec Model 160 - Multiple MPPT Inverter Extension
INSERT INTO sunspec_models (
    id, modelNumber, name, description, version, modelType, blockLength,
    dataPoints, mandatoryPoints, optionalPoints
) VALUES (
    'sunspec_model_160',
    160,
    'Multiple MPPT Inverter Extension',
    'Extension model for inverters with multiple MPPT inputs',
    '1.0',
    'EXTENSION',
    28,
    '{
        "DCA_SF": {"type": "sunssf", "description": "DC Current Scale Factor"},
        "DCV_SF": {"type": "sunssf", "description": "DC Voltage Scale Factor"},
        "DCW_SF": {"type": "sunssf", "description": "DC Power Scale Factor"},
        "DCWH_SF": {"type": "sunssf", "description": "DC Energy Scale Factor"},
        "Evt": {"type": "bitfield32", "description": "Global Events"},
        "N": {"type": "count", "description": "Number of Modules"},
        "TmsPer": {"type": "uint16", "description": "Timestamp Period"},
        "ID": {"type": "uint16", "description": "Module ID"},
        "IDStr": {"type": "string", "length": 8, "description": "Module ID String"},
        "DCA": {"type": "uint16", "units": "A", "scaleFactor": "DCA_SF", "description": "DC Current"},
        "DCV": {"type": "uint16", "units": "V", "scaleFactor": "DCV_SF", "description": "DC Voltage"},
        "DCW": {"type": "uint16", "units": "W", "scaleFactor": "DCW_SF", "description": "DC Power"},
        "DCWH": {"type": "acc32", "units": "Wh", "scaleFactor": "DCWH_SF", "description": "Lifetime Energy"},
        "Tms": {"type": "uint32", "units": "Secs", "description": "Timestamp"},
        "Tmp": {"type": "int16", "units": "C", "description": "Temperature"},
        "DCSt": {"type": "enum16", "description": "Operating State"},
        "DCEvt": {"type": "bitfield32", "description": "Module Events"}
    }',
    ARRAY['DCA_SF', 'DCV_SF', 'DCW_SF', 'DCWH_SF', 'N'],
    ARRAY['Evt', 'TmsPer', 'ID', 'IDStr', 'DCA', 'DCV', 'DCW', 'DCWH', 'Tms', 'Tmp', 'DCSt', 'DCEvt']
) ON CONFLICT (modelNumber) DO NOTHING;

-- Insert SunSpec Model 1 - Common Model
INSERT INTO sunspec_models (
    id, modelNumber, name, description, version, modelType, blockLength,
    dataPoints, mandatoryPoints, optionalPoints
) VALUES (
    'sunspec_model_001',
    1,
    'Common Model',
    'Common identification model for all SunSpec devices',
    '1.0',
    'COMMON',
    65,
    '{
        "Mn": {"type": "string", "length": 32, "description": "Manufacturer", "mandatory": true},
        "Md": {"type": "string", "length": 32, "description": "Model", "mandatory": true},
        "Opt": {"type": "string", "length": 16, "description": "Options"},
        "Vr": {"type": "string", "length": 16, "description": "Version"},
        "SN": {"type": "string", "length": 32, "description": "Serial Number", "mandatory": true},
        "DA": {"type": "uint16", "description": "Device Address"}
    }',
    ARRAY['Mn', 'Md', 'SN'],
    ARRAY['Opt', 'Vr', 'DA']
) ON CONFLICT (modelNumber) DO NOTHING;

-- Insert SunSpec Model 120 - Nameplate Ratings
INSERT INTO sunspec_models (
    id, modelNumber, name, description, version, modelType, blockLength,
    dataPoints, mandatoryPoints, optionalPoints
) VALUES (
    'sunspec_model_120',
    120,
    'Nameplate Ratings',
    'Nameplate ratings model for inverter specifications',
    '1.0',
    'INVERTER',
    26,
    '{
        "DERTyp": {"type": "enum16", "description": "DER Type"},
        "WRtg": {"type": "uint16", "units": "W", "scaleFactor": "WRtg_SF", "description": "Active Power Rating"},
        "VARtg": {"type": "uint16", "units": "var", "scaleFactor": "VARtg_SF", "description": "Apparent Power Rating"},
        "VArRtgQ1": {"type": "int16", "units": "var", "scaleFactor": "VArRtg_SF", "description": "Reactive Power Q1 Rating"},
        "VArRtgQ2": {"type": "int16", "units": "var", "scaleFactor": "VArRtg_SF", "description": "Reactive Power Q2 Rating"},
        "VArRtgQ3": {"type": "int16", "units": "var", "scaleFactor": "VArRtg_SF", "description": "Reactive Power Q3 Rating"},
        "VArRtgQ4": {"type": "int16", "units": "var", "scaleFactor": "VArRtg_SF", "description": "Reactive Power Q4 Rating"},
        "ARtg": {"type": "uint16", "units": "A", "scaleFactor": "ARtg_SF", "description": "AC Current Rating"},
        "PFRtgQ1": {"type": "int16", "units": "cos()", "scaleFactor": "PFRtg_SF", "description": "Power Factor Q1 Rating"},
        "PFRtgQ2": {"type": "int16", "units": "cos()", "scaleFactor": "PFRtg_SF", "description": "Power Factor Q2 Rating"},
        "PFRtgQ3": {"type": "int16", "units": "cos()", "scaleFactor": "PFRtg_SF", "description": "Power Factor Q3 Rating"},
        "PFRtgQ4": {"type": "int16", "units": "cos()", "scaleFactor": "PFRtg_SF", "description": "Power Factor Q4 Rating"},
        "WHRtg": {"type": "uint16", "units": "Wh", "scaleFactor": "WHRtg_SF", "description": "Energy Rating"},
        "AhrRtg": {"type": "uint16", "units": "Ah", "scaleFactor": "AhrRtg_SF", "description": "Amp-hour Rating"},
        "MaxChrRte": {"type": "uint16", "units": "W", "scaleFactor": "MaxChrRte_SF", "description": "Maximum Charge Rate"},
        "MaxDisChrRte": {"type": "uint16", "units": "W", "scaleFactor": "MaxDisChrRte_SF", "description": "Maximum Discharge Rate"}
    }',
    ARRAY['DERTyp'],
    ARRAY['WRtg', 'VARtg', 'VArRtgQ1', 'VArRtgQ2', 'VArRtgQ3', 'VArRtgQ4', 'ARtg', 'PFRtgQ1', 'PFRtgQ2', 'PFRtgQ3', 'PFRtgQ4', 'WHRtg', 'AhrRtg', 'MaxChrRte', 'MaxDisChrRte']
) ON CONFLICT (modelNumber) DO NOTHING;

-- Create index for fast model lookup
CREATE INDEX IF NOT EXISTS idx_sunspec_models_type ON sunspec_models(modelType);
CREATE INDEX IF NOT EXISTS idx_sunspec_models_number_type ON sunspec_models(modelNumber, modelType);

-- Grant necessary permissions
GRANT SELECT ON sunspec_models TO PUBLIC;

-- Display summary
SELECT 
    modelNumber,
    name,
    modelType,
    array_length(mandatoryPoints, 1) as mandatory_count,
    array_length(optionalPoints, 1) as optional_count
FROM sunspec_models 
ORDER BY modelNumber;