import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { itemsKey, toNum } from "../utils/storage";
import { Card, Th, Input } from "../components/UI";

export default function StationInventory() {
    const { sector = "", station = "" } = useParams();
    const nav = useNavigate();

    const STORAGE_KEY = itemsKey(sector);

    const [items, setItems] = useState<any[]>(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    });

    // re-load items if sector changes via router (without full reload)
    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        setItems(raw ? JSON.parse(raw) : []);
    }, [STORAGE_KEY]);

    const [query, setQuery] = useState("");
    const [category, setCategory] = useState("All");
    const [sort, setSort] = useState<{ by: string; dir: "asc" | "desc" }>({
        by: "name",
        dir: "asc",
    });
    const [editing, setEditing] = useState<any | null>(null);

    useEffect(
        () => localStorage.setItem(STORAGE_KEY, JSON.stringify(items)),
        [STORAGE_KEY, items]
    );

    const stationItems = useMemo(
        () => items.filter((i) => (i.station || "").trim() === station.trim()),
        [items, station]
    );

    const categories = useMemo(
        () => ["All", ...Array.from(new Set(stationItems.map((i) => i.category)))],
        [stationItems]
    );

    const filtered = useMemo(() => {
        let rows = stationItems;
        if (category !== "All") rows = rows.filter((i) => i.category === category);
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            rows = rows.filter(
                (i) =>
                    (i.name || "").toLowerCase().includes(q) ||
                    (i.category || "").toLowerCase().includes(q)
            );
        }
        const mul = sort.dir === "asc" ? 1 : -1;
        rows = [...rows].sort((a, b) => {
            const av = getField(a, sort.by);
            const bv = getField(b, sort.by);
            if (typeof av === "number" && typeof bv === "number")
                return (av - bv) * mul;
            return String(av).localeCompare(String(bv)) * mul;
        });
        return rows;
    }, [stationItems, query, category, sort]);

    function getField(item: any, by: string) {
        if (by.startsWith("status.")) return item?.status?.[by.split(".")[1]] ?? 0;
        if (by.startsWith("source.")) return item?.source?.[by.split(".")[1]] ?? 0;
        return item?.[by] ?? "";
    }

    function handleAdd(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(form.entries());
        const newItem = {
            id: crypto.randomUUID(),
            sector,
            station,
            category: (data.category || "").toString().trim() || "Uncategorized",
            name: (data.name || "").toString().trim(),
            stocks: toNum(data.stocks),
            status: {
                serviceable: toNum(data.serviceable),
                unserviceable: toNum(data.unserviceable),
                ber: toNum(data.ber),
            },
            source: {
                organic: toNum(data.organic),
                donated: toNum(data.donated),
                loaned: toNum(data.loaned),
                fas: toNum(data.fas),
            },
        };
        if (!newItem.name) return;
        setItems((prev) => [newItem, ...prev]);
        (e.currentTarget as HTMLFormElement).reset();
    }

    function handleEditSave(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(form.entries());
        setItems((prev) =>
            prev.map((it) =>
                it.id === editing!.id
                    ? {
                        ...it,
                        category: (data.category || "").toString().trim(),
                        name: (data.name || "").toString().trim(),
                        stocks: toNum(data.stocks),
                        status: {
                            serviceable: toNum(data.serviceable),
                            unserviceable: toNum(data.unserviceable),
                            ber: toNum(data.ber),
                        },
                        source: {
                            organic: toNum(data.organic),
                            donated: toNum(data.donated),
                            loaned: toNum(data.loaned),
                            fas: toNum(data.fas),
                        },
                    }
                    : it
            )
        );
        setEditing(null);
    }

    function handleDelete(id: string) {
        if (!confirm("Delete this item?")) return;
        setItems((prev) => prev.filter((i) => i.id !== id));
    }

    function toggleSort(by: string) {
        setSort((s) =>
            s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: "asc" }
        );
    }

    function exportCSV() {
        const headers = [
            "station",
            "category",
            "name",
            "stocks",
            "serviceable",
            "unserviceable",
            "ber",
            "organic",
            "donated",
            "loaned",
            "fas",
        ];
        const rows = [
            headers.join(","),
            ...filtered.map((i) =>
                headers.map((h) => JSON.stringify(getCSVValue(i, h))).join(",")
            ),
        ].join("\n");
        const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sector}-${station}-inventory-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function getCSVValue(i: any, h: string) {
        const map: Record<string, any> = {
            serviceable: i?.status?.serviceable,
            unserviceable: i?.status?.unserviceable,
            ber: i?.status?.ber,
            organic: i?.source?.organic,
            donated: i?.source?.donated,
            loaned: i?.source?.loaned,
            fas: i?.source?.fas,
        };
        return h in map ? map[h] : i?.[h];
    }

    async function importCSV(file: File) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const [header, ...rest] = lines;
        const cols = header.split(",").map((s) => s.replaceAll('"', ""));
        const required = [
            "station",
            "category",
            "name",
            "stocks",
            "serviceable",
            "unserviceable",
            "ber",
            "organic",
            "donated",
            "loaned",
            "fas",
        ];
        if (required.some((r) => !cols.includes(r))) {
            alert("CSV missing required headers");
            return;
        }
        const next = rest.map((line) => {
            const values =
                line
                    .match(/"(?:[^"]|"")*"|[^,]+/g)
                    ?.map((s) => s.replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
            const row: any = Object.fromEntries(cols.map((c, idx) => [c, values[idx] ?? ""]));
            return {
                id: crypto.randomUUID(),
                sector,
                station, // force current station
                category: String(row.category || "Uncategorized"),
                name: String(row.name || ""),
                stocks: toNum(row.stocks),
                status: {
                    serviceable: toNum(row.serviceable),
                    unserviceable: toNum(row.unserviceable),
                    ber: toNum(row.ber),
                },
                source: {
                    organic: toNum(row.organic),
                    donated: toNum(row.donated),
                    loaned: toNum(row.loaned),
                    fas: toNum(row.fas),
                },
            };
        });
        setItems((prev) => [...next, ...prev]);
    }

    const totals = useMemo(
        () => ({
            skus: filtered.length,
            units: filtered.reduce((s, i) => s + toNum(i.stocks), 0),
            serviceable: filtered.reduce((s, i) => s + toNum(i?.status?.serviceable), 0),
            unserviceable: filtered.reduce((s, i) => s + toNum(i?.status?.unserviceable), 0),
            ber: filtered.reduce((s, i) => s + toNum(i?.status?.ber), 0),
            organic: filtered.reduce((s, i) => s + toNum(i?.source?.organic), 0),
            donated: filtered.reduce((s, i) => s + toNum(i?.source?.donated), 0),
            loaned: filtered.reduce((s, i) => s + toNum(i?.source?.loaned), 0),
            fas: filtered.reduce((s, i) => s + toNum(i?.source?.fas), 0),
        }),
        [filtered]
    );

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-white/70 backdrop-blur border-b">
                <div className="section py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => nav(`/sector/${encodeURIComponent(sector)}`)}
                            className="soft-btn px-3 py-2"
                        >
                            ← {sector} Stations
                        </button>
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                            {sector} • {station} — Inventory
                        </h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exportCSV} className="soft-btn px-3 py-2">
                            Export CSV
                        </button>
                        <label className="soft-btn px-3 py-2 cursor-pointer">
                            Import CSV
                            <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && importCSV(e.target.files[0])}
                            />
                        </label>
                    </div>
                </div>
            </header>

            {/* Main */}
            <main className="section py-6 grid gap-6">
                {/* Stats */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card title="Total SKUs" value={totals.skus} footer="unique items" />
                    <Card title="Total Units" value={totals.units} footer="in stock" />
                    <Card title="Serviceable" value={totals.serviceable} footer="this station" />
                    <Card title="Organic" value={totals.organic} footer="this station" />
                </section>

                {/* Add item */}
                <section className="panel panel-pad">
                    <h2 className="font-semibold mb-3">Add Item — {station}</h2>
                    <form onSubmit={handleAdd} className="grid gap-4">
                        <div className="grid md:grid-cols-4 gap-3">
                            <input value={station} disabled readOnly className="text-input" />
                            <Input name="category" placeholder="Category" className="text-input" />
                            <Input name="name" placeholder="Product name" required className="text-input" />
                            <Input name="stocks" type="number" min={0} placeholder="Stocks" className="text-input" />
                        </div>

                        <fieldset className="border rounded-2xl p-3">
                            <legend className="px-2 text-sm text-slate-500">STATUS</legend>
                            <div className="grid md:grid-cols-3 gap-3">
                                <Input name="serviceable" type="number" min={0} placeholder="Serviceable" className="text-input" />
                                <Input name="unserviceable" type="number" min={0} placeholder="Unserviceable" className="text-input" />
                                <Input name="ber" type="number" min={0} placeholder="BER" className="text-input" />
                            </div>
                        </fieldset>

                        <fieldset className="border rounded-2xl p-3">
                            <legend className="px-2 text-sm text-slate-500">SOURCE</legend>
                            <div className="grid md:grid-cols-4 gap-3">
                                <Input name="organic" type="number" min={0} placeholder="Organic" className="text-input" />
                                <Input name="donated" type="number" min={0} placeholder="Donated" className="text-input" />
                                <Input name="loaned" type="number" min={0} placeholder="Loaned" className="text-input" />
                                <Input name="fas" type="number" min={0} placeholder="FAS" className="text-input" />
                            </div>
                        </fieldset>

                        <div className="flex justify-end">
                            <button className="solid-btn px-4 py-2">Add</button>
                        </div>
                    </form>
                </section>

                {/* Filters */}
                <section className="panel panel-pad flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="flex gap-2 items-center flex-wrap">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by product or category"
                            className="text-input w-[18rem] md:w-[28rem]"
                        />
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="text-input"
                        >
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm text-slate-500">{filtered.length} results</div>
                </section>

                {/* Table */}
                <section className="panel">
                    <div className="panel-pad overflow-x-auto">
                        <table className="min-w-[56rem] w-full text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    <Th
                                        rowSpan={2}
                                        onClick={() => toggleSort("category")}
                                        active={sort.by === "category"}
                                        dir={sort.dir}
                                    >
                                        Category
                                    </Th>
                                    <Th
                                        rowSpan={2}
                                        onClick={() => toggleSort("name")}
                                        active={sort.by === "name"}
                                        dir={sort.dir}
                                    >
                                        Product Name
                                    </Th>
                                    <Th
                                        rowSpan={2}
                                        className="text-right"
                                        onClick={() => toggleSort("stocks")}
                                        active={sort.by === "stocks"}
                                        dir={sort.dir}
                                    >
                                        Stocks
                                    </Th>
                                    <th className="px-4 py-2 text-center bg-blue-50 text-slate-700" colSpan={4}>
                                        STATUS
                                    </th>
                                    <th className="px-4 py-2 text-center bg-amber-50 text-slate-700" colSpan={5}>
                                        SOURCE
                                    </th>
                                    <th className="px-4 py-2" rowSpan={2}>
                                        Actions
                                    </th>
                                </tr>
                                <tr className="bg-slate-50">
                                    <Th
                                        onClick={() => toggleSort("status.serviceable")}
                                        active={sort.by === "status.serviceable"}
                                        dir={sort.dir}
                                        className="text-right bg-blue-50"
                                    >
                                        Serviceable
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("status.unserviceable")}
                                        active={sort.by === "status.unserviceable"}
                                        dir={sort.dir}
                                        className="text-right bg-blue-50"
                                    >
                                        Unserviceable
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("status.ber")}
                                        active={sort.by === "status.ber"}
                                        dir={sort.dir}
                                        className="text-right bg-blue-50"
                                    >
                                        BER
                                    </Th>
                                    <th className="px-4 py-2 text-right bg-blue-50">Total</th>

                                    <Th
                                        onClick={() => toggleSort("source.organic")}
                                        active={sort.by === "source.organic"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        Organic
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("source.donated")}
                                        active={sort.by === "source.donated"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        Donated
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("source.loaned")}
                                        active={sort.by === "source.loaned"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        Loaned
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("source.fas")}
                                        active={sort.by === "source.fas"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        FAS
                                    </Th>
                                    <th className="px-4 py-2 text-right bg-amber-50">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => {
                                    const statusTotal =
                                        toNum(item?.status?.serviceable) +
                                        toNum(item?.status?.unserviceable) +
                                        toNum(item?.status?.ber);
                                    const sourceTotal =
                                        toNum(item?.source?.organic) +
                                        toNum(item?.source?.donated) +
                                        toNum(item?.source?.loaned) +
                                        toNum(item?.source?.fas);
                                    const warn =
                                        item.stocks !== undefined &&
                                        (statusTotal !== item.stocks || sourceTotal !== item.stocks);

                                    return (
                                        <tr key={item.id} className="border-t hover:bg-slate-50">
                                            <td className="px-4 py-2">{item.category}</td>
                                            <td className="px-4 py-2 font-medium">{item.name}</td>
                                            <td className="px-4 py-2 text-right">{toNum(item.stocks)}</td>

                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {toNum(item?.status?.serviceable)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {toNum(item?.status?.unserviceable)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {toNum(item?.status?.ber)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {statusTotal}
                                            </td>

                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.organic)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.donated)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.loaned)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.fas)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {sourceTotal}
                                            </td>

                                            <td className="px-4 py-2 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button
                                                        onClick={() => setEditing(item)}
                                                        className="soft-btn px-3 py-1"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="soft-btn px-3 py-1 hover:bg-red-50"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                                {warn && (
                                                    <div className="text-xs text-amber-600 mt-1">
                                                        Totals don't match Stocks
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td className="px-4 py-10 text-center text-slate-500" colSpan={13}>
                                            No items found
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <footer className="text-center text-xs text-slate-500 pb-8">
                    {sector} • {station}
                </footer>
            </main>

            {/* Edit dialog */}
            {editing && (
                <div
                    className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                    onClick={() => setEditing(null)}
                >
                    <div
                        className="panel panel-pad w-full max-w-3xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-semibold mb-3">Edit Item — {station}</h3>
                        <form onSubmit={handleEditSave} className="grid gap-4">
                            <div className="grid md:grid-cols-4 gap-3">
                                <input value={station} disabled readOnly className="text-input" />
                                <Input name="category" defaultValue={editing.category} className="text-input" />
                                <Input name="name" defaultValue={editing.name} required className="text-input" />
                                <Input
                                    name="stocks"
                                    type="number"
                                    min={0}
                                    defaultValue={editing.stocks}
                                    className="text-input"
                                />
                            </div>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">STATUS</legend>
                                <div className="grid md:grid-cols-3 gap-3">
                                    <Input
                                        name="serviceable"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.status?.serviceable}
                                        className="text-input"
                                    />
                                    <Input
                                        name="unserviceable"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.status?.unserviceable}
                                        className="text-input"
                                    />
                                    <Input
                                        name="ber"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.status?.ber}
                                        className="text-input"
                                    />
                                </div>
                            </fieldset>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">SOURCE</legend>
                                <div className="grid md:grid-cols-4 gap-3">
                                    <Input
                                        name="organic"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.organic}
                                        className="text-input"
                                    />
                                    <Input
                                        name="donated"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.donated}
                                        className="text-input"
                                    />
                                    <Input
                                        name="loaned"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.loaned}
                                        className="text-input"
                                    />
                                    <Input
                                        name="fas"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.fas}
                                        className="text-input"
                                    />
                                </div>
                            </fieldset>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className="soft-btn px-4 py-2"
                                >
                                    Cancel
                                </button>
                                <button className="solid-btn px-4 py-2">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
