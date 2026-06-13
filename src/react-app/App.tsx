import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/common";
import Home from "./pages/Home";
import Search from "./pages/Search";
import CardDetail from "./pages/CardDetail";
import Archetypes from "./pages/Archetypes";
import ArchetypeDetail from "./pages/ArchetypeDetail";
import { Sets, SetDetail } from "./pages/Sets";

// Track B（Canvas 创作套件）按需加载
const CardMaker = lazy(() => import("./pages/CardMaker"));
const ShareImage = lazy(() => import("./pages/ShareImage"));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder"));

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Suspense fallback={<div className="container page"><Spinner /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/card/:id" element={<CardDetail />} />
            <Route path="/archetypes" element={<Archetypes />} />
            <Route path="/archetypes/:id" element={<ArchetypeDetail />} />
            <Route path="/sets" element={<Sets />} />
            <Route path="/sets/:code" element={<SetDetail />} />
            <Route path="/maker" element={<CardMaker />} />
            <Route path="/share" element={<ShareImage />} />
            <Route path="/deck" element={<DeckBuilder />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </AppShell>
    </BrowserRouter>
  );
}
