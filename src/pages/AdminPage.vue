<template>
  <div class="min-h-screen bg-[#f5f7f0]">
    <div class="max-w-4xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-bold text-[#2D8A4E]">报名管理</h1>
          <p class="text-sm text-gray-400 mt-0.5">网球课报名记录管理</p>
        </div>
        <div class="flex items-center gap-3">
          <select
            v-model="selectedWeek"
            @change="fetchRegistrations"
            class="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-600 outline-none focus:border-[#2D8A4E]"
          >
            <option v-for="w in availableWeeks" :key="w" :value="w">{{ w }}</option>
          </select>
          <button
            @click="goExport"
            class="px-4 py-2 rounded-lg bg-[#2D8A4E] text-white text-sm font-medium hover:bg-[#237a3f] transition-all"
          >
            导出报名列表
          </button>
          <button
            @click="goHome"
            class="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 transition-all"
          >
            返回报名
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="w-8 h-8 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>

      <template v-else>
        <div class="flex gap-4 mb-4">
          <div class="bg-white rounded-xl px-5 py-3 shadow-sm flex-1">
            <div class="text-xs text-gray-400">周二报名</div>
            <div class="text-xl font-bold text-[#2D8A4E]">{{ tuesdayCount }}<span class="text-sm text-gray-400 font-normal"> / 10</span></div>
          </div>
          <div class="bg-white rounded-xl px-5 py-3 shadow-sm flex-1">
            <div class="text-xs text-gray-400">周三报名</div>
            <div class="text-xl font-bold text-[#2D8A4E]">{{ wednesdayCount }}<span class="text-sm text-gray-400 font-normal"> / 10</span></div>
          </div>
          <div class="bg-white rounded-xl px-5 py-3 shadow-sm flex-1">
            <div class="text-xs text-gray-400">总报名</div>
            <div class="text-xl font-bold text-[#2D8A4E]">{{ totalCount }}<span class="text-sm text-gray-400 font-normal"> / 20</span></div>
          </div>
        </div>

        <div v-if="registrations.length === 0" class="bg-white rounded-2xl shadow-sm p-12 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p class="text-gray-400 text-sm">本周暂无报名记录</p>
        </div>

        <div v-else class="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="border-b border-gray-100">
                <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">序号</th>
                <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">姓名</th>
                <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">上课日</th>
                <th class="text-left px-5 py-3 text-xs text-gray-400 font-medium">报名时间</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, index) in registrations"
                :key="r.id"
                class="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
              >
                <td class="px-5 py-3.5 text-sm text-gray-400">{{ index + 1 }}</td>
                <td class="px-5 py-3.5 text-sm text-gray-700">{{ r.name }}</td>
                <td class="px-5 py-3.5">
                  <span
                    :class="[
                      'inline-block px-2.5 py-1 rounded-full text-xs font-medium',
                      r.classDay === 'tuesday'
                        ? 'bg-[#2D8A4E]/10 text-[#2D8A4E]'
                        : 'bg-[#F5A623]/10 text-[#F5A623]'
                    ]"
                  >
                    {{ r.classDay === 'tuesday' ? '周二' : '周三' }}
                  </span>
                </td>
                <td class="px-5 py-3.5 text-sm text-gray-400">{{ r.createdAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(true)
const selectedWeek = ref('')
const registrations = ref<Array<{
  id: number
  name: string
  classDay: string
  createdAt: string
}>>([])

const availableWeeks = ref<string[]>([])

const tuesdayCount = computed(() =>
  registrations.value.filter(r => r.classDay === 'tuesday').length
)
const wednesdayCount = computed(() =>
  registrations.value.filter(r => r.classDay === 'wednesday').length
)
const totalCount = computed(() => registrations.value.length)

function getCurrentWeekKey(): string {
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  const weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function generateWeeks() {
  const weeks: string[] = []
  const current = getCurrentWeekKey()
  const [year, weekStr] = current.split('-W')
  let weekNum = parseInt(weekStr)

  for (let i = 3; i >= 0; i--) {
    let w = weekNum - i
    let y = parseInt(year)
    if (w < 1) {
      y--
      const endOfPrevYear = new Date(y, 11, 31)
      const startOfPrevYear = new Date(y, 0, 1)
      const days = Math.floor((endOfPrevYear.getTime() - startOfPrevYear.getTime()) / (24 * 60 * 60 * 1000))
      const totalWeeks = Math.ceil((days + startOfPrevYear.getDay() + 1) / 7)
      w = totalWeeks + w
    }
    weeks.push(`${y}-W${String(w).padStart(2, '0')}`)
  }
  availableWeeks.value = weeks
  selectedWeek.value = current
}

async function fetchRegistrations() {
  loading.value = true
  try {
    const res = await fetch(`/api/registrations?week=${selectedWeek.value}`)
    const data = await res.json()
    registrations.value = data.registrations
  } catch {
  } finally {
    loading.value = false
  }
}

function goExport() {
  router.push('/export')
}

function goHome() {
  router.push('/')
}

onMounted(() => {
  generateWeeks()
  fetchRegistrations()
})
</script>