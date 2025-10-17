import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { itemsKey, loadStations, saveStations, toNum } from "../utils/storage";
import { MiniStat } from "../components/UI";

export default function SectorDashboard() {
    const { sector = "" } = useParams();
    const nav = useNavigate();

    // stations registry (curated)
    const [stations, setStations] = useState<string[]>(() => loadStations(sector));

    // re-load stations if route param changes (e.g., navigating between sectors without full reload)
    useEffect(() => {
        setStations(loadStations(sector));
    }, [sector]);

    // items for the sector (for counts, and cascade delete)
    const STORAGE_KEY = itemsKey(sector);
    const [items, setItems] = useState<any[]>(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    });

    // refresh items if the sector param changes
    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        setItems(raw ? JSON.parse(raw) : []);
    }, [STORAGE_KEY]);

    useEffect(() => saveStations(sector, stations), [sector, stations]);
    useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)), [STORAGE_KEY, items]);

    const stationCards = useMemo(
        () =>
            stations.map((name) => {
                const list = items.filter((i) => (i.station || "").trim() === name.trim());
                return {
                    name,
                    skus: list.length,
                    units: list.reduce((s, i) => s + toNum(i?.stocks), 0),
                };
            }),
        [stations, items]
    );

    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");

    function createStation(e: FormEvent) {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;
        if (stations.some((s) => s.toLowerCase() === name.toLowerCase())) {
            alert("Station already exists in this sector.");
            return;
        }
        setStations((prev) => [...prev, name]);
        setShowNew(false);
        setNewName("");
    }

    function deleteStation(name: string) {
        if (
            !confirm(
                `Delete station "${name}"?\n\nThis will also delete ALL items under this station in ${sector}.`
            )
        )
            return;
        setStations((prev) => prev.filter((s) => s !== name));
        setItems((prev) => prev.filter((i) => (i.station || "") !== name));
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
                <div className="section py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => nav("/")} className="soft-btn px-3 py-2">
                            ← Sectors
                        </button>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                            {sector} — Stations
                        </h1>
                    </div>
                    <button onClick={() => setShowNew(true)} className="soft-btn px-3 py-2">
                        + New Station
                    </button>
                </div>
            </header>

            {/* Main */}
            <main className="section py-8 grid gap-8">
                <section>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                        {stationCards.map((card) => (
                            <div key={card.name} className="panel panel-pad flex flex-col gap-4">
                                <div>
                                    <div className="text-[11px] uppercase tracking-wider text-slate-500">
                                        Station
                                    </div>
                                    <div className="text-xl font-bold mt-1">{card.name}</div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <MiniStat label="SKUs" value={card.skus} />
                                    <MiniStat label="Units" value={card.units} />
                                </div>

                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() =>
                                            nav(
                                                `/sector/${encodeURIComponent(sector)}/${encodeURIComponent(card.name)}`
                                            )
                                        }
                                        className="soft-btn px-3 py-2"
                                    >
                                        Open
                                    </button>
                                    <button
                                        onClick={() => deleteStation(card.name)}
                                        className="soft-btn px-3 py-2 hover:bg-red-50"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}

                        {stationCards.length === 0 && (
                            <div className="text-slate-500">No stations yet.</div>
                        )}
                    </div>
                </section>
            </main>

            {/* Create Station Dialog */}
            {showNew && (
                <div
                    className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                    onClick={() => setShowNew(false)}
                >
                    <form
                        onSubmit={createStation}
                        className="panel panel-pad w-full max-w-md"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-semibold mb-3">Create Station — {sector}</h3>
                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                            placeholder="Station name"
                            className="text-input"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowNew(false)}
                                className="soft-btn px-4 py-2"
                            >
                                Cancel
                            </button>
                            <button className="solid-btn px-4 py-2">Create</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
