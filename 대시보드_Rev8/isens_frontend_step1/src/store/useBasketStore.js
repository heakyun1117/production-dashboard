import { create } from "zustand";

const MAX_BASKET = 6;

const useBasketStore = create((set, get) => ({
  basketItems: [], // sheetKey 배열 (최대 6개)

  addToBasket: (sheetKey) =>
    set((s) => {
      if (s.basketItems.includes(sheetKey)) return s;
      if (s.basketItems.length >= MAX_BASKET) return s;
      return { basketItems: [...s.basketItems, sheetKey] };
    }),

  removeFromBasket: (sheetKey) =>
    set((s) => ({
      basketItems: s.basketItems.filter((k) => k !== sheetKey),
    })),

  clearBasket: () => set({ basketItems: [] }),

  isInBasket: (sheetKey) => get().basketItems.includes(sheetKey),
}));

export default useBasketStore;
