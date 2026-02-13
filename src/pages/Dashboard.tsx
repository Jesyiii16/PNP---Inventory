import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SECTORS, itemsKey, toNum } from "../utils/storage";
import {
    Search,
    SlidersHorizontal,
    Database,
    LayoutDashboard,
    ChevronRight,
} from "lucide-react";

/**
 * OPTIONAL: Put sector logo URLs here (top-right of each card).
 * If you don't have logos yet, leave them empty and it will show a placeholder.
 */
const SECTOR_LOGO: Record<string, string> = {
    RHQ: "", // "/assets/logos/rhq.png"
    CAVITE: "",
    LAGUNA: "",
    BATANGAS: "",
    RIZAL: "",
    QUEZON: "",
    RMFB: "",
};

type SortKey = "region" | "alpha" | "skus" | "units";

function StatTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-2xl bg-slate-200/70 border border-white/10 px-4 py-3">
            <div className="text-[12px] text-slate-600">{label}</div>
            <div className="text-lg font-extrabold text-slate-900 leading-tight mt-1">
                {value.toLocaleString()}
            </div>
        </div>
    );
}

function CardLogo({ name }: { name: string }) {
    const src = SECTOR_LOGO[name];
    if (!src) {
        return (
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white/70 text-[10px] font-bold">
                {name.slice(0, 2)}
            </div>
        );
    }
    return (
        <img
            src={src}
            alt={`${name} logo`}
            className="h-10 w-10 rounded-xl object-cover bg-white/10 border border-white/10"
            loading="lazy"
        />
    );
}

/**
 * OPTIONAL: If you want a fixed “Region Order (R4A)” like your screenshot.
 * Edit this array to match your real desired order.
 */
const REGION_ORDER_R4A = ["RHQ", "CAVITE", "LAGUNA", "BATANGAS", "RIZAL", "QUEZON", "RMFB"];

export default function Dashboard() {
    const nav = useNavigate();

    const [query, setQuery] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("region");

    const cards = useMemo(() => {
        return SECTORS.map((name) => {
            const raw = localStorage.getItem(itemsKey(name));
            let skus = 0,
                units = 0;

            try {
                const items = raw ? JSON.parse(raw) : [];
                skus = items.length;
                units = items.reduce((s: number, i: any) => s + toNum(i?.stocks), 0);
            } catch { }

            return { name, skus, units, isLocal: true };
        });
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();

        let list = cards.filter((c) => {
            if (!q) return true;
            return c.name.toLowerCase().includes(q);
        });

        list.sort((a, b) => {
            if (sortKey === "alpha") return a.name.localeCompare(b.name);
            if (sortKey === "skus") return b.skus - a.skus;
            if (sortKey === "units") return b.units - a.units;

            // "region" order:
            const ia = REGION_ORDER_R4A.indexOf(a.name);
            const ib = REGION_ORDER_R4A.indexOf(b.name);

            // anything not found goes to bottom (alphabetical among them)
            const ra = ia === -1 ? 9999 : ia;
            const rb = ib === -1 ? 9999 : ib;
            if (ra !== rb) return ra - rb;
            return a.name.localeCompare(b.name);
        });

        return list;
    }, [cards, query, sortKey]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Top Header */}
            <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/70 backdrop-blur">
                <div className="w-full max-w-[95rem] mx-auto px-4 xl:px-8 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        {/* Left: breadcrumb + titles */}
                        <div>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                                    R4 / Police Inventory
                                </span>
                                <ChevronRight className="h-4 w-4" />
                                <span className="rounded-full bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5">
                                    Dashboard
                                </span>
                            </div>

                            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-2">
                                Inventory Overview
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Sector summary for ammunition, firearms, and accessories.
                            </p>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
                                onClick={() => {
                                    // TODO: hook this up if you have a quicklook route/modal
                                    // nav("/quicklook");
                                }}
                            >
                                <SlidersHorizontal className="h-4 w-4 text-slate-600" />
                                Quicklook
                            </button>

                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
                                onClick={() => {
                                    // TODO: hook this up if you have a generate function
                                    // Example: seed local storage, or fetch initial data
                                    // generateDemoData();
                                }}
                            >
                                <Database className="h-4 w-4 text-slate-600" />
                                Generate Data
                            </button>

                            <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold shadow-sm hover:bg-slate-800"
                                onClick={() => {
                                    // If you have a dedicated inventory page:
                                    // nav("/inventory");
                                }}
                            >
                                <LayoutDashboard className="h-4 w-4" />
                                Inventory
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="w-full max-w-[95rem] mx-auto px-4 xl:px-8 py-8">
                {/* Filter Bar Card */}
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
                    <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                            {/* simple shield-ish vibe */}
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M12 2l8 4v6c0 5-3.2 9.4-8 10-4.8-.6-8-5-8-10V6l8-4z"
                                    stroke="#2563eb"
                                    strokeWidth="2"
                                />
                            </svg>
                        </div>

                        <div className="flex-1">
                            <div className="font-bold">Sectors</div>
                            <div className="text-sm text-slate-500">
                                Search, filter, and sort sectors for faster access.
                            </div>

                            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-1">
                                    Showing <span className="font-semibold text-slate-700">{filtered.length}</span>
                                </span>
                                <span>
                                    of <span className="font-semibold text-slate-700">{cards.length}</span> sectors
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full max-w-[460px]">
                            <div className="flex gap-2">
                                {/* search */}
                                <div className="flex-1 relative">
                                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search sector (e.g., RHQ, Cavite)"
                                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                </div>

                                {/* sort */}
                                <select
                                    value={sortKey}
                                    onChange={(e) => setSortKey(e.target.value as SortKey)}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200"
                                >
                                    <option value="region">Region Order (R4A)</option>
                                    <option value="alpha">Alphabetical</option>
                                    <option value="units">Units (High → Low)</option>
                                    <option value="skus">SKUs (High → Low)</option>
                                </select>
                            </div>

                            <div className="text-xs text-slate-500 text-right">
                                Tip: Use <span className="font-semibold text-slate-700">Units</span> sorting to spot
                                high-stock sectors.
                            </div>
                        </div>
                    </div>
                </section>

                {/* Cards */}
                <section className="mt-6">
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {filtered.map((card) => (
                            <button
                                key={card.name}
                                onClick={() => nav(`/sector/${encodeURIComponent(card.name)}`)}
                                className={[
                                    "group text-left rounded-3xl p-6 shadow-lg",
                                    "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950",
                                    "border border-white/10 hover:border-white/20 transition",
                                ].join(" ")}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[11px] uppercase tracking-wider text-white/60">
                                            Sector
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

                                    <CardLogo name={card.name} />
                                </div>

                                <div className="mt-6 grid grid-cols-2 gap-3">
                                    <StatTile label="SKUs" value={card.skus} />
                                    <StatTile label="Units" value={card.units} />
                                </div>

                                <div className="mt-6 flex items-center justify-between">
                                    <span className="text-sm font-semibold text-white/90">
                                        Open sector <span className="ml-1">→</span>
                                    </span>
                                    <span className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition">
                                        <ChevronRight className="h-5 w-5 text-white/70" />
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
