export type HoleDeviation = {
  position: 'L' | 'R';
  holeNumber: number;
  deviation: number;
};

export type AssemblySheet = {
  machineId: number;
  operatorId?: string;
  sheetNumber: number;
  holes: HoleDeviation[];
};

const machineData: Record<number, number[]> = {
  1: [-0.012, -0.004, 0.006, -0.011, 0.003, 0.014, 0.009, -0.008, 0.012, -0.005, 0.01, 0.002],
  2: [0.011, 0.006, 0.015, 0.013, 0.009, 0.012, 0.062, 0.071, 0.054, 0.078, 0.068, 0.059],
  3: [-0.082, -0.096, -0.088, -0.091, -0.103, -0.087, -0.014, -0.02, -0.011, -0.025, -0.017, -0.008],
  4: [0.074, -0.051, 0.063, -0.069, 0.018, -0.077, -0.055, 0.081, -0.063, 0.072, -0.012, 0.046],
};

export function getAssemblyData(): AssemblySheet[] {
  return [1, 2, 3, 4].map((machineId) => ({
    machineId,
    operatorId: `작업자-${machineId}`,
    sheetNumber: 1,
    holes: machineData[machineId].map((deviation, index) => ({
      position: index < 6 ? 'L' : 'R',
      holeNumber: (index % 6) + 1,
      deviation,
    })),
  }));
}
