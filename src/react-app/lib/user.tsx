// M10 账号体系前端上下文：当前用户 + 收藏状态（乐观更新）。
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import type { AuthUser, FavKind } from "../../shared/types";
import {
  authMe, authLogin, authRegister, authLogout,
  listFavorites, addFavorite, removeFavorite,
} from "./api";

interface UserCtx {
  me: AuthUser | null | undefined;   // undefined=加载中 null=未登录
  login: (u: string, p: string) => Promise<void>;
  register: (u: string, p: string, opts?: { website?: string; t?: number }) => Promise<void>;
  logout: () => Promise<void>;
  isFav: (kind: FavKind, ref: string | number) => boolean;
  toggleFav: (kind: FavKind, ref: string | number) => Promise<void>;
  favs: Record<FavKind, string[]>;
  refreshFavs: () => Promise<void>;
}

const EMPTY_FAVS: Record<FavKind, string[]> = { card: [], set: [], wallpaper: [] };

const Ctx = createContext<UserCtx>({
  me: null,
  login: async () => {}, register: async () => {}, logout: async () => {},
  isFav: () => false, toggleFav: async () => {},
  favs: EMPTY_FAVS, refreshFavs: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AuthUser | null | undefined>(undefined);
  const [favs, setFavs] = useState<Record<FavKind, string[]>>(EMPTY_FAVS);

  const refreshFavs = useCallback(async () => {
    try {
      const [card, set, wallpaper] = await Promise.all([
        listFavorites("card"), listFavorites("set"), listFavorites("wallpaper"),
      ]);
      setFavs({ card: card.items, set: set.items, wallpaper: wallpaper.items });
    } catch {
      setFavs(EMPTY_FAVS);
    }
  }, []);

  useEffect(() => {
    authMe()
      .then((r) => { setMe(r.user); void refreshFavs(); })
      .catch(() => setMe(null));
  }, [refreshFavs]);

  const login = useCallback(async (u: string, p: string) => {
    const r = await authLogin(u, p);
    setMe(r.user);
    void refreshFavs();
  }, [refreshFavs]);

  const register = useCallback(async (u: string, p: string, opts?: { website?: string; t?: number }) => {
    const r = await authRegister(u, p, opts);
    setMe(r.user);
    setFavs(EMPTY_FAVS);
  }, []);

  const logout = useCallback(async () => {
    try { await authLogout(); } catch { /* 会话已失效也视为登出成功 */ }
    setMe(null);
    setFavs(EMPTY_FAVS);
  }, []);

  const isFav = useCallback(
    (kind: FavKind, ref: string | number) => favs[kind].includes(String(ref)),
    [favs],
  );

  // 乐观更新：先改本地，失败回滚
  const toggleFav = useCallback(async (kind: FavKind, ref: string | number) => {
    const key = String(ref);
    const had = favs[kind].includes(key);
    setFavs((f) => ({
      ...f,
      [kind]: had ? f[kind].filter((x) => x !== key) : [key, ...f[kind]],
    }));
    try {
      if (had) await removeFavorite(kind, key);
      else await addFavorite(kind, key);
    } catch (e) {
      setFavs((f) => ({
        ...f,
        [kind]: had ? [key, ...f[kind]] : f[kind].filter((x) => x !== key),
      }));
      throw e;
    }
  }, [favs]);

  return (
    <Ctx.Provider value={{ me, login, register, logout, isFav, toggleFav, favs, refreshFavs }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUser(): UserCtx {
  return useContext(Ctx);
}
