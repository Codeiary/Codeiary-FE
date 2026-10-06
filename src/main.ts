import { createApp } from "vue";
import App from "@/App.vue";
import router from "@/router/index";
import { initializeTheme } from "@/composables/useTheme";
import "@/assets/styles/app.css";
import "@/assets/styles/admin.css";
import "@/assets/styles/theme.css";

initializeTheme();
createApp(App).use(router).mount("#app");
