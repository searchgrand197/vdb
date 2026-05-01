import { create } from 'zustand';

/**
 * Notification store — manages in-app notifications and unread count.
 * Not persisted (notifications are transient).
 */
export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    set((state) => ({
      notifications: [
        { id: Date.now(), timestamp: new Date().toISOString(), read: false, ...notification },
        ...state.notifications,
      ],
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      const wasUnread = notification && !notification.read;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: wasUnread ? state.unreadCount - 1 : state.unreadCount,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

  setUnreadCount: (count) => set({ unreadCount: count }),
}));
