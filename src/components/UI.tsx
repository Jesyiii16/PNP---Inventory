import React from "react";

/* -------------------------------------------------------------------------- */
/*  Layout helpers                                                            */
/* -------------------------------------------------------------------------- */

export const Section: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className = "",
    ...p
}) => <div {...p} className={`w-full max-w-[95rem] px-4 xl:px-8 mx-auto ${className}`} />;

export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className = "",
    ...p
}) => (
    <div
        {...p}
        className={`bg-white/90 backdrop-blur rounded-3xl border border-slate-200/70 shadow-sm ${className}`}
    />
);

export const PanelPad: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
    className = "",
    ...p
}) => <Panel {...p} className={`p-5 md:p-6 ${className}`} />;

/* -------------------------------------------------------------------------- */
/*  Buttons / Inputs                                                          */
/* -------------------------------------------------------------------------- */

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "soft" | "solid";
};

export const Button: React.FC<BtnProps> = ({ variant = "soft", className = "", ...p }) => (
    <button
        {...p}
        className={`${variant === "solid"
            ? "rounded-2xl bg-slate-900 text-white hover:brightness-95"
            : "rounded-2xl border border-slate-200 bg-white/80 shadow-sm hover:shadow-md"
            } transition ${className}`}
    />
);

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
    const { className = "", ...rest } = props;
    return (
        <input
            {...rest}
            className={`w-full rounded-2xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 shadow-inner placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-200 ${className}`}
        />
    );
}

/* -------------------------------------------------------------------------- */
/*  Table header                                                              */
/* -------------------------------------------------------------------------- */

export function Th({
    children,
    onClick,
    active,
    dir,
    className = "",
    rowSpan,
    colSpan,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    active?: boolean;
    dir?: "asc" | "desc";
    className?: string;
    rowSpan?: number;
    colSpan?: number;
}) {
    return (
        <th
            rowSpan={rowSpan}
            colSpan={colSpan}
            className={`px-4 py-2 text-left select-none whitespace-nowrap font-medium text-slate-700 ${className}`}
        >
            {onClick ? (
                <button
                    onClick={onClick}
                    className={`inline-flex items-center gap-1 hover:opacity-80 transition ${active ? "font-semibold" : "font-medium"}`}
                >
                    {children}
                    <span className="text-xs opacity-60">{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
                </button>
            ) : (
                <span className="inline-flex items-center gap-1">{children}</span>
            )}
        </th>
    );
}

/* -------------------------------------------------------------------------- */
/*  Stats / Chips                                                             */
/* -------------------------------------------------------------------------- */

export function Card({
    title,
    value,
    footer,
}: {
    title: string;
    value: React.ReactNode;
    footer?: string;
}) {
    return (
        <Panel className="p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{title}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
            {footer && <div className="text-xs text-slate-500 mt-1">{footer}</div>}
        </Panel>
    );
}

export function MiniStat({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="rounded-2xl bg-slate-100/70 p-3">
            <div className="text-slate-500">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    );
}

export const Chip = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700">
        {children}
    </span>
);
