import { createRouter, createWebHistory } from 'vue-router'
import RegistrationPage from '@/pages/RegistrationPage.vue'
import SuccessPage from '@/pages/SuccessPage.vue'
import AdminPage from '@/pages/AdminPage.vue'

const routes = [
  {
    path: '/',
    name: 'registration',
    component: RegistrationPage,
  },
  {
    path: '/success',
    name: 'success',
    component: SuccessPage,
  },
  {
    path: '/admin',
    name: 'admin',
    component: AdminPage,
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router