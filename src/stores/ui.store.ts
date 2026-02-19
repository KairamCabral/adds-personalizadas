import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  // Sidebar (desktop collapsed state)
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Sidebar mobile overlay
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;

  // Command palette
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  // Order detail
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;

  // Create order dialog
  createOrderOpen: boolean;
  setCreateOrderOpen: (open: boolean) => void;
  createOrderStatus: string | null;
  setCreateOrderStatus: (status: string | null) => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      // Mobile sidebar
      mobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
      toggleMobileSidebar: () =>
        set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),

      // Command palette
      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),

      // Order detail
      selectedOrderId: null,
      setSelectedOrderId: (id) => set({ selectedOrderId: id }),

      // Create order
      createOrderOpen: false,
      setCreateOrderOpen: (open) => set({ createOrderOpen: open }),
      createOrderStatus: null,
      setCreateOrderStatus: (status) => set({ createOrderStatus: status }),
    }),
    {
      name: "adds-crm-ui",
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
