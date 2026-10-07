import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { configurePrimeVue } from './primevue'
import 'primeicons/primeicons.css'
import '../styles/tokens.css'
import '../styles/global.css'

const app = createApp(App)
app.use(createPinia())
configurePrimeVue(app)
app.mount('#app')
