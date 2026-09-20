import { capture, handleMessage, syncCalendarSessions } from "./application";
import { syncAllReminders } from "./reminders";
import { ChromeSettingsRepository, DexieReadingRepository } from "../storage/repositories";

const readingRepo = new DexieReadingRepository();
const settingsRepo = new ChromeSettingsRepository();

const MENU = {
  open: "readslot-open",
  saveLink: "readslot-save-link",
  saveSelection: "readslot-save-selection",
  plan: "readslot-plan"
} as const;

const openPage = (page: "queue.html" | "planner.html" | "session.html" | "options.html") =>
  chrome.tabs.create({ url: chrome.runtime.getURL(page) });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU.open, title: "Open ReadSlot", contexts: ["action"] });
    chrome.contextMenus.create({ id: MENU.plan, title: "Plan reading time", contexts: ["action"] });
    chrome.contextMenus.create({
      id: MENU.saveLink,
      title: "Save link to ReadSlot",
      contexts: ["link"]
    });
    chrome.contextMenus.create({
      id: MENU.saveSelection,
      title: "Save selection to ReadSlot",
      contexts: ["selection"]
    });
  });
  void chrome.alarms.create("readslot-sync", { periodInMinutes: 30 });
  void syncAllReminders(readingRepo, settingsRepo);
});

chrome.runtime.onStartup?.addListener(() => {
  void syncAllReminders(readingRepo, settingsRepo);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void (async () => {
    if (info.menuItemId === MENU.open) return openPage("queue.html");
    if (info.menuItemId === MENU.plan) return openPage("planner.html");
    if (info.menuItemId === MENU.saveLink && info.linkUrl) {
      const result = await capture.fromUrl(info.linkUrl);
      if (tab?.id) await capture.toast(tab.id, result);
    }
    if (info.menuItemId === MENU.saveSelection && tab?.url) {
      const result = await capture.fromUrl(tab.url, tab.title, info.selectionText);
      if (tab.id) await capture.toast(tab.id, result);
    }
  })();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "open-dashboard") void openPage("queue.html");
  if (command === "capture-page") {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const result = await capture.fromTab(tab);
      if (tab.id) await capture.toast(tab.id, result);
    })();
  }
});

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === "readslot.open"
  ) {
    void openPage("queue.html");
    sendResponse(true);
    return false;
  }
  void handleMessage(message).then(sendResponse);
  return true;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "readslot-sync") {
    void syncCalendarSessions();
    return;
  }
  if (alarm.name === "readslot-weekly-plan") {
    void chrome.notifications.create("readslot-weekly-plan", {
      type: "basic",
      iconUrl: "icons/icon-128.png",
      title: "Plan a lighter reading week",
      message: "Review your queue and choose reading blocks. Nothing is booked automatically."
    });
    return;
  }
  if (alarm.name.startsWith("reminder:item:")) {
    const itemId = alarm.name.slice("reminder:item:".length);
    void (async () => {
      const itemResult = await readingRepo.get(itemId);
      if (!itemResult.ok) return;
      const item = itemResult.value;
      const today = new Date().getDay();
      if (
        item.status !== "deleted" &&
        item.recurrence?.enabled &&
        (item.recurrence.daysOfWeek.length === 0 || item.recurrence.daysOfWeek.includes(today))
      ) {
        void chrome.notifications.create(`reminder:item:${item.id}`, {
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: `Time to read: ${item.title}`,
          message: `${item.domain} · ${item.plannedMinutes ?? item.estimatedMinutes} min · Click to study now.`
        });
      }
    })();
    return;
  }
  if (alarm.name.startsWith("reminder:habit:")) {
    const habitId = alarm.name.slice("reminder:habit:".length);
    void (async () => {
      const settingsResult = await settingsRepo.get();
      if (!settingsResult.ok) return;
      const habit = settingsResult.value.dailyReminders?.find((h) => h.id === habitId);
      const today = new Date().getDay();
      if (habit?.enabled && (habit.daysOfWeek.length === 0 || habit.daysOfWeek.includes(today))) {
        void chrome.notifications.create(`reminder:habit:${habit.id}`, {
          type: "basic",
          iconUrl: "icons/icon-128.png",
          title: habit.label || "Daily reading habit",
          message: "It's time for your daily reading session. Click to view your queue."
        });
      }
    })();
    return;
  }
  if (!alarm.name.startsWith("session:")) return;
  const sessionId = alarm.name.slice("session:".length);
  void chrome.notifications.create(`review:${sessionId}`, {
    type: "basic",
    iconUrl: "icons/icon-128.png",
    title: "How did your reading block go?",
    message: "Review what you finished and return the rest to your queue."
  });
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId.startsWith("review:")) void openPage("session.html");
  if (notificationId === "readslot-weekly-plan") void openPage("planner.html");
  if (notificationId.startsWith("reminder:item:")) {
    const itemId = notificationId.slice("reminder:item:".length);
    void (async () => {
      const itemResult = await readingRepo.get(itemId);
      if (itemResult.ok && itemResult.value.originalUrl) {
        void chrome.tabs.create({ url: itemResult.value.originalUrl });
      }
    })();
  }
  if (notificationId.startsWith("reminder:habit:")) {
    void openPage("queue.html");
  }
});
