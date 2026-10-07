import type { App } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import Tooltip from 'primevue/tooltip'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const Editorial = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#f1f7f4',
      100: '#dcebe3',
      200: '#bbd8c9',
      300: '#91bca5',
      400: '#659b82',
      500: '#417960',
      600: '#315f4c',
      700: '#234e45',
      800: '#203f38',
      900: '#1c342f',
      950: '#0d1e1a',
    },
  },
})

export function configurePrimeVue(app: App) {
  app.use(PrimeVue, {
    locale: {
      emptyMessage: 'Nenhum resultado encontrado',
      aria: {
        firstPageLabel: 'Primeira página',
        lastPageLabel: 'Última página',
        nextPageLabel: 'Próxima página',
        prevPageLabel: 'Página anterior',
        rowsPerPageLabel: 'Linhas por página',
        pageLabel: 'Página {page}',
        selectLabel: 'Selecionar',
        unselectLabel: 'Desmarcar',
        close: 'Fechar',
      },
    },
    theme: { preset: Editorial, options: { darkModeSelector: false } },
  })
  app.use(ToastService)
  app.use(ConfirmationService)
  app.directive('tooltip', Tooltip)
}
