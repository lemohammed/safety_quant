const MAX_HAZARD_DISTANCE = 1e4;
const KELVIN_OFFSET = 273;
const DEFAULT_ATMOSPHERIC_PRESSURE = 101.325;
const POOL_DEPTH = 100; // 1 / meter. Example: 1cm = 100 (1/meter)
const MAX_RELEASE_TIME = 900; //seconds
const MAX_UNIT_HAZARD = 8;
const MAX_CEI = 1000;
const MM_PER_INCHES = 25.4;

const EPRG = {
  1: 22,
  2: 111,
  3: 11060,
};

const enum ReleaseType {
  LIQUID = 1,
  GAS = 2,
}

const enum EquipmentType {
  VESSEL = 1,
  PIPE = 2,
  Pressure_Relief_Device = 3,
}

interface ProcessVariables {
  P_g: number;
  P_a?: number;
  P_v: number;
  T: number;
  T_b: number;
  T_a: number;
  mw: number;
  height: number;
  density: number;
  diameter: number;
  inventory: number;
  dikedArea?: number;
  heatCapacityToLatentHeatRatio?: number;
}

function getProcessUnitHazard(f1: number, f2: number): number {
  return Math.min(MAX_UNIT_HAZARD, f1 * f2);
}

function getFEI(f3: number, mf: number): number {
  return f3 * mf;
}

function getAreaOfExposure(fei: number): number {
  return Math.PI * Math.pow(fei * 0.84, 2);
}

function getRuptureDiameter(diameter: number, equipmentType: EquipmentType) {
  return diameter < 4 ? 2 : Math.pow(diameter / 2, 2) * Math.PI * 0.2;
}

function getAirBorneQuantity(
  releaseType: ReleaseType,
  processVariables: ProcessVariables,
  aq?: number
): number {
  switch (releaseType) {
    case ReleaseType.LIQUID:
      return getLiquidAirBorneQuantity(processVariables);
    case ReleaseType.GAS:
      return getGasAirBorneQuantity(processVariables);
    default:
      console.log("Invalid release type");
      return aq ?? 0.0;
  }
}

function getGasAirBorneQuantity({ T, mw, P_g, P_a }: ProcessVariables): number {
  return (
    4.571 *
    1e-6 *
    getAbsolutePressure(P_g, P_a) *
    Math.sqrt(mw / (T + KELVIN_OFFSET))
  );
}

function getAbsolutePressure(P_g: number, P_a?: number) {
  return P_g + (P_a ?? DEFAULT_ATMOSPHERIC_PRESSURE);
}

function getLiquidAirBorneQuantity({
  mw,
  P_v,
  T,
  heatCapacityToLatentHeatRatio,
  T_b,
  T_a,
  density,
  diameter,
  P_g,
  P_a,
  height,
  inventory,
  dikedArea,
}: ProcessVariables): number {
  const L = getLiquidReleaseRate(diameter, density, P_g, height);
  const F_v = getFlashFraction(heatCapacityToLatentHeatRatio, T, T_b);
  if (F_v >= 0.2) {
    return L;
  }

  const w_T = Math.min(L * MAX_RELEASE_TIME, inventory);
  const Wp = getPoolQuantity(F_v, w_T);
  const AQ_f = getFlashAirBorneQuantity(F_v, L);
  const A_p = dikedArea ?? getPoolArea(Wp, density);
  const T_char = Math.min(T_b, Math.max(T, T_a));
  const AQ_p =
    (9.0 * 1e-4 * Math.pow(A_p, 0.95) * (mw * P_v)) / (T_char + KELVIN_OFFSET);

  return Math.min(AQ_p + AQ_f, L);
}

function getFlashAirBorneQuantity(F_v: number, L: number) {
  return 5 * F_v * L;
}

function getFlashFraction(
  heatCapacityToLatentHeatRatio: number | undefined,
  operatingTemperature: number,
  boilingPoint: number
) {
  return (
    (heatCapacityToLatentHeatRatio ?? 0.0044) *
    (operatingTemperature - boilingPoint)
  );
}

function getLiquidReleaseRate(
  diameter: number,
  density: number,
  pressure: number,
  height: number
) {
  return (
    9.44 *
    1e-7 *
    (Math.pow(diameter * MM_PER_INCHES, 2) *
      density *
      Math.sqrt((1000 * pressure) / density + 9.81 * height))
  );
}

function getPoolQuantity(F_v: number, w_T: number): number {
  return w_T * (1 - 5 * F_v);
}

function getPoolArea(Wp: number, density: number) {
  return POOL_DEPTH * (Wp / density);
}

function getChemicalExposureIndex(aq: number): number {
  return Math.min(MAX_CEI, 655.1 * Math.sqrt(aq / EPRG[2]));
}

function getHazardousDistance(aq: number, level: 1 | 2 | 3): number {
  return Math.min(MAX_HAZARD_DISTANCE, 6551 * Math.sqrt(aq / EPRG[level]));
}

const AQ = getAirBorneQuantity(ReleaseType.LIQUID, {
  P_g: 2300,
  P_v: 101.325,
  T: 25,
  T_b: -4.4,
  T_a: 25,
  mw: 54.09,
  height: 1.9,
  density: 614.9,
  heatCapacityToLatentHeatRatio: 5.45 * 1e-3,
  diameter: 2,
  inventory: 200,
  dikedArea: 200,
});

const CEI = getChemicalExposureIndex(AQ);

console.log({
  AQ,
  CEI,
});

console.log({
  HD1: getHazardousDistance(AQ, 1),
  HD2: getHazardousDistance(AQ, 2),
  HD3: getHazardousDistance(AQ, 3),
});
