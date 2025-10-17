import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SECTORS, itemsKey, toNum } from "../utils/storage";
import { MiniStat } from "../components/UI";


export default function Dashboard() {
    const nav = useNavigate();

    const cards = useMemo(
        () =>
            SECTORS.map((name) => {
                const raw = localStorage.getItem(itemsKey(name));
                let skus = 0,
                    units = 0;
                try {
                    const items = raw ? JSON.parse(raw) : [];
                    skus = items.length;
                    units = items.reduce((s: number, i: any) => s + toNum(i?.stocks), 0);
                } catch { }
                return { name, skus, units };
            }),
        []
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            {/* Header */}
            <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur">
                <div className="w-full max-w-[95rem] px-4 xl:px-8 mx-auto py-4">
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                        Inventory Dashboard
                    </h1>
                </div>
            </header>

            {/* Main */}
            <main className="w-full max-w-[95rem] px-4 xl:px-8 mx-auto py-8 grid gap-8">
                <section>
                    <h2 className="text-lg font-semibold mb-3">Sectors</h2>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        {cards.map((card) => (
                            <button
                                key={card.name}
                                onClick={() => nav(`/sector/${encodeURIComponent(card.name)}`)}
                                className="text-left group p-5 bg-white/90 backdrop-blur rounded-3xl border border-slate-200/70 shadow-sm hover:shadow-md transition"
                            >
                                <div className="text-[11px] uppercase tracking-wider text-slate-500">
                                    Sector
                                </div>

                                <div className="text-2xl font-extrabold mt-1 group-hover:translate-x-0.5 transition-transform">
                                    {card.name}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                    <MiniStat label="SKUs" value={card.skus} />
                                    <MiniStat label="Units" value={card.units} />
                                </div>
                            </button>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
