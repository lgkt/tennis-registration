<template>
  <div class="min-h-screen bg-[#f5f7f0]">
    <div class="max-w-md mx-auto px-4 py-6">
      <div class="text-center mb-8">
        <div class="w-16 h-16 bg-[#2D8A4E] rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-[#2D8A4E] tracking-wide">网球课报名</h1>
        <p class="text-gray-500 text-sm mt-1">每周一 9:00 开放当周报名</p>
      </div>

      <div v-if="loading" class="text-center py-12">
        <div class="w-10 h-10 border-4 border-[#2D8A4E] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p class="text-gray-400 mt-4">加载中...</p>
      </div>

      <template v-else>
        <div v-if="!isOpen" class="bg-white rounded-2xl shadow-sm p-8 text-center">
          <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 class="text-lg font-semibold text-gray-700 mb-2">报名暂未开放</h2>
          <p class="text-gray-400 text-sm">开放时间：每周一 9:00（北京时间）</p>
          <div v-if="nextOpenTime" class="mt-4 text-sm text-gray-500">
            距离开放还有
            <span class="text-[#2D8A4E] font-semibold">{{ countdown }}</span>
          </div>
        </div>

        <template v-else>
          <div class="grid grid-cols-2 gap-3 mb-6">
            <div
              :class="[
                'relative rounded-2xl p-4 text-center transition-all duration-300',
                status.tuesday >= 10
                  ? 'bg-gray-100 opacity-60'
                  : 'bg-white shadow-sm border-2 border-transparent hover:border-[#2D8A4E]/30'
              ]"
            >
              <div class="text-xs text-gray-400 mb-1">周二</div>
              <div class="text-xs text-gray-300 mb-2">{{ weekDates.tuesday }}</div>
              <div class="text-3xl font-bold" :class="status.tuesday >= 10 ? 'text-gray-400' : 'text-[#2D8A4E]'">
                {{ status.tuesday }}
              </div>
              <div class="text-xs text-gray-400 mt-1">/ 10 人</div>
              <div v-if="status.tuesday >= 10" class="absolute -top-2 -right-2 bg-[#F5A623] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                已满
              </div>
              <div
                v-else
                class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-[#2D8A4E] rounded-full transition-all duration-500"
                  :style="{ width: `${(status.tuesday / 10) * 100}%` }"
                ></div>
              </div>
            </div>

            <div
              :class="[
                'relative rounded-2xl p-4 text-center transition-all duration-300',
                status.wednesday >= 10
                  ? 'bg-gray-100 opacity-60'
                  : 'bg-white shadow-sm border-2 border-transparent hover:border-[#2D8A4E]/30'
              ]"
            >
              <div class="text-xs text-gray-400 mb-1">周三</div>
              <div class="text-xs text-gray-300 mb-2">{{ weekDates.wednesday }}</div>
              <div class="text-3xl font-bold" :class="status.wednesday >= 10 ? 'text-gray-400' : 'text-[#2D8A4E]'">
                {{ status.wednesday }}
              </div>
              <div class="text-xs text-gray-400 mt-1">/ 10 人</div>
              <div v-if="status.wednesday >= 10" class="absolute -top-2 -right-2 bg-[#F5A623] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                已满
              </div>
              <div
                v-else
                class="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden"
              >
                <div
                  class="h-full bg-[#2D8A4E] rounded-full transition-all duration-500"
                  :style="{ width: `${(status.wednesday / 10) * 100}%` }"
                ></div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm p-6">
            <h2 class="text-base font-semibold text-gray-700 mb-4">填写报名信息</h2>

            <form @submit.prevent="handleSubmit">
              <div class="mb-4">
                <label class="block text-sm text-gray-500 mb-1.5">
                  姓名 <span class="text-red-400">*</span>
                </label>
                <input
                  v-model="form.name"
                  type="text"
                  placeholder="请输入姓名"
                  class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:border-[#2D8A4E] focus:ring-2 focus:ring-[#2D8A4E]/20 outline-none transition-all text-sm"
                />
                <p v-if="errors.name" class="text-red-400 text-xs mt-1">{{ errors.name }}</p>
              </div>

              <div class="mb-6">
                <label class="block text-sm text-gray-500 mb-1.5">
                  上课日 <span class="text-red-400">*</span>
                </label>
                <div class="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    :disabled="status.tuesday >= 10"
                    @click="form.classDay = 'tuesday'"
                    :class="[
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                      form.classDay === 'tuesday'
                        ? 'border-[#2D8A4E] bg-[#2D8A4E]/5 text-[#2D8A4E]'
                        : status.tuesday >= 10
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#2D8A4E]/30'
                    ]"
                  >
                    <div>周二</div>
                    <div class="text-xs mt-0.5 opacity-70">{{ weekDates.tuesday }}</div>
                    <span v-if="status.tuesday >= 10" class="block text-xs mt-0.5">名额已满</span>
                  </button>
                  <button
                    type="button"
                    :disabled="status.wednesday >= 10"
                    @click="form.classDay = 'wednesday'"
                    :class="[
                      'py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all',
                      form.classDay === 'wednesday'
                        ? 'border-[#2D8A4E] bg-[#2D8A4E]/5 text-[#2D8A4E]'
                        : status.wednesday >= 10
                          ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-[#2D8A4E]/30'
                    ]"
                  >
                    <div>周三</div>
                    <div class="text-xs mt-0.5 opacity-70">{{ weekDates.wednesday }}</div>
                    <span v-if="status.wednesday >= 10" class="block text-xs mt-0.5">名额已满</span>
                  </button>
                </div>
                <p v-if="errors.classDay" class="text-red-400 text-xs mt-1">{{ errors.classDay }}</p>
              </div>

              <button
                type="submit"
                :disabled="submitting"
                :class="[
                  'w-full py-3.5 rounded-xl text-white font-semibold text-base transition-all',
                  submitting
                    ? 'bg-[#2D8A4E]/60 cursor-not-allowed'
                    : 'bg-[#2D8A4E] hover:bg-[#237a3f] active:scale-[0.98] shadow-lg shadow-[#2D8A4E]/20'
                ]"
              >
                <span v-if="submitting" class="flex items-center justify-center gap-2">
                  <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  提交中...
                </span>
                <span v-else>提交报名</span>
              </button>
            </form>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const loading = ref(true)
const isOpen = ref(false)
const nextOpenTime = ref('')
const submitting = ref(false)
const countdown = ref('')
let countdownTimer: ReturnType<typeof setInterval> | null = null

interface StatusData {
  tuesday: number
  wednesday: number
  isOpen: boolean
  nextOpenTime: string | null
}

const status = reactive<StatusData>({
  tuesday: 0,
  wednesday: 0,
  isOpen: false,
  nextOpenTime: null,
})

const form = reactive({
  name: '',
  classDay: '',
})

const errors = reactive({
  name: '',
  classDay: '',
})

const STORAGE_KEY = 'tennis_last_form'

function getWeekDates() {
  const now = new Date()
  const beijingOffset = 8 * 60
  const localOffset = now.getTimezoneOffset()
  const beijingTime = new Date(now.getTime() + (localOffset + beijingOffset) * 60 * 1000)

  const dayOfWeek = beijingTime.getDay()
  let daysToMonday: number
  if (dayOfWeek === 0) {
    daysToMonday = -6
  } else {
    daysToMonday = 1 - dayOfWeek
  }

  const monday = new Date(beijingTime)
  monday.setDate(monday.getDate() + daysToMonday)

  const tuesday = new Date(monday)
  tuesday.setDate(tuesday.getDate() + 1)

  const wednesday = new Date(monday)
  wednesday.setDate(wednesday.getDate() + 2)

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return {
    tuesday: fmt(tuesday),
    wednesday: fmt(wednesday),
  }
}

const weekDates = getWeekDates()

function loadLastForm() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const data = JSON.parse(saved)
      form.name = data.name || ''
      form.classDay = data.classDay || ''
    }
  } catch {
  }
}

function saveForm() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      name: form.name,
      classDay: form.classDay,
    }))
  } catch {
  }
}

function validate(): boolean {
  let valid = true
  errors.name = ''
  errors.classDay = ''

  if (!form.name.trim()) {
    errors.name = '请输入姓名'
    valid = false
  }

  if (!form.classDay) {
    errors.classDay = '请选择上课日'
    valid = false
  }

  return valid
}

function updateCountdown() {
  if (!nextOpenTime.value) return
  const now = new Date()
  const target = new Date(nextOpenTime.value)
  const diff = target.getTime() - now.getTime()

  if (diff <= 0) {
    countdown.value = '即将开放'
    return
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  const parts: string[] = []
  if (days > 0) parts.push(`${days}天`)
  parts.push(`${String(hours).padStart(2, '0')}时${String(minutes).padStart(2, '0')}分${String(seconds).padStart(2, '0')}秒`)
  countdown.value = parts.join(' ')
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status')
    const data = await res.json()
    status.tuesday = data.tuesday
    status.wednesday = data.wednesday
    isOpen.value = data.isOpen
    nextOpenTime.value = data.nextOpenTime || ''

    if (data.nextOpenTime) {
      updateCountdown()
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = setInterval(updateCountdown, 1000)
    }
  } catch {
  } finally {
    loading.value = false
  }
}

async function handleSubmit() {
  if (!validate()) return

  submitting.value = true
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name.trim(),
        classDay: form.classDay,
      }),
    })

    const data = await res.json()

    if (data.success) {
      saveForm()
      router.push({
        path: '/success',
        query: {
          name: form.name.trim(),
          classDay: form.classDay,
        },
      })
    } else {
      errors.name = data.message || '报名失败，请重试'
    }
  } catch {
    errors.name = '网络错误，请稍后重试'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadLastForm()
  fetchStatus()
})

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>