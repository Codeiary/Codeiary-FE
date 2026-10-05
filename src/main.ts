import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { initializeTheme } from "./theme";
import "./style.css";
import "./admin.css";
import "./theme.css";

initializeTheme();
createApp(App).use(router).mount("#app");
