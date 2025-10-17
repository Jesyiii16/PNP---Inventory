import React from "react";
import { Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import SectorDashboard from "./pages/SectorDashboard";
import StationInventory from "./pages/StationInventory";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/sector/:sector" element={<SectorDashboard />} />
      <Route path="/sector/:sector/:station" element={<StationInventory />} />
    </Routes>
  );
}
