import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "./lib/i18n";
import { UserProvider } from "./lib/user";
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
// M11：分享长图功能暂时下线（保留代码以备恢复）
// const ShareImage = lazy(() => import("./pages/ShareImage"));
const DeckBuilder = lazy(() => import("./pages/DeckBuilder"));
// M9 壁纸图库按需加载
const Wallpapers = lazy(() => import("./pages/Wallpapers"));
// M10 账号体系按需加载
const Login = lazy(() => import("./pages/Login"));
const Me = lazy(() => import("./pages/Me"));
const Admin = lazy(() => import("./pages/Admin"));
// M11 反馈建议按需加载
const Feedback = lazy(() => import("./pages/Feedback"));

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
      <UserProvider>
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
            {/* M11：分享长图功能暂时下线（保留代码以备恢复） */}
            {/* <Route path="/share" element={<ShareImage />} /> */}
            <Route path="/deck" element={<DeckBuilder />} />
            <Route path="/wallpapers" element={<Wallpapers />} />
            <Route path="/login" element={<Login />} />
            <Route path="/me" element={<Me />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </AppShell>
      </UserProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
