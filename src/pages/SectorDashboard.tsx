import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { itemsKey, toNum } from "../utils/storage";
import { MiniStat } from "../components/UI";
import { supabase } from "../lib/supabaseClient";

export default function SectorDashboard() {
    const { sector = "" } = useParams();
    const nav = useNavigate();

    // stations from Supabase
    const [stations, setStations] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    // UI-only state (no new components)
    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<"alpha" | "skus" | "units">("alpha");

    async function fetchStations() {
        const { data, error } = await supabase
            .from("stations")
            .select("name")
            .eq("sector_name", sector)
            .order("created_at", { ascending: true });

        if (error) {
            console.error("❌ Error fetching stations:", error);
            return;
        }

        if (data) {
            setStations(data.map((s) => s.name));
        }
    }

    useEffect(() => {
        fetchStations();
    }, [sector]);

    // items remain local for now
    const STORAGE_KEY = itemsKey(sector);
    const [items, setItems] = useState<any[]>(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    });

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        setItems(raw ? JSON.parse(raw) : []);
    }, [STORAGE_KEY]);

    useEffect(
        () => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)),
        [STORAGE_KEY, items]
    );

    const stationCards = useMemo(
        () =>
            stations.map((name) => {
                const list = items.filter(
                    (i) => (i.station || "").trim() === name.trim()
                );
                return {
                    name,
                    skus: list.length,
                    units: list.reduce((s, i) => s + toNum(i?.stocks), 0),
                };
            }),
        [stations, items]
    );

    // UI-only: search + sort (no new components)
    const filteredCards = useMemo(() => {
        const q = query.trim().toLowerCase();

        let list = stationCards.filter((c) => {
            if (!q) return true;
            return c.name.toLowerCase().includes(q);
        });

        list.sort((a, b) => {
            if (sortKey === "skus") return b.skus - a.skus;
            if (sortKey === "units") return b.units - a.units;
            return a.name.localeCompare(b.name);
        });

        return list;
    }, [stationCards, query, sortKey]);

    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");

    async function createStation(e: FormEvent) {
        e.preventDefault();
        const name = newName.trim();
        if (!name) return;

        if (stations.some((s) => s.toLowerCase() === name.toLowerCase())) {
            alert("Station already exists in this sector.");
            return;
        }

        setLoading(true);

        const { error } = await supabase
            .from("stations")
            .insert([{ name, sector_name: sector }]);

        if (error) {
            console.error("❌ Supabase Insert Error:", error);
            alert("Failed to create station:\n" + error.message);
            setLoading(false);
            return;
        }

        setStations((prev) => [...prev, name]);
        setShowNew(false);
        setNewName("");
        setLoading(false);
    }

    async function deleteStation(name: string) {
        const confirmDelete = confirm(
            `Delete station "${name}"?\n\nThis will also delete ALL items under this station in ${sector}.`
        );
        if (!confirmDelete) return;

        const { error } = await supabase
            .from("stations")
            .delete()
            .eq("name", name)
            .eq("sector_name", sector);

        if (error) {
            console.error("❌ Supabase Delete Error:", error);
            alert("Failed to delete station:\n" + error.message);
            return;
        }

        setStations((prev) => prev.filter((s) => s !== name));
        setItems((prev) => prev.filter((i) => (i.station || "") !== name));
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Header (similar to Main Dashboard) */}
            <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur">
                <div className="w-full max-w-[95rem] mx-auto px-4 xl:px-8 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        {/* Left: breadcrumb + title */}
                        <div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    R4 / Police Inventory
                                </span>
                                <span className="text-slate-400">›</span>
                                <button
                                    onClick={() => nav("/")}
                                    className="rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 hover:bg-blue-100"
                                >
                                    Dashboard
                                </button>
                                <span className="text-slate-400">›</span>
                                <span className="rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5">
                                    {sector}
                                </span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
                                {sector} — Stations
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Station summary and quick access for this sector.
                            </p>
                        </div>

                        {/* Right: action button */}
                        <div className="flex items-center gap-2">
                            <button
                                disabled={loading}
                                onClick={() => setShowNew(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-800 disabled:opacity-40"
                            >
                                + New Station
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="w-full max-w-[95rem] mx-auto px-4 xl:px-8 py-8">
                {/* Filter Bar (similar style) */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="font-bold">Stations</div>
                            <div className="text-sm text-slate-500">
                                Search and sort stations for faster access.
                            </div>

                            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-1">
                                    Showing{" "}
                                    <span className="font-semibold text-slate-700">
                                        {filteredCards.length}
                                    </span>
                                </span>
                                <span>
                                    of{" "}
                                    <span className="font-semibold text-slate-700">
                                        {stationCards.length}
                                    </span>{" "}
                                    stations
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full max-w-[520px]">
                            <div className="flex gap-2">
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search station (e.g., Station 1)"
                                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                />

                                <select
                                    value={sortKey}
                                    onChange={(e) =>
                                        setSortKey(e.target.value as "alpha" | "skus" | "units")
                                    }
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="alpha">Alphabetical</option>
                                    <option value="units">Units (High → Low)</option>
                                    <option value="skus">SKUs (High → Low)</option>
                                </select>
                            </div>

                            <div className="text-xs text-slate-500 text-right">
                                Tip: Sort by <span className="font-semibold">Units</span> to spot
                                high-stock stations.
                            </div>
                        </div>
                    </div>
                </section>

                {/* Station Cards (dark like main dashboard cards) */}
                <section className="mt-6">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filteredCards.map((card) => (
                            <div
                                key={card.name}
                                className={[
                                    "rounded-3xl p-6 shadow-lg",
                                    "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950",
                                    "border border-white/10",
                                    "flex flex-col gap-5",
                                ].join(" ")}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-wider text-white/60">
                                            Station
                                        </div>
                                        <div className="text-2xl font-extrabold text-white mt-1">
                                            {card.name}
                                        </div>

                                        <div className="mt-3">
                                            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                                                Local data
                                            </span>
                                        </div>
                                    </div>

                                    {/* Simple placeholder badge (no new component) */}
                                    <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/70 text-[10px] font-bold">
                                        {card.name.slice(0, 2).toUpperCase()}
                                    </div>
                                </div>

                                {/* Keep MiniStat (no new component) */}
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                                        <MiniStat label="SKUs" value={card.skus} />
                                    </div>
                                    <div className="rounded-2xl bg-white/10 border border-white/10 p-3">
                                        <MiniStat label="Units" value={card.units} />
                                    </div>
                                </div>

                                <div className="mt-1 flex gap-2">
                                    <button
                                        onClick={() =>
                                            nav(
                                                `/sector/${encodeURIComponent(
                                                    sector
                                                )}/${encodeURIComponent(card.name)}`
                                            )
                                        }
                                        className="flex-1 inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white px-3 py-2 text-sm font-semibold transition"
                                    >
                                        Open station →
                                    </button>

                                    <button
                                        onClick={() => deleteStation(card.name)}
                                        className="inline-flex items-center justify-center rounded-xl bg-white/10 hover:bg-red-500/15 border border-white/10 text-white px-3 py-2 text-sm font-semibold transition"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}

                        {filteredCards.length === 0 && (
                            <div className="text-slate-500">No stations yet.</div>
                        )}
                    </div>
                </section>
            </main>

            {/* Create Station Dialog (keep same logic, UI slightly aligned) */}
            {showNew && (
                <div
                    className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                    onClick={() => setShowNew(false)}
                >
                    <form
                        onSubmit={createStation}
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-lg p-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-semibold mb-3">Create Station — {sector}</h3>

                        <input
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            autoFocus
                            placeholder="Station name"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                        />

                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                type="button"
                                onClick={() => setShowNew(false)}
                                className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={loading}
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-40"
                            >
                                {loading ? "Saving..." : "Create"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}