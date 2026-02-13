// Shared constants & helpers

export const SECTORS = ["RHQ", "CAVITE", "LAGUNA", "BATANGAS", "RIZAL", "QUEZON", "RMFB"] as const;

export const itemsKey = (sector: string) => `inventory_items_v5_${sector}`;
export const stationsKey = (sector: string) => `stations_v1_${sector}`;

export function toNum(n: any) {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
}

// Curated stations registry (per sector)
export function loadStations(sector: string): string[] {
    try {
        const raw = localStorage.getItem(stationsKey(sector));
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}
export function saveStations(sector: string, list: string[]) {
    localStorage.setItem(stationsKey(sector), JSON.stringify(list));
}
