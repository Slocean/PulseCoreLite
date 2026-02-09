import { createRouter, createWebHashHistory } from "vue-router";

import DashboardPage from "../pages/DashboardPage.vue";
import NetworkSpecsPage from "../pages/NetworkSpecsPage.vue";
import HardwareOverviewPage from "../pages/HardwareOverviewPage.vue";
import SettingsPage from "../pages/SettingsPage.vue";
import CompactOverlayPage from "../pages/CompactOverlayPage.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", component: DashboardPage },
    { path: "/network", component: NetworkSpecsPage },
    { path: "/hardware", component: HardwareOverviewPage },
    { path: "/settings", component: SettingsPage },
    { path: "/overlay", component: CompactOverlayPage }
  ]
});

export default router;
