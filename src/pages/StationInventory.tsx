import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toNum } from "../utils/storage";
import { Card, Th, Input } from "../components/UI";
import { supabase } from "../lib/supabaseClient";

const CSV_HEADERS = [
    "station",
    "equipment",
    "type",
    "make",
    "serialNo",
    "propertyNo",
    "acquisitionDate",
    "acquisitionCost",
    "costOfRepair",
    "currentOrDepreciated",
    "svc",
    "uns",
    "ber",
    "procured",
    "donated",
    "foundAtStation",
    "loaned",
    "userOffice",
    "userName",
];

type Item = {
    id: string;
    sector: string;
    station: string;
    equipment: string;
    type: string;
    make: string;
    serialNo: string;
    propertyNo: string;
    acquisitionDate: string | null;
    acquisitionCost: number;
    costOfRepair: number;
    currentOrDepreciated: string;
    status: { svc: number; uns: number; ber: number };
    source: {
        procured: number;
        donated: number;
        foundAtStation: number;
        loaned: number;
    };
    whereabouts: { userOffice: string; userName: string };
};

const mapRowToItem = (row: any): Item => ({
    id: row.id,
    sector: row.sector,
    station: row.station,
    equipment: row.equipment ?? "",
    type: row.type ?? "",
    make: row.make ?? "",
    serialNo: row.serial_no ?? "",
    propertyNo: row.property_no ?? "",
    acquisitionDate: row.acquisition_date ?? null,
    acquisitionCost: toNum(row.acquisition_cost),
    costOfRepair: toNum(row.cost_of_repair),
    currentOrDepreciated: row.current_or_depreciated ?? "",
    status: {
        svc: toNum(row.status_svc),
        uns: toNum(row.status_uns),
        ber: toNum(row.status_ber),
    },
    source: {
        procured: toNum(row.source_procured),
        donated: toNum(row.source_donated),
        foundAtStation: toNum(row.source_found_at_station),
        loaned: toNum(row.source_loaned),
    },
    whereabouts: {
        userOffice: row.user_office ?? "",
        userName: row.user_name ?? "",
    },
});

export default function StationInventory() {
    const { sector = "", station = "" } = useParams();
    const nav = useNavigate();

    const [items, setItems] = useState<Item[]>([]);
    const [query, setQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [sort, setSort] = useState<{ by: string; dir: "asc" | "desc" }>({
        by: "type",
        dir: "asc",
    });
    const [editing, setEditing] = useState<Item | null>(null);
    const [loading, setLoading] = useState(false);

    // FETCH from Supabase
    useEffect(() => {
        if (!sector || !station) return;

        const fetchItems = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from("station_inventory")
                .select("*")
                .eq("sector", sector)
                .eq("station", station)
                .order("created_at", { ascending: false });

            if (error) {
                console.error(error);
            } else {
                setItems((data || []).map(mapRowToItem));
            }
            setLoading(false);
        };

        fetchItems();
    }, [sector, station]);

    const stationItems = useMemo(
        () => items.filter((i) => (i.station || "").trim() === station.trim()),
        [items, station]
    );

    const types = useMemo(
        () => ["All", ...Array.from(new Set(stationItems.map((i) => i.type || "")))],
        [stationItems]
    );

    const getField = (item: any, by: string) => {
        if (by.startsWith("status.")) return item?.status?.[by.split(".")[1]] ?? 0;
        if (by.startsWith("source.")) return item?.source?.[by.split(".")[1]] ?? 0;
        if (by.startsWith("whereabouts."))
            return item?.whereabouts?.[by.split(".")[1]] ?? "";
        return item?.[by] ?? "";
    };

    const filtered = useMemo(() => {
        let rows = stationItems;
        if (typeFilter !== "All") rows = rows.filter((i) => i.type === typeFilter);
        if (query.trim()) {
            const q = query.trim().toLowerCase();
            rows = rows.filter(
                (i) =>
                    (i.equipment || "").toLowerCase().includes(q) ||
                    (i.type || "").toLowerCase().includes(q) ||
                    (i.make || "").toLowerCase().includes(q) ||
                    (i.serialNo || "").toLowerCase().includes(q) ||
                    (i.propertyNo || "").toLowerCase().includes(q) ||
                    (i.whereabouts?.userName || "").toLowerCase().includes(q)
            );
        }
        const mul = sort.dir === "asc" ? 1 : -1;
        return [...rows].sort((a, b) => {
            const av = getField(a, sort.by);
            const bv = getField(b, sort.by);
            if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
            return String(av).localeCompare(String(bv)) * mul;
        });
    }, [stationItems, query, typeFilter, sort]);

    // ADD (insert into Supabase)
    const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const data: any = Object.fromEntries(new FormData(e.currentTarget).entries());

        const payload = {
            sector,
            station,
            equipment: (data.equipment || "").toString().trim(),
            type: (data.type || "").toString().trim() || "Unspecified",
            make: (data.make || "").toString().trim(),
            serial_no: (data.serialNo || "").toString().trim(),
            property_no: (data.propertyNo || "").toString().trim(),
            acquisition_date:
                (data.acquisitionDate || "").toString().trim() || null,
            acquisition_cost: toNum(data.acquisitionCost),
            cost_of_repair: toNum(data.costOfRepair),
            current_or_depreciated: (data.currentOrDepreciated || "")
                .toString()
                .trim(),
            status_svc: toNum(data.svc),
            status_uns: toNum(data.uns),
            status_ber: toNum(data.ber),
            source_procured: toNum(data.procured),
            source_donated: toNum(data.donated),
            source_found_at_station: toNum(data.foundAtStation),
            source_loaned: toNum(data.loaned),
            user_office: (data.userOffice || "").toString().trim(),
            user_name: (data.userName || "").toString().trim(),
        };

        if (!payload.equipment && !payload.type && !payload.make) return;

        const { data: inserted, error } = await supabase
            .from("station_inventory")
            .insert(payload)
            .select("*")
            .single();

        if (error) {
            console.error(error);
            alert("Failed to add item");
            return;
        }

        setItems((prev) => [mapRowToItem(inserted), ...prev]);
        e.currentTarget.reset();
    };

    // EDIT SAVE (update Supabase)
    const handleEditSave = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editing) return;

        const data: any = Object.fromEntries(new FormData(e.currentTarget).entries());

        const payload = {
            equipment: (data.equipment || "").toString().trim(),
            type: (data.type || "").toString().trim(),
            make: (data.make || "").toString().trim(),
            serial_no: (data.serialNo || "").toString().trim(),
            property_no: (data.propertyNo || "").toString().trim(),
            acquisition_date:
                (data.acquisitionDate || "").toString().trim() || null,
            acquisition_cost: toNum(data.acquisitionCost),
            cost_of_repair: toNum(data.costOfRepair),
            current_or_depreciated: (data.currentOrDepreciated || "")
                .toString()
                .trim(),
            status_svc: toNum(data.svc),
            status_uns: toNum(data.uns),
            status_ber: toNum(data.ber),
            source_procured: toNum(data.procured),
            source_donated: toNum(data.donated),
            source_found_at_station: toNum(data.foundAtStation),
            source_loaned: toNum(data.loaned),
            user_office: (data.userOffice || "").toString().trim(),
            user_name: (data.userName || "").toString().trim(),
        };

        const { data: updated, error } = await supabase
            .from("station_inventory")
            .update(payload)
            .eq("id", editing.id)
            .select("*")
            .single();

        if (error) {
            console.error(error);
            alert("Failed to save item");
            return;
        }

        const updatedItem = mapRowToItem(updated);
        setItems((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
        setEditing(null);
    };

    // DELETE (Supabase)
    const handleDelete = async (id: string) => {
        if (!confirm("Delete this item?")) return;
        const { error } = await supabase
            .from("station_inventory")
            .delete()
            .eq("id", id);

        if (error) {
            console.error(error);
            alert("Failed to delete");
            return;
        }
        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const toggleSort = (by: string) =>
        setSort((s) =>
            s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: "asc" }
        );

    const getCSVValue = (i: any, h: string) => {
        const map: Record<string, any> = {
            station: i.station,
            equipment: i.equipment,
            serialNo: i.serialNo,
            propertyNo: i.propertyNo,
            acquisitionDate: i.acquisitionDate,
            acquisitionCost: i.acquisitionCost,
            costOfRepair: i.costOfRepair,
            currentOrDepreciated: i.currentOrDepreciated,
            svc: i?.status?.svc,
            uns: i?.status?.uns,
            ber: i?.status?.ber,
            procured: i?.source?.procured,
            donated: i?.source?.donated,
            foundAtStation: i?.source?.foundAtStation,
            loaned: i?.source?.loaned,
            userOffice: i?.whereabouts?.userOffice,
            userName: i?.whereabouts?.userName,
        };
        return h in map ? map[h] : i?.[h];
    };

    const exportCSV = () => {
        const rows = [
            CSV_HEADERS.join(","),
            ...filtered.map((i) =>
                CSV_HEADERS.map((h) => JSON.stringify(getCSVValue(i, h))).join(",")
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
    };

    // IMPORT CSV → insert into Supabase
    const importCSV = async (file: File) => {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(Boolean);
        const [header, ...rest] = lines;
        const cols = header.split(",").map((s) => s.replaceAll('"', ""));
        if (CSV_HEADERS.some((r) => !cols.includes(r))) {
            alert("CSV missing required headers");
            return;
        }

        const payloads = rest.map((line) => {
            const values =
                line
                    .match(/"(?:[^"]|"")*"|[^,]+/g)
                    ?.map((s) => s.replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
            const row: any = Object.fromEntries(
                cols.map((c, idx) => [c, values[idx] ?? ""])
            );
            return {
                sector,
                station,
                equipment: String(row.equipment || ""),
                type: String(row.type || "Unspecified"),
                make: String(row.make || ""),
                serial_no: String(row.serialNo || ""),
                property_no: String(row.propertyNo || ""),
                acquisition_date: String(row.acquisitionDate || "") || null,
                acquisition_cost: toNum(row.acquisitionCost),
                cost_of_repair: toNum(row.costOfRepair),
                current_or_depreciated: String(row.currentOrDepreciated || ""),
                status_svc: toNum(row.svc),
                status_uns: toNum(row.uns),
                status_ber: toNum(row.ber),
                source_procured: toNum(row.procured),
                source_donated: toNum(row.donated),
                source_found_at_station: toNum(row.foundAtStation),
                source_loaned: toNum(row.loaned),
                user_office: String(row.userOffice || ""),
                user_name: String(row.userName || ""),
            };
        });

        const { data, error } = await supabase
            .from("station_inventory")
            .insert(payloads)
            .select("*");

        if (error) {
            console.error(error);
            alert("Failed to import CSV");
            return;
        }

        setItems((prev) => [...(data || []).map(mapRowToItem), ...prev]);
    };

    const totals = useMemo(() => {
        const totalSvc = filtered.reduce((s, i) => s + toNum(i?.status?.svc), 0);
        const totalUns = filtered.reduce((s, i) => s + toNum(i?.status?.uns), 0);
        const totalBer = filtered.reduce((s, i) => s + toNum(i?.status?.ber), 0);
        const totalProcured = filtered.reduce(
            (s, i) => s + toNum(i?.source?.procured),
            0
        );
        return {
            skus: filtered.length,
            units: totalSvc + totalUns + totalBer,
            serviceable: totalSvc,
            procured: totalProcured,
        };
    }, [filtered]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 overflow-x-hidden">
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
                                onChange={(e) =>
                                    e.target.files?.[0] && importCSV(e.target.files[0])
                                }
                            />
                        </label>
                    </div>
                </div>
            </header>

            <main className="section py-6 grid gap-6">
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card title="Total SKUs" value={totals.skus} footer="unique items" />
                    <Card
                        title="Total Units"
                        value={totals.units}
                        footer="Svc + Uns + BER"
                    />
                    <Card
                        title="Serviceable"
                        value={totals.serviceable}
                        footer="this station"
                    />
                    <Card
                        title="Procured"
                        value={totals.procured}
                        footer="this station"
                    />
                </section>

                {/* Filters (kept from your earlier version if you want) */}
                <section className="panel panel-pad flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
                    <div className="flex gap-2 items-center flex-wrap">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by equipment, type, make, serial no. or user"
                            className="text-input w-[18rem] md:w-[28rem]"
                        />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="text-input"
                        >
                            {types.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="text-sm text-slate-500">
                        {loading ? "Loading..." : `${filtered.length} results`}
                    </div>
                </section>

                {/* ADD FORM */}
                <section className="panel panel-pad">
                    <h2 className="font-semibold mb-3">Add Item — {station}</h2>
                    <form onSubmit={handleAdd} className="grid gap-4">
                        {/* row 1 */}
                        <div className="grid md:grid-cols-4 gap-3">
                            <input value={station} disabled readOnly className="text-input" />
                            <Input
                                name="equipment"
                                placeholder="Equipment"
                                className="text-input"
                            />
                            <Input name="type" placeholder="Type" className="text-input" />
                            <Input name="make" placeholder="Make" className="text-input" />
                        </div>
                        {/* row 2 */}
                        <div className="grid md:grid-cols-4 gap-3">
                            <Input
                                name="serialNo"
                                placeholder="Serial No."
                                className="text-input"
                            />
                            <Input
                                name="propertyNo"
                                placeholder="Property No."
                                className="text-input"
                            />
                            <Input name="acquisitionDate" type="date" className="text-input" />
                            <Input
                                name="acquisitionCost"
                                type="number"
                                min={0}
                                placeholder="Acquisition Cost"
                                className="text-input"
                            />
                        </div>
                        {/* row 3 */}
                        <div className="grid md:grid-cols-4 gap-3">
                            <Input
                                name="costOfRepair"
                                type="number"
                                min={0}
                                placeholder="Cost of Repair (if any)"
                                className="text-input"
                            />
                            <Input
                                name="currentOrDepreciated"
                                placeholder="Current or Depreciated"
                                className="text-input md:col-span-2"
                            />
                        </div>

                        <fieldset className="border rounded-2xl p-3">
                            <legend className="px-2 text-sm text-slate-500">STATUS</legend>
                            <div className="grid md:grid-cols-3 gap-3">
                                <Input
                                    name="svc"
                                    type="number"
                                    min={0}
                                    placeholder="Svc"
                                    className="text-input"
                                />
                                <Input
                                    name="uns"
                                    type="number"
                                    min={0}
                                    placeholder="Uns"
                                    className="text-input"
                                />
                                <Input
                                    name="ber"
                                    type="number"
                                    min={0}
                                    placeholder="BER"
                                    className="text-input"
                                />
                            </div>
                        </fieldset>

                        <fieldset className="border rounded-2xl p-3">
                            <legend className="px-2 text-sm text-slate-500">SOURCE</legend>
                            <div className="grid md:grid-cols-4 gap-3">
                                <Input
                                    name="procured"
                                    type="number"
                                    min={0}
                                    placeholder="Procured"
                                    className="text-input"
                                />
                                <Input
                                    name="donated"
                                    type="number"
                                    min={0}
                                    placeholder="Donated"
                                    className="text-input"
                                />
                                <Input
                                    name="foundAtStation"
                                    type="number"
                                    min={0}
                                    placeholder="Found at Station"
                                    className="text-input"
                                />
                                <Input
                                    name="loaned"
                                    type="number"
                                    min={0}
                                    placeholder="Loaned"
                                    className="text-input"
                                />
                            </div>
                        </fieldset>

                        <fieldset className="border rounded-2xl p-3">
                            <legend className="px-2 text-sm text-slate-500">WHEREABOUTS</legend>
                            <div className="grid md:grid-cols-2 gap-3">
                                <Input
                                    name="userOffice"
                                    placeholder="User Office"
                                    className="text-input"
                                />
                                <Input
                                    name="userName"
                                    placeholder="User Name"
                                    className="text-input"
                                />
                            </div>
                        </fieldset>

                        <div className="flex justify-end">
                            <button className="solid-btn px-4 py-2">Add</button>
                        </div>
                    </form>
                </section>

                {/* TABLE PANEL */}
                <section className="panel overflow-x-auto">
                    <div className="panel-pad">
                        <table className="min-w-[76rem] text-sm">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="px-4 py-2 text-center bg-slate-100" colSpan={9}>
                                        DESCRIPTION
                                    </th>
                                    <th className="px-4 py-2 text-center bg-amber-50" colSpan={5}>
                                        SOURCE
                                    </th>
                                    <th className="px-4 py-2 text-center bg-blue-50" colSpan={4}>
                                        STATUS
                                    </th>
                                    <th className="px-4 py-2 text-center bg-slate-100" colSpan={2}>
                                        WHEREABOUTS
                                    </th>
                                    <th className="px-4 py-2" rowSpan={2}>
                                        Actions
                                    </th>
                                </tr>
                                <tr className="bg-slate-50">
                                    <Th
                                        onClick={() => toggleSort("equipment")}
                                        active={sort.by === "equipment"}
                                        dir={sort.dir}
                                    >
                                        Equipment
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("type")}
                                        active={sort.by === "type"}
                                        dir={sort.dir}
                                    >
                                        Type
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("make")}
                                        active={sort.by === "make"}
                                        dir={sort.dir}
                                    >
                                        Make
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("serialNo")}
                                        active={sort.by === "serialNo"}
                                        dir={sort.dir}
                                    >
                                        Serial No.
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("propertyNo")}
                                        active={sort.by === "propertyNo"}
                                        dir={sort.dir}
                                    >
                                        Property No.
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("acquisitionDate")}
                                        active={sort.by === "acquisitionDate"}
                                        dir={sort.dir}
                                    >
                                        Acquisition Date
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("acquisitionCost")}
                                        active={sort.by === "acquisitionCost"}
                                        dir={sort.dir}
                                        className="text-right"
                                    >
                                        Acquisition Cost
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("costOfRepair")}
                                        active={sort.by === "costOfRepair"}
                                        dir={sort.dir}
                                        className="text-right"
                                    >
                                        Cost of Repair
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("currentOrDepreciated")}
                                        active={sort.by === "currentOrDepreciated"}
                                        dir={sort.dir}
                                    >
                                        Current / Depreciated
                                    </Th>

                                    <Th
                                        onClick={() => toggleSort("source.procured")}
                                        active={sort.by === "source.procured"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        Procured
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
                                        onClick={() => toggleSort("source.foundAtStation")}
                                        active={sort.by === "source.foundAtStation"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        Found at Station
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("source.loaned")}
                                        active={sort.by === "source.loaned"}
                                        dir={sort.dir}
                                        className="text-right bg-amber-50"
                                    >
                                        Loaned
                                    </Th>
                                    <th className="px-4 py-2 text-right bg-amber-50">Total</th>

                                    <Th
                                        onClick={() => toggleSort("status.svc")}
                                        active={sort.by === "status.svc"}
                                        dir={sort.dir}
                                        className="text-right bg-blue-50"
                                    >
                                        Svc
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("status.uns")}
                                        active={sort.by === "status.uns"}
                                        dir={sort.dir}
                                        className="text-right bg-blue-50"
                                    >
                                        Uns
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
                                        onClick={() => toggleSort("whereabouts.userOffice")}
                                        active={sort.by === "whereabouts.userOffice"}
                                        dir={sort.dir}
                                    >
                                        User Office
                                    </Th>
                                    <Th
                                        onClick={() => toggleSort("whereabouts.userName")}
                                        active={sort.by === "whereabouts.userName"}
                                        dir={sort.dir}
                                    >
                                        User Name
                                    </Th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((item) => {
                                    const statusTotal =
                                        toNum(item?.status?.svc) +
                                        toNum(item?.status?.uns) +
                                        toNum(item?.status?.ber);
                                    const sourceTotal =
                                        toNum(item?.source?.procured) +
                                        toNum(item?.source?.donated) +
                                        toNum(item?.source?.foundAtStation) +
                                        toNum(item?.source?.loaned);

                                    return (
                                        <tr key={item.id} className="border-t hover:bg-slate-50">
                                            <td className="px-4 py-2">{item.equipment}</td>
                                            <td className="px-4 py-2">{item.type}</td>
                                            <td className="px-4 py-2">{item.make}</td>
                                            <td className="px-4 py-2">{item.serialNo}</td>
                                            <td className="px-4 py-2">{item.propertyNo}</td>
                                            <td className="px-4 py-2">{item.acquisitionDate}</td>
                                            <td className="px-4 py-2 text-right">
                                                {toNum(item.acquisitionCost)}
                                            </td>
                                            <td className="px-4 py-2 text-right">
                                                {toNum(item.costOfRepair)}
                                            </td>
                                            <td className="px-4 py-2">
                                                {item.currentOrDepreciated}
                                            </td>

                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.procured)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.donated)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.foundAtStation)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {toNum(item?.source?.loaned)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-amber-50/40">
                                                {sourceTotal}
                                            </td>

                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {toNum(item?.status?.svc)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {toNum(item?.status?.uns)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {toNum(item?.status?.ber)}
                                            </td>
                                            <td className="px-4 py-2 text-right bg-blue-50/40">
                                                {statusTotal}
                                            </td>

                                            <td className="px-4 py-2">
                                                {item.whereabouts?.userOffice}
                                            </td>
                                            <td className="px-4 py-2">
                                                {item.whereabouts?.userName}
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
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        {/* 9 desc + 5 source + 4 status + 2 whereabouts + 1 actions = 21 */}
                                        <td
                                            className="px-4 py-10 text-center text-slate-500"
                                            colSpan={21}
                                        >
                                            {loading ? "Loading..." : "No items found"}
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

            {editing && (
                <div
                    className="fixed inset-0 bg-black/20 flex items-center justify-center p-4"
                    onClick={() => setEditing(null)}
                >
                    <div
                        className="panel panel-pad w-full max-w-4xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="font-semibold mb-3">Edit Item — {station}</h3>
                        <form onSubmit={handleEditSave} className="grid gap-4">
                            <div className="grid md:grid-cols-4 gap-3">
                                <input
                                    value={station}
                                    disabled
                                    readOnly
                                    className="text-input"
                                />
                                <Input
                                    name="equipment"
                                    defaultValue={editing.equipment}
                                    className="text-input"
                                />
                                <Input
                                    name="type"
                                    defaultValue={editing.type}
                                    className="text-input"
                                />
                                <Input
                                    name="make"
                                    defaultValue={editing.make}
                                    className="text-input"
                                />
                            </div>
                            <div className="grid md:grid-cols-4 gap-3">
                                <Input
                                    name="serialNo"
                                    defaultValue={editing.serialNo}
                                    className="text-input"
                                />
                                <Input
                                    name="propertyNo"
                                    defaultValue={editing.propertyNo}
                                    className="text-input"
                                />
                                <Input
                                    name="acquisitionDate"
                                    type="date"
                                    defaultValue={
                                        editing.acquisitionDate || undefined
                                    }
                                    className="text-input"
                                />
                                <Input
                                    name="acquisitionCost"
                                    type="number"
                                    min={0}
                                    defaultValue={editing.acquisitionCost}
                                    className="text-input"
                                />
                            </div>
                            <div className="grid md:grid-cols-4 gap-3">
                                <Input
                                    name="costOfRepair"
                                    type="number"
                                    min={0}
                                    defaultValue={editing.costOfRepair}
                                    className="text-input"
                                />
                                <Input
                                    name="currentOrDepreciated"
                                    defaultValue={editing.currentOrDepreciated}
                                    className="text-input md:col-span-2"
                                />
                            </div>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">STATUS</legend>
                                <div className="grid md:grid-cols-3 gap-3">
                                    <Input
                                        name="svc"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.status?.svc}
                                        className="text-input"
                                    />
                                    <Input
                                        name="uns"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.status?.uns}
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
                                        name="procured"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.procured}
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
                                        name="foundAtStation"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.foundAtStation}
                                        className="text-input"
                                    />
                                    <Input
                                        name="loaned"
                                        type="number"
                                        min={0}
                                        defaultValue={editing.source?.loaned}
                                        className="text-input"
                                    />
                                </div>
                            </fieldset>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">
                                    WHEREABOUTS
                                </legend>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <Input
                                        name="userOffice"
                                        defaultValue={editing.whereabouts?.userOffice}
                                        className="text-input"
                                    />
                                    <Input
                                        name="userName"
                                        defaultValue={editing.whereabouts?.userName}
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
