import { useEffect, useMemo, useState, FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toNum } from "../utils/storage";
import { Th, Input } from "../components/UI";
import { supabase } from "../lib/supabaseClient";

/**
 * ✅ Updates in this version:
 * - Adds REQUIRED field validation for Add + Edit
 * - Shows a popup alert listing missing fields
 * - Blocks submit if:
 *   - required inputs are empty
 *   - select boxes not selected (still "")
 *   - status violates DB constraint (Current/Depreciated)
 *
 * Notes:
 * - Your DB check constraint currently expects status in ('Current','Depreciated') or NULL.
 *   This code forces valid values.
 */

const CSV_HEADERS = [
    "station",
    "caliber",
    "type",
    "make",
    "serialNo",
    "propertyNo",
    "acquisitionDate",
    "acquisitionCost",
    "costOfRepair",

    "status",
    "statusOfProperty",
    "source",
    "disposition",
    "issuanceType",

    "qty",
    "value",
    "userOffice",
    "userName",
];

const TYPE_OPTIONS = ["Semi-Auto Rifle", "Rifle", "BAR", "SMG"] as const;

// ✅ Must match your DB check constraint exactly
const STATUS_OPTIONS = ["Current", "Depreciated"] as const;

// ✅ Properties options
const SOURCE_OPTIONS = ["Organic", "Donated", "Loaned"] as const;
const STATUS_OF_PROPERTY_OPTIONS = ["Serviceable", "Unserviceable", "Beyond Economic Repair"] as const;
const DISPOSITION_OPTIONS = ["On hand", "Issued"] as const;
const ISSUANCE_TYPE_OPTIONS = ["Assigned", "Temporary", "Permanent"] as const;

type Item = {
    id: string;
    sector: string;
    station: string;
    caliber: string;
    type: string;
    make: string;
    serialNo: string;
    propertyNo: string;
    acquisitionDate: string | null;
    acquisitionCost: number;
    costOfRepair: number;

    status: string;
    statusOfProperty: string;

    source: string;
    disposition: string;
    issuanceType: string;

    onHand: { qty: number; value: number };
    whereabouts: { userOffice: string; userName: string };
};

const mapRowToItem = (row: any): Item => ({
    id: row.id,
    sector: row.sector,
    station: row.station,
    caliber: row.caliber ?? "",
    type: row.type ?? "",
    make: row.make ?? "",
    serialNo: row.serial_no ?? "",
    propertyNo: row.property_no ?? "",
    acquisitionDate: row.acquisition_date ?? null,
    acquisitionCost: toNum(row.acquisition_cost),
    costOfRepair: toNum(row.cost_of_repair),

    status: row.status ?? "",
    statusOfProperty: row.status_of_property ?? "",

    source: row.source ?? "",
    disposition: row.disposition ?? "",
    issuanceType: row.issuance_type ?? "",

    onHand: {
        qty: toNum(row.on_hand_qty),
        value: toNum(row.on_hand_value),
    },
    whereabouts: {
        userOffice: row.user_office ?? "",
        userName: row.user_name ?? "",
    },
});

function isEmpty(v: unknown) {
    if (v === null || v === undefined) return true;
    if (typeof v === "string") return v.trim() === "";
    return false;
}

function normalizeText(v: unknown) {
    return String(v ?? "").trim();
}

/**
 * REQUIRED fields rules:
 * - Inputs: caliber, serialNo, propertyNo are required
 * - Selects: type, status, statusOfProperty, source, disposition, issuanceType are required
 * - Optional: make, dates, costs, onHand, whereabouts
 *
 * You can add/remove required fields easily here.
 */
function validatePayloadForAddOrEdit(payload: {
    caliber: string;
    type: string;
    serial_no: string;
    property_no: string;
    status: string;
    status_of_property: string;
    source: string;
    disposition: string;
    issuance_type: string;
}) {
    const missing: string[] = [];

    // Inputs
    if (isEmpty(payload.caliber)) missing.push("Caliber");
    if (isEmpty(payload.serial_no)) missing.push("Serial No.");
    if (isEmpty(payload.property_no)) missing.push("Property No.");

    // Selects
    if (isEmpty(payload.type) || payload.type === "Unspecified") missing.push("Type");
    if (isEmpty(payload.status)) missing.push("Status");
    if (isEmpty(payload.status_of_property)) missing.push("Status of Property");
    if (isEmpty(payload.source)) missing.push("Source");
    if (isEmpty(payload.disposition)) missing.push("Disposition");
    if (isEmpty(payload.issuance_type)) missing.push("Issuance Type");

    // DB constraint safety for status
    if (!isEmpty(payload.status) && !STATUS_OPTIONS.includes(payload.status as any)) {
        missing.push(`Status must be one of: ${STATUS_OPTIONS.join(", ")}`);
    }

    // Optional: validate specific select values if you want strictness
    if (!isEmpty(payload.source) && !SOURCE_OPTIONS.includes(payload.source as any)) {
        missing.push(`Source must be one of: ${SOURCE_OPTIONS.join(", ")}`);
    }
    if (!isEmpty(payload.status_of_property) && !STATUS_OF_PROPERTY_OPTIONS.includes(payload.status_of_property as any)) {
        missing.push(`Status of Property must be one of: ${STATUS_OF_PROPERTY_OPTIONS.join(", ")}`);
    }
    if (!isEmpty(payload.disposition) && !DISPOSITION_OPTIONS.includes(payload.disposition as any)) {
        missing.push(`Disposition must be one of: ${DISPOSITION_OPTIONS.join(", ")}`);
    }
    if (!isEmpty(payload.issuance_type) && !ISSUANCE_TYPE_OPTIONS.includes(payload.issuance_type as any)) {
        missing.push(`Issuance Type must be one of: ${ISSUANCE_TYPE_OPTIONS.join(", ")}`);
    }

    return missing;
}

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

            if (error) console.error(error);
            else setItems((data || []).map(mapRowToItem));

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
        if (by.startsWith("onHand.")) return item?.onHand?.[by.split(".")[1]] ?? 0;
        if (by.startsWith("whereabouts.")) return item?.whereabouts?.[by.split(".")[1]] ?? "";
        return item?.[by] ?? "";
    };

    const filtered = useMemo(() => {
        let rows = stationItems;

        if (typeFilter !== "All") rows = rows.filter((i) => i.type === typeFilter);

        if (query.trim()) {
            const q = query.trim().toLowerCase();
            rows = rows.filter(
                (i) =>
                    (i.caliber || "").toLowerCase().includes(q) ||
                    (i.type || "").toLowerCase().includes(q) ||
                    (i.make || "").toLowerCase().includes(q) ||
                    (i.serialNo || "").toLowerCase().includes(q) ||
                    (i.propertyNo || "").toLowerCase().includes(q) ||
                    (i.status || "").toLowerCase().includes(q) ||
                    (i.statusOfProperty || "").toLowerCase().includes(q) ||
                    (i.source || "").toLowerCase().includes(q) ||
                    (i.disposition || "").toLowerCase().includes(q) ||
                    (i.issuanceType || "").toLowerCase().includes(q) ||
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

    const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(fd.entries());

        const payload = {
            sector,
            station,
            caliber: normalizeText(data.caliber),
            type: normalizeText(data.type) || "Unspecified",
            make: normalizeText(data.make),
            serial_no: normalizeText(data.serialNo),
            property_no: normalizeText(data.propertyNo),
            acquisition_date: normalizeText(data.acquisitionDate) || null,
            acquisition_cost: toNum(data.acquisitionCost),
            cost_of_repair: toNum(data.costOfRepair),

            status: normalizeText(data.status),
            status_of_property: normalizeText(data.statusOfProperty),

            source: normalizeText(data.source),
            disposition: normalizeText(data.disposition),
            issuance_type: normalizeText(data.issuanceType),

            on_hand_qty: toNum(data.qty),
            on_hand_value: toNum(data.value),

            user_office: normalizeText(data.userOffice),
            user_name: normalizeText(data.userName),
        };

        // ✅ Validation popup
        const missing = validatePayloadForAddOrEdit({
            caliber: payload.caliber,
            type: payload.type,
            serial_no: payload.serial_no,
            property_no: payload.property_no,
            status: payload.status,
            status_of_property: payload.status_of_property,
            source: payload.source,
            disposition: payload.disposition,
            issuance_type: payload.issuance_type,
        });

        if (missing.length) {
            alert(`Please complete the following before adding:\n\n- ${missing.join("\n- ")}`);
            return;
        }

        const { data: inserted, error } = await supabase
            .from("station_inventory")
            .insert(payload)
            .select("*")
            .single();

        if (error) {
            console.error(error);
            alert(error.message || "Failed to add item");
            return;
        }

        setItems((prev) => [mapRowToItem(inserted), ...prev]);
        e.currentTarget.reset();
    };

    const handleEditSave = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editing) return;

        const fd = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(fd.entries());

        const payload = {
            caliber: normalizeText(data.caliber),
            type: normalizeText(data.type),
            make: normalizeText(data.make),
            serial_no: normalizeText(data.serialNo),
            property_no: normalizeText(data.propertyNo),
            acquisition_date: normalizeText(data.acquisitionDate) || null,
            acquisition_cost: toNum(data.acquisitionCost),
            cost_of_repair: toNum(data.costOfRepair),

            status: normalizeText(data.status),
            status_of_property: normalizeText(data.statusOfProperty),

            source: normalizeText(data.source),
            disposition: normalizeText(data.disposition),
            issuance_type: normalizeText(data.issuanceType),

            on_hand_qty: toNum(data.qty),
            on_hand_value: toNum(data.value),

            user_office: normalizeText(data.userOffice),
            user_name: normalizeText(data.userName),
        };

        // ✅ Validation popup
        const missing = validatePayloadForAddOrEdit({
            caliber: payload.caliber,
            type: payload.type,
            serial_no: payload.serial_no,
            property_no: payload.property_no,
            status: payload.status,
            status_of_property: payload.status_of_property,
            source: payload.source,
            disposition: payload.disposition,
            issuance_type: payload.issuance_type,
        });

        if (missing.length) {
            alert(`Please complete the following before saving:\n\n- ${missing.join("\n- ")}`);
            return;
        }

        const { data: updated, error } = await supabase
            .from("station_inventory")
            .update(payload)
            .eq("id", editing.id)
            .select("*")
            .single();

        if (error) {
            console.error(error);
            alert(error.message || "Failed to save item");
            return;
        }

        const updatedItem = mapRowToItem(updated);
        setItems((prev) => prev.map((it) => (it.id === updatedItem.id ? updatedItem : it)));
        setEditing(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this item?")) return;

        const { error } = await supabase.from("station_inventory").delete().eq("id", id);

        if (error) {
            console.error(error);
            alert(error.message || "Failed to delete");
            return;
        }

        setItems((prev) => prev.filter((i) => i.id !== id));
    };

    const toggleSort = (by: string) =>
        setSort((s) => (s.by === by ? { by, dir: s.dir === "asc" ? "desc" : "asc" } : { by, dir: "asc" }));

    const getCSVValue = (i: Item, h: string) => {
        const map: Record<string, any> = {
            station: i.station,
            caliber: i.caliber,
            type: i.type,
            make: i.make,
            serialNo: i.serialNo,
            propertyNo: i.propertyNo,
            acquisitionDate: i.acquisitionDate,
            acquisitionCost: i.acquisitionCost,
            costOfRepair: i.costOfRepair,
            status: i.status,
            statusOfProperty: i.statusOfProperty,
            source: i.source,
            disposition: i.disposition,
            issuanceType: i.issuanceType,
            qty: i.onHand.qty,
            value: i.onHand.value,
            userOffice: i.whereabouts.userOffice,
            userName: i.whereabouts.userName,
        };
        return map[h];
    };

    const exportCSV = () => {
        const rows = [
            CSV_HEADERS.join(","),
            ...filtered.map((i) => CSV_HEADERS.map((h) => JSON.stringify(getCSVValue(i, h))).join(",")),
        ].join("\n");

        const blob = new Blob([rows], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sector}-${station}-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

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
                line.match(/"(?:[^"]|"")*"|[^,]+/g)?.map((s) => s.replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
            const row: any = Object.fromEntries(cols.map((c, idx) => [c, values[idx] ?? ""]));

            return {
                sector,
                station,
                caliber: String(row.caliber || "").trim(),
                type: String(row.type || "Unspecified").trim(),
                make: String(row.make || "").trim(),
                serial_no: String(row.serialNo || "").trim(),
                property_no: String(row.propertyNo || "").trim(),
                acquisition_date: String(row.acquisitionDate || "").trim() || null,
                acquisition_cost: toNum(row.acquisitionCost),
                cost_of_repair: toNum(row.costOfRepair),

                status: String(row.status || "").trim(),
                status_of_property: String(row.statusOfProperty || "").trim(),

                source: String(row.source || "").trim(),
                disposition: String(row.disposition || "").trim(),
                issuance_type: String(row.issuanceType || "").trim(),

                on_hand_qty: toNum(row.qty),
                on_hand_value: toNum(row.value),
                user_office: String(row.userOffice || "").trim(),
                user_name: String(row.userName || "").trim(),
            };
        });

        // Optional: validate each CSV row; block if any invalid
        const badRows: { index: number; missing: string[] }[] = [];
        payloads.forEach((p, idx) => {
            const miss = validatePayloadForAddOrEdit({
                caliber: p.caliber,
                type: p.type,
                serial_no: p.serial_no,
                property_no: p.property_no,
                status: p.status,
                status_of_property: p.status_of_property,
                source: p.source,
                disposition: p.disposition,
                issuance_type: p.issuance_type,
            });
            if (miss.length) badRows.push({ index: idx + 1, missing: miss });
        });

        if (badRows.length) {
            const preview = badRows
                .slice(0, 5)
                .map((r) => `Row ${r.index}: ${r.missing.join(", ")}`)
                .join("\n");
            alert(
                `CSV import blocked. Some rows are missing required fields.\n\n${preview}${badRows.length > 5 ? `\n\n(+${badRows.length - 5} more rows)` : ""
                }`
            );
            return;
        }

        const { data, error } = await supabase.from("station_inventory").insert(payloads).select("*");

        if (error) {
            console.error(error);
            alert(error.message || "Failed to import CSV");
            return;
        }

        setItems((prev) => [...(data || []).map(mapRowToItem), ...prev]);
    };

    const totals = useMemo(() => {
        const totalQty = filtered.reduce((s, i) => s + toNum(i.onHand.qty), 0);
        const totalValue = filtered.reduce((s, i) => s + toNum(i.onHand.value), 0);

        return {
            skus: filtered.length,
            qty: totalQty,
            value: totalValue,
        };
    }, [filtered]);

    return (
        <div className="min-h-screen bg-sky-500 text-slate-900 overflow-x-hidden">
            <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/70 backdrop-blur">
                <div className="w-full max-w-[95rem] mx-auto px-4 xl:px-8 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => nav(`/sector/${encodeURIComponent(sector)}`)}
                            className="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 text-sm font-semibold"
                        >
                            ← {sector} Stations
                        </button>

                        <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                            {sector} • {station} — Inventory
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportCSV}
                            className="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 text-sm font-semibold"
                        >
                            Export CSV
                        </button>

                        <label className="rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-2 text-sm font-semibold cursor-pointer">
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

            <main className="w-full max-w-[95rem] mx-auto px-4 xl:px-8 py-6 grid gap-6">
                {/* Stats */}
                <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-white/80 border border-white/40 shadow-sm px-5 py-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Total SKUs</div>
                        <div className="text-2xl font-extrabold mt-1">{totals.skus}</div>
                        <div className="text-xs text-slate-500 mt-1">unique items</div>
                    </div>

                    <div className="rounded-2xl bg-white/80 border border-white/40 shadow-sm px-5 py-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Qty</div>
                        <div className="text-2xl font-extrabold mt-1">{totals.qty}</div>
                        <div className="text-xs text-slate-500 mt-1">on hand per count</div>
                    </div>

                    <div className="rounded-2xl bg-white/80 border border-white/40 shadow-sm px-5 py-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Value</div>
                        <div className="text-2xl font-extrabold mt-1">{totals.value}</div>
                        <div className="text-xs text-slate-500 mt-1">on hand per count</div>
                    </div>
                </section>

                {/* Filters (ONLY search + type) */}
                <section className="rounded-2xl bg-white/70 border border-white/40 shadow-sm p-4">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex gap-2 items-center flex-wrap">
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by caliber, type, make, serial no. or user"
                                className="w-full md:w-[28rem] rounded-xl bg-white/90 border border-white/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
                            />

                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="rounded-xl bg-white/90 border border-white/40 px-3 py-2 text-sm font-semibold"
                            >
                                {types.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="text-sm text-slate-600">{loading ? "Loading..." : `${filtered.length} results`}</div>
                    </div>
                </section>

                {/* Add Form */}
                <section className="rounded-2xl border border-white/30 bg-gradient-to-b from-slate-700/70 to-slate-500/60 shadow-lg p-5 sm:p-6">
                    <div className="text-sm text-white/90 mb-4">
                        <span className="opacity-90">Add Item — </span>
                        <span className="font-semibold">{station}</span>
                    </div>

                    <form onSubmit={handleAdd} className="grid gap-4">
                        <div className="grid md:grid-cols-4 gap-3">
                            <input value={station} disabled readOnly className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm" />

                            <Input name="caliber" placeholder="Caliber *" className="text-input !rounded-xl !bg-white/90 !border-white/30" />

                            <select
                                name="type"
                                defaultValue=""
                                className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
                            >
                                <option value="" disabled>
                                    Type *
                                </option>
                                {TYPE_OPTIONS.map((t) => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>

                            <Input name="make" placeholder="Make" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                        </div>

                        <div className="grid md:grid-cols-4 gap-3">
                            <Input name="serialNo" placeholder="Serial No. *" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                            <Input
                                name="propertyNo"
                                placeholder="Semi-Expandable Property Nr *"
                                className="text-input !rounded-xl !bg-white/90 !border-white/30"
                            />
                            <Input name="acquisitionDate" type="date" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                            <Input
                                name="acquisitionCost"
                                type="number"
                                min={0}
                                placeholder="Acquisition Cost"
                                className="text-input !rounded-xl !bg-white/90 !border-white/30"
                            />
                        </div>

                        {/* Cost of Repair + Status */}
                        <div className="grid md:grid-cols-4 gap-3">
                            <Input
                                name="costOfRepair"
                                type="number"
                                min={0}
                                placeholder="Cost of Repair (if any)"
                                className="text-input !rounded-xl !bg-white/90 !border-white/30"
                            />

                            <select
                                name="status"
                                defaultValue=""
                                className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50 md:col-span-3"
                            >
                                <option value="" disabled>
                                    Status *
                                </option>
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                        {s}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* PROPERTIES */}
                        <fieldset className="rounded-2xl border border-black/30 bg-slate-900/10 p-4">
                            <legend className="px-2 text-[10px] uppercase tracking-wider text-white/80">PROPERTIES</legend>

                            <div className="grid md:grid-cols-4 gap-3">
                                <select
                                    name="source"
                                    defaultValue=""
                                    className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
                                >
                                    <option value="" disabled>
                                        Source *
                                    </option>
                                    {SOURCE_OPTIONS.map((o) => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    name="statusOfProperty"
                                    defaultValue=""
                                    className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
                                >
                                    <option value="" disabled>
                                        Status of Property *
                                    </option>
                                    {STATUS_OF_PROPERTY_OPTIONS.map((o) => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    name="disposition"
                                    defaultValue=""
                                    className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
                                >
                                    <option value="" disabled>
                                        Disposition *
                                    </option>
                                    {DISPOSITION_OPTIONS.map((o) => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    name="issuanceType"
                                    defaultValue=""
                                    className="w-full rounded-xl bg-white/90 border border-white/30 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/50"
                                >
                                    <option value="" disabled>
                                        Issuance Type *
                                    </option>
                                    {ISSUANCE_TYPE_OPTIONS.map((o) => (
                                        <option key={o} value={o}>
                                            {o}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </fieldset>

                        <fieldset className="rounded-2xl border border-black/30 bg-slate-900/10 p-4">
                            <legend className="px-2 text-[10px] uppercase tracking-wider text-white/80">ON HAND PER COUNT</legend>
                            <div className="grid md:grid-cols-2 gap-3">
                                <Input name="qty" type="number" min={0} placeholder="Qty" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                                <Input name="value" type="number" min={0} placeholder="Value" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                            </div>
                        </fieldset>

                        <fieldset className="rounded-2xl border border-black/30 bg-slate-900/10 p-4">
                            <legend className="px-2 text-[10px] uppercase tracking-wider text-white/80">WHEREABOUTS</legend>
                            <div className="grid md:grid-cols-2 gap-3">
                                <Input name="userOffice" placeholder="User Office" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                                <Input name="userName" placeholder="User Name" className="text-input !rounded-xl !bg-white/90 !border-white/30" />
                            </div>
                        </fieldset>

                        <div className="flex justify-end">
                            <button className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800">
                                Add
                            </button>
                        </div>
                    </form>
                </section>

                {/* Table */}
                <section className="rounded-2xl overflow-hidden shadow-lg border border-black/10 bg-white">
                    <div className="bg-gradient-to-r from-slate-950 to-slate-900 px-4 py-3">
                        <div className="text-xs font-extrabold tracking-wider text-white">STATUS OF FIREARMS</div>
                    </div>

                    <div className="overflow-x-auto">
                        <div className="p-4">
                            <table className="min-w-[92rem] text-sm">
                                <thead>
                                    <tr className="bg-slate-100">
                                        <th className="px-4 py-2 text-center" colSpan={8}>
                                            DESCRIPTION
                                        </th>
                                        <th className="px-4 py-2 text-center" colSpan={5}>
                                            PROPERTIES
                                        </th>
                                        <th className="px-4 py-2 text-center bg-emerald-50" colSpan={2}>
                                            ON HAND PER COUNT
                                        </th>
                                        <th className="px-4 py-2 text-center" colSpan={2}>
                                            WHEREABOUTS
                                        </th>
                                        <th className="px-4 py-2" rowSpan={2}>
                                            Actions
                                        </th>
                                    </tr>

                                    <tr className="bg-slate-50">
                                        <Th onClick={() => toggleSort("type")} active={sort.by === "type"} dir={sort.dir}>
                                            Type
                                        </Th>
                                        <Th onClick={() => toggleSort("make")} active={sort.by === "make"} dir={sort.dir}>
                                            Make
                                        </Th>
                                        <Th onClick={() => toggleSort("caliber")} active={sort.by === "caliber"} dir={sort.dir}>
                                            Caliber
                                        </Th>
                                        <Th onClick={() => toggleSort("serialNo")} active={sort.by === "serialNo"} dir={sort.dir}>
                                            Serial No.
                                        </Th>
                                        <Th onClick={() => toggleSort("propertyNo")} active={sort.by === "propertyNo"} dir={sort.dir}>
                                            Property No.
                                        </Th>
                                        <Th onClick={() => toggleSort("acquisitionDate")} active={sort.by === "acquisitionDate"} dir={sort.dir}>
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

                                        <Th onClick={() => toggleSort("status")} active={sort.by === "status"} dir={sort.dir}>
                                            Status
                                        </Th>

                                        <Th
                                            onClick={() => toggleSort("statusOfProperty")}
                                            active={sort.by === "statusOfProperty"}
                                            dir={sort.dir}
                                        >
                                            Status of Property
                                        </Th>
                                        <Th onClick={() => toggleSort("source")} active={sort.by === "source"} dir={sort.dir}>
                                            Source
                                        </Th>
                                        <Th onClick={() => toggleSort("disposition")} active={sort.by === "disposition"} dir={sort.dir}>
                                            Disposition
                                        </Th>
                                        <Th onClick={() => toggleSort("issuanceType")} active={sort.by === "issuanceType"} dir={sort.dir}>
                                            Issuance Type
                                        </Th>

                                        <Th onClick={() => toggleSort("onHand.qty")} active={sort.by === "onHand.qty"} dir={sort.dir} className="bg-emerald-50">
                                            Qty
                                        </Th>
                                        <Th
                                            onClick={() => toggleSort("onHand.value")}
                                            active={sort.by === "onHand.value"}
                                            dir={sort.dir}
                                            className="bg-emerald-50"
                                        >
                                            Value
                                        </Th>

                                        <Th
                                            onClick={() => toggleSort("whereabouts.userOffice")}
                                            active={sort.by === "whereabouts.userOffice"}
                                            dir={sort.dir}
                                        >
                                            User Office
                                        </Th>
                                        <Th onClick={() => toggleSort("whereabouts.userName")} active={sort.by === "whereabouts.userName"} dir={sort.dir}>
                                            User Name
                                        </Th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {filtered.map((item) => (
                                        <tr key={item.id} className="border-t hover:bg-slate-50">
                                            <td className="px-4 py-2">{item.type}</td>
                                            <td className="px-4 py-2">{item.make}</td>
                                            <td className="px-4 py-2">{item.caliber}</td>
                                            <td className="px-4 py-2">{item.serialNo}</td>
                                            <td className="px-4 py-2">{item.propertyNo}</td>
                                            <td className="px-4 py-2">{item.acquisitionDate}</td>
                                            <td className="px-4 py-2 text-right">{toNum(item.acquisitionCost)}</td>
                                            <td className="px-4 py-2 text-right">{toNum(item.costOfRepair)}</td>

                                            <td className="px-4 py-2">{item.status}</td>

                                            <td className="px-4 py-2">{item.statusOfProperty}</td>
                                            <td className="px-4 py-2">{item.source}</td>
                                            <td className="px-4 py-2">{item.disposition}</td>
                                            <td className="px-4 py-2">{item.issuanceType}</td>

                                            <td className="px-4 py-2 bg-emerald-50/40">{toNum(item.onHand.qty)}</td>
                                            <td className="px-4 py-2 bg-emerald-50/40">{toNum(item.onHand.value)}</td>

                                            <td className="px-4 py-2">{item.whereabouts.userOffice}</td>
                                            <td className="px-4 py-2">{item.whereabouts.userName}</td>

                                            <td className="px-4 py-2 text-right">
                                                <div className="flex gap-2 justify-end">
                                                    <button onClick={() => setEditing(item)} className="soft-btn px-3 py-1">
                                                        Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(item.id)} className="soft-btn px-3 py-1 hover:bg-red-50">
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {filtered.length === 0 && (
                                        <tr>
                                            <td className="px-4 py-10 text-center text-slate-500" colSpan={18}>
                                                {loading ? "Loading..." : "No items found"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                <footer className="text-center text-xs text-white/80 pb-8">
                    {sector} • {station}
                </footer>
            </main>

            {/* Edit Modal */}
            {editing && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
                    <div className="panel panel-pad w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="font-semibold mb-3">Edit Item — {station}</h3>

                        <form onSubmit={handleEditSave} className="grid gap-4">
                            <div className="grid md:grid-cols-4 gap-3">
                                <input value={station} disabled readOnly className="text-input" />
                                <Input name="caliber" defaultValue={editing.caliber} placeholder="Caliber *" className="text-input" />

                                <select name="type" defaultValue={editing.type} className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm">
                                    {TYPE_OPTIONS.map((t) => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>

                                <Input name="make" defaultValue={editing.make} className="text-input" />
                            </div>

                            <div className="grid md:grid-cols-4 gap-3">
                                <Input name="serialNo" defaultValue={editing.serialNo} placeholder="Serial No. *" className="text-input" />
                                <Input name="propertyNo" defaultValue={editing.propertyNo} placeholder="Property No. *" className="text-input" />
                                <Input name="acquisitionDate" type="date" defaultValue={editing.acquisitionDate || undefined} className="text-input" />
                                <Input name="acquisitionCost" type="number" min={0} defaultValue={editing.acquisitionCost} className="text-input" />
                            </div>

                            <div className="grid md:grid-cols-4 gap-3">
                                <Input name="costOfRepair" type="number" min={0} defaultValue={editing.costOfRepair} className="text-input" />

                                <select name="status" defaultValue={editing.status || ""} className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm md:col-span-3">
                                    <option value="" disabled>
                                        Status *
                                    </option>
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">PROPERTIES</legend>
                                <div className="grid md:grid-cols-4 gap-3">
                                    <select name="source" defaultValue={editing.source || ""} className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm">
                                        <option value="" disabled>
                                            Source *
                                        </option>
                                        {SOURCE_OPTIONS.map((o) => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        name="statusOfProperty"
                                        defaultValue={editing.statusOfProperty || ""}
                                        className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm"
                                    >
                                        <option value="" disabled>
                                            Status of Property *
                                        </option>
                                        {STATUS_OF_PROPERTY_OPTIONS.map((o) => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        name="disposition"
                                        defaultValue={editing.disposition || ""}
                                        className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm"
                                    >
                                        <option value="" disabled>
                                            Disposition *
                                        </option>
                                        {DISPOSITION_OPTIONS.map((o) => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        name="issuanceType"
                                        defaultValue={editing.issuanceType || ""}
                                        className="w-full rounded-xl bg-white border border-slate-300 px-3 py-2 text-sm"
                                    >
                                        <option value="" disabled>
                                            Issuance Type *
                                        </option>
                                        {ISSUANCE_TYPE_OPTIONS.map((o) => (
                                            <option key={o} value={o}>
                                                {o}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </fieldset>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">ON HAND PER COUNT</legend>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <Input name="qty" type="number" min={0} defaultValue={editing.onHand.qty} className="text-input" />
                                    <Input name="value" type="number" min={0} defaultValue={editing.onHand.value} className="text-input" />
                                </div>
                            </fieldset>

                            <fieldset className="border rounded-2xl p-3">
                                <legend className="px-2 text-sm text-slate-500">WHEREABOUTS</legend>
                                <div className="grid md:grid-cols-2 gap-3">
                                    <Input name="userOffice" defaultValue={editing.whereabouts.userOffice} className="text-input" />
                                    <Input name="userName" defaultValue={editing.whereabouts.userName} className="text-input" />
                                </div>
                            </fieldset>

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditing(null)} className="soft-btn px-4 py-2">
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